import * as planck from 'planck';
import {
  BALL_SAVE_S, CHARGE_RATE, LAUNCH_V_MIN, LAUNCH_V_MAX,
  PPU, SC, TILT_MAX, TILT_WINDOW_S, PHYS_DT,
  FEVER_HITS, FEVER_WINDOW_S, FEVER_TIME_S, FEVER_MULT,
  SPINNER_DOUBLE_S, COMBO_WINDOW_S, COMBO_BONUS, SKILL_WINDOW_S
} from './config';
import * as L from './layout';
import * as ph from './physics';
import { Table } from './table';
import { Bumper, Sling } from './entities';
import { on } from './events';
import { DMD3D } from './dmd3d';
import { sfx, startMusic } from './audio';

export interface Ball {
  body: planck.Body;
  captured: boolean;
}

export interface Fx {
  burst(x: number, y: number, color: string, n?: number, speed?: number): void;
  shake(a: number): void;
}

export interface Hud {
  score: HTMLElement;
  ball: HTMLElement;
  mult: HTMLElement;
  high: HTMLElement;
  power: HTMLElement;
}

const fmtScore = (n: number) => n.toLocaleString('en-US');
const cssC = {
  orange: '#ff9a3d', magenta: '#ff2fd6', yellow: '#ffe94a', cyan: '#00eaff', green: '#4dff88', red: '#ff4757', white: '#ffffff'
};

interface Task { at: number; fn: () => void; }

export class Game {
  state: 'attract' | 'ready' | 'play' | 'bonus' | 'over' = 'attract';
  paused = false;
  score = 0;
  ballNum = 1;
  totalBalls = 3;
  extraBalls = 0;
  mult = 1;
  laneLit = [false, false, false];
  laneCompletions = 0;
  lockLit = false;
  locks = 0;
  lockedBalls: planck.Body[] = [];
  multiballReady = false;
  inMultiball = false;
  skillLane = 0;
  skillActive = false;
  skillUntil = 0;
  ballSaveUntil = 0;
  tilt = false;
  tiltTimes: number[] = [];
  standupLit = [false, false];
  standupRounds = 0;
  spinnerDoubleUntil = 0;
  feverHits: number[] = [];
  feverUntil = 0;
  comboTimes: { at: number; n: number }[] = [];
  combo = 0;
  nextExtra = SC.extraBallScore;
  high = 0;
  time = 0;
  charging = false;
  charge = 0;
  balls: Ball[] = [];
  private tasks: Task[] = [];
  private acc = 0;
  private bonusTotal = 0;
  private bonusElapsed = 0;
  private bonusAdded = 0;
  private overAt = 0;
  private hudDirty = true;
  private saving = false;

  constructor(
    private table: Table,
    private dmd: DMD3D,
    private hud: Hud,
    private fx: Fx
  ) {
    this.high = Math.max(0, ...(JSON.parse(localStorage.getItem('np3d-highscores') || '[]') as number[]));
    table.standups.reset();
    on((e) => this.handle(e));
    this.dmd.setScroll('NEON PINBALL 3D 霓虹彈珠  ★  按 LAUNCH 開始新遊戲 PRESS LAUNCH TO START ★');
    this.hud.high.textContent = fmtScore(this.high);
  }

  private after(delay: number, fn: () => void) {
    this.tasks.push({ at: this.time + delay, fn });
  }

  private msg(text: string, dur = 2, blink = false) {
    this.dmd.showMsg(text, dur, blink);
  }

  private addScore(base: number) {
    this.score += base * this.mult;
    this.hudDirty = true;
    while (this.score >= this.nextExtra) {
      this.nextExtra += SC.extraBallScore;
      if (this.extraBalls < 2) {
        this.extraBalls++;
        this.msg('EXTRA BALL 加球!', 2.5);
        sfx.extraBall();
      }
    }
  }

  private bumpCombo() {
    const now = this.time;
    this.comboTimes = this.comboTimes.filter((c) => c.at > now - COMBO_WINDOW_S * 4);
    const last = this.comboTimes[this.comboTimes.length - 1];
    if (last && now - last.at < COMBO_WINDOW_S) {
      last.n++;
      last.at = now;
      this.combo = last.n;
    } else {
      this.combo = 1;
      this.comboTimes.push({ at: now, n: 1 });
    }
    if (this.combo >= 3) {
      const bonus = Math.min(10, this.combo) * COMBO_BONUS;
      this.addScore(bonus);
      this.msg(`COMBO ×${this.combo}! +${fmtScore(bonus)}`, 0.9);
    }
  }

  private checkFever() {
    this.feverHits = this.feverHits.filter((t) => t > this.time - FEVER_WINDOW_S);
    if (this.time < this.feverUntil) return;
    if (this.feverHits.length >= FEVER_HITS) {
      this.feverUntil = this.time + FEVER_TIME_S;
      this.feverHits = [];
      this.msg(`BUMPER FEVER! ×${FEVER_MULT}`, 2.5, true);
      sfx.jackpot();
    }
  }

  physicsFrame(dt: number) {
    if (this.paused) return;
    this.acc += Math.min(dt, 0.05);
    while (this.acc >= PHYS_DT) {
      ph.stepWorld();
      this.acc -= PHYS_DT;
    }
    for (const b of this.balls) {
      if (!b.captured) ph.clampSpeed(b.body);
    }
    for (const p of ph.takePending()) {
      const ent = p.ent as Record<string, unknown>;
      if (ent instanceof Bumper || ent instanceof Sling) {
        ent.hit(p.ball);
      } else if (ent && typeof ent === 'object' && 'bank' in ent) {
        (ent.bank as { hit(i: number): void }).hit(ent.index as number);
      } else if (ent && typeof ent === 'object' && 'owner' in ent) {
        (ent.owner as { hit(i: number): void }).hit(ent.index as number);
      } else if (ent && typeof ent === 'object' && 'rollover' in ent) {
        (ent.rollover as { hit(): void }).hit();
      } else if (ent && typeof ent === 'object' && 'spinner' in ent) {
        (ent.spinner as { hit(b: planck.Body): void }).hit(p.ball);
      } else if (ent && typeof ent === 'object' && 'saucer' in ent) {
        (ent.saucer as { hit(b: planck.Body): void }).hit(p.ball);
      }
    }
  }

  private ballOnPlunger(): Ball | undefined {
    return this.balls.find((b) => {
      if (b.captured || !b.body.isActive()) return false;
      const p = b.body.getPosition();
      return p.x * PPU > 420 && p.y * PPU > 690 && p.y * PPU < 815;
    });
  }

  private spawnBall(x: number, y: number): Ball {
    const body = ph.makeBall(x, y);
    const ball: Ball = { body, captured: false };
    this.balls.push(ball);
    return ball;
  }

  private removeBall(b: Ball) {
    ph.world.destroyBody(b.body);
    const i = this.balls.indexOf(b);
    if (i >= 0) this.balls.splice(i, 1);
  }

  private activeBalls(): Ball[] {
    return this.balls.filter((b) => !b.captured && b.body.isActive());
  }

  update(dt: number) {
    if (this.paused) {
      this.dmd.setInfo('PAUSED 暫停 — 按 P 繼續');
      this.dmd.update(this.time);
      return;
    }
    this.time += dt;

    this.tasks = this.tasks.filter((t) => {
      if (this.time >= t.at) {
        t.fn();
        return false;
      }
      return true;
    });

    this.physicsFrame(dt);

    if (this.charging) {
      this.charge = Math.min(1, this.charge + CHARGE_RATE * dt);
      this.table.plunger.setCharge(this.charge);
      this.hud.power.style.width = `${Math.round(this.charge * 100)}%`;
    }

    this.table.update(dt, this.balls.map((b) => b.body));
    this.updateState(dt);
    this.updateLamps();

    this.checkDrains();

    this.dmd.setScore(this.state === 'bonus' ? this.score + this.bonusAdded : this.score);
    this.dmd.update(this.time);

    if (this.hudDirty) {
      this.hudDirty = false;
      this.hud.score.textContent = fmtScore(this.score);
      this.hud.ball.textContent = String(this.ballNum);
      this.hud.mult.textContent = '×' + this.mult;
      this.hud.high.textContent = fmtScore(Math.max(this.high, this.score));
    }
  }

  private updateState(dt: number) {
    switch (this.state) {
      case 'attract': {
        const t = this.time * 1.5;
        this.table.bumpers.forEach((b, i) => b.pulse = 0.5 + 0.5 * Math.sin(t * 2 + i * 2.1));
        const chase = Math.floor(t) % 3;
        Object.values(this.table.rollovers).forEach((r, i) => {
          if (r.id.startsWith('lane')) r.setLit(i % 3 === chase);
        });
        this.table.saucer.glowLevel = Math.sin(t * 3) > 0.4 ? 0.8 : 0.12;
        break;
      }
      case 'ready': {
        this.dmd.setInfo(`BALL ${this.ballNum} — 按住 LAUNCH 蓄力後放開`);
        break;
      }
      case 'play': {
        this.tiltTimes = this.tiltTimes.filter((t) => t > this.time - TILT_WINDOW_S);
        if (this.skillActive && this.time > this.skillUntil) this.skillActive = false;
        if (this.time > this.feverUntil) this.feverHits = [];
        const onPlunger = this.ballOnPlunger();
        if (onPlunger) {
          this.dmd.setInfo('按住 LAUNCH 蓄力發射');
        } else {
          this.dmd.setInfo('');
        }
        const remain = Math.ceil(this.ballSaveUntil - this.time);
        if (remain > 0 && remain <= 3 && Math.floor(this.time * 2) % 2 === 0) {
          this.dmd.setInfo(`BALL SAVE ${remain}`);
        }
        break;
      }
      case 'bonus': {
        this.bonusElapsed += dt;
        const target = Math.min(this.bonusTotal, Math.floor((this.bonusTotal * this.bonusElapsed) / 1.4));
        if (target > this.bonusAdded) {
          if (Math.floor(this.bonusElapsed / 0.07) !== Math.floor((this.bonusElapsed - dt) / 0.07)) sfx.bonusTick();
        }
        this.bonusAdded = target;
        if (this.bonusElapsed >= 1.6) {
          this.score += this.bonusTotal;
          this.bonusAdded = 0;
          this.hudDirty = true;
          this.nextBall();
        }
        break;
      }
      case 'over': {
        if (this.time > this.overAt) {
          this.state = 'attract';
          this.dmd.setScroll('NEON PINBALL 3D 霓虹彈珠  ★  按 LAUNCH 再來一局 PRESS LAUNCH TO PLAY AGAIN ★');
        }
        break;
      }
    }
  }

  private updateLamps() {
    const t = this.table;
    t.saucer.glowLevel = this.inMultiball
      ? 0.55 + 0.45 * Math.sin(this.time * 10)
      : this.lockLit
        ? 0.4 + 0.35 * Math.sin(this.time * 6)
        : this.state === 'attract' ? t.saucer.glowLevel : 0.15;
    Object.values(t.rollovers).forEach((r) => {
      if (r.id.startsWith('lane')) {
        const i = ['P', 'I', 'N'].indexOf(r.id.slice(4));
        if (this.state === 'play' || this.state === 'ready') {
          r.setLit(
            this.laneLit[i] ||
            (this.skillActive && i === this.skillLane && Math.floor(this.time * 6) % 2 === 0)
          );
        }
      }
    });
  }

  private checkDrains() {
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      if (b.captured || !b.body.isActive()) continue;
      if (b.body.getPosition().y * PPU > L.DRAIN_Y) {
        this.removeBall(b);
        sfx.drain();
        this.fx.shake(3);
      }
    }
    if (this.state !== 'play') return;
    const act = this.activeBalls();
    if (act.length > 0) {
      if (this.inMultiball && act.length === 1) {
        this.inMultiball = false;
        this.msg('MULTIBALL 結束', 2);
      }
      return;
    }
    if (this.time < this.ballSaveUntil) {
      if (this.saving) return;
      this.saving = true;
      this.msg('BALL SAVED 球救援!', 1.6);
      sfx.ballSave();
      this.after(0.6, () => {
        this.saving = false;
        this.spawnBall(L.SPAWN.x, L.SPAWN.y);
        this.after(0.5, () => this.launch(0.65));
      });
      return;
    }
    this.endOfBall();
  }

  private endOfBall() {
    this.saving = false;
    for (const b of [...this.balls]) {
      if (b.captured) this.removeBall(b);
    }
    this.table.saucer.takeCaptured();
    this.state = 'bonus';
    const lanes = this.laneCompletions * 5000;
    this.bonusTotal = this.tilt ? 0 : this.mult * SC.bonusPer + lanes;
    this.bonusElapsed = 0;
    this.bonusAdded = 0;
    if (this.tilt) {
      this.msg('TILT — 本球無獎勵', 1.8);
    } else {
      this.msg(`BONUS 獎勵 ×${this.mult}`, 1.8);
    }
    sfx.drain();
  }

  private nextBall() {
    this.tilt = false;
    this.tiltTimes = [];
    this.table.flippers.L.forceDown();
    this.table.flippers.R.forceDown();
    if (this.extraBalls > 0) {
      this.extraBalls--;
      this.msg('EXTRA BALL 加球!', 2);
      sfx.extraBall();
    } else {
      this.ballNum++;
      this.hudDirty = true;
      if (this.ballNum > this.totalBalls) {
        this.gameOver();
        return;
      }
    }
    this.state = 'ready';
    this.spawnBall(L.SPAWN.x, L.SPAWN.y);
  }

  private gameOver() {
    this.state = 'over';
    this.overAt = this.time + 6;
    const hs = JSON.parse(localStorage.getItem('np3d-highscores') || '[]') as number[];
    hs.push(this.score);
    hs.sort((a, b) => b - a);
    localStorage.setItem('np3d-highscores', JSON.stringify(hs.slice(0, 5)));
    this.high = hs[0] ?? this.high;
    this.hud.high.textContent = fmtScore(this.high);
    this.hudDirty = true;
    this.dmd.setInfo(`GAME OVER — 最終得分 ${fmtScore(this.score)} — 按 LAUNCH 再來一局`);
    sfx.gameOver();
  }

  newGame() {
    this.saving = false;
    for (const b of this.balls) ph.world.destroyBody(b.body);
    this.balls = [];
    this.tasks = [];
    this.score = 0;
    this.ballNum = 1;
    this.extraBalls = 0;
    this.mult = 1;
    this.laneLit = [false, false, false];
    this.laneCompletions = 0;
    this.lockLit = false;
    this.locks = 0;
    this.lockedBalls = [];
    this.multiballReady = false;
    this.inMultiball = false;
    this.tilt = false;
    this.tiltTimes = [];
    this.standupLit = [false, false];
    this.standupRounds = 0;
    this.table.standups.reset();
    this.spinnerDoubleUntil = 0;
    this.feverHits = [];
    this.feverUntil = 0;
    this.comboTimes = [];
    this.combo = 0;
    this.nextExtra = SC.extraBallScore;
    this.charging = false;
    this.charge = 0;
    this.table.plunger.setCharge(0);
    this.hud.power.style.width = '0%';
    this.hudDirty = true;
    this.state = 'ready';
    this.dmd.setScroll(null);
    this.spawnBall(L.SPAWN.x, L.SPAWN.y);
    this.msg('第 1 球 BALL 1', 2);
    sfx.gameStart();
    startMusic();
  }

  pressFlipper(side: 'L' | 'R') {
    if (this.tilt || this.paused) return;
    this.table.flippers[side].press();
    if (this.state === 'play') {
      const lit = this.laneLit;
      if (lit.some(Boolean) && !lit.every(Boolean)) {
        this.laneLit = side === 'L' ? [lit[1], lit[2], lit[0]] : [lit[2], lit[0], lit[1]];
        Object.keys(this.table.rollovers).forEach((k, i) => {
          if (k.startsWith('lane')) this.table.rollovers[k].setLit(this.laneLit[i]);
        });
      }
    }
  }

  releaseFlipper(side: 'L' | 'R') {
    this.table.flippers[side].release();
  }

  startCharge() {
    if (this.paused) return;
    if ((this.state === 'ready' || this.state === 'play') && this.ballOnPlunger()) {
      this.charging = true;
      this.charge = 0;
    }
  }

  releaseCharge() {
    if (!this.charging) return;
    this.charging = false;
    const c = this.charge;
    this.charge = 0;
    this.table.plunger.setCharge(0);
    this.hud.power.style.width = '0%';
    if (this.state === 'ready' || this.state === 'play') this.launch(c);
  }

  launch(power: number) {
    const ball = this.ballOnPlunger();
    if (!ball) return;
    const v = LAUNCH_V_MIN + (LAUNCH_V_MAX - LAUNCH_V_MIN) * power;
    const m = ball.body.getMass();
    ball.body.applyLinearImpulse(ph.vec(0, -v * m), ball.body.getPosition(), true);
    sfx.launch(power);
    this.fx.shake(2 + power * 5);
    this.state = 'play';
    this.ballSaveUntil = this.time + BALL_SAVE_S;
    this.skillActive = true;
    this.skillUntil = this.time + SKILL_WINDOW_S;
    this.skillLane = Math.floor(Math.random() * 3);
    this.msg(`技巧射門: ${['P', 'I', 'N'][this.skillLane]} 道`, 2.2);
    if (this.multiballReady) {
      this.multiballReady = false;
      this.inMultiball = true;
      this.after(0.3, () => this.msg('MULTIBALL!! 3 BALLS', 2.5));
      this.lockedBalls.forEach((b, i) => {
        this.after(0.45 + i * 0.35, () => {
          b.setActive(true);
          b.setPosition(ph.vecP(L.SAUCER.x, L.SAUCER.y - 8));
          b.setLinearVelocity(ph.vec(i === 0 ? -7 : 7, -34));
          b.setAwake(true);
          sfx.saucerOut();
        });
      });
      this.lockedBalls = [];
    }
  }

  nudge(dir: 'L' | 'R' | 'U') {
    if (this.state !== 'play' || this.paused) return;
    if (this.tilt) return;
    this.tiltTimes.push(this.time);
    if (this.tiltTimes.filter((t) => t > this.time - TILT_WINDOW_S).length >= TILT_MAX) {
      this.tilt = true;
      this.table.flippers.L.forceDown();
      this.table.flippers.R.forceDown();
      this.msg('TILT !! 犯規', 3, true);
      sfx.tilt();
      this.fx.shake(10);
      return;
    }
    sfx.nudge();
    this.fx.shake(3.5);
    for (const b of this.activeBalls()) {
      const m = b.body.getMass();
      const imp = dir === 'L' ? ph.vec(-3.6 * m, 0) : dir === 'R' ? ph.vec(3.6 * m, 0) : ph.vec(0, -3.6 * m);
      b.body.applyLinearImpulse(imp, b.body.getPosition(), true);
    }
    if (this.tiltTimes.length >= 2) this.msg(`小心 TILT! ${this.tiltTimes.length}/${TILT_MAX}`, 0.8);
  }

  togglePause() {
    this.paused = !this.paused;
  }

  private handle(e: { type: string; [k: string]: unknown }) {
    switch (e.type) {
      case 'bumper': {
        if (this.state !== 'play') break;
        this.feverHits.push(this.time);
        this.checkFever();
        const fever = this.time < this.feverUntil;
        this.addScore(Math.min(SC.bumperMax, SC.bumper + this.laneCompletions * SC.bumperStep) * (fever ? FEVER_MULT : 1));
        this.bumpCombo();
        sfx.bumper(e.index as number);
        this.fx.burst(e.x as number, e.y as number, cssC.orange, 10, 1.4);
        this.fx.shake(1.6);
        break;
      }
      case 'sling': {
        if (this.state !== 'play') break;
        this.addScore(SC.sling);
        this.bumpCombo();
        sfx.sling();
        this.fx.burst(e.x as number, e.y as number, cssC.magenta, 8, 1.2);
        this.fx.shake(1.8);
        break;
      }
      case 'drop': {
        if (this.state !== 'play') break;
        this.addScore(SC.drop);
        this.bumpCombo();
        sfx.drop();
        const d = L.DROPS[e.index as number];
        this.fx.burst(d.x, d.y, cssC.yellow, 8, 1.1);
        break;
      }
      case 'dropComplete': {
        if (this.state !== 'play') break;
        this.addScore(SC.dropComplete);
        this.spinnerDoubleUntil = this.time + SPINNER_DOUBLE_S;
        if (!this.inMultiball) {
          this.lockLit = true;
          this.msg('鎖球已點亮 LOCK LIT — 射入中央 LOCK', 2.5);
        } else {
          this.msg('+25000 全倒!', 1.5);
        }
        sfx.lock();
        break;
      }
      case 'standup': {
        if (this.state !== 'play') break;
        this.addScore(SC.standup);
        this.bumpCombo();
        sfx.standup();
        const i = e.index as number;
        this.standupLit[i] = true;
        this.table.standups.setLit(i, true);
        if (this.standupLit.every(Boolean)) {
          this.addScore(SC.standupPair);
          this.standupRounds++;
          this.standupLit = [false, false];
          this.table.standups.reset();
          if (this.standupRounds % 2 === 0 && this.extraBalls < 2) {
            this.extraBalls++;
            this.msg('EXTRA BALL 加球!', 2.5);
            sfx.extraBall();
          } else {
            this.msg('+10000', 1.2);
          }
        }
        break;
      }
      case 'rollover': {
        const id = e.id as string;
        if (id.startsWith('lane')) {
          const idx = ['P', 'I', 'N'].indexOf(id.slice(4));
          if (this.state === 'play' && this.skillActive && idx === this.skillLane) {
            this.addScore(SC.skill);
            this.msg('SKILL SHOT! +50000', 2);
            sfx.skill();
            this.skillActive = false;
          } else if (this.state === 'play') {
            this.addScore(SC.lane);
            sfx.lane();
          }
          this.laneLit[idx] = true;
          this.table.rollovers[id].setLit(true);
          if (this.laneLit.every(Boolean)) {
            this.laneLit = [false, false, false];
            Object.keys(this.table.rollovers).forEach((k) => {
              if (k.startsWith('lane')) this.table.rollovers[k].setLit(false);
            });
            if (this.mult < 8) this.mult++;
            this.laneCompletions++;
            this.hudDirty = true;
            if (this.state === 'play') {
              this.addScore(SC.laneComplete);
              this.msg(`P-I-N 完成! 倍率 ×${this.mult}`, 2);
              sfx.extraBall();
            }
          }
        } else if (this.state === 'play') {
          this.addScore(SC.inlane);
          sfx.lane();
        }
        break;
      }
      case 'spinner': {
        if (this.state !== 'play') break;
        this.addScore(SC.spinnerRev * (this.time < this.spinnerDoubleUntil ? 2 : 1));
        sfx.spinner();
        break;
      }
      case 'spinnerTick': {
        if (this.state !== 'play') break;
        this.addScore(SC.spinnerTick * (this.time < this.spinnerDoubleUntil ? 2 : 1));
        break;
      }
      case 'saucer': {
        if (this.state !== 'play') break;
        const ball = e.ball as planck.Body;
        if (this.table.saucer.hasCaptured()) break;
        sfx.saucerIn();
        if (this.lockLit && !this.inMultiball && this.locks < 2 && this.activeBalls().length === 1) {
          this.table.saucer.capture(ball);
          const b = this.balls.find((x) => x.body === ball);
          if (b) b.captured = true;
          this.lockLit = false;
          this.after(1.2, () => {
            this.locks++;
            this.addScore(SC.lock);
            sfx.lock();
            const taken = this.table.saucer.takeCaptured();
            if (taken) this.lockedBalls.push(taken);
            if (this.locks >= 2) {
              this.multiballReady = true;
              this.msg('2 球已鎖定! 發射啟動 MULTIBALL', 3);
            } else {
              this.msg(`球已鎖定 ${this.locks}/2`, 2);
            }
            this.state = 'ready';
            this.spawnBall(L.SPAWN.x, L.SPAWN.y);
          });
        } else {
          this.table.saucer.capture(ball);
          const b = this.balls.find((x) => x.body === ball);
          if (b) b.captured = true;
          const jackpot = this.inMultiball;
          this.after(0.9, () => {
            this.addScore(jackpot ? SC.jackpot : SC.saucer);
            if (jackpot) {
              this.msg('JACKPOT! +100000', 2);
              sfx.jackpot();
              this.fx.burst(L.SAUCER.x, L.SAUCER.y, cssC.yellow, 30, 2.2);
              this.fx.shake(6);
            } else {
              this.msg(`+${fmtScore(SC.saucer * this.mult)}`, 1.2);
              sfx.saucerOut();
            }
            const taken = this.table.saucer.takeCaptured();
            if (taken) {
              this.table.saucer.eject(taken, Math.random() * 10 - 5, -30);
              const bb = this.balls.find((x) => x.body === taken);
              if (bb) bb.captured = false;
            }
          });
        }
        break;
      }
      default:
        break;
    }
  }
}
