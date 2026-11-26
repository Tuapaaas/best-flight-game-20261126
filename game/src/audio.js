// Skylark Courier — all sound is synthesized with WebAudio: an engine hum
// that follows the throttle, a chime for rings and deliveries, a thud for
// landings and a low rumble for a crash. No audio files, no network.

export function createAudio() {
  let ctx = null;
  let hum = null;
  let humGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      hum = ctx.createOscillator();
      hum.type = 'sawtooth';
      hum.frequency.value = 55;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 320;
      humGain = ctx.createGain();
      humGain.gain.value = 0;
      hum.connect(filter).connect(humGain).connect(ctx.destination);
      hum.start();
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  return {
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
    },
    engine(throttle, flying) {
      if (!ctx || muted) return;
      if (humGain) humGain.gain.value = flying ? 0.02 + throttle * 0.05 : 0;
      if (hum) hum.frequency.value = 50 + throttle * 70;
    },
    ring() {
      blip(880, 0.35, 'sine', 0.18);
      blip(1318, 0.4, 'sine', 0.14, 0.09);
    },
    delivery() {
      blip(523, 0.25, 'triangle', 0.2);
      blip(659, 0.25, 'triangle', 0.2, 0.1);
      blip(784, 0.45, 'triangle', 0.2, 0.2);
    },
    land() {
      blip(140, 0.25, 'sine', 0.25);
    },
    crash() {
      blip(70, 0.7, 'sawtooth', 0.3);
      blip(45, 0.9, 'sine', 0.3, 0.05);
    },
    click() {
      blip(1200, 0.06, 'square', 0.06);
    },
    toggleMute() {
      muted = !muted;
      if (humGain) humGain.gain.value = 0;
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
