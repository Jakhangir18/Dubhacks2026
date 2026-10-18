// Local synthesis only. Timers schedule short notes; nothing runs in the render loop.
const MELODY = [523.25, 659.25, 783.99, 659.25, 587.33, 0, 659.25, 523.25];
const BASS = [130.81, 130.81, 146.83, 98];

export class GardenSound {
  constructor(store) {
    this.store = store;
    this.enabled = store.get('zombiewalk.sound', true);
    this.musicWanted = false;
    this.ducked = false;
    this.beat = 0;
  }

  unlock() {
    try {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.master.gain.value = this.enabled ? 0.5 : 0;
        this.master.connect(this.context.destination);
        this.music = this.context.createGain();
        this.music.gain.value = this.ducked ? 0.2 : 1;
        this.music.connect(this.master);
        // Optional recording tap: failure must never disable the speakers.
        try {
          this.capture = this.context.createMediaStreamDestination();
          this.master.connect(this.capture);
        } catch { /* recording without audio is fine */ }
      }
      this.context.resume().then(() => this.syncMusic()).catch(() => {});
    } catch { /* audio is optional on devices without an output */ }
  }

  toggle() {
    this.enabled = !this.enabled;
    this.store.set('zombiewalk.sound', this.enabled);
    if (this.master) this.master.gain.setTargetAtTime(this.enabled ? 0.5 : 0, this.context.currentTime, 0.02);
    this.syncMusic();
  }

  duck(value) {
    this.ducked = value;
    if (this.music) this.music.gain.setTargetAtTime(value ? 0.2 : 1, this.context.currentTime, 0.08);
  }

  setMusic(value) { this.musicWanted = value; this.syncMusic(); }

  syncMusic() {
    const wanted = this.enabled && this.musicWanted && this.context?.state === 'running';
    if (!wanted) { clearInterval(this.timer); this.timer = null; return; }
    if (this.timer) return;
    this.timer = setInterval(() => {
      const beat = this.beat++ % MELODY.length;
      if (MELODY[beat]) this.tone(MELODY[beat], MELODY[beat], 0.24, 0.065, 'sine', 0, this.music);
      if (beat % 2 === 0) this.tone(BASS[beat / 2], BASS[beat / 2], 0.36, 0.07, 'triangle', 0, this.music);
    }, 420);
  }

  tone(from, to, duration, volume = 0.18, type = 'sine', delay = 0, output = this.master) {
    if (!this.enabled || this.context?.state !== 'running') return;
    const start = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const envelope = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    osc.frequency.exponentialRampToValueAtTime(to, start + duration);
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(volume, start + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(envelope); envelope.connect(output);
    osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
    osc.start(start); osc.stop(start + duration + 0.01);
  }

  play(name) {
    switch (name) {
      case 'step': this.tone(220, 110, 0.045, 0.13, 'triangle'); break;
      case 'high': this.tone(180, 720, 0.22, 0.14, 'triangle'); break;
      case 'stomp': this.tone(280, 65, 0.16, 0.24); break;
      case 'miss': this.tone(150, 90, 0.13, 0.1); break;
      case 'seed': this.tone(1100, 190, 0.18, 0.07, 'triangle'); break;
      case 'dodge':
        this.tone(784, 784, 0.18, 0.13);
        this.tone(1175, 1175, 0.24, 0.1, 'sine', 0.09);
        break;
      case 'act': case 'home': {
        const notes = name === 'home' ? [523, 659, 784, 1047, 784, 1047] : [392, 523, 659];
        notes.forEach((note, i) => this.tone(note, note, 0.22, 0.12, 'triangle', i * 0.13));
        break;
      }
    }
  }
}
