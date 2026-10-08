import { chromium } from '@playwright/test';
import { existsSync, mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';

// `npm run shoot -- <scenario...>` → shots/<scenario>.png at 1280x720 with a fixed seed.
const scenarios = process.argv.slice(2);
if (scenarios.length === 0) {
  console.log('usage: npm run shoot -- <scenario...>');
  process.exit(1);
}
const port = 5174;
const base = `http://localhost:${port}`;

async function waitFor(url: string, ms: number): Promise<void> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`dev server did not start at ${url}`);
}

const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore' });
try {
  await waitFor(base, 30_000);
  const localChromium = '/opt/pw-browsers/chromium';
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM || existsSync(localChromium) ? { executablePath: process.env.PW_CHROMIUM ?? localChromium } : {},
  );
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  mkdirSync('shots', { recursive: true });
  for (const s of scenarios) {
    await page.goto(`${base}/?seed=1&scenario=${encodeURIComponent(s)}&debug=1`);
    await page.waitForSelector('[data-testid="app"]');
    await page.evaluate(() => (window as unknown as { __game?: { skipAnimations?: () => void } }).__game?.skipAnimations?.());
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/${s}.png` });
    console.log(`shots/${s}.png`);
  }
  await browser.close();
} finally {
  server.kill();
}
