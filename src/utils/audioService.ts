let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtor =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtor();
  }
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playTone(frequency: number, durationMs: number, delayMs = 0, gainPeak = 0.14) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime + delayMs / 1000;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainPeak, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + durationMs / 1000 + 0.03);
  } catch {
    // Audio playback silently skipped if browser blocks autoplay
  }
}

export const audioService = {
  playStartWork() {
    playTone(523.25, 140, 0, 0.14); // C5
    playTone(659.25, 180, 120, 0.16); // E5
  },
  playRestChime() {
    playTone(587.33, 160, 0, 0.12); // D5
    playTone(440.0, 220, 150, 0.11); // A4
  },
  playCompleteChord() {
    playTone(523.25, 220, 0, 0.13); // C5
    playTone(659.25, 240, 110, 0.13); // E5
    playTone(783.99, 360, 220, 0.15); // G5
  },
  playPostureAlert() {
    playTone(440.0, 180, 0, 0.14);
    playTone(554.37, 180, 180, 0.14);
    playTone(659.25, 320, 360, 0.16);
  },
  playScanTick() {
    playTone(720, 50, 0, 0.04);
  },
  vibrate(pattern: number | number[]) {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {
      // Haptics unavailable on desktop browsers
    }
  },
};
