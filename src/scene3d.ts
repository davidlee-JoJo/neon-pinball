import { Engine } from '@babylonjs/core/Engines/engine';
import { Scene } from '@babylonjs/core/scene';
import { Vector3, Color3 } from '@babylonjs/core/Maths/math';
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight';
import { SpotLight } from '@babylonjs/core/Lights/spotLight';
import { PointLight } from '@babylonjs/core/Lights/pointLight';
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import '@babylonjs/core/Culling/ray';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture';
import * as planck from 'planck';
import { BALL_R, PPU, C } from './config';
import * as L from './layout';
import type { Table } from './table';
import type { Flipper } from './entities';
import { DMD3D } from './dmd3d';

const S = 100;
const PX = (x: number) => (x - 240) / S;
const PZ = (y: number) => (y - 450) / S;
const WALL_H = 0.42;
const WALL_T = 0.12;

const col = (hex: number) => Color3.FromHexString('#' + hex.toString(16).padStart(6, '0'));

interface BallView {
  body: planck.Body;
  captured: boolean;
}

class Shake {
  amt = 0;
  add(a: number) {
    this.amt = Math.min(1.6, this.amt + a / 10);
  }
  update(dt: number) {
    this.amt = Math.max(0, this.amt - dt * 2.2);
  }
  ox() {
    return (Math.random() * 2 - 1) * this.amt * 0.06;
  }
  oy() {
    return (Math.random() * 2 - 1) * this.amt * 0.04;
  }
}

class SparkPool {
  private items: { mesh: Mesh; mat: StandardMaterial; vx: number; vy: number; vz: number; life: number; max: number }[] = [];
  private idx = 0;

  constructor(scene: Scene, count = 56) {
    for (let i = 0; i < count; i++) {
      const mesh = MeshBuilder.CreateSphere('sp' + i, { diameter: 0.05, segments: 4 }, scene);
      const mat = new StandardMaterial('spm' + i, scene);
      mat.emissiveColor = new Color3(1, 1, 1);
      mat.diffuseColor = Color3.Black();
      mat.specularColor = Color3.Black();
      mesh.material = mat;
      mesh.setEnabled(false);
      this.items.push({ mesh, mat, vx: 0, vy: 0, vz: 0, life: 0, max: 1 });
    }
  }

  spawn(x: number, z: number, color: string, n: number, speed: number) {
    const c = Color3.FromHexString(color);
    for (let i = 0; i < n; i++) {
      const s = this.items[this.idx];
      this.idx = (this.idx + 1) % this.items.length;
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.5 + Math.random() * 0.9);
      s.mesh.position.set(x, 0.12, z);
      s.vx = Math.cos(a) * v;
      s.vz = Math.sin(a) * v;
      s.vy = (0.4 + Math.random() * 0.9) * v;
      s.max = 0.45 + Math.random() * 0.3;
      s.life = s.max;
      s.mat.emissiveColor = c;
      s.mesh.setEnabled(true);
    }
  }

  update(dt: number) {
    for (const s of this.items) {
      if (s.life <= 0) continue;
      s.life -= dt;
      if (s.life <= 0) {
        s.mesh.setEnabled(false);
        continue;
      }
      s.vy -= 9 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y = Math.max(0.02, s.mesh.position.y + s.vy * dt);
      s.mesh.position.z += s.vz * dt;
      const k = s.life / s.max;
      s.mesh.scaling.setAll(0.4 + k);
    }
  }
}

export interface Scene3D {
  engine: Engine;
  scene: Scene;
  dmd: DMD3D;
  syncTable(table: Table): void;
  syncBalls(balls: BallView[]): void;
  setCharge(c: number): void;
  burst(x: number, y: number, color: string, n?: number, speed?: number): void;
  shake(a: number): void;
  frame(dt: number, primary: BallView | null): void;
}

function neonMat(scene: Scene, name: string, color: Color3, glow = 0.55): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = color.scale(0.25);
  m.emissiveColor = color.scale(glow);
  m.specularColor = Color3.Black();
  return m;
}

function darkMat(scene: Scene, name: string, r: number, g: number, b: number): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = new Color3(r, g, b);
  m.specularColor = new Color3(0.08, 0.08, 0.1);
  m.specularPower = 64;
  return m;
}

function wallBoxes(pts: L.Pt[], closed: boolean, h: number, t: number, list: Mesh[], strips: Mesh[], scene: Scene, stripMat: StandardMaterial | null) {
  const n = pts.length;
  const segs: [L.Pt, L.Pt][] = [];
  for (let i = 0; i < n - 1; i++) segs.push([pts[i], pts[i + 1]]);
  if (closed) segs.push([pts[n - 1], pts[0]]);
  for (const [a, b] of segs) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) / S + t;
    if (len <= t) continue;
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    const ang = Math.atan2(-(dy / S), dx / S);
    const box = MeshBuilder.CreateBox('w', { width: len, height: h, depth: t }, scene);
    box.position.set(PX(mx), h / 2, PZ(my));
    box.rotation.y = ang;
    list.push(box);
    if (stripMat) {
      const st = MeshBuilder.CreateBox('ws', { width: len - t * 0.2, height: 0.03, depth: 0.035 }, scene);
      st.material = stripMat;
      st.position.set(PX(mx), h + 0.012, PZ(my));
      st.rotation.y = ang;
      strips.push(st);
    }
  }
}

function paintPlayfield(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 960;
  cv.height = 1640;
  const g = cv.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 1640);
  grad.addColorStop(0, '#0d0d22');
  grad.addColorStop(0.5, '#0a0a18');
  grad.addColorStop(1, '#12122e');
  g.fillStyle = grad;
  g.fillRect(0, 0, 960, 1640);

  const X = (x: number) => x * 2;
  const Y = (y: number) => 1640 - y * 2;

  g.strokeStyle = 'rgba(60,80,160,0.25)';
  g.lineWidth = 2;
  for (let i = 0; i <= 24; i++) {
    g.beginPath();
    g.moveTo(i * 40, 0);
    g.lineTo(i * 40, 1640);
    g.stroke();
  }
  for (let i = 0; i <= 41; i++) {
    g.beginPath();
    g.moveTo(0, i * 40);
    g.lineTo(960, i * 40);
    g.stroke();
  }

  const neon = (color: string, blur = 18) => {
    g.shadowColor = color;
    g.shadowBlur = blur;
  };

  neon('#00eaff', 22);
  g.strokeStyle = 'rgba(0,234,255,0.8)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(X(240), Y(250), 225 * 2 - 24, Math.PI, 0);
  g.stroke();

  for (const b of L.BUMPERS) {
    neon('#ff9a3d', 26);
    g.strokeStyle = 'rgba(255,154,61,0.85)';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(X(b.x), Y(b.y), b.r * 2 + 14, 0, Math.PI * 2);
    g.stroke();
    g.beginPath();
    g.arc(X(b.x), Y(b.y), 10, 0, Math.PI * 2);
    g.fillStyle = 'rgba(255,154,61,0.5)';
    g.fill();
  }

  neon('#ffe94a', 24);
  g.strokeStyle = 'rgba(255,233,74,0.8)';
  g.lineWidth = 5;
  g.setLineDash([16, 12]);
  g.beginPath();
  g.arc(X(240), Y(478), 60, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);

  g.font = '900 150px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  neon('#ff2fd6', 34);
  g.fillStyle = 'rgba(255,47,214,0.28)';
  g.fillText('NEON', X(240), Y(620));
  neon('#00eaff', 30);
  g.font = '900 64px Arial';
  g.fillStyle = 'rgba(0,234,255,0.5)';
  g.fillText('PINBALL 3D', X(240), Y(545));

  g.font = '900 44px Arial';
  for (const ln of L.TOP_LANES) {
    neon('#00eaff', 16);
    g.fillStyle = 'rgba(0,234,255,0.75)';
    g.fillText(ln.letter, X(ln.x), Y(ln.y));
  }
  neon('#4dff88', 14);
  g.fillStyle = 'rgba(77,255,136,0.75)';
  g.font = '900 34px Arial';
  g.fillText('▲', X(L.INLANES[0].x), Y(L.INLANES[0].y));
  g.fillText('▲', X(L.INLANES[1].x), Y(L.INLANES[1].y));
  neon('#ff4757', 14);
  g.fillStyle = 'rgba(255,71,87,0.75)';
  g.fillText('✕', X(L.OUTLANE.x), Y(L.OUTLANE.y));

  g.setLineDash([10, 10]);
  neon('#9d5cff', 12);
  g.strokeStyle = 'rgba(157,92,255,0.6)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(X(45), Y(250));
  g.lineTo(X(45), Y(470));
  g.stroke();
  g.setLineDash([]);

  neon('#00eaff', 12);
  g.fillStyle = 'rgba(0,234,255,0.5)';
  for (let i = 0; i < 4; i++) {
    g.beginPath();
    g.moveTo(X(448), Y(720 - i * 40) + 14);
    g.lineTo(X(448) - 16, Y(720 - i * 40) - 12);
    g.lineTo(X(448) + 16, Y(720 - i * 40) - 12);
    g.closePath();
    g.fill();
  }

  return cv;
}

function paintTitle(): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = 1024;
  cv.height = 160;
  const g = cv.getContext('2d')!;
  g.fillStyle = '#07070f';
  g.fillRect(0, 0, 1024, 160);
  g.font = '900 92px Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.shadowColor = '#00eaff';
  g.shadowBlur = 30;
  g.fillStyle = '#9ff5ff';
  g.fillText('NEON PINBALL 3D', 512, 82);
  return cv;
}

export async function createScene(canvas: HTMLCanvasElement): Promise<Scene3D> {
  const engine = new Engine(canvas, true, { stencil: false, preserveDrawingBuffer: true });
  const scene = new Scene(engine);
  scene.useRightHandedSystem = true;
  scene.clearColor = Color3.FromHexString('#05050c').toColor4(1);

  const camera = new UniversalCamera('cam', new Vector3(0, 6.4, 8.4), scene);
  camera.setTarget(new Vector3(0, -0.7, 0.2));
  camera.fov = 0.88;
  camera.minZ = 0.1;

  const hemi = new HemisphericLight('hemi', new Vector3(0.2, 1, -0.1), scene);
  hemi.intensity = 0.42;
  hemi.groundColor = new Color3(0.08, 0.05, 0.16);

  const spot = new SpotLight('spot', new Vector3(0, 9.5, 0.6), new Vector3(0, -1, 0), 1.35, 6, scene);
  spot.intensity = 14;
  spot.range = 22;
  spot.diffuse = new Color3(1, 0.97, 0.9);

  const ptL = new PointLight('ptL', new Vector3(-2.6, 2.2, 1.6), scene);
  ptL.diffuse = col(C.magenta);
  ptL.intensity = 3.5;
  ptL.range = 12;
  const ptR = new PointLight('ptR', new Vector3(2.6, 2.2, 1.6), scene);
  ptR.diffuse = col(C.cyan);
  ptR.intensity = 3.5;
  ptR.range = 12;

  const glow = new GlowLayer('glow', scene);
  glow.intensity = 0.85;
  const shadow = new ShadowGenerator(1024, spot);
  shadow.useBlurExponentialShadowMap = true;
  shadow.blurKernel = 24;
  shadow.darkness = 0.45;

  const dmd = new DMD3D();
  const dmdTex = new DynamicTexture('dmdTex', { width: dmd.canvas.width, height: dmd.canvas.height }, scene, false);
  const dmdCtx = dmdTex.getContext();

  const matWall = darkMat(scene, 'wall', 0.13, 0.16, 0.26);
  const matDark = darkMat(scene, 'dark', 0.05, 0.05, 0.08);
  const matCyan = neonMat(scene, 'nCyan', col(C.cyan), 1.1);
  const matMagenta = neonMat(scene, 'nMag', col(C.magenta), 1.0);
  const matYellow = neonMat(scene, 'nYel', col(C.yellow), 1.0);
  const matOrange = neonMat(scene, 'nOrg', col(C.orange), 0.9);
  const matGreen = neonMat(scene, 'nGrn', col(C.green), 0.9);
  const matRed = neonMat(scene, 'nRed', col(C.red), 0.9);
  const matBall = new StandardMaterial('ball', scene);
  matBall.diffuseColor = new Color3(0.82, 0.86, 0.92);
  matBall.specularColor = new Color3(1, 1, 1);
  matBall.specularPower = 128;

  const struct: Mesh[] = [];
  const strips: Mesh[] = [];
  wallBoxes(L.WALL_OUTER, false, WALL_H, WALL_T, struct, strips, scene, matCyan);
  wallBoxes(L.LANE_GUIDE, false, WALL_H, WALL_T, struct, strips, scene, matCyan);
  for (const d of L.DIVIDERS) wallBoxes(d, false, WALL_H, WALL_T, struct, strips, scene, matCyan);
  wallBoxes(L.ORBIT_WALL, false, WALL_H, WALL_T, struct, strips, scene, matCyan);
  const ledges: Mesh[] = [];
  wallBoxes(L.ORBIT_FLOOR, false, 0.1, 0.08, ledges, [], scene, null);
  wallBoxes(L.DROP_BANK, false, 0.1, 0.08, ledges, [], scene, null);
  wallBoxes(L.STANDUP_WALL, false, 0.1, 0.08, ledges, [], scene, null);
  const capPts = [...L.WALL_OUTER, ...L.LANE_GUIDE, ...L.DIVIDERS.flat(), ...L.ORBIT_WALL];
  for (const p of capPts) {
    const cap = MeshBuilder.CreateCylinder('cap', { diameter: WALL_T * 1.6, height: WALL_H, tessellation: 10 }, scene);
    cap.position.set(PX(p[0]), WALL_H / 2, PZ(p[1]));
    struct.push(cap);
  }
  const wallMesh = Mesh.MergeMeshes(struct, true, true, undefined, false, true)!;
  wallMesh.material = matWall;
  wallMesh.receiveShadows = true;
  const stripMesh = Mesh.MergeMeshes(strips, true, true, undefined, false, true)!;
  stripMesh.material = matCyan;
  const ledgeMesh = Mesh.MergeMeshes(ledges, true, true, undefined, false, true)!;
  ledgeMesh.material = matDark;
  ledgeMesh.receiveShadows = true;

  const pfTex = new DynamicTexture('pf', { width: 960, height: 1640 }, scene, true);
  pfCtx(pfTex).drawImage(paintPlayfield(), 0, 0);
  pfTex.update(true);
  const matPF = new StandardMaterial('pf', scene);
  matPF.diffuseTexture = pfTex;
  matPF.emissiveTexture = pfTex;
  matPF.emissiveColor = new Color3(0.35, 0.35, 0.42);
  matPF.specularColor = new Color3(0.12, 0.12, 0.15);
  const pf = MeshBuilder.CreateGround('pf', { width: 480 / S, height: 820 / S }, scene);
  pf.material = matPF;
  pf.receiveShadows = true;

  const base = MeshBuilder.CreateBox('base', { width: 5.6, height: 0.5, depth: 9.0 }, scene);
  base.position.set(0, -0.32, 0.05);
  base.material = darkMat(scene, 'cab', 0.07, 0.08, 0.16);

  const bb = MeshBuilder.CreateBox('backbox', { width: 5.6, height: 2.2, depth: 0.35 }, scene);
  bb.position.set(0, 1.25, -4.55);
  bb.material = darkMat(scene, 'bbm', 0.06, 0.07, 0.14);

  const dmdPlane = MeshBuilder.CreatePlane('dmdPlane', { width: 4.4, height: 1.1, sideOrientation: Mesh.DOUBLESIDE }, scene);
  dmdPlane.position.set(0, 1.0, -4.3);
  const matDMD = new StandardMaterial('dmdMat', scene);
  matDMD.emissiveTexture = dmdTex;
  matDMD.diffuseColor = Color3.Black();
  matDMD.specularColor = Color3.Black();
  matDMD.backFaceCulling = false;
  dmdPlane.material = matDMD;
  glow.addExcludedMesh(dmdPlane);

  const titleTex = new DynamicTexture('titleTex', { width: 1024, height: 160 }, scene, true);
  pfCtx(titleTex).drawImage(paintTitle(), 0, 0);
  titleTex.update(true);
  const titlePlane = MeshBuilder.CreatePlane('titlePlane', { width: 4.4, height: 0.69, sideOrientation: Mesh.DOUBLESIDE }, scene);
  titlePlane.position.set(0, 1.88, -4.3);
  const matTitle = new StandardMaterial('titleMat', scene);
  matTitle.emissiveTexture = titleTex;
  matTitle.diffuseColor = Color3.Black();
  matTitle.specularColor = Color3.Black();
  matTitle.backFaceCulling = false;
  titlePlane.material = matTitle;
  glow.addExcludedMesh(titlePlane);

  const bbStripL = MeshBuilder.CreateBox('bbsl', { width: 0.06, height: 1.7, depth: 0.06 }, scene);
  bbStripL.position.set(-2.75, 1.1, -4.36);
  bbStripL.material = matMagenta;
  const bbStripR = bbStripL.clone('bbsr');
  bbStripR.position.x = 2.75;

  const flippers: Record<'L' | 'R', Mesh> = {} as never;
  const flipMats: Record<'L' | 'R', StandardMaterial> = {} as never;
  const makeFlipper = (side: 'L' | 'R') => {
    const P = side === 'L' ? L.FLIPPER_L : L.FLIPPER_R;
    const len = 62, r1 = 8, r2 = 4.5, tip = 45 * Math.PI / 180;
    const pts = [
      [0, -r1], [len, -r2], [len + r2 * Math.cos(tip), -r2 * Math.sin(tip)],
      [len + r2, 0], [len + r2 * Math.cos(tip), r2 * Math.sin(tip)], [len, r2],
      [0, r1], [-r1, 0]
    ].map((p) => new Vector3(p[0] / S, p[1] / S, 0));
    const m = MeshBuilder.ExtrudeShape('flip' + side, {
      shape: pts,
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 0.16)],
      cap: Mesh.CAP_ALL,
      sideOrientation: Mesh.DOUBLESIDE,
      closeShape: true
    });
    m.rotation.x = Math.PI / 2;
    m.position.y = 0.08;
    m.bakeCurrentTransformIntoVertices();
    m.position.set(PX(P.x), 0.09, PZ(P.y));
    const fm = darkMat(scene, 'flipMat' + side, 0.1, 0.11, 0.2);
    fm.emissiveColor = (side === 'L' ? col(C.cyan) : col(C.magenta)).scale(0.3);
    m.material = fm;
    m.receiveShadows = true;
    shadow.addShadowCaster(m);
    flippers[side] = m;
    flipMats[side] = fm;
    return m;
  };
  makeFlipper('L');
  makeFlipper('R');

  const bumperViews = L.BUMPERS.map((b) => {
    const x = PX(b.x), z = PZ(b.y);
    const baseM = MeshBuilder.CreateCylinder('bp', { diameter: (b.r * 2) / S, height: 0.2, tessellation: 24 }, scene);
    baseM.position.set(x, 0.1, z);
    baseM.material = darkMat(scene, 'bpb', 0.09, 0.05, 0.15);
    baseM.receiveShadows = true;
    const ring = MeshBuilder.CreateTorus('bpr', { diameter: (b.r * 2 + 6) / S, thickness: 0.035, tessellation: 32 }, scene);
    ring.position.set(x, 0.21, z);
    const rm = neonMat(scene, 'bpr' + b.x, col(C.orange), 0.8);
    ring.material = rm;
    const dome = MeshBuilder.CreateSphere('bpd', { diameter: 0.22, segments: 12 }, scene);
    dome.position.set(x, 0.27, z);
    const dm = neonMat(scene, 'bpd' + b.x, col(C.yellow), 0.7);
    dome.material = dm;
    shadow.addShadowCaster(baseM);
    return { ring, ringMat: rm, dome, domeMat: dm, x, z };
  });

  const slingViews = [L.SLING_L, L.SLING_R].map((pts, i) => {
    const cx = (pts[0][0] + pts[1][0] + pts[2][0]) / 3;
    const cy = (pts[0][1] + pts[1][1] + pts[2][1]) / 3;
    const shape = pts.map((p) => new Vector3((p[0] - cx) / S, (p[1] - cy) / S, 0));
    const m = MeshBuilder.ExtrudeShape('sl' + i, {
      shape,
      path: [new Vector3(0, 0, 0), new Vector3(0, 0, 0.18)],
      cap: Mesh.CAP_ALL,
      sideOrientation: Mesh.DOUBLESIDE,
      closeShape: true
    });
    m.rotation.x = Math.PI / 2;
    m.position.y = 0.09;
    m.bakeCurrentTransformIntoVertices();
    m.position.set(PX(cx), 0.09, PZ(cy));
    const sm = neonMat(scene, 'slm' + i, col(C.magenta), 0.55);
    m.material = sm;
    m.receiveShadows = true;
    return { mesh: m, mat: sm };
  });

  const dropViews = L.DROPS.map((d, i) => {
    const m = MeshBuilder.CreateBox('dr' + i, { width: 0.22, height: 0.1, depth: 0.1 }, scene);
    m.position.set(PX(d.x), 0.05, PZ(d.y));
    m.rotation.y = -d.angle;
    const dm = neonMat(scene, 'drm' + i, col(C.yellow), 0.8);
    m.material = dm;
    shadow.addShadowCaster(m);
    const lp = MeshBuilder.CreatePlane('drl' + i, { width: 0.2, height: 0.14 }, scene);
    lp.position.set(PX(d.x) - Math.sin(d.angle) * 0.001, 0.12, PZ(d.y));
    lp.rotation.y = -d.angle;
    const lt = new DynamicTexture('drlt' + i, { width: 64, height: 44 }, scene, true);
    const lc = lt.getContext() as unknown as CanvasRenderingContext2D;
    lc.fillStyle = '#000';
    lc.fillRect(0, 0, 64, 44);
    lc.font = '900 36px Arial';
    lc.textAlign = 'center';
    lc.textBaseline = 'middle';
    lc.shadowColor = '#ffe94a';
    lc.shadowBlur = 8;
    lc.fillStyle = '#ffe94a';
    lc.fillText(d.letter, 32, 24);
    lt.update(true);
    const lm = new StandardMaterial('drlm' + i, scene);
    lm.emissiveTexture = lt;
    lm.diffuseColor = Color3.Black();
    lm.specularColor = Color3.Black();
    lp.material = lm;
    lp.parent = m;
    lp.position.set(0, 0.09, 0);
    lp.rotation.set(-Math.PI / 2, 0, 0);
    return { mesh: m, mat: dm };
  });

  const standupViews = L.STANDUPS.map((s, i) => {
    const m = MeshBuilder.CreateBox('su' + i, { width: 0.2, height: 0.11, depth: 0.09 }, scene);
    m.position.set(PX(s.x), 0.055, PZ(s.y));
    m.rotation.y = -s.angle;
    const sm = neonMat(scene, 'sum' + i, col(C.green), 0.25);
    m.material = sm;
    shadow.addShadowCaster(m);
    return { mesh: m, mat: sm };
  });

  const rolloverViews: Record<string, { mesh: Mesh; mat: StandardMaterial; color: Color3 }> = {};
  const addRoll = (id: string, x: number, y: number, w: number, d: number, color: number) => {
    const m = MeshBuilder.CreateBox('ro' + id, { width: w / S, height: 0.012, depth: d / S }, scene);
    m.position.set(PX(x), 0.008, PZ(y));
    const rm = neonMat(scene, 'rom' + id, col(color), 0.25);
    m.material = rm;
    rolloverViews[id] = { mesh: m, mat: rm, color: col(color) };
  };
  for (const ln of L.TOP_LANES) addRoll('lane' + ln.letter, ln.x, ln.y, 32, 16, C.cyan);
  addRoll('inL', L.INLANES[0].x, L.INLANES[0].y, 24, 16, C.green);
  addRoll('inR', L.INLANES[1].x, L.INLANES[1].y, 24, 16, C.green);
  addRoll('outL', L.OUTLANE.x, L.OUTLANE.y, 22, 16, C.red);

  const saucerX = PX(L.SAUCER.x), saucerZ = PZ(L.SAUCER.y);
  const hole = MeshBuilder.CreateCylinder('hole', { diameter: (L.SAUCER.r * 2 - 4) / S, height: 0.02, tessellation: 32 }, scene);
  hole.position.set(saucerX, 0.012, saucerZ);
  hole.material = matDark;
  const saucerRing = MeshBuilder.CreateTorus('sr', { diameter: (L.SAUCER.r * 2 + 4) / S, thickness: 0.03, tessellation: 40 }, scene);
  saucerRing.position.set(saucerX, 0.02, saucerZ);
  const saucerMat = neonMat(scene, 'srm', col(C.yellow), 0.3);
  saucerRing.material = saucerMat;

  const spinnerX = PX(L.SPINNER.x), spinnerZ = PZ(L.SPINNER.y);
  const spinnerMesh = MeshBuilder.CreateBox('spn', { width: 0.06, height: 0.5, depth: 0.09 }, scene);
  spinnerMesh.position.set(spinnerX, 0.25, spinnerZ);
  spinnerMesh.material = matCyan;
  shadow.addShadowCaster(spinnerMesh);

  const plungerX = PX(L.PLUNGER.x);
  const knob = MeshBuilder.CreateBox('knob', { width: 0.3, height: 0.12, depth: 0.22 }, scene);
  knob.position.set(plungerX, 0.06, PZ(780));
  knob.material = matCyan;
  const rod = MeshBuilder.CreateCylinder('rod', { diameter: 0.07, height: 0.6, tessellation: 12 }, scene);
  rod.rotation.x = Math.PI / 2;
  rod.position.set(plungerX, 0.06, PZ(800));
  rod.material = matWall;
  shadow.addShadowCaster(knob);

  const ballGlow = new PointLight('bg', new Vector3(0, 1, 0), scene);
  ballGlow.diffuse = new Color3(1, 0.95, 0.85);
  ballGlow.intensity = 0;
  ballGlow.range = 2.6;

  const protoBall = MeshBuilder.CreateSphere('ballP', { diameter: (BALL_R * 2) / S, segments: 20 }, scene);
  protoBall.material = matBall;
  shadow.addShadowCaster(protoBall);
  protoBall.setEnabled(false);
  const ballPool: Mesh[] = [];
  const ballMap = new Map<planck.Body, Mesh>();
  const makeBallMesh = () => {
    const m = ballPool.pop() ?? (() => {
      const c = protoBall.clone('ballC');
      c.material = matBall;
      shadow.addShadowCaster(c);
      return c;
    })();
    m.setEnabled(true);
    return m;
  };

  const sparks = new SparkPool(scene);
  const shake = new Shake();

  const flashes: { light: PointLight; k: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const fl = new PointLight('fl' + i, new Vector3(0, -9, 0), scene);
    fl.intensity = 0;
    fl.range = 3.2;
    flashes.push({ light: fl, k: 0 });
  }
  let flashIdx = 0;

  const camBase = { pos: new Vector3(0, 6.4, 8.4), tgt: new Vector3(0, -0.7, 0.2) };
  let charge = 0;

  function pfCtx(dt: DynamicTexture) {
    return dt.getContext();
  }

  const api: Scene3D = {
    engine,
    scene,
    dmd,
    setCharge(c: number) {
      charge = c;
    },
    burst(x: number, y: number, color: string, n = 10, speed = 1.3) {
      sparks.spawn(PX(x), PZ(y), color, n, speed);
      const f = flashes[flashIdx];
      flashIdx = (flashIdx + 1) % flashes.length;
      f.light.position.set(PX(x), 0.7, PZ(y));
      f.light.diffuse = Color3.FromHexString(color);
      f.k = 1;
    },
    shake(a: number) {
      shake.add(a);
    },
    syncTable(table: Table) {
      for (const side of ['L', 'R'] as const) {
        const f: Flipper = table.flippers[side];
        const P = f.pivot;
        flippers[side].rotation.y = -f.body.getAngle();
        flippers[side].position.set(PX(P.x), 0.09, PZ(P.y));
      }
      bumperViews.forEach((v, i) => {
        const p = table.bumpers[i].pulse;
        v.ringMat.emissiveColor = col(C.orange).scale(0.4 + p * 1.6);
        v.domeMat.emissiveColor = col(C.yellow).scale(0.35 + p * 1.6);
        v.dome.scaling.setAll(1 + p * 0.25);
      });
      slingViews.forEach((v, i) => {
        const p = table.slings[i].pulse;
        v.mat.emissiveColor = col(C.magenta).scale(0.35 + p * 1.7);
      });
      dropViews.forEach((v, i) => {
        const t = table.drops.targets[i];
        v.mesh.position.y = t.active ? 0.05 : -0.14;
        v.mat.emissiveColor = col(C.yellow).scale(t.active ? 0.8 : 0.05);
        v.mesh.getChildMeshes()[0].setEnabled(t.active);
      });
      standupViews.forEach((v, i) => {
        const lit = table.standups.items[i].lit;
        v.mat.emissiveColor = col(C.green).scale(lit ? 1.3 : 0.18);
      });
      for (const [id, v] of Object.entries(rolloverViews)) {
        const lit = table.rollovers[id]?.lit ?? false;
        v.mat.emissiveColor = v.color.scale(lit ? 1.25 : 0.16);
      }
      spinnerMesh.rotation.x = table.spinner.angle;
      saucerMat.emissiveColor = col(C.yellow).scale(0.12 + table.saucer.glowLevel * 1.2);
      knob.position.z = PZ(780) + charge * 0.42;
      rod.position.z = PZ(800) + charge * 0.42;
    },
    syncBalls(balls: BallView[]) {
      const seen = new Set<planck.Body>();
      for (const b of balls) {
        if (b.captured || !b.body.isActive()) continue;
        seen.add(b.body);
        let m = ballMap.get(b.body);
        if (!m) {
          m = makeBallMesh();
          ballMap.set(b.body, m);
        }
        const p = b.body.getPosition();
        m.position.set(p.x * PPU / S - 240 / S, BALL_R / S, p.y * PPU / S - 450 / S);
      }
      for (const [body, m] of [...ballMap]) {
        if (!seen.has(body)) {
          m.setEnabled(false);
          ballMap.delete(body);
          ballPool.push(m);
        }
      }
    },
    frame(dt: number, primary: BallView | null) {
      sparks.update(dt);
      shake.update(dt);
      for (const f of flashes) {
        if (f.k > 0) {
          f.k = Math.max(0, f.k - dt * 3.2);
          f.light.intensity = f.k * 5;
        }
      }
      let px = 0, active = false;
      if (primary && !primary.captured && primary.body.isActive()) {
        const p = primary.body.getPosition();
        px = (p.x * PPU - 240) / S;
        ballGlow.position.set(px, 0.5, (p.y * PPU - 450) / S);
        ballGlow.intensity = 3;
        active = true;
      }
      if (!active) ballGlow.intensity = 0;

      const sx = shake.ox();
      camera.position.set(camBase.pos.x + sx, camBase.pos.y, camBase.pos.z);
      camera.setTarget(new Vector3(camBase.tgt.x + sx, camBase.tgt.y, camBase.tgt.z));

      dmdCtx.drawImage(dmd.canvas, 0, 0);
      dmdTex.update(true);
    }
  };

  return api;
}
