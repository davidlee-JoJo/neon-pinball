import * as planck from 'planck';
import { FLIPPER_SPEED, FLIPPER_TORQUE, PPU } from './config';
import * as L from './layout';
import * as ph from './physics';
import { emit } from './events';

const U = (p: number) => p / PPU;

export class Flipper {
  body: planck.Body;
  joint: planck.RevoluteJoint;
  pressed = false;
  private side: 'L' | 'R';
  readonly rest: number;
  readonly up: number;
  readonly len = 62;
  readonly r1 = 8;
  readonly r2 = 4.5;

  constructor(side: 'L' | 'R') {
    this.side = side;
    const P = side === 'L' ? L.FLIPPER_L : L.FLIPPER_R;
    this.rest = side === 'L' ? 0.52 : Math.PI - 0.52;
    this.up = side === 'L' ? -0.62 : Math.PI + 0.62;
    const tip = 45 * Math.PI / 180;
    const pts = [
      [0, -this.r1], [this.len, -this.r2], [this.len + this.r2 * Math.cos(tip), -this.r2 * Math.sin(tip)],
      [this.len + this.r2, 0], [this.len + this.r2 * Math.cos(tip), this.r2 * Math.sin(tip)], [this.len, this.r2],
      [0, this.r1], [-this.r1, 0]
    ] as L.Pt[];
    this.body = ph.world.createBody({
      type: 'dynamic',
      position: ph.vecP(P.x, P.y),
      angle: this.rest,
      linearDamping: 0.1
    });
    this.body.createFixture(new planck.Polygon(pts.map((p) => ph.vec(U(p[0]), U(p[1])))), {
      density: 1.2,
      friction: 0.06,
      restitution: 0.35
    });
    this.joint = ph.world.createJoint(new planck.RevoluteJoint(
      {
        enableLimit: true,
        lowerAngle: Math.min(this.rest, this.up),
        upperAngle: Math.max(this.rest, this.up),
        enableMotor: true,
        motorSpeed: 0,
        maxMotorTorque: FLIPPER_TORQUE
      },
      ph.getAnchorSafe(),
      this.body,
      ph.vecP(P.x, P.y)
    )) as planck.RevoluteJoint;
  }

  get pivot(): { x: number; y: number } {
    return this.side === 'L' ? L.FLIPPER_L : L.FLIPPER_R;
  }

  press() {
    if (this.pressed) return;
    this.pressed = true;
    this.joint.setMotorSpeed(this.side === 'L' ? -FLIPPER_SPEED : FLIPPER_SPEED);
    emit({ type: 'flipper', side: this.side });
  }

  release() {
    if (!this.pressed) return;
    this.pressed = false;
    this.joint.setMotorSpeed(0);
  }

  forceDown() {
    this.pressed = false;
    this.joint.setMotorSpeed(0);
  }
}

export class Bumper {
  body: planck.Body;
  pulse = 0;
  index: number;
  private def: { x: number; y: number; r: number };

  constructor(def: { x: number; y: number; r: number }, index: number) {
    this.def = def;
    this.index = index;
    this.body = ph.world.createBody({ position: ph.vecP(def.x, def.y) });
    const f = this.body.createFixture(new planck.Circle(def.r / PPU), { density: 1, restitution: 0.55, friction: 0.02 });
    f.setUserData({ kind: 'bumper', ent: this });
  }

  get pos() {
    return this.def;
  }

  hit(ball: planck.Body) {
    const dx = ball.getPosition().x - U(this.def.x);
    const dy = ball.getPosition().y - U(this.def.y);
    const d = Math.hypot(dx, dy) || 1;
    const k = 24 * ball.getMass();
    ball.applyLinearImpulse(ph.vec((dx / d) * k, (dy / d) * k - 2 * ball.getMass()), ball.getPosition(), true);
    this.pulse = 1;
    emit({ type: 'bumper', index: this.index, x: this.def.x, y: this.def.y });
  }

  update(dt: number) {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 3.4);
  }
}

export class Sling {
  body: planck.Body;
  pulse = 0;
  private pts: L.Pt[];
  private normal: L.Pt;
  mid: L.Pt;

  constructor(pts: L.Pt[], normal: L.Pt) {
    this.pts = pts;
    this.normal = normal;
    this.body = ph.staticPoly(pts, { kind: 'sling', ent: this, restitution: 0.2 });
    const a = pts[0], b = pts[1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    this.mid = [mx, my];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sx = mx + this.normal[0] * 2, sy = my + this.normal[1] * 2;
    const sbody = ph.world.createBody({ position: ph.vecP(sx, sy), angle: ang });
    const sf = sbody.createFixture(new planck.Box(U(len / 2), U(2.5)), { isSensor: true });
    sf.setUserData({ kind: 'sling', ent: this });
  }

  get normalVec() {
    return this.normal;
  }

  hit(ball: planck.Body) {
    const k = 26 * ball.getMass();
    ball.applyLinearImpulse(ph.vec(this.normal[0] * k, this.normal[1] * k), ball.getPosition(), true);
    this.pulse = 1;
    const a = this.pts[0], b = this.pts[1];
    emit({ type: 'sling', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
  }

  update(dt: number) {
    if (this.pulse > 0) this.pulse = Math.max(0, this.pulse - dt * 4);
  }
}

export class DropBank {
  targets: { body: planck.Body; active: boolean; x: number; y: number; angle: number; letter: string }[] = [];
  private resetTimer = -1;
  private resetCb: () => void;

  constructor(onReset: () => void) {
    this.resetCb = onReset;
    L.DROPS.forEach((d, i) => {
      const body = ph.staticBox(d.x, d.y, 10, 4.5, d.angle, { kind: 'drop', ent: { bank: this, index: i } });
      this.targets.push({ body, active: true, x: d.x, y: d.y, angle: d.angle, letter: d.letter });
    });
  }

  hit(index: number) {
    const t = this.targets[index];
    if (!t.active) return;
    t.active = false;
    t.body.setActive(false);
    emit({ type: 'drop', index });
    if (this.targets.every((q) => !q.active)) {
      this.resetTimer = 1.6;
      emit({ type: 'dropComplete' });
    }
  }

  update(dt: number) {
    if (this.resetTimer > 0) {
      this.resetTimer -= dt;
      if (this.resetTimer <= 0) {
        this.resetTimer = -1;
        for (const t of this.targets) {
          t.active = true;
          t.body.setActive(true);
        }
        this.resetCb();
      }
    }
  }
}

export class Standups {
  items: { body: planck.Body; lit: boolean; index: number; x: number; y: number; angle: number }[] = [];

  constructor() {
    L.STANDUPS.forEach((s, i) => {
      const body = ph.staticBox(s.x, s.y, 9, 4, s.angle, { kind: 'standup', ent: { owner: this, index: i } });
      this.items.push({ body, lit: false, index: i, x: s.x, y: s.y, angle: s.angle });
    });
  }

  hit(index: number) {
    emit({ type: 'standup', index });
  }

  setLit(i: number, v: boolean) {
    this.items[i].lit = v;
  }

  reset() {
    for (const it of this.items) it.lit = false;
  }
}

export class Rollover {
  body: planck.Body;
  lit = false;
  x: number;
  y: number;

  constructor(public id: string, x: number, y: number, hw: number, hh: number) {
    this.x = x;
    this.y = y;
    this.body = ph.world.createBody({ position: ph.vecP(x, y) });
    const f = this.body.createFixture(new planck.Box(U(hw), U(hh)), { isSensor: true });
    f.setUserData({ kind: 'rollover', ent: { rollover: this } });
  }

  hit() {
    emit({ type: 'rollover', id: this.id });
  }

  setLit(v: boolean) {
    this.lit = v;
  }
}

export class Spinner {
  private body: planck.Body;
  angle = 0;
  private spinVel = 0;
  private acc = 0;
  x: number;
  y: number;

  constructor() {
    const s = L.SPINNER;
    this.x = s.x;
    this.y = s.y;
    this.body = ph.world.createBody({ position: ph.vecP(s.x, s.y) });
    const f = this.body.createFixture(new planck.Box(U(s.hw), U(s.hh)), { isSensor: true });
    f.setUserData({ kind: 'spinner', ent: { spinner: this } });
  }

  hit(ball: planck.Body) {
    const v = ball.getLinearVelocity();
    const sp = Math.hypot(v.x, v.y) * PPU;
    this.spinVel = Math.min(34, Math.max(9, sp * 0.16)) * (v.x >= 0 ? 1 : -1) * -1;
    emit({ type: 'spinner', speed: sp });
  }

  update(dt: number) {
    if (Math.abs(this.spinVel) < 0.4) {
      this.spinVel = 0;
      return;
    }
    this.angle += this.spinVel * dt;
    this.acc += Math.abs(this.spinVel * dt);
    this.spinVel *= Math.pow(0.35, dt);
    if (this.acc > Math.PI) {
      this.acc -= Math.PI;
      emit({ type: 'spinnerTick' });
    }
  }
}

export class Saucer {
  body: planck.Body;
  captured: planck.Body | null = null;
  pulse = 0;
  glowLevel = 0.15;

  constructor() {
    const s = L.SAUCER;
    this.body = ph.world.createBody({ position: ph.vecP(s.x, s.y) });
    const f = this.body.createFixture(new planck.Circle((s.r - 3) / PPU), { isSensor: true });
    f.setUserData({ kind: 'saucer', ent: { saucer: this } });
  }

  get pos() {
    return L.SAUCER;
  }

  hit(ball: planck.Body) {
    emit({ type: 'saucer', ball });
  }

  capture(ball: planck.Body) {
    this.captured = ball;
    ball.setActive(false);
  }

  hasCaptured() {
    return this.captured !== null;
  }

  takeCaptured(): planck.Body | null {
    const b = this.captured;
    this.captured = null;
    return b;
  }

  eject(ball: planck.Body, vx: number, vy: number) {
    ball.setActive(true);
    ball.setPosition(ph.vecP(L.SAUCER.x, L.SAUCER.y - 6));
    ball.setLinearVelocity(ph.vec(vx, vy));
    ball.setAwake(true);
    this.pulse = 1;
  }
}

export class Plunger {
  charge = 0;
  setCharge(c: number) {
    this.charge = Math.min(1, Math.max(0, c));
  }
}
