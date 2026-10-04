let ctx: AudioContext | null = null;
let master: GainNode;
let sfxBus: GainNode;
let musicBus: GainNode;
let muted = localStorage.getItem('np-muted') === '1';
let musicTimer: number | null = null;
let nextNote = 0;
let step = 0;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') void ctx.resume();
    return;
  }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.85;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.16;
  musicBus.connect(master);
}

export function isMuted() {
  return muted;
}

export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem('np-muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 1;
}

function tone(o: {
  f: number;
  dur: number;
  type?: OscillatorType;
  vol?: number;
  slide?: number;
  delay?: number;
  attack?: number;
  bus?: GainNode;
}) {
  if (!ctx) return;
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = o.type ?? 'square';
  osc.frequency.setValueAtTime(o.f, t0);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t0 + o.dur);
  const v = o.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + (o.attack ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  osc.connect(g).connect(o.bus ?? sfxBus);
  osc.start(t0);
  osc.stop(t0 + o.dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(o: { dur: number; vol?: number; freq?: number; q?: number; delay?: number; slideTo?: number }) {
  if (!ctx) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t0 = ctx.currentTime + (o.delay ?? 0);
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const flt = ctx.createBiquadFilter();
  flt.type = 'bandpass';
  flt.frequency.setValueAtTime(o.freq ?? 1200, t0);
  if (o.slideTo) flt.frequency.exponentialRampToValueAtTime(o.slideTo, t0 + o.dur);
  flt.Q.value = o.q ?? 1;
  const g = ctx.createGain();
  const v = o.vol ?? 0.2;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(v, t0 + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
  src.connect(flt).connect(g).connect(sfxBus);
  src.start(t0);
  src.stop(t0 + o.dur + 0.05);
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  flipper() {
    noise({ dur: 0.06, vol: 0.3, freq: 700, q: 0.8 });
    tone({ f: 150, dur: 0.06, type: 'triangle', vol: 0.25, slide: 90 });
  },
  bumper(i: number) {
    const base = [880, 988, 1175][i % 3];
    tone({ f: base, dur: 0.12, type: 'sine', vol: 0.3 });
    tone({ f: base * 2, dur: 0.08, type: 'sine', vol: 0.12, delay: 0.02 });
    noise({ dur: 0.03, vol: 0.12, freq: 3000 });
  },
  sling() {
    tone({ f: 520, dur: 0.08, type: 'sawtooth', vol: 0.18, slide: 220 });
    noise({ dur: 0.05, vol: 0.2, freq: 900 });
  },
  drop() {
    tone({ f: 220, dur: 0.09, type: 'square', vol: 0.22, slide: 140 });
    noise({ dur: 0.04, vol: 0.15, freq: 500 });
  },
  standup() {
    tone({ f: 660, dur: 0.07, type: 'square', vol: 0.18 });
    tone({ f: 990, dur: 0.07, type: 'square', vol: 0.1, delay: 0.05 });
  },
  lane() {
    tone({ f: 1320, dur: 0.09, type: 'sine', vol: 0.2 });
  },
  spinner() {
    tone({ f: 1760, dur: 0.05, type: 'sine', vol: 0.1 });
  },
  saucerIn() {
    tone({ f: 500, dur: 0.3, type: 'sine', vol: 0.2, slide: 150 });
  },
  saucerOut() {
    tone({ f: 300, dur: 0.2, type: 'sine', vol: 0.2, slide: 800 });
  },
  lock() {
    [0, 4, 7, 12].forEach((n, i) => tone({ f: NOTE(64 + n), dur: 0.35, type: 'square', vol: 0.16, delay: i * 0.09 }));
  },
  jackpot() {
    [0, 4, 7, 12, 16, 19, 24].forEach((n, i) =>
      tone({ f: NOTE(69 + n), dur: 0.22, type: 'square', vol: 0.18, delay: i * 0.07 })
    );
  },
  skill() {
    [0, 7, 12].forEach((n, i) => tone({ f: NOTE(76 + n), dur: 0.15, type: 'triangle', vol: 0.22, delay: i * 0.06 }));
  },
  launch(power: number) {
    noise({ dur: 0.25, vol: 0.25, freq: 300 + power * 500, slideTo: 1800 });
    tone({ f: 120 + power * 160, dur: 0.22, type: 'sawtooth', vol: 0.15, slide: 60 });
  },
  drain() {
    tone({ f: 300, dur: 0.5, type: 'sawtooth', vol: 0.2, slide: 60 });
  },
  tilt() {
    tone({ f: 90, dur: 0.6, type: 'sawtooth', vol: 0.3 });
    noise({ dur: 0.5, vol: 0.2, freq: 200, q: 0.5 });
  },
  nudge() {
    noise({ dur: 0.08, vol: 0.22, freq: 250, q: 0.7 });
  },
  extraBall() {
    [0, 5, 9, 12, 17].forEach((n, i) => tone({ f: NOTE(69 + n), dur: 0.2, type: 'triangle', vol: 0.2, delay: i * 0.08 }));
  },
  gameStart() {
    [0, 4, 7].forEach((n, i) => tone({ f: NOTE(57 + n), dur: 0.18, type: 'square', vol: 0.16, delay: i * 0.08 }));
  },
  ballSave() {
    tone({ f: NOTE(76), dur: 0.15, type: 'sine', vol: 0.2 });
    tone({ f: NOTE(83), dur: 0.15, type: 'sine', vol: 0.2, delay: 0.12 });
  },
  bonusTick() {
    tone({ f: 1046, dur: 0.03, type: 'square', vol: 0.08 });
  },
  gameOver() {
    [0, -3, -7, -12].forEach((n, i) => tone({ f: NOTE(64 + n), dur: 0.3, type: 'triangle', vol: 0.2, delay: i * 0.14 }));
  }
};

const BASS = [45, 45, 52, 45, 48, 48, 43, 43];
const LEAD = [69, 72, 76, 72, 74, 77, 81, 77, 76, 72, 69, 72, 71, 74, 79, 74];

function schedule() {
  if (!ctx) return;
  const spb = 60 / 112 / 2;
  while (nextNote < ctx.currentTime + 0.15) {
    const s = step % 16;
    const bar = Math.floor(step / 16) % 8;
    tone({ f: NOTE(BASS[bar]), dur: spb * 0.9, type: 'triangle', vol: 0.22, delay: nextNote - ctx.currentTime, bus: musicBus });
    if (s % 2 === 0) {
      const li = LEAD[(bar * 2 + (s >> 1)) % LEAD.length];
      tone({ f: NOTE(li), dur: spb * 0.85, type: 'square', vol: 0.07, delay: nextNote - ctx.currentTime, bus: musicBus });
    }
    if (s % 4 === 2) noise({ dur: 0.03, vol: 0.05, freq: 6000, delay: nextNote - ctx.currentTime });
    nextNote += spb;
    step++;
  }
}

export function startMusic() {
  if (!ctx || musicTimer !== null) return;
  nextNote = ctx.currentTime + 0.1;
  musicTimer = window.setInterval(schedule, 40);
}

export function stopMusic() {
  if (musicTimer !== null) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}
