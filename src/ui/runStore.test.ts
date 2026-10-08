import { describe, expect, it } from 'vitest';
import { looksLikeRun } from './runStore';
import { newRun } from '../core/run/run';

describe('saved-run guard', () => {
  it('accepts a real run and rejects junk, so a damaged save cannot take the title down', () => {
    expect(looksLikeRun(newRun('x'))).toBe(true);
    expect(looksLikeRun(null)).toBe(false);
    expect(looksLikeRun('run')).toBe(false);
    expect(looksLikeRun({ phase: 'map' })).toBe(false);
    const broken = { ...newRun('x'), deck: 'nope' };
    expect(looksLikeRun(broken)).toBe(false);
  });
});
