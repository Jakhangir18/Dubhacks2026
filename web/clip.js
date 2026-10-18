// Only the Phaser canvas is accepted. No camera, microphone or display capture.
// Two staggered, complete recordings retain 10–20 seconds (about 15 on average).
// Arbitrarily dropping WebM chunks would discard headers/keyframes and break playback.
const WINDOW_MS = 10000;
const MAX_BYTES = 30 * 1024 * 1024;

export class WalkClip {
  start(canvas, audioStream) {
    this.cancel();
    try {
      if (!canvas.captureStream || !window.MediaRecorder) return false;
      // VP8 first: lower encoding cost alongside pose estimation, 15 fps is plenty here.
      this.mime = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
        .find((type) => MediaRecorder.isTypeSupported(type));
      if (!this.mime) return false;
      this.stream = canvas.captureStream(15);
      if (audioStream) for (const track of audioStream.getAudioTracks()) this.stream.addTrack(track.clone());
      this.windows = [];
      this.rotate();
      this.timer = setInterval(() => {
        try { this.rotate(); } catch { this.cancel(); }
      }, WINDOW_MS);
      return true;
    } catch { this.cancel(); return false; }
  }

  rotate() {
    if (this.windows.length === 2) this.stopWindow(this.windows.shift(), true);
    const recorder = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 1000000, audioBitsPerSecond: 64000 });
    const entry = { recorder, chunks: [], size: 0, discarded: false };
    entry.done = new Promise((resolve) => {
      recorder.ondataavailable = ({ data }) => {
        if (entry.discarded) return;
        entry.size += data.size;
        if (entry.size > MAX_BYTES) { entry.discarded = true; entry.chunks = []; this.cancel(); return; }
        if (data.size) entry.chunks.push(data);
      };
      recorder.onerror = () => { entry.discarded = true; this.cancel(); };
      recorder.onstop = () => {
        resolve(entry.discarded || !entry.size ? null : new Blob(entry.chunks, { type: recorder.mimeType }));
        entry.chunks = [];
      };
    });
    this.windows.push(entry);
    recorder.start(1000);
  }

  stopWindow(entry, discard = false) {
    entry.discarded ||= discard;
    if (discard) entry.chunks = [];
    if (entry.recorder.state !== 'inactive') entry.recorder.stop();
  }

  async finish() {
    clearInterval(this.timer);
    const entries = this.windows || [];
    this.windows = [];
    // The older live window includes the arrival, with no concatenation or re-encoding.
    entries.forEach((entry, i) => this.stopWindow(entry, i > 0));
    const blob = entries.length ? await entries[0].done : null;
    this.release();
    return blob;
  }

  release() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
  }

  cancel() {
    clearInterval(this.timer);
    this.windows?.forEach((entry) => this.stopWindow(entry, true));
    this.windows = [];
    this.release();
  }
}

export async function uploadClip(blob, signal) {
  const response = await fetch('/api/clip', { method: 'POST', headers: { 'content-type': blob.type }, body: blob, signal });
  if (!response.ok) throw new Error('Clip upload failed');
  const { url } = await response.json();
  const qr = await fetch(`/api/qr?url=${encodeURIComponent(url)}`, { signal });
  if (!qr.ok) throw new Error('QR unavailable');
  const objectURL = URL.createObjectURL(await qr.blob());
  try {
    const image = new Image();
    image.src = objectURL;
    await image.decode();
    return { url, image };
  } finally { URL.revokeObjectURL(objectURL); }
}
