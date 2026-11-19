// Synthesized sound: every effect is built with WebAudio oscillators and noise,
// so the game ships no audio files and makes no network request. The context is
// created on the first user gesture; everything is guarded so a muted or blocked
// context never breaks the game.
export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;

  function ensure() {
    if (ctx) return ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo) {
    const c = ensure();
    if (!c) return;
    try {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type || 'square';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
      gain.gain.setValueAtTime(vol, c.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(c.currentTime + dur + 0.02);
    } catch { /* sound is optional */ }
  }

  function noise(dur, vol, lowpass) {
    const c = ensure();
    if (!c) return;
    try {
      const len = Math.floor(c.sampleRate * dur);
      const buffer = c.createBuffer(1, len, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = c.createBufferSource();
      src.buffer = buffer;
      const gain = c.createGain();
      gain.gain.value = vol;
      let node = src;
      if (lowpass) {
        const filter = c.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = lowpass;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(master);
      src.start();
    } catch { /* sound is optional */ }
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() { return muted; },
    click() { tone(660, 0.06, 'square', 0.12); },
    shoot() { noise(0.12, 0.35, 3000); tone(180, 0.1, 'sawtooth', 0.2, 60); },
    punch() { noise(0.08, 0.25, 900); },
    crash() { noise(0.25, 0.5, 500); tone(90, 0.25, 'sine', 0.4, 40); },
    explosion() { noise(0.7, 0.6, 400); tone(60, 0.6, 'sine', 0.5, 30); },
    pickup() { tone(880, 0.09, 'sine', 0.2); setTimeout(() => tone(1320, 0.12, 'sine', 0.2), 80); },
    cash() { tone(1046, 0.08, 'triangle', 0.22); setTimeout(() => tone(1568, 0.14, 'triangle', 0.22), 70); },
    reload() { tone(440, 0.05, 'square', 0.12); setTimeout(() => tone(587, 0.06, 'square', 0.12), 90); },
    wanted() { tone(220, 0.35, 'sawtooth', 0.25, 440); },
    missionDone() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.16, 'triangle', 0.25), i * 110));
    },
    busted() { tone(392, 0.5, 'sawtooth', 0.25, 196); },
    engine(on, ratio) {
      const c = ensure();
      if (!c) return;
      try {
        if (on && !engineOsc) {
          engineOsc = c.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = c.createGain();
          engineGain.gain.value = 0.035;
          const filter = c.createBiquadFilter();
          filter.type = 'lowpass';
          filter.frequency.value = 700;
          engineOsc.connect(filter);
          filter.connect(engineGain);
          engineGain.connect(master);
          engineOsc.start();
        } else if (!on && engineOsc) {
          engineOsc.stop();
          engineOsc = null;
          engineGain = null;
        }
        if (engineOsc) engineOsc.frequency.setValueAtTime(55 + ratio * 130, c.currentTime);
      } catch { /* sound is optional */ }
    },
    siren(on) {
      const c = ensure();
      if (!c) return;
      try {
        if (on && !sirenOsc) {
          sirenOsc = c.createOscillator();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 800;
          const lfo = c.createOscillator();
          lfo.type = 'square';
          lfo.frequency.value = 0.9;
          const lfoGain = c.createGain();
          lfoGain.gain.value = 180;
          lfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);
          sirenGain = c.createGain();
          sirenGain.gain.value = 0.05;
          sirenOsc.connect(sirenGain);
          sirenGain.connect(master);
          sirenOsc.start();
          lfo.start();
          sirenOsc._lfo = lfo;
        } else if (!on && sirenOsc) {
          sirenOsc._lfo.stop();
          sirenOsc.stop();
          sirenOsc = null;
          sirenGain = null;
        }
      } catch { /* sound is optional */ }
    },
  };
}
