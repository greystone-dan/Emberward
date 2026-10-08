import { expect, test, type Page } from '@playwright/test';

type Api = {
  getState(): { phase: string; turn: number; wave: number; units: { id: number; side: number }[]; sides: { cards: { uid: number; spent: boolean }[] }[] };
  dispatch(a: unknown): boolean;
  legalActions(): { type: string; card?: number; lane?: number; row?: number }[];
  skipAnimations(): void;
  advanceTime(ms: number): void;
  busy(): boolean;
  renderToText(): string;
  exportReplay(): string;
};
const game = (page: Page) => page.evaluate(() => (window as unknown as { __game: Api }).__game.getState());

test('a human can play a full battle with the mouse, and the preview shows what the Clash will do', async ({ page }) => {
  await page.goto('/?seed=7&scenario=battle-wave1&debug=1');
  await expect(page.getByTestId('battle')).toBeVisible();
  await expect(page.getByTestId('wave')).toHaveText(/Wave 1/);
  // The enemy's intent is shown before it acts.
  await expect(page.getByTestId('intent')).toContainText(/Enemy will/);
  await expect(page.locator('.chip .intent')).toHaveCount(1);

  // Inspect the first card, then summon it to the Front of lane A.
  const strip = page.getByTestId('strip-0');
  const first = strip.locator('.chip').first();
  const name = await first.getAttribute('data-name');
  await first.click();
  await expect(page.getByTestId('card-panel')).toContainText(name!);
  await expect(page.locator('.cell.empty.playable')).toHaveCount(12);
  await page.getByTestId('cell-0-0-0').click();
  await expect(page.getByTestId('cell-0-0-0').locator('.unit')).toHaveAttribute('data-name', name!);
  await expect(first).toHaveClass(/spent/);
  // Clash preview arrows appear once something can attack.
  await expect(page.getByTestId('arrows')).toHaveAttribute('data-count', /^[1-9]\d*$/);

  // Moving keeps the turn: click the unit, then a neighbouring cell.
  const actionsBefore = await game(page);
  await page.getByTestId('cell-0-0-0').locator('.unit').click();
  await expect(page.getByTestId('cell-0-1-0')).toHaveClass(/playable/);
  await page.getByTestId('cell-0-1-0').click();
  await expect(page.getByTestId('cell-0-1-0').locator('.unit')).toHaveAttribute('data-name', name!);
  const afterMove = await game(page);
  expect(afterMove.turn).toBe(actionsBefore.turn);

  // End the turn; the enemy answers and the wave resolves with animations.
  await page.getByTestId('btn-pass').click();
  await expect(page.getByTestId('hint')).toContainText(/Resolving|Enemy is acting|Your turn/);
  await page.evaluate(() => (window as unknown as { __game: Api }).__game.skipAnimations());
  await expect(page.getByTestId('wave')).toHaveText(/Wave 2/);
  await expect(page.getByTestId('log')).toContainText(/Wave 2/);

  // Play out the rest through the debug API (summon when possible, else pass) until the battle ends.
  const result = await page.evaluate(() => {
    const g = (window as unknown as { __game: Api }).__game;
    let guard = 0;
    while (g.getState().phase === 'action' && guard++ < 100) {
      const acts = g.legalActions();
      const summon = acts.find((a) => a.type === 'summon');
      g.dispatch(summon ?? { type: 'pass' });
      g.advanceTime(10_000);
    }
    return { phase: g.getState().phase, text: g.renderToText(), replay: g.exportReplay() };
  });
  expect(result.phase).toBe('over');
  expect(result.text).toContain('OVER');
  expect(result.text).not.toContain('ERRORS');
  expect(JSON.parse(result.replay).actions.length).toBeGreaterThan(5);
  await expect(page.getByTestId('overlay')).toBeVisible();
  await expect(page.getByTestId('overlay')).toContainText(/light/);
});

test('spells target through the board and cards grey out when spent', async ({ page }) => {
  await page.goto('/?seed=3&scenario=battle-wave3&debug=1');
  await expect(page.getByTestId('wave')).toHaveText(/Wave 3/);
  // Find an unspent card with a castable spell and cast it through the UI if it needs a target.
  const castable = await page.evaluate(() => {
    const g = (window as unknown as { __game: Api }).__game;
    const casts = g.legalActions().filter((a) => a.type === 'cast');
    return casts.length ? casts[0]!.card : undefined;
  });
  test.skip(castable === undefined, 'no castable spell in this seed');
  await page.getByTestId(`card-${castable}`).click();
  const btn = page.getByTestId('btn-cast');
  await expect(btn).toBeEnabled();
  await btn.click();
  const target = page.locator('.unit.targetable, .cell.targetable, .lane-label.targetable, .rowlabel.targetable, .chip.targetable').first();
  if ((await target.count()) > 0) await target.click();
  await page.evaluate(() => (window as unknown as { __game: Api }).__game.skipAnimations());
  await expect(page.getByTestId(`card-${castable}`)).toHaveClass(/spent/);
});
