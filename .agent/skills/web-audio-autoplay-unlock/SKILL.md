---
name: web-audio-autoplay-unlock
description: Unlocks the Web Audio API (AudioContext) on restricted mobile browsers (like Android Chrome and iOS Safari) to allow programmatic sound playback (e.g., for notifications) without direct user interaction at the time of playback.
---

# Web Audio Autoplay Unlock

## The Problem
Modern browsers strictly enforce an Autoplay Policy that prevents audio from playing unless triggered by a direct user interaction (like a click or tap). If a web application receives a background event (like a WebSocket message or a setTimeout) and attempts to play an alert sound (`audio.play()`), the browser will throw a `NotAllowedError` exception, and the audio will remain silent.

## The Solution
To bypass this, you must "prime" or "unlock" the AudioContext by playing a silent sound on the very first user interaction (e.g., a tap anywhere on the screen). Once unlocked, the browser permits programmatic playback for the duration of the session.

### Implementation Pattern

1. Create a global Audio Context.
2. Bind a one-time event listener to `touchstart`, `mousedown`, or `click` on the `document` or `window`.
3. In the event handler, create a silent, empty `AudioBuffer` and play it.
4. Immediately remove the event listener.

```typescript
export function unlockAudioContext() {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContext) return;

  const ctx = new AudioContext();

  const unlock = function() {
    // Create an empty buffer (1 frame, 1 channel, 22050 Hz)
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    // Play the silent buffer
    if (source.start) {
      source.start(0);
    } else if ((source as any).noteOn) {
      (source as any).noteOn(0);
    }

    // Optionally resume the context if it was suspended
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // Remove the event listeners after unlocking
    document.removeEventListener('touchstart', unlock, true);
    document.removeEventListener('touchend', unlock, true);
    document.removeEventListener('click', unlock, true);
    document.removeEventListener('keydown', unlock, true);
  };

  // Bind to common user interaction events
  document.addEventListener('touchstart', unlock, true);
  document.addEventListener('touchend', unlock, true);
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
}
```

## When to use this skill
- When you are implementing an in-app notification system that requires an audible chime or alert when a background message arrives.
- When you encounter `NotAllowedError: play() failed because the user didn't interact with the document first` in the browser console.
