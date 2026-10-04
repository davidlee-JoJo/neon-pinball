export const TABLE_W = 480;
export const TABLE_H = 820;

export const PPU = 20;

export const BALL_R = 11.5;
export const BALL_R_U = BALL_R / PPU;

export const GRAVITY = 42;
export const MAX_SPEED = 108;
export const BALL_DENSITY = 0.08;
export const BALL_RESTITUTION = 0.38;
export const BALL_FRICTION = 0.03;
export const WALL_RESTITUTION = 0.32;
export const WALL_FRICTION = 0.02;

export const FLIPPER_SPEED = 26;
export const FLIPPER_TORQUE = 2600;
export const FLIPPER_REST = 0.52;
export const FLIPPER_UP = -0.62;

export const PHYS_HZ = 120;
export const PHYS_DT = 1 / PHYS_HZ;

export const BALL_SAVE_S = 8;
export const TILT_WINDOW_S = 2.5;
export const TILT_MAX = 3;

export const LAUNCH_V_MIN = 20;
export const LAUNCH_V_MAX = 82;
export const CHARGE_RATE = 0.85;

export const SC = {
  bumper: 150,
  bumperStep: 100,
  bumperMax: 600,
  sling: 75,
  lane: 1000,
  laneComplete: 5000,
  spinnerRev: 100,
  spinnerTick: 25,
  drop: 750,
  dropComplete: 15000,
  standup: 500,
  standupPair: 3000,
  saucer: 2500,
  lock: 10000,
  jackpot: 50000,
  skill: 25000,
  inlane: 100,
  outlane: 100,
  bonusPer: 10000,
  extraBallScore: 500000
};

export const C = {
  cyan: 0x00eaff,
  magenta: 0xff2fd6,
  yellow: 0xffe94a,
  orange: 0xff7a2f,
  green: 0x4dff88,
  purple: 0x9d5cff,
  red: 0xff4757,
  blue: 0x3d7bff,
  white: 0xffffff,
  bgDeep: 0x07070f,
  bgMid: 0x101024,
  wallDim: 0x1b2a4a
};

export const css = (n: number) => '#' + n.toString(16).padStart(6, '0');
