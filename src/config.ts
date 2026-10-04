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
  bumper: 500,
  bumperStep: 100,
  bumperMax: 1500,
  sling: 250,
  lane: 1500,
  laneComplete: 10000,
  spinnerRev: 500,
  spinnerTick: 125,
  drop: 2500,
  dropComplete: 25000,
  standup: 1000,
  standupPair: 10000,
  saucer: 15000,
  lock: 10000,
  jackpot: 100000,
  skill: 50000,
  inlane: 500,
  outlane: 500,
  bonusPer: 10000,
  extraBallScore: 2000000
};

export const FEVER_HITS = 8;
export const FEVER_WINDOW_S = 4;
export const FEVER_TIME_S = 10;
export const FEVER_MULT = 3;
export const SPINNER_DOUBLE_S = 20;
export const COMBO_WINDOW_S = 1.2;
export const COMBO_BONUS = 5000;
export const SKILL_WINDOW_S = 6;

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
