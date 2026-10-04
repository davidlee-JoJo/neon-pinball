const DOT = 4;
const W = 128;
const H = 32;

export class DMD {
  private vctx: CanvasRenderingContext2D;
  private octx: CanvasRenderingContext2D;
  private bg: HTMLCanvasElement;
  private scoreShown = -1;
  private info = '';
  private msg: { text: string; until: number; blink: boolean } | null = null;
  private scroll: string | null = null;
  private scrollX = W + 4;

  constructor(canvas: HTMLCanvasElement) {
    canvas.width = W * DOT;
    canvas.height = H * DOT;
    this.vctx = canvas.getContext('2d')!;
    const off = document.createElement('canvas');
    off.width = W;
    off.height = H;
    this.octx = off.getContext('2d', { willReadFrequently: true })!;

    this.bg = document.createElement('canvas');
    this.bg.width = W * DOT;
    this.bg.height = H * DOT;
    const b = this.bg.getContext('2d')!;
    b.fillStyle = '#0a0603';
    b.fillRect(0, 0, this.bg.width, this.bg.height);
    b.fillStyle = '#241305';
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        b.beginPath();
        b.arc(x * DOT + DOT / 2, y * DOT + DOT / 2, DOT * 0.32, 0, Math.PI * 2);
        b.fill();
      }
  }

  setScore(n: number) {
    if (n !== this.scoreShown) {
      this.scoreShown = n;
    }
  }

  setInfo(t: string) {
    if (t !== this.info) {
      this.info = t;
    }
  }

  showMsg(text: string, dur = 2, blink = false) {
    this.msg = { text, until: 0, blink };
    this.msg.until = performance.now() / 1000 + dur;
  }

  setScroll(t: string | null) {
    this.scroll = t;
    this.scrollX = W + 4;
  }

  update(timeSec: number) {
    const c = this.octx;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    c.fillStyle = '#fff';
    c.font = 'bold 19px "Courier New", monospace';
    c.textAlign = 'right';
    c.textBaseline = 'top';
    c.fillText(this.scoreShown.toLocaleString('en-US'), 127, 2);

    if (this.msg) {
      if (!(this.msg.blink && Math.floor(timeSec * 2.5) % 2 === 0)) {
        c.font = 'bold 10px Arial, "Microsoft JhengHei", sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'top';
        c.fillText(this.msg.text, W / 2, 21);
      }
      if (timeSec > this.msg.until) this.msg = null;
    } else if (this.scroll !== null) {
      c.font = 'bold 10px Arial, "Microsoft JhengHei", sans-serif';
      const w = c.measureText(this.scroll).width;
      this.scrollX -= 0.55;
      if (this.scrollX < -w) this.scrollX = W + 6;
      c.textAlign = 'left';
      c.textBaseline = 'top';
      c.fillText(this.scroll, this.scrollX, 21);
    } else if (this.info) {
      c.font = 'bold 10px Arial, "Microsoft JhengHei", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'top';
      c.fillText(this.info, W / 2, 21);
    }

    const v = this.vctx;
    v.drawImage(this.bg, 0, 0);
    const img = c.getImageData(0, 0, W, H).data;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const a = img[(y * W + x) * 4 + 3];
        if (a > 110) {
          v.fillStyle = 'rgba(255,140,40,0.35)';
          v.fillRect(x * DOT, y * DOT, DOT, DOT);
          v.fillStyle = a > 200 ? '#ffd98c' : '#d97e22';
          v.fillRect(x * DOT + 1, y * DOT + 1, DOT - 2, DOT - 2);
        }
      }
    }
  }
}
