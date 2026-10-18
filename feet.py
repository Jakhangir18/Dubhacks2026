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
import collections
import statistics
import threading
import time
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
    p.add_argument("--classes", default="shoe,foot")
    p.add_argument("--conf", type=float, default=0.15)
    p.add_argument("--max-area", type=float, default=0.15, help="reject boxes above this fraction of the frame")
    p.add_argument("--record", action="store_true", help="save preview to clip_<time>.mp4 (saved even on q or Ctrl-C)")
    args = p.parse_args()

    det = FeetDetector(args.classes.split(","), args.conf, args.max_area)
    cap = open_camera(args.camera_name, args.camera)
    writer = None
    if args.record:
        path = time.strftime("clip_%Y%m%d_%H%M%S.mp4")
        size = (int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)), int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)))
        writer = cv2.VideoWriter(path, cv2.VideoWriter_fourcc(*"mp4v"), cap.get(cv2.CAP_PROP_FPS) or 30, size)
        atexit.register(writer.release)
        print("Recording to", path)

    times = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t0 = time.perf_counter()
        feet = det(frame)
        times.append(time.perf_counter() - t0)
        for f in det.rejected:
            cv2.rectangle(frame, (f.x1, f.y1), (f.x2, f.y2), (0, 0, 255), 1)
        for f in feet:
            cv2.rectangle(frame, (f.x1, f.y1), (f.x2, f.y2), (0, 255, 0), 2)
            cv2.putText(frame, f"{f.label} {f.conf:.2f}", (f.x1, max(f.y1 - 6, 12)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        cv2.putText(frame, f"{times[-1] * 1000:.0f} ms | {len(feet)} kept, {len(det.rejected)} rejected", (10, 25),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("feet (q to quit)", frame)
        if writer:
            writer.write(frame)
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
