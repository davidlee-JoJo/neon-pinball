import { Container, Sprite, Texture } from 'pixi.js';

const texCache = new Map<string, Texture>();

export function glowTexture(color: string, size = 64): Texture {
  const key = `glow_${color}_${size}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.25, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  const t = Texture.from(cv);
  texCache.set(key, t);
  return t;
}

export function ballTexture(size = 64): Texture {
  const key = `ball_${size}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const c = cv.getContext('2d')!;
  const r = size / 2;
  const g = c.createRadialGradient(r * 0.7, r * 0.6, r * 0.1, r, r, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#dfe9f5');
  g.addColorStop(0.7, '#7d8aa0');
  g.addColorStop(1, '#2a3140');
  c.fillStyle = g;
  c.beginPath();
  c.arc(r, r, r - 1, 0, Math.PI * 2);
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.5)';
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(r, r, r - 2, Math.PI * 0.9, Math.PI * 1.6);
  c.stroke();
  const t = Texture.from(cv);
  texCache.set(key, t);
  return t;
}

export class Lamp {
  sprite: Sprite;
  level = 0;
  target = 0;
  private decay = 3.2;

  constructor(color: string, size: number, parent: Container) {
    this.sprite = new Sprite(glowTexture(color));
    this.sprite.anchor.set(0.5);
    this.sprite.blendMode = 'add';
    this.sprite.width = size;
    this.sprite.height = size;
    this.sprite.alpha = 0;
    parent.addChild(this.sprite);
  }

  set(v: number) {
    this.target = v;
  }

  pulse(strength = 1) {
    this.level = Math.max(this.level, strength);
  }

  update(dt: number) {
    this.level = Math.max(this.target, this.level - this.decay * dt);
    const shown = Math.max(this.level, this.target);
    this.sprite.alpha = Math.min(1, shown);
    const s = 0.85 + Math.min(1, shown) * 0.45;
    this.sprite.scale.set(s * (this.sprite.width / 64));
  }

  place(x: number, y: number) {
    this.sprite.position.set(x, y);
  }
}

interface P {
  s: Sprite;
  vx: number;
  vy: number;
  life: number;
  ttl: number;
  g: number;
  size: number;
}

export class Particles {
  private pool: Sprite[] = [];
  private active: P[] = [];

  constructor(private parent: Container, private max = 260) {}

  private getSprite(): Sprite {
    let s = this.pool.pop();
    if (!s) {
      s = new Sprite(glowTexture('#ffffff', 32));
      s.anchor.set(0.5);
      s.blendMode = 'add';
    }
    this.parent.addChild(s);
    return s;
  }

  burst(x: number, y: number, color: string, n: number, speed = 120, size = 10, g = 260, ttl = 0.5) {
    for (let i = 0; i < n; i++) {
      if (this.active.length >= this.max) break;
      const s = this.getSprite();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      s.texture = glowTexture(color, 32);
      s.position.set(x, y);
      s.width = size;
      s.height = size;
      s.alpha = 1;
      const p: P = { s, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, ttl: ttl * (0.6 + Math.random() * 0.7), g, size };
      this.active.push(p);
    }
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life += dt;
      if (p.life >= p.ttl) {
        this.parent.removeChild(p.s);
        this.pool.push(p.s);
        this.active.splice(i, 1);
        continue;
      }
      p.vy += p.g * dt;
      p.vx *= 0.985;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      const k = 1 - p.life / p.ttl;
      p.s.alpha = k;
      const sc = p.size * (0.5 + k * 0.7);
      p.s.width = sc;
      p.s.height = sc;
    }
  }
}

export const shake = {
  mag: 0,
  add(m: number) {
    this.mag = Math.min(this.mag + m, 16);
  },
  update(dt: number) {
    this.mag *= Math.pow(0.0015, dt);
    if (this.mag < 0.05) this.mag = 0;
  },
  ox() {
    return this.mag ? (Math.random() * 2 - 1) * this.mag : 0;
  },
  oy() {
    return this.mag ? (Math.random() * 2 - 1) * this.mag : 0;
  }
};

export class Trail {
  private sprites: Sprite[] = [];
  private pts: { x: number; y: number }[] = [];

  constructor(parent: Container, private n = 10, private size = 16) {
    for (let i = 0; i < n; i++) {
      const s = new Sprite(glowTexture('#9fd8ff', 32));
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.alpha = 0;
      parent.addChild(s);
      this.sprites.push(s);
    }
  }

  push(x: number, y: number) {
    this.pts.unshift({ x, y });
    if (this.pts.length > this.n * 2) this.pts.pop();
    for (let i = 0; i < this.n; i++) {
      const p = this.pts[Math.min(i * 2, this.pts.length - 1)];
      const s = this.sprites[i];
      if (!p) {
        s.alpha = 0;
        continue;
      }
      s.position.set(p.x, p.y);
      const k = 1 - i / this.n;
      s.alpha = k * 0.32;
      const sc = this.size * k;
      s.width = sc;
      s.height = sc;
    }
  }

  hide() {
    for (const s of this.sprites) s.alpha = 0;
    this.pts.length = 0;
  }
}
