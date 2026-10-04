import puppeteer from 'puppeteer-core';

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const url = process.env.URL || 'http://localhost:4173/';

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: 'new',
  args: ['--no-sandbox', '--use-gl=angle', '--enable-unsafe-swiftshader', '--window-size=560,980']
});
const page = await browser.newPage();
await page.setViewport({ width: 560, height: 980 });

const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('requestfailed', (r) => errors.push('REQFAIL: ' + r.url()));
page.on('response', (r) => {
  if (r.status() >= 400) errors.push('HTTP' + r.status() + ': ' + r.url());
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 1500));

await page.evaluate(() => window.__game.newGame());
await new Promise((r) => setTimeout(r, 500));

// direct launch without mouse, charge 0.8
await page.evaluate(() => {
  const g = window.__game;
  g.startCharge();
});
await new Promise((r) => setTimeout(r, 800));
const c = await page.evaluate(() => {
  const g = window.__game;
  return { charging: g.charging, charge: g.charge };
});
console.log('charging:', JSON.stringify(c));

await page.evaluate(() => {
  const g = window.__game;
  g.releaseCharge();
});

for (let i = 0; i < 16; i++) {
  await new Promise((r) => setTimeout(r, 180));
  const s = await page.evaluate(() => {
    const g = window.__game;
    const b = g.balls[0];
    if (!b) return { none: true };
    const p = b.body.getPosition();
    const v = b.body.getLinearVelocity();
    return { x: Math.round(p.x * 20), y: Math.round(p.y * 20), vx: Math.round(v.x * 20), vy: Math.round(v.y * 20), state: g.state };
  });
  console.log(i * 180 + 'ms', JSON.stringify(s));
}

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
