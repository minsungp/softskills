import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'teaser', 'captures');
await fs.mkdir(OUT, { recursive: true });

async function snap(page, name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });
  console.log(`${name}.png`);
}

async function clickIf(page, selector) {
  const el = await page.$(selector);
  if (el) await el.click();
}

async function openScene(page, index, stones = 0) {
  await page.evaluate(({ index, stones }) => {
    const dbg = window.__verdianDebug;
    const s = dbg.state;
    s.started = true;
    s.paused = false;
    s.soundOn = false;
    s.sceneIndex = index;
    s.stones = stones;
    s.activeScenario = null;
    s.result = null;
    s.timeLeft = 20 * 60 - index * 17;
    const o = dbg.objectives[index];
    s.player.x = o.x;
    s.player.y = o.y;
    s.camera.x = Math.max(0, Math.min(o.x - 480, 44 * 32 - 960));
    s.camera.y = Math.max(0, Math.min(o.y - 320, 30 * 32 - 640));
    document.getElementById('dialog').hidden = true;
    document.getElementById('sceneStage').hidden = true;
    dbg.interact();
  }, { index, stones });
}

async function showChoices(page) {
  for (let i = 0; i < 3; i++) {
    const exists = await page.$('#continueLine');
    if (!exists) break;
    await page.click('#continueLine');
    await page.waitForTimeout(120);
  }
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
page.on('console', msg => {
  if (msg.type() === 'error') console.log('PAGE ERROR:', msg.text());
});
await page.goto('http://127.0.0.1:4173/?capture=' + Date.now(), { waitUntil: 'networkidle' });
await snap(page, '00-intro');
await page.click('#beginButton');
await page.waitForTimeout(500);
await snap(page, '01-overworld-start');

await openScene(page, 0, 0);
await snap(page, '02-three-path-dialogue');
await showChoices(page);
await snap(page, '03-three-path-choices');
await page.click('[data-choice="1"]');
await snap(page, '04-stone-result');

await openScene(page, 3, 1);
await showChoices(page);
await snap(page, '05-broken-bridge-choice');

await openScene(page, 7, 2);
await showChoices(page);
await snap(page, '06-rune-gate-choice');

await openScene(page, 9, 2);
await showChoices(page);
await snap(page, '07-storm-conflict-choice');

await openScene(page, 11, 3);
await showChoices(page);
await snap(page, '08-tool-shore-choice');

await openScene(page, 18, 5);
await showChoices(page);
await snap(page, '09-final-altar-choice');

await page.evaluate(() => {
  const dbg = window.__verdianDebug;
  const s = dbg.state;
  s.started = true;
  s.stones = 5;
  s.sceneIndex = 20;
  s.scores = { Analytical: 19, Teamwork: 20, Time: 14, Resilience: 13, Creativity: 10, Leadership: 15 };
  dbg.showReport();
});
await snap(page, '10-assessment-report');

const errors = await page.evaluate(() => ({ title: document.title, hasDebug: Boolean(window.__verdianDebug) }));
console.log(JSON.stringify(errors));
await browser.close();
