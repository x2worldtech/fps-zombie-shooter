let audioCtx: AudioContext | null = null;
// biome-ignore lint/correctness/noUnusedVariables: used as side-effect flag
let audioUnlocked = false;

/**
 * Attempt to resume the AudioContext. Must be called from a user gesture handler.
 */
export async function unlockAudio(): Promise<void> {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch (_) {}
  }
  audioUnlocked = audioCtx.state === "running";
}

function getAudioContext(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch (_) {
      return null;
    }
  }
  // If suspended, try a non-blocking resume (may not work without gesture, but worth trying)
  if (audioCtx.state === "suspended") {
    audioCtx.resume().catch(() => {});
  }
  if (audioCtx.state !== "running") return null;
  return audioCtx;
}

function createNoise(
  ctx: AudioContext,
  duration: number,
): AudioBufferSourceNode {
  const bufferSize = Math.ceil(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

export function pistolShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Sharp crack
    const noise = createNoise(ctx, 0.15);
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2000, now);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    filter.Q.value = 0.5;

    gainNode.gain.setValueAtTime(0.8, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.15);

    // Tone snap
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } catch (_) {}
}

export function shotgunShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Deep boom
    const noise = createNoise(ctx, 0.5);
    const gainNode = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.4);

    gainNode.gain.setValueAtTime(1.2, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.5);

    // Sub boom
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
    oscGain.gain.setValueAtTime(0.8, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch (_) {}
}

export function assaultRifleShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // === Layer 1: Sub-bass thud (deep body of the shot) ===
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.18);
    subGain.gain.setValueAtTime(1.4, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.22);

    // === Layer 2: Mid-frequency body punch ===
    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = "triangle";
    midOsc.frequency.setValueAtTime(180, now);
    midOsc.frequency.exponentialRampToValueAtTime(55, now + 0.14);
    midGain.gain.setValueAtTime(0.9, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    midOsc.connect(midGain);
    midGain.connect(ctx.destination);
    midOsc.start(now);
    midOsc.stop(now + 0.18);

    // === Layer 3: Sharp crack (high-freq noise burst) ===
    const crackNoise = createNoise(ctx, 0.06);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(3500, now);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.1, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackNoise.start(now);
    crackNoise.stop(now + 0.06);

    // === Layer 4: Body noise with low-pass sweep (the "meat") ===
    const bodyNoise = createNoise(ctx, 0.25);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "lowpass";
    bodyFilter.frequency.setValueAtTime(1800, now);
    bodyFilter.frequency.exponentialRampToValueAtTime(120, now + 0.2);
    bodyFilter.Q.value = 2.0;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(1.2, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    bodyNoise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyNoise.start(now);
    bodyNoise.stop(now + 0.25);

    // === Layer 5: Mechanical clank (bolt cycling) ===
    const clankNoise = createNoise(ctx, 0.04);
    const clankFilter = ctx.createBiquadFilter();
    clankFilter.type = "bandpass";
    clankFilter.frequency.setValueAtTime(900, now + 0.06);
    clankFilter.Q.value = 4.0;
    const clankGain = ctx.createGain();
    clankGain.gain.setValueAtTime(0, now);
    clankGain.gain.setValueAtTime(0.35, now + 0.06);
    clankGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    clankNoise.connect(clankFilter);
    clankFilter.connect(clankGain);
    clankGain.connect(ctx.destination);
    clankNoise.start(now + 0.06);
    clankNoise.stop(now + 0.1);
  } catch (_) {}
}

export function zombieGrowl(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const distortion = ctx.createWaveShaper();

    // Create distortion curve
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) {
      const x = (i * 2) / 256 - 1;
      curve[i] = ((Math.PI + 200) * x) / (Math.PI + 200 * Math.abs(x));
    }
    distortion.curve = curve;

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.setValueAtTime(60, now + 0.1);
    osc.frequency.setValueAtTime(90, now + 0.2);
    osc.frequency.setValueAtTime(70, now + 0.3);

    gainNode.gain.setValueAtTime(0.3, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(distortion);
    distortion.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  } catch (_) {}
}

export function zombieRoar(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(50, now);
    osc.frequency.linearRampToValueAtTime(120, now + 0.3);
    osc.frequency.linearRampToValueAtTime(40, now + 0.7);

    gainNode.gain.setValueAtTime(0.5, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;

    osc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  } catch (_) {}
}

export function playerHit(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(150, now + 0.2);

    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gainNode);
    gainNode.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch (_) {}
}

export function pickupChime(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [523, 659, 784, 1047];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, now + i * 0.08);
      gainNode.gain.linearRampToValueAtTime(0.3, now + i * 0.08 + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.2);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.2);
    });
  } catch (_) {}
}

export function waveStart(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [220, 277, 330, 440];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, now + i * 0.12);
      gainNode.gain.linearRampToValueAtTime(0.2, now + i * 0.12 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.4);
    });
  } catch (_) {}
}

export function waveClear(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const chord = [523, 659, 784, 1047, 1319];
    chord.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      gainNode.gain.setValueAtTime(0, now + i * 0.06);
      gainNode.gain.linearRampToValueAtTime(0.25, now + i * 0.06 + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.6);
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.6);
    });
  } catch (_) {}
}
