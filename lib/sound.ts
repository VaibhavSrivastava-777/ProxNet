// Web Audio API Sound Utility for ProxNet
// Bypasses browser autoplay restrictions using silent buffer priming

let globalAudioCtx: AudioContext | null = null;
let isUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!globalAudioCtx) {
    const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtxClass) {
      globalAudioCtx = new AudioCtxClass();
    }
  }
  if (globalAudioCtx && globalAudioCtx.state === "suspended") {
    globalAudioCtx.resume().catch(() => {});
  }
  return globalAudioCtx;
}

export function unlockAudioContext() {
  if (typeof window === "undefined" || isUnlocked) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  const unlock = () => {
    try {
      // Create and play 1-frame silent buffer to unlock AudioContext on iOS/Android
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);

      if (ctx.state === "suspended") {
        ctx.resume();
      }

      isUnlocked = true;
    } catch (e) {
      console.warn("AudioContext unlock failed:", e);
    } finally {
      document.removeEventListener("touchstart", unlock, true);
      document.removeEventListener("touchend", unlock, true);
      document.removeEventListener("click", unlock, true);
      document.removeEventListener("keydown", unlock, true);
    }
  };

  document.addEventListener("touchstart", unlock, true);
  document.addEventListener("touchend", unlock, true);
  document.addEventListener("click", unlock, true);
  document.addEventListener("keydown", unlock, true);
}

/**
 * Plays a modern, subtle glass chime or message pop notification via Web Audio API.
 * No external .mp3 files required.
 */
export function playNotificationSound(type: "chime" | "job_match" | "message" = "chime") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    if (type === "job_match" || type === "chime") {
      // Modern Glass Chime (C5: 523.25Hz -> G5: 783.99Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();

      osc1.type = "sine";
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);

      osc1.start(now);
      osc1.stop(now + 0.12);

      // Second higher tone (G5) starting slightly offset (30ms)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(783.99, now + 0.03);
      gain2.gain.setValueAtTime(0.2, now + 0.03);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);

      osc2.start(now + 0.03);
      osc2.stop(now + 0.4);
    } else if (type === "message") {
      // Soft double-tap wooden/glass pop (D5: 587.33Hz -> A5: 880Hz)
      [0, 0.08].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(idx === 0 ? 587.33 : 880, now + offset);
        gain.gain.setValueAtTime(0.18, now + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.08);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + offset);
        osc.stop(now + offset + 0.08);
      });
    }
  } catch (e) {
    console.warn("Web Audio playback error:", e);
  }
}
