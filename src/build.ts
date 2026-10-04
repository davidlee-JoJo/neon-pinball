import { Container } from 'pixi.js';
import * as planck from 'planck';
import * as ph from './physics';
import * as L from './layout';
import { Flipper, Bumper, Sling, DropBank, Standups, Rollover, Spinner, Saucer, Gate, Plunger } from './entities';

export interface Table {
  flippers: { L: Flipper; R: Flipper };
  bumpers: Bumper[];
  slings: Sling[];
  drops: DropBank;
  standups: Standups;
  rollovers: Record<string, Rollover>;
  spinner: Spinner;
  saucer: Saucer;
  gate: Gate;
  plunger: Plunger;
  update(dt: number, balls: planck.Body[]): void;
}

export function buildTable(dyn: Container, glow: Container, onDropsReset: () => void): Table {
  ph.staticChain(L.WALL_OUTER);

  for (const d of L.DIVIDERS) {
    ph.staticSeg(d[0], d[1], { kind: 'wall' });
    ph.staticCap(d[0], 4);
    ph.staticCap(d[1], 4);
  }

  ph.staticSeg(L.ORBIT_WALL[0], L.ORBIT_WALL[1]);
  ph.staticCap(L.ORBIT_WALL[1], 4);
  ph.staticCap(L.ORBIT_WALL[0], 4);
  ph.staticSeg(L.ORBIT_FLOOR[0], L.ORBIT_FLOOR[1]);
  ph.staticCap(L.ORBIT_FLOOR[0], 3);
  ph.staticCap(L.ORBIT_FLOOR[1], 3);

  ph.staticSeg(L.DROP_BANK[0], L.DROP_BANK[1]);
  ph.staticCap(L.DROP_BANK[0], 3);
  ph.staticCap(L.DROP_BANK[1], 3);

  ph.staticSeg(L.STANDUP_WALL[0], L.STANDUP_WALL[1]);
  ph.staticCap(L.STANDUP_WALL[1], 3);

  const t: Table = {
    flippers: {
      L: new Flipper('L', dyn),
      R: new Flipper('R', dyn)
    },
    bumpers: L.BUMPERS.map((b, i) => new Bumper(b, i, dyn, glow)),
    slings: [new Sling(L.SLING_L, [0.824, -0.565], dyn, glow), new Sling(L.SLING_R, [-0.824, -0.565], dyn, glow)],
    drops: new DropBank(dyn, onDropsReset),
    standups: new Standups(dyn, glow),
    rollovers: {},
    spinner: new Spinner(dyn),
    saucer: new Saucer(dyn, glow),
    gate: new Gate(),
    plunger: new Plunger(dyn),
    update(dt, balls) {
      for (const b of t.bumpers) b.update(dt);
      for (const s of t.slings) s.update(dt);
      t.drops.update(dt);
      t.spinner.update(dt);
      t.gate.update(balls);
    }
  };

  for (const ln of L.TOP_LANES) {
    t.rollovers['lane' + ln.letter] = new Rollover('lane' + ln.letter, ln.x, ln.y, 16, 8, '#00eaff', dyn, glow);
  }
  t.rollovers.inL = new Rollover('inL', L.INLANES[0].x, L.INLANES[0].y, 12, 8, '#4dff88', dyn, glow);
  t.rollovers.inR = new Rollover('inR', L.INLANES[1].x, L.INLANES[1].y, 12, 8, '#4dff88', dyn, glow);
  t.rollovers.outL = new Rollover('outL', L.OUTLANE.x, L.OUTLANE.y, 11, 8, '#ff4757', dyn, glow);

  return t;
}
