import { expect, test } from '@playwright/test';

test('the app loads at 1280x720 and exposes the debug API', async ({ page }) => {
  await page.goto('/?seed=1&debug=1');
  await expect(page).toHaveTitle(/Emberward/);
  await expect(page.locator('[data-testid="app"]')).toBeVisible();
  const hasApi = await page.evaluate(() => typeof (window as unknown as { __game?: unknown }).__game === 'object');
  expect(hasApi).toBe(true);
});
