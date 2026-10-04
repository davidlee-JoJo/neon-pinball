import * as planck from 'planck';
import {
  PPU, GRAVITY, WALL_RESTITUTION, WALL_FRICTION,
  BALL_R_U, BALL_DENSITY, BALL_RESTITUTION, BALL_FRICTION, MAX_SPEED, PHYS_DT
} from './config';
import * as L from './layout';

export const world = new planck.World(new planck.Vec2(0, GRAVITY));

export type UD = { kind: string; ent?: unknown };

export const toU = (p: number) => p / PPU;
export const toP = (u: number) => u * PPU;
export const vec = (x: number, y: number) => new planck.Vec2(x, y);
export const vecP = (x: number, y: number) => new planck.Vec2(x / PPU, y / PPU);

let anchor: planck.Body | null = null;
export function getAnchorSafe() {
  if (!anchor) anchor = world.createBody({ position: vec(0, 0) });
  return anchor;
}

export interface FixOpts {
  restitution?: number;
  friction?: number;
  kind?: string;
  ent?: unknown;
  sensor?: boolean;
}

function addFix(body: planck.Body, shape: planck.Shape, o: FixOpts = {}) {
  const f = body.createFixture(shape, {
    friction: o.friction ?? WALL_FRICTION,
    restitution: o.restitution ?? WALL_RESTITUTION,
    isSensor: o.sensor ?? false
  });
  f.setUserData({ kind: o.kind ?? 'wall', ent: o.ent });
  return f;
}

export function staticChain(pts: L.Pt[], o: FixOpts = {}) {
  const body = world.createBody({ position: vec(0, 0) });
  addFix(body, new planck.Chain(pts.map((p) => vecP(p[0], p[1]))), o);
  return body;
}

export function staticSeg(a: L.Pt, b: L.Pt, o: FixOpts = {}) {
  const body = world.createBody({ position: vec(0, 0) });
  addFix(body, new planck.Edge(vecP(a[0], a[1]), vecP(b[0], b[1])), o);
  return body;
}

export function staticCap(p: L.Pt, r: number, o: FixOpts = {}) {
  const body = world.createBody({ position: vecP(p[0], p[1]) });
  addFix(body, new planck.Circle(r / PPU), o);
  return body;
}

export function staticPoly(pts: L.Pt[], o: FixOpts = {}) {
  const body = world.createBody({ position: vec(0, 0) });
  addFix(body, new planck.Polygon(pts.map((p) => vecP(p[0], p[1]))), o);
  return body;
}

export function staticBox(cx: number, cy: number, hw: number, hh: number, angle: number, o: FixOpts = {}) {
  const body = world.createBody({ position: vecP(cx, cy), angle });
  addFix(body, new planck.Box(hw / PPU, hh / PPU), o);
  return body;
}

export function makeBall(x: number, y: number) {
  const body = world.createBody({
    type: 'dynamic',
    position: vecP(x, y),
    bullet: true,
    fixedRotation: true,
    linearDamping: 0.008
  });
  body.createFixture(new planck.Circle(BALL_R_U), {
    density: BALL_DENSITY,
    friction: BALL_FRICTION,
    restitution: BALL_RESTITUTION
  });
  body.setUserData({ kind: 'ball' });
  return body;
}

export function clampSpeed(body: planck.Body, max = MAX_SPEED) {
  const v = body.getLinearVelocity();
  const s = Math.hypot(v.x, v.y);
  if (s > max) body.setLinearVelocity(vec((v.x / s) * max, (v.y / s) * max));
}

const pending: { ent: unknown; ball: planck.Body }[] = [];

world.on('begin-contact', (contact: planck.Contact) => {
  const fa = contact.getFixtureA();
  const fb = contact.getFixtureB();
  route(fa, fb);
  route(fb, fa);
});

function route(self: planck.Fixture, other: planck.Fixture) {
  const ud = self.getUserData() as UD | null;
  if (!ud || !ud.ent) return;
  const ob = other.getBody();
  const obUd = ob.getUserData() as UD | null;
  if (!obUd || obUd.kind !== 'ball') return;
  pending.push({ ent: ud.ent, ball: ob });
}

export function takePending() {
  return pending.splice(0, pending.length);
}

export function stepWorld() {
  world.step(PHYS_DT, 8, 3);
}
