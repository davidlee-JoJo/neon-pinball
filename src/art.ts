import { Container, Graphics, Sprite, Texture, Text } from 'pixi.js';
import { TABLE_W, TABLE_H, C } from './config';
import * as L from './layout';

function neonStroke(g: Graphics, pts: number[], color: number, w = 3) {
  g.poly(pts);
  g.stroke({ width: w * 3, color, alpha: 0.1 });
  g.poly(pts);
  g.stroke({ width: w * 1.7, color, alpha: 0.28 });
  g.poly(pts);
  g.stroke({ width: w, color, alpha: 0.95 });
}

function segPts(a: L.Pt, b: L.Pt) {
  return [a[0], a[1], b[0], b[1]];
}

function bgCanvas(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = TABLE_W;
  cv.height = TABLE_H;
  const c = cv.getContext('2d')!;
  const grad = c.createLinearGradient(0, 0, 0, TABLE_H);
  grad.addColorStop(0, '#0b0c1e');
  grad.addColorStop(0.5, '#0a0a16');
  grad.addColorStop(1, '#07070f');
  c.fillStyle = grad;
  c.fillRect(0, 0, TABLE_W, TABLE_H);

  c.strokeStyle = 'rgba(0,234,255,0.045)';
  c.lineWidth = 1;
  for (let i = 0; i < 26; i++) {
    c.beginPath();
    let x = Math.random() * TABLE_W;
    let y = Math.random() * TABLE_H;
    c.moveTo(x, y);
    for (let s = 0; s < 4; s++) {
      if (Math.random() < 0.5) x += (Math.random() - 0.5) * 90;
      else y += (Math.random() - 0.5) * 90;
      c.lineTo(x, y);
    }
    c.stroke();
    c.fillStyle = 'rgba(0,234,255,0.09)';
    c.fillRect(x - 1.5, y - 1.5, 3, 3);
  }

  c.strokeStyle = 'rgba(157,92,255,0.05)';
  for (let x = 0; x <= TABLE_W; x += 40) {
    c.beginPath();
    c.moveTo(x, 0);
    c.lineTo(x, TABLE_H);
    c.stroke();
  }
  for (let y = 0; y <= TABLE_H; y += 40) {
    c.beginPath();
    c.moveTo(0, y);
    c.lineTo(TABLE_W, y);
    c.stroke();
  }

  const vg = c.createRadialGradient(TABLE_W / 2, TABLE_H * 0.42, TABLE_H * 0.25, TABLE_W / 2, TABLE_H * 0.5, TABLE_H * 0.72);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  c.fillStyle = vg;
  c.fillRect(0, 0, TABLE_W, TABLE_H);
  return cv;
}

function label(parent: Container, text: string, x: number, y: number, size: number, color: number, alpha = 0.85, rot = 0) {
  const t = new Text({
    text,
    style: { fontFamily: 'Arial, "Microsoft JhengHei", sans-serif', fontSize: size, fontWeight: '700', fill: color, letterSpacing: 1 }
  });
  t.anchor.set(0.5);
  t.position.set(x, y);
  t.rotation = rot;
  t.alpha = alpha;
  parent.addChild(t);
  return t;
}

export function buildArt(bg: Container) {
  const s = new Sprite(Texture.from(bgCanvas()));
  bg.addChild(s);

  const g = new Graphics();
  neonStroke(g, L.WALL_OUTER.flatMap((p) => [p[0], p[1]]), C.cyan, 3);

  for (const d of L.DIVIDERS) neonStroke(g, segPts(d[0], d[1]), C.magenta, 3);
  neonStroke(g, segPts(L.ORBIT_WALL[0], L.ORBIT_WALL[1]), C.blue, 3);
  neonStroke(g, segPts(L.ORBIT_FLOOR[0], L.ORBIT_FLOOR[1]), C.blue, 3);
  neonStroke(g, segPts(L.DROP_BANK[0], L.DROP_BANK[1]), C.yellow, 3);
  neonStroke(g, segPts(L.STANDUP_WALL[0], L.STANDUP_WALL[1]), C.green, 3);
  neonStroke(g, segPts(L.GATE[0], L.GATE[1]), C.red, 2);

  for (const sl of [L.SLING_L, L.SLING_R]) {
    g.poly(sl.flatMap((p) => [p[0], p[1]]));
    g.stroke({ width: 1.5, color: C.magenta, alpha: 0.4 });
  }

  const sa = L.SAUCER;
  g.circle(sa.x, sa.y, sa.r + 8).stroke({ width: 1.5, color: C.yellow, alpha: 0.3 });
  label(g, 'LOCK', sa.x, sa.y + sa.r + 16, 9, C.yellow, 0.7);
  label(g, '鎖球', sa.x, sa.y + sa.r + 27, 9, C.yellow, 0.6);

  label(g, 'SPIN', L.SPINNER.x, L.SPINNER.y - 30, 9, C.cyan, 0.7, 0);

  const laneLetters = ['P', 'I', 'N'];
  L.TOP_LANES.forEach((ln, i) => {
    label(g, laneLetters[i], ln.x, ln.y - 26, 15, C.cyan, 0.9);
    g.moveTo(ln.x, ln.y + 14).lineTo(ln.x, ln.y + 26);
    g.stroke({ width: 2, color: C.cyan, alpha: 0.5 });
  });
  label(g, '技巧射門 SKILL SHOT', 235, 212, 9, C.cyan, 0.55);

  const arrows = new Graphics();
  for (const inn of L.INLANES) {
    arrows.moveTo(inn.x, inn.y - 18).lineTo(inn.x, inn.y + 10);
    arrows.moveTo(inn.x - 5, inn.y + 2).lineTo(inn.x, inn.y + 10).lineTo(inn.x + 5, inn.y + 2);
    arrows.stroke({ width: 2, color: C.green, alpha: 0.75 });
  }
  arrows.moveTo(L.OUTLANE.x, L.OUTLANE.y - 16).lineTo(L.OUTLANE.x, L.OUTLANE.y + 8);
  arrows.stroke({ width: 2, color: C.red, alpha: 0.55 });
  bg.addChild(g, arrows);

  const laneArc = new Graphics();
  laneArc.circle(L.ARC_C[0], L.ARC_C[1], L.ARC_R - 34).stroke({ width: 1, color: C.purple, alpha: 0.18 });
  laneArc.circle(L.ARC_C[0], L.ARC_C[1], L.INNER_R + 12).stroke({ width: 1, color: C.purple, alpha: 0.12 });
  bg.addChild(laneArc);

  const title = new Text({
    text: 'NEON PINBALL',
    style: { fontFamily: 'Arial', fontSize: 17, fontWeight: '900', fill: 0x1e3a5f, letterSpacing: 4 }
  });
  title.anchor.set(0.5);
  title.position.set(240, 234);
  title.alpha = 0.5;
  bg.addChild(title);
  label(bg, '霓 虹 彈 珠', 240, 254, 11, 0x14304f, 0.55);

  label(bg, '推桌 NUDGE', 240, 800, 9, 0x33406a, 0.5);
}
