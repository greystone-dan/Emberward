import { expect, test } from '@playwright/test';

test('keywords and traits show tooltips on hover', async ({ page }) => {
  await page.goto('/?seed=1&scenario=card-inspect&debug=1');
  await expect(page.getByTestId('battle')).toBeVisible();
  // The inspected card's rules text wraps keywords; hover one.
  const kw = page.locator('.right .kw').first();
  await expect(kw).toBeVisible();
  await kw.hover();
  await expect(page.getByTestId('tooltip')).toBeVisible();
  await expect(page.getByTestId('tooltip')).toContainText(/:/);
  // Trait chips too.
  const chip = page.locator('.right .tchip').first();
  await chip.hover();
  const chipName = (await chip.textContent())?.trim() ?? '';
  await expect(page.getByTestId('tooltip')).toContainText(chipName);
});

test('the first battle and first Drift are coached once', async ({ page }) => {
  await page.goto('/?seed=tut&tutorial=1');
  await page.getByTestId('btn-new-run').click();
  await page.getByTestId('btn-warden-0').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  const coach = page.getByTestId('coach');
  await expect(coach).toBeVisible();
  await expect(coach).toContainText(/free/i);
  await page.getByTestId('coach-next').click();
  await expect(coach).toContainText(/1✦ more/);
  await page.getByTestId('coach-skip').click();
  await expect(coach).toHaveCount(0);
  // Through to a battle: the battle coach points at the enemy deck first.
  for (let i = 0; i < 3; i++) {
    await page.getByTestId('btn-take-0').click();
    if (await page.getByTestId('rekindle').isVisible()) await page.getByTestId('btn-rekindle').click();
  }
  await page.locator('.node.can').first().click();
  await page.getByTestId('btn-muster-confirm').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  await expect(coach).toBeVisible();
  await expect(coach).toContainText(/face up/);
  for (let i = 0; i < 5; i++) await page.getByTestId('coach-next').click();
  await expect(coach).toHaveCount(0);
  // Seen flags are stored: a plain reload of a fresh run shows no coach.
  await page.goto('/?seed=tut2');
  await page.getByTestId('btn-new-run').click();
  await page.getByTestId('btn-warden-0').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  await expect(coach).toHaveCount(0);
});

test('settings change animation speed and sound hooks fire in battle', async ({ page }) => {
  await page.goto('/?seed=1&scenario=battle-wave1&debug=1');
  await page.getByTestId('btn-settings').click();
  await expect(page.getByTestId('settings')).toBeVisible();
  await page.getByTestId('set-speed-instant').click();
  await page.getByTestId('btn-settings-close').click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('emberward.settings.v1') ?? '{}'));
  expect(stored.speed).toBe(0);
  // Play a card and pass: the summon hook fires even though no audio device is present.
  const first = page.locator('[data-testid="strip-0"] [data-testid^="card-"]').first();
  await first.click();
  await page.getByTestId('btn-summon').click();
  await page.locator('[data-testid="cell-0-0-0"]').click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { __audio: { log: string[] } }).__audio.log)).toContain('summon');
});

test('a run saved in IndexedDB resumes after a reload', async ({ page }) => {
  await page.goto('/?seed=idb&debug=1');
  await page.getByTestId('btn-new-run').click();
  await page.getByTestId('btn-warden-1').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  await page.getByTestId('btn-take-0').click();
  const inDb = await page.evaluate(
    () =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open('emberward', 1);
        req.onsuccess = () => {
          const t = req.result.transaction('kv', 'readonly').objectStore('kv').get('run.v1');
          t.onsuccess = () => resolve(!!t.result && (t.result as { deck: unknown[] }).deck.length === 7);
          t.onerror = () => resolve(false);
        };
        req.onerror = () => resolve(false);
      }),
  );
  expect(inDb).toBe(true);
  await page.reload();
  await page.getByTestId('btn-continue-run').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  await expect(page.getByTestId('runbar')).toContainText('The Ferryman');
});

test('the Stair loop starts after the first click; the kind follows the run', async ({ page }) => {
  await page.goto('/?seed=music&scenario=run-map&debug=1');
  await expect(page.getByTestId('map')).toBeVisible();
  await page.mouse.click(5, 5); // the first gesture unlocks audio
  const audio = () => page.evaluate(() => { const a = (window as unknown as { __audio: { music: string | null; state(): { playing: string | null; transport: string | null } } }).__audio; return { music: a.music, ...a.state() }; });
  await expect.poll(async () => (await audio()).music).toBe('stair');
  await expect.poll(async () => (await audio()).transport, { timeout: 15_000 }).toBe('started');
  await page.getByTestId('btn-settings').click();
  await page.getByTestId('set-music').fill('0');
  await page.getByTestId('btn-settings-close').click();
  expect((await audio()).playing).toBe('stair');
});
