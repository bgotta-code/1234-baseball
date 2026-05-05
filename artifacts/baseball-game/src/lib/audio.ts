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

// Create a noise buffer of given duration
function makeNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
  const bufLen = Math.floor(ctx.sampleRate * duration);
  const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Create a bandpass-filtered noise source
function noiseBand(
  ctx: AudioContext,
  duration: number,
  freq: number,
  q: number,
  startTime: number,
  stopTime: number,
): AudioNode {
  const src = ctx.createBufferSource();
  src.buffer = makeNoiseBuffer(ctx, duration);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = freq;
  bp.Q.value = q;
  src.connect(bp);
  src.start(startTime);
  src.stop(stopTime);
  return bp;
}

// Stadium reverb: multiple delay taps for a spacious feel
function stadiumReverb(ctx: AudioContext, source: AudioNode, dryWet = 0.45): AudioNode {
  const out = ctx.createGain();
  out.gain.value = 1;

  const dryG = ctx.createGain();
  dryG.gain.value = 1 - dryWet;
  source.connect(dryG);
  dryG.connect(out);

  // Stadium echoes: early reflections + late reverb taps
  const taps = [
    { time: 0.035, g: 0.38 },
    { time: 0.07, g: 0.28 },
    { time: 0.12, g: 0.2 },
    { time: 0.2, g: 0.14 },
    { time: 0.32, g: 0.09 },
    { time: 0.5, g: 0.06 },
    { time: 0.75, g: 0.04 },
  ];

  taps.forEach(({ time, g }) => {
    const delay = ctx.createDelay(1.0);
    delay.delayTime.value = time;
    const tapG = ctx.createGain();
    tapG.gain.value = g * dryWet;
    // Light low-pass per tap (air absorption at distance)
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6000 - time * 6000;
    source.connect(delay);
    delay.connect(lp);
    lp.connect(tapG);
    tapG.connect(out);
  });

  return out;
}

// Multi-band crowd noise — sounds like actual crowd of people
function makeCrowdNoise(
  ctx: AudioContext,
  duration: number,
  intensity: number,
  startTime: number,
): AudioNode {
  const master = ctx.createGain();
  master.gain.value = 0.001;

  // Low rumble — crowd moving, stadium structure (80–220 Hz)
  const band1 = noiseBand(ctx, duration, 140, 0.7, startTime, startTime + duration);
  const g1 = ctx.createGain(); g1.gain.value = intensity * 0.35;
  band1.connect(g1); g1.connect(master);

  // Voice fundamental range — crowd chatter (280–600 Hz)
  const band2 = noiseBand(ctx, duration, 420, 1.1, startTime, startTime + duration);
  const g2 = ctx.createGain(); g2.gain.value = intensity * 0.45;
  band2.connect(g2); g2.connect(master);

  // Voice first formant — "aaah" sound (800–1400 Hz)
  const band3 = noiseBand(ctx, duration, 1050, 1.8, startTime, startTime + duration);
  const g3 = ctx.createGain(); g3.gain.value = intensity * 0.3;
  band3.connect(g3); g3.connect(master);

  // Excitement/sibilance (2000–4500 Hz)
  const band4 = noiseBand(ctx, duration, 3000, 2.2, startTime, startTime + duration);
  const g4 = ctx.createGain(); g4.gain.value = intensity * 0.18;
  band4.connect(g4); g4.connect(master);

  // Very high fizz — clapping, whistles (6000–10000 Hz)
  const band5 = noiseBand(ctx, duration, 7500, 2.0, startTime, startTime + duration);
  const g5 = ctx.createGain(); g5.gain.value = intensity * 0.1;
  band5.connect(g5); g5.connect(master);

  return master;
}

// Add "individual voices" to the crowd — random short oscillator bursts
function addVoiceBursts(ctx: AudioContext, count: number, startTime: number, duration: number, dest: AudioNode) {
  for (let i = 0; i < count; i++) {
    const t = startTime + Math.random() * duration * 0.7;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    // Random voice pitch: male 90-180Hz, female 165-260Hz
    const isMale = Math.random() > 0.45;
    const baseFreq = isMale ? 90 + Math.random() * 90 : 165 + Math.random() * 95;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * (0.85 + Math.random() * 0.35), t + 0.3);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.035 + Math.random() * 0.02, t + 0.05);
    gain.gain.linearRampToValueAtTime(0.02, t + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4 + Math.random() * 0.3);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + 0.8);
  }
}

export function playSwoosh() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const bufLen = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(3200, t);
    bp.frequency.exponentialRampToValueAtTime(350, t + 0.22);
    bp.Q.value = 1.0;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.28, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    src.connect(bp); bp.connect(gain); gain.connect(ctx.destination);
    src.start(t); src.stop(t + 0.25);
  } catch (e) {}
}

export function playBatCrack(intensity: number) {
  try {
    const ctx = getCtx(), t = ctx.currentTime;

    // Initial crack transient (very sharp)
    const crackBuf = makeNoiseBuffer(ctx, 0.04);
    const crackSrc = ctx.createBufferSource(); crackSrc.buffer = crackBuf;
    const crackBp = ctx.createBiquadFilter(); crackBp.type = 'bandpass';
    crackBp.frequency.value = 3000 + intensity * 600; crackBp.Q.value = 0.6;
    const crackG = ctx.createGain();
    crackG.gain.setValueAtTime(1.2, t);
    crackG.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    crackSrc.connect(crackBp); crackBp.connect(crackG); crackG.connect(ctx.destination);
    crackSrc.start(t); crackSrc.stop(t + 0.05);

    // Body resonance (wood/aluminum) — decaying tone
    const bodyBuf = makeNoiseBuffer(ctx, 0.18);
    const bodySrc = ctx.createBufferSource(); bodySrc.buffer = bodyBuf;
    const bodyBp = ctx.createBiquadFilter(); bodyBp.type = 'bandpass';
    bodyBp.frequency.value = 1100 + intensity * 300; bodyBp.Q.value = 1.8;
    const bodyG = ctx.createGain();
    bodyG.gain.setValueAtTime(0.5, t + 0.005);
    bodyG.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    bodySrc.connect(bodyBp); bodyBp.connect(bodyG); bodyG.connect(ctx.destination);
    bodySrc.start(t + 0.005); bodySrc.stop(t + 0.2);

    // Ball impact thud — low frequency thump
    const osc = ctx.createOscillator(), tg = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200 + intensity * 25, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.2);
    tg.gain.setValueAtTime(0.7, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(tg); tg.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.25);
  } catch (e) {}
}

export function playCrowdRoar(intensity: number, delay: number) {
  try {
    const ctx = getCtx();
    const duration = 2.0 + intensity * 1.5;
    const startTime = ctx.currentTime + delay;

    const crowd = makeCrowdNoise(ctx, duration + 0.5, 1.0, startTime);
    const reverb = stadiumReverb(ctx, crowd, 0.5);
    reverb.connect(ctx.destination);

    // Add individual voices cheering
    addVoiceBursts(ctx, Math.floor(8 + intensity * 6), startTime, duration, ctx.destination);

    // Envelope the master crowd
    const envGain = ctx.createGain();
    crowd.connect(envGain);

    // Shape the volume envelope
    const masterGain = crowd as GainNode;
    masterGain.gain.setValueAtTime(0.001, startTime);
    masterGain.gain.linearRampToValueAtTime(0.42 + intensity * 0.12, startTime + 0.4);
    masterGain.gain.linearRampToValueAtTime(0.30 + intensity * 0.08, startTime + duration * 0.55);
    masterGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  } catch (e) {}
}

export function playCrowdGroan() {
  try {
    const ctx = getCtx();
    const duration = 1.4;
    const t = ctx.currentTime;

    // Multi-band noise shaped like a groan (descending)
    const crowd = makeCrowdNoise(ctx, duration, 0.7, t);
    const reverb = stadiumReverb(ctx, crowd, 0.4);
    reverb.connect(ctx.destination);

    // Groan envelope: quick swell then fade
    const master = crowd as GainNode;
    master.gain.setValueAtTime(0.001, t);
    master.gain.linearRampToValueAtTime(0.28, t + 0.18);
    master.gain.linearRampToValueAtTime(0.2, t + 0.6);
    master.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Descending "ohhh" voices (crowd expressing disappointment)
    for (let v = 0; v < 10; v++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const det = (Math.random() - 0.5) * 50;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(340 + det, t + 0.04);
      osc.frequency.linearRampToValueAtTime(195 + det * 0.6, t + 1.0);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.05 + Math.random() * 0.02, t + 0.1);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.6);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.3);
    }

    addVoiceBursts(ctx, 4, t + 0.1, 0.8, ctx.destination);
  } catch (e) {}
}

export function playCrowdCheer() {
  try {
    const ctx = getCtx();
    const duration = 1.5;
    const t = ctx.currentTime;

    // Multi-band noise
    const crowd = makeCrowdNoise(ctx, duration, 0.85, t);
    const reverb = stadiumReverb(ctx, crowd, 0.48);
    reverb.connect(ctx.destination);

    const master = crowd as GainNode;
    master.gain.setValueAtTime(0.001, t);
    master.gain.linearRampToValueAtTime(0.32, t + 0.12);
    master.gain.linearRampToValueAtTime(0.25, t + 0.7);
    master.gain.exponentialRampToValueAtTime(0.001, t + duration);

    // Rising "yeaah" voices (crowd cheering)
    for (let v = 0; v < 8; v++) {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      const det = (Math.random() - 0.5) * 65;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(230 + det, t);
      osc.frequency.linearRampToValueAtTime(380 + det, t + 0.3);
      osc.frequency.linearRampToValueAtTime(320 + det * 0.5, t + 0.7);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.025, t + 0.08);
      gain.gain.linearRampToValueAtTime(0.04, t + 0.5);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 1.1);
    }

    addVoiceBursts(ctx, 5, t, 0.6, ctx.destination);
  } catch (e) {}
}

export function playGloveThud() {
  try {
    const ctx = getCtx(), t = ctx.currentTime;

    // Low thump
    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.14);
    og.gain.setValueAtTime(0.6, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.16);

    // Impact noise burst
    const noiseBuf = makeNoiseBuffer(ctx, 0.1);
    const nSrc = ctx.createBufferSource(); nSrc.buffer = noiseBuf;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 380;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.55, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    nSrc.connect(lp); lp.connect(ng); ng.connect(ctx.destination);
    nSrc.start(t); nSrc.stop(t + 0.12);
  } catch (e) {}
}

export function playHomeRunFanfare() {
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.28);
    });
  } catch (e) {}
}

// Ambient stadium murmur (background noise)
let ambientNode: GainNode | null = null;
export function startAmbientMurmur() {
  try {
    const ctx = getCtx();
    if (ambientNode) return;
    const duration = 30;
    const t = ctx.currentTime;
    const crowd = makeCrowdNoise(ctx, duration, 0.25, t);
    const reverb = stadiumReverb(ctx, crowd, 0.5);
    const out = ctx.createGain();
    out.gain.value = 0.18;
    reverb.connect(out);
    out.connect(ctx.destination);
    const master = crowd as GainNode;
    master.gain.setValueAtTime(0.001, t);
    master.gain.linearRampToValueAtTime(1, t + 2);
    ambientNode = out;
  } catch (e) {}
}

export function playHitSound(dist: number) {
  playBatCrack(dist);
  if (dist === 4) { playHomeRunFanfare(); playCrowdRoar(4, 0.18); }
  else playCrowdRoar(dist, 0.12);
}

export function playOutSound(half: number) {
  playGloveThud();
  if (half === 0) playCrowdCheer();
  else playCrowdGroan();
}
