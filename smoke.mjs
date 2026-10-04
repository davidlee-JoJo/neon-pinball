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
page.on('console', (m) => {
  if (m.type() === 'error') errors.push('CONSOLE: ' + m.text());
});
page.on('requestfailed', (r) => {
  if (!r.url().includes('favicon')) errors.push('REQFAIL: ' + r.url());
});

await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise((r) => setTimeout(r, 2500));

const state0 = await page.evaluate(() => window.__game?.state);
console.log('state after load:', state0);
await page.screenshot({ path: 'shot-attract.png' });

await page.evaluate(() => window.__game.newGame());
await new Promise((r) => setTimeout(r, 800));
const state1 = await page.evaluate(() => window.__game.state);
console.log('state after newGame:', state1);

// click the actual launch button center
const rect = await page.evaluate(() => {
  const b = document.getElementById('btn-launch').getBoundingClientRect();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
});
await page.mouse.move(rect.x, rect.y);
await page.mouse.down();
await new Promise((r) => setTimeout(r, 900));
await page.mouse.up();
await new Promise((r) => setTimeout(r, 4000));

const s = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, score: g.score, balls: g.balls.length };
});
console.log('after launch:', JSON.stringify(s));
await page.screenshot({ path: 'shot-play.png' });

await page.evaluate(() => {
  const g = window.__game;
  g.nudge('L');
  g.pressFlipper('L');
  g.pressFlipper('R');
});
await new Promise((r) => setTimeout(r, 3000));
const s2 = await page.evaluate(() => {
  const g = window.__game;
  return { state: g.state, score: g.score, balls: g.balls.length };
});
console.log('after 3s play:', JSON.stringify(s2));
await page.screenshot({ path: 'shot-play2.png' });

console.log('errors:', errors.length ? errors : 'none');
await browser.close();
