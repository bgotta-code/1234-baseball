let audioCtx: AudioContext | null = null;
let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
    audioUnlocked = true;
  } catch (e) {}
}

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

export function playSwoosh() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.18);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3000, t);
    bp.frequency.exponentialRampToValueAtTime(400, t + 0.18);
    bp.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.2);
  } catch (e) {}
}

export function playBatCrack(intensity: number) {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.12);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 2200 + intensity * 400; bp.Q.value = 0.8;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.9, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    src.connect(bp); bp.connect(cg); cg.connect(ctx.destination);
    src.start(t); src.stop(t + 0.12);
    const osc = ctx.createOscillator(), tg = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180 + intensity * 20, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
    tg.gain.setValueAtTime(0.6, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    osc.connect(tg); tg.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.2);
  } catch (e) {}
}

export function playCrowdRoar(intensity: number, delay: number) {
  try {
    const ctx = getCtx();
    const duration = 1.5 + intensity * 1.2;
    const bufLen = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(2, bufLen, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch); let lp = 0;
      for (let i = 0; i < bufLen; i++) { lp = lp * 0.92 + (Math.random() * 2 - 1) * 0.08; d[i] = lp; }
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain();
    const t = ctx.currentTime + delay;
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.35 + intensity * 0.15, t + 0.3);
    gain.gain.linearRampToValueAtTime(0.25 + intensity * 0.1, t + duration * 0.5);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
    src.connect(hp); hp.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + duration);
  } catch (e) {}
}

export function playCrowdGroan() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    for (let v = 0; v < 6; v++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const det = (Math.random() - 0.5) * 40;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320 + det, t + 0.05);
      osc.frequency.linearRampToValueAtTime(200 + det * 0.5, t + 0.7);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.1);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.0);
    }
    const bufLen = Math.floor(ctx.sampleRate * 0.8);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0); let lp = 0;
    for (let i = 0; i < bufLen; i++) { lp = lp * 0.93 + (Math.random() * 2 - 1) * 0.07; d[i] = lp; }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.12, t + 0.15);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
    src.connect(ng); ng.connect(ctx.destination);
    src.start(t); src.stop(t + 0.85);
  } catch (e) {}
}

export function playCrowdCheer() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    for (let v = 0; v < 5; v++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const det = (Math.random() - 0.5) * 60;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(250 + det, t);
      osc.frequency.linearRampToValueAtTime(420 + det, t + 0.35);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.08);
      gain.gain.linearRampToValueAtTime(0.05, t + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.75);
    }
    const bufLen = Math.floor(ctx.sampleRate * 0.6);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.001, t);
    ng.gain.linearRampToValueAtTime(0.18, t + 0.1);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    src.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    src.start(t); src.stop(t + 0.65);
  } catch (e) {}
}

export function playGloveThud() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.15);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.15);
  } catch (e) {}
}

export function playHomeRunFanfare() {
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.18, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.25);
    });
  } catch (e) {}
}

export function playHitSound(dist: number) {
  playBatCrack(dist);
  if (dist === 4) { playHomeRunFanfare(); playCrowdRoar(4, 0.15); }
  else playCrowdRoar(dist, 0.1);
}

export function playOutSound(half: number) {
  playGloveThud();
  if (half === 0) playCrowdCheer();
  else playCrowdGroan();
}
