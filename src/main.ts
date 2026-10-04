import './style.css';
import { Vector3 } from '@babylonjs/core/Maths/math';
import * as planck from 'planck';
import * as ph from './physics';
import { buildTable } from './table';
import { Game, Hud } from './rules';
import { createScene } from './scene3d';
import { bindInput } from './input';

async function boot() {
  const canvas = document.getElementById('c3d') as HTMLCanvasElement;
  const scene3d = await createScene(canvas);

  const table = buildTable(() => {});

  const hud: Hud = {
    score: document.getElementById('score')!,
    ball: document.getElementById('ball-num')!,
    mult: document.getElementById('multiplier')!,
    high: document.getElementById('highscore')!,
    power: document.querySelector('#power-bar i') as HTMLElement
  };

  const fx = {
    burst: (x: number, y: number, color: string, n?: number, speed?: number) => scene3d.burst(x, y, color, n, speed),
    shake: (a: number) => scene3d.shake(a)
  };

  const game = new Game(table, scene3d.dmd, hud, fx);
  bindInput(game, scene3d, document.getElementById('btn-mute') as HTMLButtonElement, document.getElementById('btn-pause') as HTMLButtonElement);

  (window as unknown as Record<string, unknown>).__game = game;
  (window as unknown as Record<string, unknown>).__world = ph.world;
  (window as unknown as Record<string, unknown>).__planck = planck;
  (window as unknown as Record<string, unknown>).__scene = scene3d.scene;
  (window as unknown as Record<string, unknown>).__V3 = Vector3;

  window.addEventListener('resize', () => scene3d.engine.resize());

  let last = performance.now();
  scene3d.engine.runRenderLoop(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    game.update(dt);
    scene3d.setCharge(game.charge);
    scene3d.syncTable(table);
    scene3d.syncBalls(game.balls);
    const primary = game.balls.find((b) => !b.captured) ?? null;
    scene3d.frame(dt, primary);
    scene3d.scene.render();
  });
}

void boot();
