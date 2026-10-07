import { expect, it } from 'vitest';
import { cards } from './cards';

it('loads the card pool with unique ids', () => {
  expect(cards.length).toBeGreaterThan(0);
  expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
});
