import { Application, Container } from 'pixi.js';
import './style.css';
import { TABLE_H, TABLE_W } from './config';
import * as ph from './physics';
import { buildArt } from './art';
import { buildTable } from './build';
import { Game, Hud } from './game';
import { DMD } from './dmd';
import { Particles, shake } from './fx';
import { bindInput } from './input';

async function boot() {
  const app = new Application();
  await app.init({
    antialias: true,
    background: 0x05050c,
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
    width: TABLE_W,
    height: TABLE_H
  });
  const stageEl = document.getElementById('stage')!;
  stageEl.appendChild(app.canvas as HTMLCanvasElement);

  const root = new Container();
  app.stage.addChild(root);
  const base = { x: 0, y: 0 };

  const bg = new Container();
  const dyn = new Container();
  const glow = new Container();
  const fxLayer = new Container();
  root.addChild(bg, dyn, glow, fxLayer);

  buildArt(bg);
  const particles = new Particles(fxLayer);
  const table = buildTable(dyn, glow, () => {});

  const dmd = new DMD(document.getElementById('dmd') as HTMLCanvasElement);
  const hud: Hud = {
    score: document.getElementById('score')!,
    ball: document.getElementById('ball-num')!,
    mult: document.getElementById('multiplier')!,
    high: document.getElementById('highscore')!,
    power: document.querySelector('#power-bar i') as HTMLElement
  };
  const game = new Game(table, dmd, hud, dyn, fxLayer, particles);
  bindInput(game, document.getElementById('btn-mute') as HTMLButtonElement);
  (window as unknown as Record<string, unknown>).__game = game;
  (window as unknown as Record<string, unknown>).__world = ph.world;

  const wrap = document.getElementById('stage-wrap')!;
  const fit = () => {
    const availW = wrap.clientWidth;
    const availH = wrap.clientHeight;
    const s = Math.min(availW / TABLE_W, availH / TABLE_H);
    root.scale.set(s);
    base.x = (availW - TABLE_W * s) / 2;
    base.y = (availH - TABLE_H * s) / 2;
    app.renderer.resize(availW, availH);
  };
  window.addEventListener('resize', fit);
  fit();

  app.ticker.add((ticker) => {
    const dt = Math.min(ticker.deltaMS / 1000, 0.1);
    game.update(dt);
    root.position.set(base.x + shake.ox(), base.y + shake.oy());
  });
}

void boot();
