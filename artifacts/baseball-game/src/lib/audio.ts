// ── Audio context singleton ──────────────────────────────────────────────────
let audioCtx: AudioContext | null = null;
let _muted = false;

export function isMuted() { return _muted; }
export function toggleMute() { _muted = !_muted; return _muted; }

// Close the suspended context and open a fresh one synchronously.
// iOS gives a running context immediately when called inside a user gesture.
// MUST only be called from within a real user-gesture event handler.
function recreateCtx() {
  try {
    if (audioCtx && audioCtx.state !== 'closed') void audioCtx.close();
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } catch (_) {}
}

// iOS Safari requires AudioContext to be both CREATED and USED (audio scheduled)
// within the same user-gesture call stack. Playing a 1-sample silent buffer
// satisfies the "used" requirement so the context stays running for subsequent calls.
function playSilentBuffer(ctx: AudioContext) {
  try {
    const buf = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
  } catch (_) {}
}

// Attach to touchend + click in CAPTURE phase so our handler fires before the
// element's own handler — the context is already running by the time any
// sound-playing code executes. touchend is more reliably treated as a user
// gesture for audio by iOS WebKit than touchstart.
if (typeof document !== 'undefined') {
  const handleGesture = () => {
    if (!audioCtx || audioCtx.state === 'closed') {
      try {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        // Must use the context in the same gesture call stack on iOS Safari
        playSilentBuffer(audioCtx);
      } catch (_) {}
    } else if (audioCtx.state === 'suspended') {
      recreateCtx();
      playSilentBuffer(audioCtx!);
    }
  };
  document.addEventListener('touchstart', handleGesture, { passive: true, capture: true });
  document.addEventListener('touchend', handleGesture, { passive: true, capture: true });
  document.addEventListener('click', handleGesture, { capture: true });
  // visibilitychange is NOT a user gesture on iOS — resume() only, no recreate.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && audioCtx?.state === 'suspended') {
      void audioCtx.resume();
    }
  });
}

// Must be called directly from a user-gesture handler (e.g. button onClick).
// Creates the AudioContext and plays a silent buffer so iOS Safari marks the
// context as unlocked for the entire session.
export function unlockAudio() {
  if (!audioCtx || audioCtx.state === 'closed') {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      playSilentBuffer(audioCtx);
    } catch (_) {}
    return;
  }
  if (audioCtx.state === 'suspended') {
    recreateCtx();
    playSilentBuffer(audioCtx!);
  } else {
    // Already running — play a silent buffer anyway to reinforce unlock on iOS
    playSilentBuffer(audioCtx);
  }
}

function getCtx(): AudioContext {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  } else if (audioCtx.state === 'suspended') {
    // handleGesture (capture) should have already recreated the context.
    // This is a last-resort fallback for sounds triggered outside a gesture.
    void audioCtx.resume();
  }
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

// dist 1–4 maps to single/double/triple/HR intensity
export function playCrowdRoar(dist: number, delay: number) {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime + delay;
    // Each step noticeably louder, longer, and denser
    const dur    = 1.8 + dist * 0.65;          // 2.45s → 4.4s
    const count  = 18 + dist * 9;              // 27 → 54 voices
    const peak   = 0.030 + dist * 0.022;       // 0.052 → 0.118
    const sustain = peak * 0.78;
    const v = makeCrowdVoices(ctx, dur, t, 'cheer', count);
    reverb(ctx, v, 0.44 + dist * 0.015).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(peak, t + 0.18);
    v.gain.linearRampToValueAtTime(sustain, t + dur * 0.45);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

// intensity 1–4 (mirrors dist) — louder groan for bigger away-team hits
export function playCrowdGroan(intensity = 1) {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const dur   = 1.4 + intensity * 0.35;       // 1.75s → 2.8s
    const count = 16 + intensity * 6;            // 22 → 40 voices
    const peak  = 0.034 + intensity * 0.016;     // 0.050 → 0.098
    const v = makeCrowdVoices(ctx, dur, t, 'groan', count);
    reverb(ctx, v, 0.38).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(peak, t + 0.13);
    v.gain.linearRampToValueAtTime(peak * 0.72, t + 0.62);
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

// ── HIT STINGERS — ascending brass stab scaled to hit distance ───────────────
// dist=1 → 2-note pop · dist=2 → 3-note riff · dist=3 → 4-note climb · dist=4 uses fanfare
export function playHitStinger(dist: number) {
  if (_muted || dist === 4) return; // HR keeps its own fanfare
  try {
    const ctx = getCtx();
    // [freq Hz, note duration s] — sequences scale with hit power
    const seqs: [number, number][][] = [
      [],
      [[392, 0.14], [523, 0.19]],                                     // single: G4 → C5
      [[392, 0.12], [494, 0.12], [659, 0.21]],                       // double: G4 → B4 → E5
      [[349, 0.11], [440, 0.11], [554, 0.11], [880, 0.26]],         // triple: F4 → A4 → C#5 → A5
    ];
    const seq = seqs[Math.min(dist, 3)];
    let offset = 0.06; // slight gap after bat crack
    seq.forEach(([freq, dur]) => {
      const t = ctx.currentTime + offset;
      // Two slightly-detuned sawtooth oscillators for a warm "stadium organ" brass texture
      [1, 1.006].forEach(detune => {
        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * detune;
        filt.type = 'lowpass';
        filt.frequency.value = 1800 + dist * 200;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.10, t + 0.016);
        g.gain.setValueAtTime(0.10, t + dur - 0.025);
        g.gain.linearRampToValueAtTime(0.001, t + dur);
        osc.connect(filt); filt.connect(g); g.connect(ctx.destination);
        osc.start(t); osc.stop(t + dur + 0.01);
      });
      offset += dur;
    });
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

// ── SCORE RIPPLE — short crowd burst as each run crosses home plate ───────────
export function playScoreRipple() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const dur = 1.3;
    const v = makeCrowdVoices(ctx, dur, t, 'cheer', 22);
    reverb(ctx, v, 0.52).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(0.07, t + 0.11);
    v.gain.linearRampToValueAtTime(0.045, t + 0.5);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

// ── START CHEER — crowd roar when Play Ball is clicked ───────────────────────
export function playStartCheer() {
  if (_muted) return;
  try {
    const ctx = getCtx(), t = ctx.currentTime;
    const dur = 3.8;
    const v = makeCrowdVoices(ctx, dur, t, 'cheer', 50);
    reverb(ctx, v, 0.55).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, t);
    v.gain.linearRampToValueAtTime(0.13, t + 0.35);
    v.gain.linearRampToValueAtTime(0.10, t + 1.8);
    v.gain.exponentialRampToValueAtTime(0.001, t + dur);
  } catch (_) {}
}

// ── HIGH-LEVEL HELPERS ───────────────────────────────────────────────────────
// half=0 → away batting (home team pitching); half=1 → home batting
// Home crowd cheers when home team benefits, groans otherwise.
export function playHitSound(dist: number, half: number) {
  if (_muted) return;
  playBatCrack(dist);
  playHitStinger(dist); // ascending brass stab scaled to hit distance
  if (half === 0) {
    // Away team hit — home crowd groans (louder for bigger hits)
    playCrowdGroan(dist);
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

// ── PLAY BALL JINGLE — opening notes of "Take Me Out to the Ballgame" ─────────
// Plays when the opponent accepts the game invitation.
// Stadium organ (sawtooth + lowpass) texture with reverb, then a crowd cheer.
export function playPlayBallJingle() {
  if (_muted) return;
  try {
    const ctx = getCtx();
    // "Take  me   out   to   the  ball  game"   (G major, stadium organ)
    const notes: [number, number, number][] = [
      [587, 0.00, 0.20],  // D5  "Take"
      [494, 0.22, 0.20],  // B4  "me"
      [784, 0.44, 0.44],  // G5  "out"  — the big jump up
      [587, 0.90, 0.20],  // D5  "to"
      [659, 1.12, 0.20],  // E5  "the"
      [587, 1.34, 0.62],  // D5  "ball"
      [523, 1.98, 0.52],  // C5  "game"
    ];
    // Shared reverb bus so all notes share the same room sound
    const bus = ctx.createGain(); bus.gain.value = 1.0;
    reverb(ctx, bus, 0.45).connect(ctx.destination);
    notes.forEach(([freq, offset, dur]) => {
      const t = ctx.currentTime + offset;
      [1, 1.006].forEach(detune => {
        const osc = ctx.createOscillator();
        const filt = ctx.createBiquadFilter();
        const g = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.value = freq * detune;
        filt.type = 'lowpass'; filt.frequency.value = 2400; filt.Q.value = 0.5;
        g.gain.setValueAtTime(0.001, t);
        g.gain.linearRampToValueAtTime(0.14, t + 0.022);
        g.gain.setValueAtTime(0.14, t + dur - 0.045);
        g.gain.linearRampToValueAtTime(0.001, t + dur);
        osc.connect(filt); filt.connect(g); g.connect(bus);
        osc.start(t); osc.stop(t + dur + 0.02);
      });
    });
    // Crowd cheer wells up after the melody
    const cheerT = ctx.currentTime + 2.6;
    const v = makeCrowdVoices(ctx, 2.2, cheerT, 'cheer', 35);
    reverb(ctx, v, 0.55).connect(ctx.destination);
    v.gain.setValueAtTime(0.001, cheerT);
    v.gain.linearRampToValueAtTime(0.10, cheerT + 0.35);
    v.gain.linearRampToValueAtTime(0.065, cheerT + 1.1);
    v.gain.exponentialRampToValueAtTime(0.001, cheerT + 2.2);
  } catch (_) {}
}
