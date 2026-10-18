"""Feet detector utility: webcam in, foot boxes out. Local (YOLO-World), no person needed.

    from feet import FeetDetector, open_camera
    det = FeetDetector()
    cap = open_camera("USB")            # name substring, or index=N
    ok, frame = cap.read()
    for foot in det(frame):             # list[Foot], at most 2, sanity-filtered
        print(foot.cx, foot.cy, foot.conf)

Demo with live preview:  python feet.py --camera-name USB [--record]
Detector keeps a little state (recent foot sizes), so use one instance per camera stream.
"""
import argparse
import atexit
import base64
import collections
import http.client
import json
import statistics
import threading
import time
import urllib.parse
from dataclasses import dataclass

import cv2

MODEL = "models/yolov8s-worldv2.pt"  # downloaded on first use (~340 MB)


@dataclass
class Foot:
    x1: int
    y1: int
    x2: int
    y2: int
    conf: float
    label: str

    @property
    def cx(self): return (self.x1 + self.x2) // 2

    @property
    def cy(self): return (self.y1 + self.y2) // 2

    @property
    def area(self): return (self.x2 - self.x1) * (self.y2 - self.y1)


def filter_feet(dets, frame_area, areas, max_area=0.15, max_boxes=2):
    """Split dets into (kept, rejected): drops huge, odd-shaped, off-size boxes and extras.
    `areas` is a deque of recent kept areas; it is updated in place."""
    kept, rejected = [], []
    typical = statistics.median(areas) if len(areas) >= 5 else None
    for d in sorted(dets, key=lambda d: -d.conf):
        w, h = d.x2 - d.x1, d.y2 - d.y1
        bad = (
            d.area > max_area * frame_area
            or not 0.25 <= w / max(h, 1) <= 4
            or (typical and not 0.2 * typical <= d.area <= 2.5 * typical)
            or len(kept) >= max_boxes
        )
        (rejected if bad else kept).append(d)
    areas.extend(d.area for d in kept)
    return kept, rejected


FIELD_W, FIELD_H, HIT_LINE = 720, 1280, 0.54   # the game field (web/warp.js FIELD) and its hit line (web/game.js floorLayout)


def belt_polygon(h):
    """Camera-picture fractions of the field's belt part, from the camera-to-field homography h (8 numbers)."""
    a, b, c, d, e, f, g, k = h
    m = [[a, b, c], [d, e, f], [g, k, 1.0]]
    det = (m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
           + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]))
    if abs(det) < 1e-12:
        return None
    inv = [[(m[1][1] * m[2][2] - m[1][2] * m[2][1]) / det, (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / det, (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / det],
           [(m[1][2] * m[2][0] - m[1][0] * m[2][2]) / det, (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / det, (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / det],
           [(m[1][0] * m[2][1] - m[1][1] * m[2][0]) / det, (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / det, (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / det]]
    out = []
    for u, v in [(0, HIT_LINE * FIELD_H), (FIELD_W, HIT_LINE * FIELD_H), (FIELD_W, FIELD_H), (0, FIELD_H)]:
        w = inv[2][0] * u + inv[2][1] * v + inv[2][2]
        out.append([(inv[0][0] * u + inv[0][1] * v + inv[0][2]) / w, (inv[1][0] * u + inv[1][1] * v + inv[1][2]) / w])
    return out


class BlobDetector:
    """Fallback for a dark room: white socks or light shoes on a black belt are the brightest filled blobs.
    Returns Foot boxes like FeetDetector; used when the model finds nothing (or alone with --blobs-only)."""

    def __init__(self, min_frac=0.002, max_frac=0.14, fill=0.45, label="blob"):   # a sock with its lit shin can be a tall column; the chevrons are under 0.1 %
        self.min_frac, self.max_frac, self.fill, self.label = min_frac, max_frac, fill, label
        self.threshold = 0
        self.marks = []   # [colour, cx, cy, w, h] fractions: a foot lit by a projected mark, seen on the last call
        self.zone = None   # polygon of the projected zone, fractions of the frame; outside it nothing counts (console, walls)

    def __call__(self, frame):
        import numpy as np
        self.marks = []
        if self.zone is None:
            return []   # without the calibrated zone the console and the walls would count as feet
        gray = cv2.GaussianBlur(cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (7, 7), 0)
        hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        if self.zone is not None:
            h, w = gray.shape
            keep = np.zeros_like(gray)
            cv2.fillPoly(keep, [np.array([[int(x * w), int(y * h)] for x, y in self.zone], dtype="int32")], 255)
            gray = cv2.bitwise_and(gray, keep)
        top = float(np.percentile(gray, 99.5))          # the brightest pixels set the bar, so exposure does not matter
        self.threshold = max(120, int(top * 0.6))        # the lit black belt stays below 120 even through the gamma curve
        mask = (gray >= self.threshold).astype("uint8")
        # A foot standing on a coloured mark the game projects under a flower (cyan) or a seed (magenta) lights up in that
        # colour: a bright, saturated blob of that hue is a hit the camera saw itself.
        hue, sat = hsv[:, :, 0], hsv[:, :, 1]
        for name, lo, hi in (("cyan", 85, 105), ("magenta", 140, 170)):
            m = ((gray >= self.threshold) & (sat > 90) & (hue >= lo) & (hue <= hi)).astype("uint8")
            m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((5, 5), "uint8"))
            for c in cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)[0]:
                x, y, w, h = cv2.boundingRect(c)
                if w * h >= 0.001 * frame.shape[0] * frame.shape[1]:
                    self.marks.append([name, (x + w / 2) / frame.shape[1], (y + h / 2) / frame.shape[0], w / frame.shape[1], h / frame.shape[0]])
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), "uint8"))
        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        area = frame.shape[0] * frame.shape[1]
        out = []
        for c in contours:
            x, y, w, h = cv2.boundingRect(c)
            if not self.min_frac * area <= w * h <= self.max_frac * area or not 0.3 <= w / max(h, 1) <= 3.3:
                continue
            filled = float(mask[y:y + h, x:x + w].mean())   # a projected ring or outline is hollow; a sock is solid
            if filled < self.fill:
                continue
            out.append(Foot(x, y, x + w, y + h, min(0.99, filled), self.label))
        out.sort(key=lambda f: -f.area)
        return out[:2]


class FeetDetector:
    def __init__(self, classes=("shoe", "foot"), conf=0.15, max_area=0.15, max_boxes=2):
        import torch
        from ultralytics import YOLOWorld
        self.model = YOLOWorld(MODEL)
        self.model.set_classes(list(classes))
        self.device = "mps" if torch.backends.mps.is_available() else "cpu"
        self.conf, self.max_area, self.max_boxes = conf, max_area, max_boxes
        self.areas = collections.deque(maxlen=30)
        self.rejected = []  # boxes dropped on the last call, handy for debugging

    def __call__(self, frame):
        """frame: BGR numpy array. Returns list[Foot] sorted by confidence."""
        r = self.model.predict(frame, conf=self.conf, device=self.device, agnostic_nms=True, verbose=False)[0]
        dets = [Foot(*map(int, b), c, r.names[int(k)])
                for b, c, k in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist())]
        kept, self.rejected = filter_feet(dets, frame.shape[0] * frame.shape[1], self.areas, self.max_area, self.max_boxes)
        return kept


class ShoeSender:
    """Posts each frame's shoe boxes to the game server (/api/events, kind "shoes") from a background thread.
    Keeps one connection open; a frame that arrives while the last one is still in flight is dropped, never queued."""

    def __init__(self, server, source="feet"):
        u = urllib.parse.urlsplit(server)
        if u.scheme not in ("http", "https") or not u.hostname:
            raise SystemExit(f"--server needs a full URL like https://host:8443, got {server!r}")
        self.https = u.scheme == "https"
        self.host, self.port = u.hostname, u.port or (443 if self.https else 80)
        self.source = source
        self.conn = None
        self.pending = None
        self.frame = None   # the newest preview frame waits in its own slot, so a busy connection never loses it
        self.marks = None   # the newest foot-on-mark sightings, likewise
        self.lock = threading.Condition()
        self.listeners = None
        threading.Thread(target=self._run, daemon=True).start()

    def zone(self):
        """The belt part of the calibrated field (below the hit line) as camera fractions, or None.
        Feet are only ever there; the far part of the field lies over the console, whose lights are bright."""
        try:
            cls = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
            conn = cls(self.host, self.port, timeout=3)
            conn.request("GET", "/api/shoecal")
            h = json.loads(conn.getresponse().read()).get("h") or None
            conn.close()
            return belt_polygon(h) if h and len(h) == 8 else None
        except Exception:  # noqa: BLE001 - no calibration yet, or offline
            return None

    def preview(self, frame):
        """The newest picture alone, for a camera that finds no shoes (the side camera): the dashboard shows it."""
        self.send([], frame.shape[1], frame.shape[0], frame=frame)

    def send(self, boxes, w, h, frame=None, marks=None):
        event = {"kind": "shoes", "source": self.source,
                 "boxes": [[round(f.x1 / w, 4), round(f.y1 / h, 4), round(f.x2 / w, 4), round(f.y2 / h, 4), round(f.conf, 3)]
                           for f in boxes]}
        preview = None
        if frame is not None:   # a small JPEG of what the camera sees, for the calibration clicks in the browser
            scale = 480 / max(w, h)   # long side 480 px, portrait or landscape
            small = cv2.resize(frame, (max(1, round(w * scale)), max(1, round(h * scale))))
            ok, buf = cv2.imencode(".jpg", small, [cv2.IMWRITE_JPEG_QUALITY, 60])
            if ok:
                preview = {"kind": "frame", "source": self.source,
                           "jpeg": "data:image/jpeg;base64," + base64.b64encode(buf.tobytes()).decode()}
        with self.lock:
            self.pending = event
            if preview is not None:
                self.frame = preview
            if marks:
                self.marks = {"kind": "marks", "source": self.source, "marks": [[m[0]] + [round(v, 4) for v in m[1:]] for m in marks]}
            self.lock.notify()

    def _run(self):
        while True:
            with self.lock:
                while self.pending is None:
                    self.lock.wait()
                events = [self.pending] + ([self.marks] if self.marks is not None else []) + ([self.frame] if self.frame is not None else [])
                self.marks = None
                body, self.pending, self.frame = json.dumps({"events": events}), None, None
            try:
                if self.conn is None:
                    cls = http.client.HTTPSConnection if self.https else http.client.HTTPConnection
                    self.conn = cls(self.host, self.port, timeout=3)   # a frame batch over Wi-Fi can take a moment
                self.conn.request("POST", "/api/events", body=body, headers={"Content-Type": "application/json"})
                r = self.conn.getresponse()
                data = r.read()
                self.listeners = json.loads(data).get("listeners") if r.status == 200 else None
            except Exception:  # noqa: BLE001 - a bad reply must not kill the sender thread; the next frame retries
                self.listeners = None
                if self.conn is not None:
                    self.conn.close()
                self.conn = None


def camera_names():
    """Camera names in the order OpenCV indexes them (macOS AVFoundation)."""
    import AVFoundation as av
    return [d.localizedName() for d in av.AVCaptureDevice.devicesWithMediaType_(av.AVMediaTypeVideo)]


def open_camera(name=None, index=None):
    """Open a webcam by name substring or index. Default: first non-iPhone camera.
    Handles the macOS permission prompt. Raises RuntimeError with a clear message on failure."""
    import AVFoundation as av
    kind = av.AVMediaTypeVideo
    if av.AVCaptureDevice.authorizationStatusForMediaType_(kind) == 0:  # not asked yet; OpenCV won't wait
        print("Click Allow in the macOS camera prompt...")
        done = threading.Event()
        av.AVCaptureDevice.requestAccessForMediaType_completionHandler_(kind, lambda ok: done.set())
        done.wait(60)
    if av.AVCaptureDevice.authorizationStatusForMediaType_(kind) != 3:
        raise RuntimeError("Camera access denied: enable your terminal in System Settings > Privacy & Security > Camera, "
                           "then restart it.")
    names = camera_names()
    if index is None:
        # Continuity phones can steal the default; only pick one if asked for by name
        pool = [i for i, n in enumerate(names)
                if (name and name.lower() in n.lower()) or (not name and not any(s in n.lower() for s in ("iphone", "ipad")))]
        if not pool:
            raise RuntimeError(f"No matching camera. Available: {dict(enumerate(names))}")
        index = pool[0]
    cap = cv2.VideoCapture(index)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open camera {index}. Available: {dict(enumerate(names))}")
    print(f"Camera {index}: {names[index] if index < len(names) else '?'}")
    return cap


def main():
    p = argparse.ArgumentParser(description="Live feet detection demo (q to quit)")
    p.add_argument("--camera", type=int, help="camera index (overrides --camera-name)")
    p.add_argument("--camera-name", help="substring of camera name, e.g. USB")
    p.add_argument("--classes", default="shoe,foot,sock")
    p.add_argument("--blobs", action="store_true", help="dark room fallback: bright blobs count as feet when the model sees none")
    p.add_argument("--blobs-only", action="store_true", help="use only the bright-blob detector (white socks on a black belt)")
    p.add_argument("--conf", type=float, default=0.15)
    p.add_argument("--max-area", type=float, default=0.15, help="reject boxes above this fraction of the frame")
    p.add_argument("--record", action="store_true", help="save preview to clip_<time>.mp4 (saved even on q or Ctrl-C)")
    p.add_argument("--server", help="game server, e.g. https://host:8443: send each frame's shoe boxes to /api/events")
    p.add_argument("--no-preview", action="store_true", help="no window (headless)")
    p.add_argument("--rotate", type=int, default=0, choices=(0, 90, 180, 270),
                   help="rotate the camera picture clockwise before detection (a camera mounted on its side)")
    p.add_argument("--gamma", type=float, default=1.0,
                   help="brighten a dark picture before detection, e.g. 0.5 (1 = as the camera gives it)")
    args = p.parse_args()

    sender = ShoeSender(args.server) if args.server else None   # a bad URL fails here, before the model and the camera load
    det = FeetDetector(args.classes.split(","), args.conf, args.max_area) if not args.blobs_only else None
    blobs = BlobDetector() if args.blobs or args.blobs_only else None
    cap = open_camera(args.camera_name, args.camera)
    writer = None
    if args.record:
        path = time.strftime("clip_%Y%m%d_%H%M%S.mp4")
        size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        if args.rotate in (90, 270):
            size = (size[1], size[0])   # the clip holds the rotated frames
        writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), cap.get(cv2.CAP_PROP_FPS) or 30, size)
        atexit.register(writer.release)
        print("Recording to", path)

    rotation = {90: cv2.ROTATE_90_CLOCKWISE, 180: cv2.ROTATE_180, 270: cv2.ROTATE_90_COUNTERCLOCKWISE}.get(args.rotate)
    # A dark room (projector only): a gamma curve lifts the shoes out of the dark before the detector sees them.
    gamma_table = None
    if args.gamma > 0 and abs(args.gamma - 1.0) > 1e-3:
        import numpy as np
        gamma_table = np.array([min(255, round(255 * (i / 255) ** args.gamma)) for i in range(256)], dtype="uint8")
    times = []
    last_frame_sent = 0.0
    last_zone_check = 0.0
    zone_thread = None
    zone_thread_alive = lambda: zone_thread is not None and zone_thread.is_alive()
    if blobs and not sender:
        print("--blobs needs --server: the blob detector works inside the zone calibrated in the camera window")
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if rotation is not None:
            frame = cv2.rotate(frame, rotation)
        if gamma_table is not None:
            frame = cv2.LUT(frame, gamma_table)
        t0 = time.perf_counter()
        if blobs and sender and time.time() - last_zone_check > 5 and not zone_thread_alive():   # off the capture loop
            last_zone_check = time.time()
            zone_thread = threading.Thread(target=lambda: setattr(blobs, "zone", sender.zone()), daemon=True)
            zone_thread.start()
        feet = det(frame) if det else []
        marks = []
        if blobs:
            found = blobs(frame)   # also looks for a foot lit by a projected mark
            marks = blobs.marks
            if not feet:
                feet = found
        times.append(time.perf_counter() - t0)
        if sender:
            now = time.time()
            with_frame = now - last_frame_sent > 0.5   # two pictures a second are enough to click corners on
            if with_frame:
                last_frame_sent = now
            sender.send(feet, frame.shape[1], frame.shape[0], frame if with_frame else None, marks)
        for f in (det.rejected if det else []):
            cv2.rectangle(frame, (f.x1, f.y1), (f.x2, f.y2), (0, 0, 255), 1)
        for f in feet:
            cv2.rectangle(frame, (f.x1, f.y1), (f.x2, f.y2), (0, 255, 0), 2)
            cv2.putText(frame, f"{f.label} {f.conf:.2f}", (f.x1, max(f.y1 - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        link = "" if not sender else f" | game windows: {sender.listeners}" if sender.listeners is not None else " | server: no reply"
        cv2.putText(frame, f"{times[-1] * 1000:.0f} ms | {len(feet)} kept, {len(det.rejected) if det else 0} rejected{link}", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        if writer:
            writer.write(frame)
        if not args.no_preview:
            cv2.imshow("feet (q to quit)", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break
    cap.release()
    cv2.destroyAllWindows()
    if times:
        print(f"{len(times)} frames, median {statistics.median(times) * 1000:.0f} ms")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        raise SystemExit(e)
