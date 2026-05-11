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

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(160, now);
    subOsc.frequency.exponentialRampToValueAtTime(40, now + 0.1);
    subGain.gain.setValueAtTime(1.2, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.12);

    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = "triangle";
    midOsc.frequency.setValueAtTime(600, now);
    midOsc.frequency.exponentialRampToValueAtTime(120, now + 0.08);
    midGain.gain.setValueAtTime(0.85, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    midOsc.connect(midGain);
    midGain.connect(ctx.destination);
    midOsc.start(now);
    midOsc.stop(now + 0.1);

    const crackNoise = createNoise(ctx, 0.05);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(4000, now);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.0, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackNoise.start(now);
    crackNoise.stop(now + 0.05);

    const bodyNoise = createNoise(ctx, 0.18);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "bandpass";
    bodyFilter.frequency.setValueAtTime(1200, now);
    bodyFilter.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    bodyFilter.Q.value = 1.5;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(1.0, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    bodyNoise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyNoise.start(now);
    bodyNoise.stop(now + 0.18);

    const brassNoise = createNoise(ctx, 0.035);
    const brassFilter = ctx.createBiquadFilter();
    brassFilter.type = "bandpass";
    brassFilter.frequency.setValueAtTime(2800, now + 0.05);
    brassFilter.Q.value = 5.0;
    const brassGain = ctx.createGain();
    brassGain.gain.setValueAtTime(0, now);
    brassGain.gain.setValueAtTime(0.28, now + 0.05);
    brassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
    brassNoise.connect(brassFilter);
    brassFilter.connect(brassGain);
    brassGain.connect(ctx.destination);
    brassNoise.start(now + 0.05);
    brassNoise.stop(now + 0.085);
  } catch (_) {}
}

export function shotgunShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(100, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.35);
    subGain.gain.setValueAtTime(2.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.4);

    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = "sawtooth";
    midOsc.frequency.setValueAtTime(200, now);
    midOsc.frequency.exponentialRampToValueAtTime(45, now + 0.22);
    midGain.gain.setValueAtTime(1.3, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    midOsc.connect(midGain);
    midGain.connect(ctx.destination);
    midOsc.start(now);
    midOsc.stop(now + 0.28);

    const crackNoise = createNoise(ctx, 0.07);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(3000, now);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.5, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackNoise.start(now);
    crackNoise.stop(now + 0.07);

    const bodyNoise = createNoise(ctx, 0.6);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "lowpass";
    bodyFilter.frequency.setValueAtTime(900, now);
    bodyFilter.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    bodyFilter.Q.value = 2.5;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(1.6, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    bodyNoise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyNoise.start(now);
    bodyNoise.stop(now + 0.6);

    const pumpNoise = createNoise(ctx, 0.055);
    const pumpFilter = ctx.createBiquadFilter();
    pumpFilter.type = "bandpass";
    pumpFilter.frequency.setValueAtTime(750, now + 0.18);
    pumpFilter.Q.value = 3.5;
    const pumpGain = ctx.createGain();
    pumpGain.gain.setValueAtTime(0, now);
    pumpGain.gain.setValueAtTime(0.45, now + 0.18);
    pumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.235);
    pumpNoise.connect(pumpFilter);
    pumpFilter.connect(pumpGain);
    pumpGain.connect(ctx.destination);
    pumpNoise.start(now + 0.18);
    pumpNoise.stop(now + 0.235);
  } catch (_) {}
}

export function assaultRifleShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

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

export function sniperShot(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = "sine";
    subOsc.frequency.setValueAtTime(60, now);
    subOsc.frequency.exponentialRampToValueAtTime(18, now + 0.35);
    subGain.gain.setValueAtTime(2.2, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
    subOsc.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.4);

    const midOsc = ctx.createOscillator();
    const midGain = ctx.createGain();
    midOsc.type = "triangle";
    midOsc.frequency.setValueAtTime(140, now);
    midOsc.frequency.exponentialRampToValueAtTime(35, now + 0.3);
    midGain.gain.setValueAtTime(1.6, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    midOsc.connect(midGain);
    midGain.connect(ctx.destination);
    midOsc.start(now);
    midOsc.stop(now + 0.35);

    const crackNoise = createNoise(ctx, 0.05);
    const crackFilter = ctx.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(5500, now);
    const crackGain = ctx.createGain();
    crackGain.gain.setValueAtTime(1.8, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    crackNoise.connect(crackFilter);
    crackFilter.connect(crackGain);
    crackGain.connect(ctx.destination);
    crackNoise.start(now);
    crackNoise.stop(now + 0.05);

    const bodyNoise = createNoise(ctx, 0.55);
    const bodyFilter = ctx.createBiquadFilter();
    bodyFilter.type = "lowpass";
    bodyFilter.frequency.setValueAtTime(2200, now);
    bodyFilter.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    bodyFilter.Q.value = 1.5;
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(1.8, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    bodyNoise.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    bodyNoise.start(now);
    bodyNoise.stop(now + 0.55);

    const boltNoise = createNoise(ctx, 0.06);
    const boltFilter = ctx.createBiquadFilter();
    boltFilter.type = "bandpass";
    boltFilter.frequency.setValueAtTime(1200, now + 0.18);
    boltFilter.Q.value = 5.0;
    const boltGain = ctx.createGain();
    boltGain.gain.setValueAtTime(0, now);
    boltGain.gain.setValueAtTime(0.55, now + 0.18);
    boltGain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
    boltNoise.connect(boltFilter);
    boltFilter.connect(boltGain);
    boltGain.connect(ctx.destination);
    boltNoise.start(now + 0.18);
    boltNoise.stop(now + 0.24);
  } catch (_) {}
}

// ── Nuclear Siren ──────────────────────────────────────────────────────────────
// Alternating two-tone wail (350→750hz / 700→380hz sweep, 1.5s per half). Returns stop fn.
export function playNuclearSiren(): () => void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.8, ctx.currentTime);
    masterGain.connect(ctx.destination);

    let stopped = false;
    let timeoutRef: ReturnType<typeof setTimeout> | null = null;

    const scheduleCycle = (startTime: number, cycle: number) => {
      if (stopped) return;
      const osc = ctx.createOscillator();
      const envGain = ctx.createGain();
      osc.type = "sawtooth";
      osc.connect(envGain);
      envGain.connect(masterGain);

      const wailUp = cycle % 2 === 0;
      osc.frequency.setValueAtTime(wailUp ? 350 : 700, startTime);
      osc.frequency.linearRampToValueAtTime(
        wailUp ? 750 : 380,
        startTime + 1.5,
      );

      const noise = createNoise(ctx, 3.0);
      const nFilter = ctx.createBiquadFilter();
      nFilter.type = "bandpass";
      nFilter.frequency.value = 600;
      nFilter.Q.value = 1.5;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.15, startTime);
      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(masterGain);

      envGain.gain.setValueAtTime(0, startTime);
      envGain.gain.linearRampToValueAtTime(0.6, startTime + 0.15);
      envGain.gain.setValueAtTime(0.6, startTime + 1.35);
      envGain.gain.linearRampToValueAtTime(0, startTime + 1.5);

      osc.start(startTime);
      osc.stop(startTime + 1.5);
      noise.start(startTime);
      noise.stop(startTime + 1.5);

      timeoutRef = setTimeout(
        () => scheduleCycle(ctx.currentTime, cycle + 1),
        1400,
      );
    };

    scheduleCycle(ctx.currentTime, 0);

    return () => {
      stopped = true;
      if (timeoutRef) clearTimeout(timeoutRef);
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    };
  } catch (_) {
    return () => {};
  }
}

// ── Rocket Approach Sound ──────────────────────────────────────────────────────
// Deep bass + turbine whine, gain ramps from 0 to max over durationMs. Returns stop fn.
export function playRocketApproach(durationMs: number): () => void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return () => {};

    const durationS = durationMs / 1000;
    const now = ctx.currentTime;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(2.0, now + durationS * 0.7);
    masterGain.gain.linearRampToValueAtTime(3.5, now + durationS);
    masterGain.connect(ctx.destination);

    const bassOsc = ctx.createOscillator();
    bassOsc.type = "sawtooth";
    bassOsc.frequency.setValueAtTime(60, now);
    bassOsc.frequency.linearRampToValueAtTime(120, now + durationS);
    const bassFilter = ctx.createBiquadFilter();
    bassFilter.type = "lowpass";
    bassFilter.frequency.value = 200;
    bassOsc.connect(bassFilter);
    bassFilter.connect(masterGain);
    bassOsc.start(now);
    bassOsc.stop(now + durationS + 0.2);

    const turbineOsc = ctx.createOscillator();
    turbineOsc.type = "sawtooth";
    turbineOsc.frequency.setValueAtTime(1200, now);
    turbineOsc.frequency.linearRampToValueAtTime(2800, now + durationS);
    const turbineGain = ctx.createGain();
    turbineGain.gain.setValueAtTime(0.3, now);
    turbineGain.gain.linearRampToValueAtTime(0.8, now + durationS);
    turbineOsc.connect(turbineGain);
    turbineGain.connect(masterGain);
    turbineOsc.start(now);
    turbineOsc.stop(now + durationS + 0.2);

    const noiseNode = createNoise(ctx, durationS + 0.5);
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(300, now);
    noiseFilter.frequency.linearRampToValueAtTime(800, now + durationS);
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.2, now);
    noiseGain.gain.linearRampToValueAtTime(1.0, now + durationS);
    noiseNode.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseNode.start(now);
    noiseNode.stop(now + durationS + 0.5);

    return () => {
      masterGain.gain.setValueAtTime(masterGain.gain.value, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.1);
    };
  } catch (_) {
    return () => {};
  }
}

// ── Nuclear Impact Boom ────────────────────────────────────────────────────────
// Massive sub-bass explosion (20-35hz), deep rumble (50hz), fades over 4 seconds.
export function playNuclearImpact(): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(35, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + 2.0);
    subGain.gain.setValueAtTime(4.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    sub.connect(subGain);
    subGain.connect(ctx.destination);
    sub.start(now);
    sub.stop(now + 4.0);

    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(60, now);
    rumble.frequency.exponentialRampToValueAtTime(30, now + 3.0);
    rumbleGain.gain.setValueAtTime(2.5, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 3.5);
    rumble.connect(rumbleGain);
    rumbleGain.connect(ctx.destination);
    rumble.start(now);
    rumble.stop(now + 3.5);

    const bang = createNoise(ctx, 0.8);
    const bangFilter = ctx.createBiquadFilter();
    bangFilter.type = "lowpass";
    bangFilter.frequency.setValueAtTime(1500, now);
    bangFilter.frequency.exponentialRampToValueAtTime(50, now + 0.8);
    const bangGain = ctx.createGain();
    bangGain.gain.setValueAtTime(3.0, now);
    bangGain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    bang.connect(bangFilter);
    bangFilter.connect(bangGain);
    bangGain.connect(ctx.destination);
    bang.start(now);
    bang.stop(now + 0.8);

    const tail = createNoise(ctx, 4.0);
    const tailFilter = ctx.createBiquadFilter();
    tailFilter.type = "lowpass";
    tailFilter.frequency.setValueAtTime(400, now + 0.3);
    tailFilter.frequency.exponentialRampToValueAtTime(60, now + 4.0);
    const tailGain = ctx.createGain();
    tailGain.gain.setValueAtTime(0, now);
    tailGain.gain.setValueAtTime(1.5, now + 0.2);
    tailGain.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
    tail.connect(tailFilter);
    tailFilter.connect(tailGain);
    tailGain.connect(ctx.destination);
    tail.start(now);
    tail.stop(now + 4.0);
  } catch (_) {}
}
