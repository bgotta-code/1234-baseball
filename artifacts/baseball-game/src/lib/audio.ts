// ── Audio context singleton ──────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let audioUnlocked = false;
let _muted = false;

export function isMuted() { return _muted; }
export function toggleMute() { _muted = !_muted; return _muted; }

export function unlockAudio() {
  if (audioUnlocked) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const buf = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
    const src = audioCtx.createBufferSource();
    src.buffer = buf; src.connect(audioCtx.destination); src.start(0);
    audioUnlocked = true;
  } catch (_) {}
}

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// ── Short noise buffer (utility) ─────────────────────────────────────────────
function noiseBuf(ctx: AudioContext, dur: number): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// ── Lightweight stadium reverb (delay taps) ───────────────────────────────────
function reverb(ctx: AudioContext, src: AudioNode, wet: number): AudioNode {
  const out = ctx.createGain();
  const dry = ctx.createGain(); dry.gain.value = 1 - wet * 0.5;
  src.connect(dry); dry.connect(out);
  [0.04, 0.09, 0.16, 0.27, 0.45].forEach((t, i) => {
    const d = ctx.createDelay(0.5); d.delayTime.value = t;
    const g = ctx.createGain(); g.gain.value = wet * (0.22 - i * 0.035);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 4000 - t * 6000;
    src.connect(d); d.connect(lp); lp.connect(g); g.connect(out);
  });
  return out;
}

// ── CROWD VOICE SYNTHESIS ────────────────────────────────────────────────────
//
//  Key insight: crowd noise should NOT be filtered noise (that sounds like steam).
//  Instead use sawtooth oscillators (voice-like harmonics) + bandpass formant
//  filters (vowel shape) + low-frequency AM modulation (syllabic rhythm).
//  Many detuned oscillators together = crowd.
//
function makeCrowdVoices(
  ctx: AudioContext,
  duration: number,
  startTime: number,
  type: 'cheer' | 'groan' | 'ambient',
  count: number,
): GainNode {
  const master = ctx.createGain();
  master.gain.value = 0; // caller sets envelope

  for (let i = 0; i < count; i++) {
    // Realistic voice pitch range
    const isMale = Math.random() > 0.4;
    const f0 = isMale ? 80 + Math.random() * 110 : 155 + Math.random() * 130;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; // sawtooth = rich harmonics like a real voice
    osc.frequency.value = f0;

    // Pitch contour per crowd type
    if (type === 'cheer') {
      // Rising "YEAAAH!" shape
      osc.frequency.setValueAtTime(f0 * 0.88, startTime);
      osc.frequency.exponentialRampToValueAtTime(f0 * 1.28, startTime + 0.38);
      osc.frequency.linearRampToValueAtTime(f0 * 1.08, startTime + duration);
    } else if (type === 'groan') {
      // Falling "awww" shape
      osc.frequency.setValueAtTime(f0 * 1.1, startTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(f0 * 0.78, startTime + duration);
    } else {
      // Ambient: slow drift
      osc.frequency.setValueAtTime(f0, startTime);
      osc.frequency.linearRampToValueAtTime(f0 * (0.96 + Math.random() * 0.08), startTime + duration);
    }

    // Formant filter — gives each voice a vowel character
    // "aaah" is ~700-1200 Hz, "ohh" is ~500-800 Hz
    const formantFreq = type === 'cheer'
      ? 650 + Math.random() * 650
      : type === 'groan'
        ? 450 + Math.random() * 350
        : 380 + Math.random() * 500;

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = formantFreq;
    formant.Q.value = 1.8 + Math.random() * 3.5;

    // Syllabic AM — LFO modulates gain making it sound like people talking/chanting
    // rather than a sustained drone. Rate 2–7 Hz = natural speech/chant rhythm.
    const lfoRate = 2.2 + Math.random() * 4.8;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = lfoRate;

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.22 + Math.random() * 0.22; // AM depth

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.4 + Math.random() * 0.3;

    // Wire AM: lfo → lfoDepth → voiceGain.gain (adds to base gain)
    lfo.connect(lfoDepth);
    lfoDepth.connect(voiceGain.gain);

    osc.connect(formant);
    formant.connect(voiceGain);
    voiceGain.connect(master);

    const end = startTime + duration + 0.2;
    lfo.start(startTime); lfo.stop(end);
    osc.start(startTime); osc.stop(end);
  }

  return master;
}

// ── CROWD EVENTS ─────────────────────────────────────────────────────────────

export function playCrowdCheer() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const dur = 2.0;
    const v = makeCrowdVoices(ctx, dur, t, 'cheer', 26);
    reverb(ctx, v, 0.42).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(0.058, t + 0.18);
    v.gain.linearRampToValueAtTime(0.045, t + 0.9);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

export function playCrowdRoar(intensity: number, delay: number) {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime + delay;
    const dur = 2.2 + intensity * 0.5;
    const count = 28 + Math.round(intensity * 6);
    const v = makeCrowdVoices(ctx, dur, t, 'cheer', count);
    reverb(ctx, v, 0.46).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(0.038 + intensity * 0.016, t + 0.22);
    v.gain.linearRampToValueAtTime(0.030 + intensity * 0.012, t + dur * 0.5);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

export function playCrowdGroan() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const dur = 1.7;
    const v = makeCrowdVoices(ctx, dur, t, 'groan', 22);
    reverb(ctx, v, 0.38).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(0.052, t + 0.14);
    v.gain.linearRampToValueAtTime(0.038, t + 0.65);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

// ── PITCH SOUND ──────────────────────────────────────────────────────────────
// Short descending tone + light air texture — ball leaving the pitcher's hand.
export function playSwoosh() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;

    // Descending "whomp" tone
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(130, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.018);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.26);

    // Very light air texture at ~2kHz (not hissy, just a touch)
    const nb = noiseBuf(ctx, 0.1);
    const ns = ctx.createBufferSource(); ns.buffer = nb;
    const nbp = ctx.createBiquadFilter(); nbp.type = 'bandpass';
    nbp.frequency.value = 2000; nbp.Q.value = 3;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.05, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    ns.connect(nbp); nbp.connect(ng); ng.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.12);
  } catch (_) {}
}

// ── BAT CRACK ────────────────────────────────────────────────────────────────
// Sharp impulse transient + wooden resonance tones + low ball thump.
export function playBatCrack(intensity: number) {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;

    // 1. Sharp crack impulse — very short noise burst, HIGH frequencies
    const imp = noiseBuf(ctx, 0.004);
    const impD = imp.getChannelData(0);
    for (let i = 0; i < impD.length; i++) impD[i] *= (1 - i / impD.length) * 2;
    const impSrc = ctx.createBufferSource(); impSrc.buffer = imp;
    const impHp = ctx.createBiquadFilter(); impHp.type = 'highpass';
    impHp.frequency.value = 2500;
    const impG = ctx.createGain(); impG.gain.value = 2.2;
    impSrc.connect(impHp); impHp.connect(impG); impG.connect(ctx.destination);
    impSrc.start(t); impSrc.stop(t + 0.008);

    // 2. Wooden bat resonant tones (tuned sine decays — like a struck wooden bar)
    const woodFreqs = [620, 980, 1540];
    woodFreqs.forEach((f, i) => {
      const wo = ctx.createOscillator(), wg = ctx.createGain();
      wo.type = 'sine';
      wo.frequency.value = f * (1 + intensity * 0.08);
      const decay = 0.09 - i * 0.025;
      wg.gain.setValueAtTime(0.48 / (i + 1), t + 0.001);
      wg.gain.exponentialRampToValueAtTime(0.001, t + 0.003 + decay);
      wo.connect(wg); wg.connect(ctx.destination);
      wo.start(t); wo.stop(t + 0.15);
    });

    // 3. Ball impact low thump — pitch drops like a struck membrane
    const thump = ctx.createOscillator(), tg = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(200 + intensity * 28, t);
    thump.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    tg.gain.setValueAtTime(0.85, t);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    thump.connect(tg); tg.connect(ctx.destination);
    thump.start(t); thump.stop(t + 0.2);
  } catch (_) {}
}

// ── GLOVE THUD (ball caught for an out) ──────────────────────────────────────
export function playGloveThud() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;

    const osc = ctx.createOscillator(), og = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.13);
    og.gain.setValueAtTime(0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(og); og.connect(ctx.destination);
    osc.start(t); osc.stop(t + 0.18);

    // Leather slap — narrow mid-freq noise
    const nb = noiseBuf(ctx, 0.06);
    const ns = ctx.createBufferSource(); ns.buffer = nb;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 600; bp.Q.value = 1.5;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.45, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    ns.connect(bp); bp.connect(ng); ng.connect(ctx.destination);
    ns.start(t); ns.stop(t + 0.08);
  } catch (_) {}
}

// ── HOME RUN FANFARE ─────────────────────────────────────────────────────────
export function playHomeRunFanfare() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.13;
      const osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = 'square'; osc.frequency.value = freq;
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.26);
    });
  } catch (_) {}
}

// ── HIGH-LEVEL HELPERS ───────────────────────────────────────────────────────
// half=0 → away batting (home team pitching); half=1 → home batting
// Home crowd cheers when home team benefits, groans otherwise.
export function playHitSound(dist: number, half: number) {
  if (_muted) return;
  playBatCrack(dist);
  if (half === 0) {
    // Away team hit — home crowd groans
    playCrowdGroan();
  } else {
    // Home team hit — home crowd cheers
    if (dist === 4) { playHomeRunFanfare(); playCrowdRoar(4, 0.2); }
    else playCrowdRoar(dist, 0.15);
  }
}

export function playOutSound(half: number) {
  if (_muted) return;
  playGloveThud();
  if (half === 0) playCrowdCheer(); // away out → home crowd cheers
  else playCrowdGroan();             // home out → home crowd groans
}
