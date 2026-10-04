export type Pt = [number, number];

export const ARC_C: Pt = [240, 250];
export const ARC_R = 225;
export const INNER_R = 191;

function arcPts(r: number, a0: number, a1: number, n: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([ARC_C[0] + r * Math.cos(a), ARC_C[1] + r * Math.sin(a)]);
  }
  return pts;
}

const D = Math.PI / 180;

export const WALL_OUTER: Pt[] = [
  [15, 780],
  [15, 250],
  ...arcPts(ARC_R, Math.PI, 0, 30),
  [465, 800],
  [431, 800],
  [431, 250],
  ...arcPts(INNER_R, 0, -35 * D, 10)
];

export const DIVIDERS: Pt[][] = [
  [
    [170, 70],
    [170, 185]
  ],
  [
    [290, 70],
    [290, 185]
  ]
];

export const ORBIT_WALL: Pt[] = [
  [75, 250],
  [75, 470]
];

export const ORBIT_FLOOR: Pt[] = [
  [28, 495],
  [88, 545]
];

export const DROP_BANK: Pt[] = [
  [70, 530],
  [180, 585]
];

export const STANDUP_WALL: Pt[] = [
  [431, 430],
  [385, 500]
];

export const SLING_L: Pt[] = [
  [100, 690],
  [100, 760],
  [148, 760]
];
export const SLING_R: Pt[] = [
  [380, 690],
  [380, 760],
  [332, 760]
];

export const BUMPERS: { x: number; y: number; r: number }[] = [
  { x: 160, y: 320, r: 26 },
  { x: 270, y: 290, r: 26 },
  { x: 365, y: 335, r: 26 }
];

export const SAUCER = { x: 240, y: 478, r: 20 };

export const SPINNER = { x: 45, y: 400, hw: 23, hh: 15 };

export const TOP_LANES = [
  { x: 105, y: 150, letter: 'P' },
  { x: 230, y: 150, letter: 'I' },
  { x: 365, y: 150, letter: 'N' }
];

export const DROPS = (() => {
  const a: Pt = DROP_BANK[0];
  const b: Pt = DROP_BANK[1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const nx = -uy;
  const ny = ux;
  const letters = ['B', 'A', 'L', 'L', 'S'];
  return letters.map((ch, i) => {
    const t = (0.14 + i * 0.18) * len;
    const cx = a[0] + ux * t + nx * 8;
    const cy = a[1] + uy * t + ny * 8;
    return { x: cx, y: cy, angle: Math.atan2(uy, ux), letter: ch };
  });
})();

export const STANDUPS = (() => {
  const a: Pt = STANDUP_WALL[0];
  const b: Pt = STANDUP_WALL[1];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const ux = (b[0] - a[0]) / len;
  const uy = (b[1] - a[1]) / len;
  const nx = -uy;
  const ny = ux;
  return [0.32, 0.68].map((t) => {
    const cx = a[0] + ux * len * t + nx * 7;
    const cy = a[1] + uy * len * t + ny * 7;
    return { x: cx, y: cy, angle: Math.atan2(uy, ux) };
  });
})();

export const INLANES = [
  { x: 78, y: 655, side: 'L' },
  { x: 405, y: 655, side: 'R' }
];
export const OUTLANE = { x: 35, y: 660 };

export const GATE: Pt[] = [
  [431, 255],
  [465, 235]
];

export const PLUNGER = { x: 448, y: 780, w: 30, h: 14 };
export const SPAWN = { x: 448, y: 776 };
export const DRAIN_Y = 845;

export const FLIPPER_L = { x: 160, y: 745 };
export const FLIPPER_R = { x: 320, y: 745 };
