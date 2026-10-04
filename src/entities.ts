import { Container, Graphics, Text } from 'pixi.js';
import * as planck from 'planck';
import { FLIPPER_SPEED, FLIPPER_TORQUE, FLIPPER_REST, PPU, C } from './config';
import * as L from './layout';
import * as ph from './physics';
import { Lamp } from './fx';
import { emit } from './events';

const U = (p: number) => p / PPU;

export class Flipper {
  body: planck.Body;
  joint: planck.RevoluteJoint;
  pressed = false;
  view: Container;
  private g = new Graphics();
  private side: 'L' | 'R';
  private rest: number;
  private up: number;

  constructor(side: 'L' | 'R', dyn: Container) {
    this.side = side;
    const P = side === 'L' ? L.FLIPPER_L : L.FLIPPER_R;
    this.rest = side === 'L' ? FLIPPER_REST : Math.PI - FLIPPER_REST;
    this.up = side === 'L' ? -0.62 : Math.PI + 0.62;
    const len = 62, r1 = 8, r2 = 4.5, tip = 45 * Math.PI / 180;
    const pts = [
      [0, -r1], [len, -r2], [len + r2 * Math.cos(tip), -r2 * Math.sin(tip)],
      [len + r2, 0], [len + r2 * Math.cos(tip), r2 * Math.sin(tip)], [len, r2],
      [0, r1], [-r1, 0]
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

    const color = side === 'L' ? C.cyan : C.magenta;
    this.g.poly(pts.flatMap((p) => [p[0], p[1]]));
    this.g.fill({ color: 0x232b47 });
    this.g.stroke({ width: 3, color, alpha: 0.95 });
    this.g.moveTo(0, 0);
    this.g.lineTo(len * 0.92, 0);
    this.g.stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
    this.g.circle(0, 0, 3);
    this.g.fill({ color });
    this.view = new Container();
    this.view.addChild(this.g);
    dyn.addChild(this.view);
    this.sync();
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

  sync() {
    this.view.position.set(this.body.getPosition().x * PPU, this.body.getPosition().y * PPU);
    this.view.rotation = this.body.getAngle();
  }
}

export class Bumper {
  body: planck.Body;
  lamp: Lamp;
  core: Graphics;
  pulse = 0;
  index: number;

  constructor(private def: { x: number; y: number; r: number }, index: number, dyn: Container, glow: Container) {
    this.index = index;
    this.body = ph.world.createBody({ position: ph.vecP(def.x, def.y) });
    const f = this.body.createFixture(new planck.Circle(def.r / PPU), { density: 1, restitution: 0.55, friction: 0.02 });
    f.setUserData({ kind: 'bumper', ent: this });
    this.lamp = new Lamp('#ff9a3d', def.r * 4.6, glow);
    this.lamp.place(def.x, def.y);
    this.core = new Graphics();
    this.core.circle(0, 0, def.r).fill({ color: 0x1a1030 });
    dyn.addChild(this.core);
    this.core.position.set(def.x, def.y);
    this.draw(0);
  }

  hit(ball: planck.Body) {
    const dx = ball.getPosition().x - U(this.def.x);
    const dy = ball.getPosition().y - U(this.def.y);
    const d = Math.hypot(dx, dy) || 1;
    const k = 24 * ball.getMass();
    ball.applyLinearImpulse(ph.vec((dx / d) * k, (dy / d) * k - 2 * ball.getMass()), ball.getPosition(), true);
    this.pulse = 1;
    this.lamp.pulse(1);
    emit({ type: 'bumper', index: this.index, x: this.def.x, y: this.def.y });
  }

  update(dt: number) {
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 3.4);
      this.draw(this.pulse);
    }
  }

  private draw(p: number) {
    const r = this.def.r;
    const g = this.core;
    g.clear();
    g.circle(0, 0, r).fill({ color: 0x1a1030 });
    g.circle(0, 0, r - 2).stroke({ width: 3, color: C.orange, alpha: 0.9 });
    g.circle(0, 0, r * 0.55).fill({ color: 0x2a1a40 });
    g.circle(0, 0, r * 0.55).stroke({ width: 2, color: 0xffffff, alpha: 0.5 + p * 0.5 });
    g.circle(0, 0, 4).fill({ color: 0xffffff });
    if (p > 0) {
      g.circle(0, 0, r + p * 6).stroke({ width: 2, color: 0xffc46b, alpha: p });
    }
  }
}

export class Sling {
  body: planck.Body;
  lamp: Lamp;
  pulse = 0;
  private view: Graphics;

  constructor(private pts: L.Pt[], private normal: L.Pt, dyn: Container, glow: Container) {
    this.body = ph.staticPoly(pts, { kind: 'sling', ent: this, restitution: 0.2 });
    const a = pts[0], b = pts[1];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const sx = mx + this.normal[0] * 2, sy = my + this.normal[1] * 2;
    const sbody = ph.world.createBody({ position: ph.vecP(sx, sy), angle: ang });
    const sf = sbody.createFixture(new planck.Box(U(len / 2), U(2.5)), { isSensor: true });
    sf.setUserData({ kind: 'sling', ent: this });
    this.lamp = new Lamp('#ff2fd6', 110, glow);
    this.lamp.place(mx + this.normal[0] * 16, my + this.normal[1] * 16);
    this.view = new Graphics();
    this.view.poly(pts.flatMap((p) => [p[0], p[1]]));
    this.view.fill({ color: 0x2d1030 });
    this.view.stroke({ width: 3, color: C.magenta, alpha: 0.9 });
    dyn.addChild(this.view);
    this.draw(0);
  }

  hit(ball: planck.Body) {
    const k = 26 * ball.getMass();
    ball.applyLinearImpulse(ph.vec(this.normal[0] * k, this.normal[1] * k), ball.getPosition(), true);
    this.pulse = 1;
    this.lamp.pulse(1);
    const a = this.pts[0], b = this.pts[1];
    emit({ type: 'sling', x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 });
  }

  update(dt: number) {
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 4);
      this.draw(this.pulse);
    }
  }

  private draw(p: number) {
    const g = this.view;
    g.clear();
    g.poly(this.pts.flatMap((q) => [q[0], q[1]]));
    g.fill({ color: p > 0.05 ? 0x5a1a55 : 0x2d1030 });
    g.stroke({ width: 3, color: C.magenta, alpha: 0.55 + p * 0.45 });
  }
}

export class DropBank {
  targets: { body: planck.Body; active: boolean; view: Container; g: Graphics; txt: Text; x: number; y: number }[] = [];
  private resetTimer = -1;
  private resetCb: () => void = () => {};

  constructor(dyn: Container, onReset: () => void) {
    this.resetCb = onReset;
    L.DROPS.forEach((d, i) => {
      const body = ph.staticBox(d.x, d.y, 10, 4.5, d.angle, { kind: 'drop', ent: { bank: this, index: i } });
      const view = new Container();
      const g = new Graphics();
      g.roundRect(-11, -5, 22, 10, 3).fill({ color: 0x3a2a08 });
      g.roundRect(-11, -5, 22, 10, 3).stroke({ width: 2, color: C.yellow, alpha: 0.95 });
      const txt = new Text({ text: d.letter, style: { fontFamily: 'Arial', fontSize: 9, fontWeight: '700', fill: 0xffe94a } });
      txt.anchor.set(0.5);
      view.addChild(g, txt);
      view.position.set(d.x, d.y);
      view.rotation = d.angle;
      dyn.addChild(view);
      this.targets.push({ body, active: true, view, g, txt, x: d.x, y: d.y });
    });
  }

  hit(index: number) {
    const t = this.targets[index];
    if (!t.active) return;
    t.active = false;
    t.body.setActive(false);
    t.view.alpha = 0.22;
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
          t.view.alpha = 1;
        }
        this.resetCb();
      }
    }
  }
}

export class Standups {
  items: { body: planck.Body; lamp: Lamp; lit: boolean; index: number }[] = [];

  constructor(dyn: Container, glow: Container) {
    L.STANDUPS.forEach((s, i) => {
      const body = ph.staticBox(s.x, s.y, 9, 4, s.angle, { kind: 'standup', ent: { owner: this, index: i } });
      const lamp = new Lamp('#4dff88', 56, glow);
      lamp.place(s.x, s.y);
      const g = new Graphics();
      g.roundRect(-9, -4, 18, 8, 2).fill({ color: 0x0f3d22 });
      g.roundRect(-9, -4, 18, 8, 2).stroke({ width: 2, color: C.green, alpha: 0.9 });
      g.position.set(s.x, s.y);
      g.rotation = s.angle;
      dyn.addChild(g);
      this.items.push({ body, lamp, lit: false, index: i });
    });
  }

  hit(index: number) {
    const it = this.items[index];
    it.lamp.pulse(1);
    emit({ type: 'standup', index });
  }

  setLit(i: number, v: boolean) {
    this.items[i].lit = v;
    this.items[i].lamp.set(v ? 0.8 : 0.12);
  }

  reset() {
    for (const it of this.items) {
      it.lit = false;
      it.lamp.set(0.12);
    }
  }
}

export class Rollover {
  body: planck.Body;
  lamp: Lamp;
  lit = false;

  constructor(public id: string, x: number, y: number, hw: number, hh: number, private color: string, dyn: Container, glow: Container) {
    this.body = ph.world.createBody({ position: ph.vecP(x, y) });
    const f = this.body.createFixture(new planck.Box(U(hw), U(hh)), { isSensor: true });
    f.setUserData({ kind: 'rollover', ent: { rollover: this } });
    this.lamp = new Lamp(color, 46, glow);
    this.lamp.place(x, y);
    const g = new Graphics();
    g.roundRect(-hw + 2, -hh + 2, (hw - 2) * 2, (hh - 2) * 2, 4).stroke({ width: 2, color: 0xffffff, alpha: 0.35 });
    dyn.addChild(g);
    g.position.set(x, y);
    this.lamp.set(0.1);
  }

  hit() {
    emit({ type: 'rollover', id: this.id });
    this.lamp.pulse(1);
  }

  setLit(v: boolean) {
    this.lit = v;
    this.lamp.set(v ? 0.85 : 0.1);
  }
}

export class Spinner {
  private body: planck.Body;
  private view: Graphics;
  private angle = 0;
  private spinVel = 0;
  private acc = 0;

  constructor(dyn: Container) {
    const s = L.SPINNER;
    this.body = ph.world.createBody({ position: ph.vecP(s.x, s.y) });
    const f = this.body.createFixture(new planck.Box(U(s.hw), U(s.hh)), { isSensor: true });
    f.setUserData({ kind: 'spinner', ent: { spinner: this } });
    this.view = new Graphics();
    this.view.roundRect(-s.hw + 3, -4, (s.hw - 3) * 2, 8, 4).fill({ color: 0x3b4a6b });
    this.view.roundRect(-s.hw + 3, -4, (s.hw - 3) * 2, 8, 4).stroke({ width: 2, color: C.cyan, alpha: 0.9 });
    this.view.position.set(s.x, s.y);
    dyn.addChild(this.view);
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
    this.view.rotation = this.angle;
    this.spinVel *= Math.pow(0.35, dt);
    if (this.acc > Math.PI) {
      this.acc -= Math.PI;
      emit({ type: 'spinnerTick' });
    }
  }
}

export class Saucer {
  body: planck.Body;
  lamp: Lamp;
  captured: planck.Body | null = null;
  private view: Graphics;

  constructor(dyn: Container, glow: Container) {
    const s = L.SAUCER;
    this.body = ph.world.createBody({ position: ph.vecP(s.x, s.y) });
    const f = this.body.createFixture(new planck.Circle((s.r - 3) / PPU), { isSensor: true });
    f.setUserData({ kind: 'saucer', ent: { saucer: this } });
    this.lamp = new Lamp('#ffe94a', s.r * 5, glow);
    this.lamp.place(s.x, s.y);
    this.view = new Graphics();
    this.view.circle(0, 0, s.r).fill({ color: 0x05050c });
    this.view.circle(0, 0, s.r).stroke({ width: 3, color: C.yellow, alpha: 0.85 });
    this.view.circle(0, 0, s.r - 7).stroke({ width: 1.5, color: 0xffffff, alpha: 0.25 });
    this.view.position.set(s.x, s.y);
    dyn.addChild(this.view);
  }

  hit(ball: planck.Body) {
    emit({ type: 'saucer', ball });
  }

  capture(ball: planck.Body) {
    this.captured = ball;
    ball.setActive(false);
    this.lamp.set(1);
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
    this.lamp.pulse(1);
  }
}

export class Gate {
  body: planck.Body;
  private open = false;

  constructor() {
    this.body = ph.staticSeg(L.GATE[0], L.GATE[1], { kind: 'gate', restitution: 0.1 });
  }

  update(balls: planck.Body[]) {
    let wantOpen = false;
    for (const b of balls) {
      if (!b.isActive()) continue;
      const p = b.getPosition();
      const v = b.getLinearVelocity();
      if (p.x * PPU > 424 && p.y * PPU < 430 && v.y < -1.5) wantOpen = true;
    }
    if (wantOpen !== this.open) {
      this.open = wantOpen;
      this.body.setActive(!wantOpen);
    }
  }
}

export class Plunger {
  charge = 0;
  private view: Container;
  private spring: Graphics;
  private knob: Graphics;

  constructor(dyn: Container) {
    this.view = new Container();
    this.view.position.set(L.PLUNGER.x, L.PLUNGER.y);
    this.spring = new Graphics();
    this.knob = new Graphics();
    this.knob.roundRect(-13, -2, 26, 12, 4).fill({ color: 0x3d4a6b });
    this.knob.roundRect(-13, -2, 26, 12, 4).stroke({ width: 2, color: C.cyan, alpha: 0.9 });
    this.view.addChild(this.spring, this.knob);
    dyn.addChild(this.view);
    this.drawSpring(0);
  }

  setCharge(c: number) {
    this.charge = Math.min(1, Math.max(0, c));
    this.drawSpring(this.charge);
  }

  private drawSpring(c: number) {
    const pull = c * 42;
    this.spring.clear();
    const y0 = 8 + pull;
    for (let i = 0; i < 5; i++) {
      const y = y0 + i * 6;
      this.spring.moveTo(-9, y).lineTo(9, y + 3);
    }
    this.spring.stroke({ width: 2.5, color: 0x8899bb, alpha: 0.8 });
  }
}
