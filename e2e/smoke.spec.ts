import { expect, test } from '@playwright/test';

test('the app loads at 1280x720 and exposes the debug API', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await expect(page).toHaveTitle(/Emberward/);
  await expect(page.locator('[data-testid="app"]')).toBeVisible();
  const hasApi = await page.evaluate(() => typeof (window as unknown as { __game?: unknown }).__game === 'object');
  expect(hasApi).toBe(true);
});

test('a render error shows the crash panel instead of a blank page, and Start fresh returns to the title', async ({ page }) => {
  await page.goto('/?seed=crash&debug=1');
  await expect(page.getByTestId('title')).toBeVisible();
  await page.evaluate(() => (window as unknown as { __game: { crash(): void } }).__game.crash());
  await expect(page.getByTestId('crash')).toBeVisible();
  await page.screenshot({ path: 'shots/crash.png' });
  await page.getByTestId('btn-crash-fresh').click();
  await expect(page.getByTestId('title')).toBeVisible();
});
