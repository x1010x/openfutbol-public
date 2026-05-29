// Lightweight match SFX manager. Keeps a single ambiance loop alive while a
// match is in progress and fires one-shot Audio instances for events.

const isMutedNow = (): boolean => {
  try { return localStorage.getItem('openfutbol_muted') === '1'; } catch { return false; }
};

const SFX_BASE = `${import.meta.env.BASE_URL}assets/sfx`;

// ── Ambiance (Web Audio API for seamless looping) ─────────────────────────
// HTMLAudioElement.loop has an audible gap on every loop boundary in most
// browsers because mp3 decoding inserts silent padding at the file edges.
// Web Audio's AudioBufferSourceNode loops the decoded buffer in the audio
// thread with sample-accurate timing, no seam.

let audioCtx: AudioContext | null = null;
let ambianceBuffer: AudioBuffer | null = null;
let ambianceSource: AudioBufferSourceNode | null = null;
let ambianceGain: GainNode | null = null;
let ambianceLoading: Promise<void> | null = null;
let ambianceTargetVolume = 0.6;

const getCtx = (): AudioContext => {
  if (!audioCtx) {
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
    audioCtx = new AC();
  }
  return audioCtx;
};

// Auto-detect non-silent loop region. MP3 decoders pad the buffer edges with
// silence (encoder/decoder delay) — looping over that produces audible gaps
// even with sample-accurate looping. We scan the first channel to find the
// first/last samples above a silence threshold and stash the region.
let ambianceLoopStart = 0;
let ambianceLoopEnd = 0;
const findLoopRegion = (buf: AudioBuffer): { start: number; end: number } => {
  const data = buf.getChannelData(0);
  const threshold = 0.005; // ~ -46dBFS
  let firstNoisy = 0;
  let lastNoisy = data.length - 1;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(data[i]) > threshold) { firstNoisy = i; break; }
  }
  for (let i = data.length - 1; i >= 0; i--) {
    if (Math.abs(data[i]) > threshold) { lastNoisy = i; break; }
  }
  const start = Math.max(0, firstNoisy / buf.sampleRate);
  const end = Math.min(buf.duration, (lastNoisy + 1) / buf.sampleRate);
  // Sanity: if the region collapsed to nothing, fall back to whole buffer.
  return end - start < 0.5 ? { start: 0, end: buf.duration } : { start, end };
};

const loadAmbianceBuffer = async (): Promise<void> => {
  if (ambianceBuffer) return;
  if (ambianceLoading) return ambianceLoading;
  ambianceLoading = (async () => {
    const res = await fetch(`${SFX_BASE}/ambiance.mp3`);
    const arr = await res.arrayBuffer();
    ambianceBuffer = await getCtx().decodeAudioData(arr);
    const region = findLoopRegion(ambianceBuffer);
    ambianceLoopStart = region.start;
    ambianceLoopEnd = region.end;
  })();
  return ambianceLoading;
};

const volumeForCapacity = (capacity: number | undefined): number => {
  if (!capacity || capacity <= 0) return 0.55;
  const norm = Math.max(0, Math.min(1, (capacity - 8000) / (90000 - 8000)));
  return 0.45 + 0.5 * norm; // 0.45 (small ground) → 0.95 (packed)
};

export const startAmbiance = (homeCapacity?: number): void => {
  if (isMutedNow()) return;
  ambianceTargetVolume = volumeForCapacity(homeCapacity);

  void loadAmbianceBuffer().then(() => {
    if (isMutedNow() || !ambianceBuffer) return;
    const ctx = getCtx();
    // Resume from suspended state (browsers suspend until a user gesture).
    if (ctx.state === 'suspended') void ctx.resume();

    if (ambianceSource && ambianceGain) {
      ambianceGain.gain.setValueAtTime(ambianceTargetVolume, ctx.currentTime);
      return;
    }
    const gain = ctx.createGain();
    gain.gain.value = ambianceTargetVolume;
    gain.connect(ctx.destination);

    const source = ctx.createBufferSource();
    source.buffer = ambianceBuffer;
    source.loop = true;
    if (ambianceLoopEnd > ambianceLoopStart) {
      source.loopStart = ambianceLoopStart;
      source.loopEnd = ambianceLoopEnd;
    }
    source.connect(gain);
    // Start playback at the loop region so we don't hear the silent intro on
    // the very first playthrough either.
    source.start(0, ambianceLoopStart);

    ambianceSource = source;
    ambianceGain = gain;
  }).catch(() => { /* network/decode failure: silently disable */ });
};

export const stopAmbiance = (): void => {
  if (ambianceSource) {
    try { ambianceSource.stop(); } catch { /* noop */ }
    try { ambianceSource.disconnect(); } catch { /* noop */ }
    ambianceSource = null;
  }
  if (ambianceGain) {
    try { ambianceGain.disconnect(); } catch { /* noop */ }
    ambianceGain = null;
  }
};

// Smooth fade-out of the ambiance over `seconds`, then stop the source.
export const fadeOutAmbiance = (seconds = 2.5): void => {
  if (!ambianceSource || !ambianceGain || !audioCtx) {
    stopAmbiance();
    return;
  }
  const ctx = audioCtx;
  const g = ambianceGain;
  const src = ambianceSource;
  const now = ctx.currentTime;
  // Capture current gain to make the ramp deterministic.
  g.gain.cancelScheduledValues(now);
  g.gain.setValueAtTime(g.gain.value, now);
  g.gain.linearRampToValueAtTime(0, now + seconds);
  // Tear down once the ramp completes; null-out module refs so the next
  // startAmbiance() spins up a fresh source.
  const teardownMs = seconds * 1000 + 50;
  window.setTimeout(() => {
    if (ambianceSource === src) {
      try { src.stop(); } catch { /* noop */ }
      try { src.disconnect(); } catch { /* noop */ }
      ambianceSource = null;
    }
    if (ambianceGain === g) {
      try { g.disconnect(); } catch { /* noop */ }
      ambianceGain = null;
    }
  }, teardownMs);
};

export const setAmbianceMuted = (muted: boolean): void => {
  if (!ambianceGain || !audioCtx) return;
  ambianceGain.gain.setTargetAtTime(muted ? 0 : ambianceTargetVolume, audioCtx.currentTime, 0.05);
};

const safePlay = (a: HTMLAudioElement): Promise<void> => a.play().catch(() => { /* autoplay blocked or noop */ });

// Simple linear fade-out over `ms` milliseconds.
const fadeOut = (audio: HTMLAudioElement, ms: number): Promise<void> => {
  return new Promise(resolve => {
    const start = audio.volume;
    const steps = 16;
    const step = start / steps;
    const interval = ms / steps;
    let n = 0;
    const t = window.setInterval(() => {
      n++;
      const v = Math.max(0, start - step * n);
      audio.volume = v;
      if (n >= steps) {
        window.clearInterval(t);
        try { audio.pause(); } catch { /* noop */ }
        resolve();
      }
    }, interval);
  });
};

export const playGoal = (): void => {
  if (isMutedNow()) return;
  const a = new Audio(`${SFX_BASE}/goal.mp3`);
  a.volume = 0.8;
  void safePlay(a);
};

// Plays the basic goal signal and resolves after a short pause so callers can
// gate other work (e.g. the match tick loop) until the signal has been heard.
export const playGoalSignal = (): Promise<void> => {
  return new Promise(resolve => {
    if (isMutedNow()) { window.setTimeout(resolve, 1500); return; }
    const a = new Audio(`${SFX_BASE}/goal.mp3`);
    a.volume = 0.8;
    void safePlay(a);
    let done = false;
    const finish = () => { if (done) return; done = true; resolve(); };
    a.addEventListener('ended', finish);
    a.addEventListener('loadedmetadata', () => {
      const dur = Number.isFinite(a.duration) && a.duration > 0.2 ? a.duration : 1.5;
      window.setTimeout(finish, Math.min(2500, Math.max(1200, dur * 1000)));
    });
    // Hard ceiling in case neither event fires.
    window.setTimeout(finish, 2500);
  });
};

// Plays goal + celebration together (for user-team goals). Resolves when the
// celebration has finished its natural duration plus a quick fade-out.
export const playGoalWithCelebration = (): Promise<void> => {
  return new Promise(resolve => {
    if (isMutedNow()) { resolve(); return; }
    const goal = new Audio(`${SFX_BASE}/goal.mp3`);
    goal.volume = 0.8;
    void safePlay(goal);

    const cel = new Audio(`${SFX_BASE}/goal-celebration.mp3`);
    cel.volume = 0;
    void safePlay(cel);

    // Fade in over 200ms.
    const fadeInMs = 200;
    const steps = 10;
    const target = 0.85;
    let n = 0;
    const t = window.setInterval(() => {
      n++;
      cel.volume = Math.min(target, (target / steps) * n);
      if (n >= steps) window.clearInterval(t);
    }, fadeInMs / steps);

    const finish = async () => {
      await fadeOut(cel, 500);
      resolve();
    };

    // Random celebration duration in [2000, 5000] ms. Start fade-out 500ms
    // before the chosen end so the total time the tick loop is paused is
    // exactly `celebrationMs`.
    const celebrationMs = 2000 + Math.floor(Math.random() * 3001);
    const fadeStart = Math.max(0, celebrationMs - 500);
    window.setTimeout(finish, fadeStart);
  });
};

export const playMissed = (): void => {
  if (isMutedNow()) return;
  const a = new Audio(`${SFX_BASE}/missed.mp3`);
  a.volume = 0.55;
  void safePlay(a);
};

export const playWhistle = (): void => {
  if (isMutedNow()) return;
  const a = new Audio(`${SFX_BASE}/whistle.mp3`);
  a.volume = 0.7;
  void safePlay(a);
};

export const playWhistleEnd = (): void => {
  if (isMutedNow()) return;
  const a = new Audio(`${SFX_BASE}/whisle-end.mp3`);
  a.volume = 0.8;
  void safePlay(a);
};
