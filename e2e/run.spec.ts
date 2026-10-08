import { expect, test } from '@playwright/test';

type RunApi = { getState(): { phase: string; deck: unknown[]; embers: number; won: boolean | null; errors: string[]; visited: number[] }; bot(n: number): void; finish(): void; phase(): string };
const runApi = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { __game: { run: RunApi } }).__game.run.getState());

test('a run goes from the title through Warden select, the opening Drift, the map and the Muster into a battle, and the bot finishes it', async ({ page }) => {
  await page.goto('/?seed=runtest&debug=1');
  await expect(page.getByTestId('title')).toBeVisible();
  await page.getByTestId('btn-new-run').click();
  await expect(page.getByTestId('warden-select')).toBeVisible();
  await expect(page.getByTestId('btn-warden-3')).toBeDisabled(); // the Sexton is locked
  await page.getByTestId('btn-warden-0').click();

  // The opening Drift: 8 cards, 3 takes, front two free.
  await expect(page.getByTestId('drift')).toBeVisible();
  await expect(page.locator('.river .slot')).toHaveCount(8);
  await expect(page.getByTestId('drift-slot-0').locator('.fprice')).toHaveText('free');
  await expect(page.getByTestId('drift-slot-2').locator('.fprice')).toHaveText('1✦');
  const embers0 = (await runApi(page)).embers;
  await page.getByTestId('btn-take-2').click(); // costs 1
  expect((await runApi(page)).embers).toBe(embers0 - 1);
  await page.getByTestId('btn-take-0').click();
  await page.getByTestId('btn-take-0').click();
  expect((await runApi(page)).deck.length).toBe(9);

  // The map: the first row is reachable; pick a node and muster.
  await expect(page.getByTestId('map')).toBeVisible();
  await expect(page.getByTestId('drift-preview')).toBeVisible();
  const canNodes = page.locator('.node.can');
  expect(await canNodes.count()).toBeGreaterThan(0);
  await canNodes.first().click();
  await expect(page.getByTestId('muster')).toBeVisible();
  // Toggle a card out and back in, then go to battle.
  const first = page.locator('[data-testid^="muster-"]').first();
  await first.click();
  await expect(first).toHaveClass(/dim/);
  await first.click();
  await page.getByTestId('btn-muster-confirm').click();
  await expect(page.getByTestId('battle')).toBeVisible();
  await expect(page.getByTestId('intent')).toContainText(/Enemy/);

  // Let the bot play the rest of the run headless and check it ends cleanly.
  await page.evaluate(() => (window as unknown as { __game: { run: RunApi } }).__game.run.finish());
  const final = await runApi(page);
  expect(final.phase).toBe('over');
  expect(final.errors).toEqual([]);
  expect(final.visited.length).toBeGreaterThan(0);
  await expect(page.getByTestId('run-over')).toBeVisible();
});

test('a saved run resumes from the title', async ({ page }) => {
  await page.goto('/?seed=resume&debug=1');
  await page.getByTestId('btn-new-run').click();
  await page.getByTestId('btn-warden-0').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('title')).toBeVisible();
  await page.getByTestId('btn-continue-run').click();
  await expect(page.getByTestId('drift')).toBeVisible();
  expect((await runApi(page)).deck.length).toBe(6);
});
