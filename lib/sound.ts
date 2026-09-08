// Web Audio API Sound Utility for ProxNet
// Bypasses browser autoplay restrictions using silent buffer priming

export type SoundType = "message" | "job_match" | "job_alert" | "chime";

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
 * Derives the appropriate sound type based on notification title, type, and payload data.
 */
export function getSoundTypeForNotification(
  title: string = "",
  data?: Record<string, any>
): SoundType {
  if (data?.soundType) {
    const st = String(data.soundType).toLowerCase();
    if (st === "message" || st === "job_match" || st === "job_alert" || st === "chime") {
      return st as SoundType;
    }
  }

  const lowerTitle = title.toLowerCase();
  const lowerType = String(data?.type || "").toLowerCase();

  if (
    lowerType.includes("chat") ||
    lowerType.includes("message") ||
    lowerTitle.includes("message") ||
    lowerTitle.includes("chat") ||
    lowerTitle.includes("said")
  ) {
    return "message";
  }

  if (
    lowerType.includes("match") ||
    lowerTitle.includes("match") ||
    lowerTitle.includes("fit") ||
    lowerTitle.includes("strong")
  ) {
    return "job_match";
  }

  if (
    lowerType.includes("job") ||
    lowerType.includes("refer") ||
    lowerTitle.includes("job") ||
    lowerTitle.includes("opening") ||
    lowerTitle.includes("refer") ||
    lowerTitle.includes("hiring")
  ) {
    return "job_alert";
  }

  return "chime";
}

/**
 * Plays a modern, distinctive synthesized ring tone for each notification type via Web Audio API.
 * Synthesized locally - zero network latency, zero external asset dependencies.
 */
export function playNotificationSound(type: SoundType = "chime") {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    switch (type) {
      case "message": {
        // WhatsApp-style bright, snappy double-pip pop (880Hz [A5] -> 1174Hz [D6])
        const notes = [
          { freq: 880, start: 0, dur: 0.09, gain: 0.22 },
          { freq: 1174.66, start: 0.08, dur: 0.14, gain: 0.25 },
        ];

        notes.forEach(({ freq, start, dur, gain: targetGain }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + start);

          gainNode.gain.setValueAtTime(0.001, now + start);
          gainNode.gain.linearRampToValueAtTime(targetGain, now + start + 0.015);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(now + start);
          osc.stop(now + start + dur);
        });
        break;
      }

      case "job_match": {
        // Upbeat 4-note ascending celebration arpeggio (C5 -> E5 -> G5 -> C6)
        const arpeggio = [
          { freq: 523.25, offset: 0, dur: 0.12 },
          { freq: 659.25, offset: 0.06, dur: 0.12 },
          { freq: 783.99, offset: 0.12, dur: 0.14 },
          { freq: 1046.5, offset: 0.18, dur: 0.35 },
        ];

        arpeggio.forEach(({ freq, offset, dur }, idx) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = idx === 3 ? "sine" : "triangle";
          osc.frequency.setValueAtTime(freq, now + offset);

          const peak = idx === 3 ? 0.24 : 0.16;
          gainNode.gain.setValueAtTime(0.001, now + offset);
          gainNode.gain.linearRampToValueAtTime(peak, now + offset + 0.01);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(now + offset);
          osc.stop(now + offset + dur);
        });
        break;
      }

      case "job_alert": {
        // Bright dual-bell job alert chime (E5: 659.25Hz -> B5: 987.77Hz)
        const bells = [
          { freq: 659.25, start: 0, dur: 0.22, gain: 0.18 },
          { freq: 987.77, start: 0.07, dur: 0.38, gain: 0.22 },
        ];

        bells.forEach(({ freq, start, dur, gain: targetGain }) => {
          const osc = ctx.createOscillator();
          const gainNode = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now + start);

          gainNode.gain.setValueAtTime(0.001, now + start);
          gainNode.gain.linearRampToValueAtTime(targetGain, now + start + 0.012);
          gainNode.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);

          osc.connect(gainNode);
          gainNode.connect(ctx.destination);

          osc.start(now + start);
          osc.stop(now + start + dur);
        });
        break;
      }

      case "chime":
      default: {
        // Modern ambient glass chime (C5: 523.25Hz -> G5: 783.99Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();

        osc1.type = "sine";
        osc1.frequency.setValueAtTime(523.25, now);
        gain1.gain.setValueAtTime(0.14, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

        osc1.connect(gain1);
        gain1.connect(ctx.destination);

        osc1.start(now);
        osc1.stop(now + 0.14);

        // Second higher tone (G5) offset by 35ms
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();

        osc2.type = "sine";
        osc2.frequency.setValueAtTime(783.99, now + 0.035);
        gain2.gain.setValueAtTime(0.18, now + 0.035);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);

        osc2.connect(gain2);
        gain2.connect(ctx.destination);

        osc2.start(now + 0.035);
        osc2.stop(now + 0.42);
        break;
      }
    }
  } catch (e) {
    console.warn("Web Audio playback error:", e);
  }
}
