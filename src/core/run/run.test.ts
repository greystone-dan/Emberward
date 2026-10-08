import { describe, expect, it } from 'vitest';
import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import { playRun } from './bot';
import { generateMap, reachable } from './map';
import { previewNextLine } from './drift';
import { applyRunAction, legalRunActions, newRun, priceAt, rekindleOffers } from './run';
import { makeRng } from '../rng';
import type { RunState } from './types';

function start(seed = 't1', warden = 0): RunState {
  return applyRunAction(newRun(seed), { type: 'chooseWarden', warden }).state;
}

describe('run loop', () => {
  it('choosing a Warden gives its deck and relic and opens the opening Drift of 8 with 3 takes', () => {
    const r = start();
    expect(r.deck.map((c) => c.cardId)).toEqual(content.wardens[0]!.deck);
    expect(r.relics).toEqual(['Tinderbox']);
    expect(r.phase).toBe('drift');
    expect(r.drift.line.length).toBe(FLAGS.openingDriftSize);
    expect(r.drift.takes).toBe(FLAGS.openingDriftTakes);
    expect(r.omens.length).toBe(3);
    expect(r.embers).toBe(FLAGS.startEmbers);
  });

  it('the Sexton is locked until unlocked', () => {
    expect(applyRunAction(newRun('x'), { type: 'chooseWarden', warden: 3 }).state.errors).toContain('ILLEGAL_RUN_ACTION WARDEN_LOCKED');
    expect(applyRunAction(newRun('x'), { type: 'chooseWarden', warden: 3 }, { sextonUnlocked: true }).state.phase).toBe('drift');
  });

  it('Drift prices: front two free, then +1 per place; taking pays and closes after the last take', () => {
    let r = start();
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => priceAt(r, i))).toEqual([0, 0, 1, 2, 3, 4, 5, 6]);
    const before = r.embers;
    r = applyRunAction(r, { type: 'driftTake', slot: 3 }).state;
    expect(r.embers).toBe(before - 2);
    expect(r.deck.length).toBe(7);
    expect(r.drift.line.length).toBe(7);
    expect(priceAt(r, 2)).toBe(1); // the line closed up
    r = applyRunAction(r, { type: 'driftTake', slot: 0 }).state;
    r = applyRunAction(r, { type: 'driftTake', slot: 0 }).state;
    expect(r.phase).toBe('map');
    expect(r.deck.length).toBe(9);
  });

  it('taking a card the player cannot afford is illegal', () => {
    const r = start();
    const res = applyRunAction(r, { type: 'driftTake', slot: 7 }); // costs 6 with 8 embers: legal
    expect(res.state.errors).toEqual([]);
    const poor = { ...r, embers: 1 };
    expect(applyRunAction(poor, { type: 'driftTake', slot: 4 }).state.errors[0]).toMatch(/NOT_ENOUGH_EMBERS/);
  });

  it('the map is a 7x15 lattice with a Hearth before the boss and elites only from row 5', () => {
    const { nodes } = generateMap(makeRng('m', 'map'));
    const boss = nodes.filter((n) => n.type === 'boss');
    expect(boss.length).toBe(1);
    expect(boss[0]!.y).toBe(FLAGS.mapHeight - 1);
    const hearthRow = nodes.filter((n) => n.y === FLAGS.mapHeight - 2);
    expect(hearthRow.every((n) => n.type === 'hearth')).toBe(true);
    expect(nodes.filter((n) => n.type === 'elite').every((n) => n.y >= FLAGS.eliteFromRow)).toBe(true);
    expect(nodes.filter((n) => n.y === 0).every((n) => n.type === 'fight')).toBe(true);
    // Every node leads somewhere, and the start row is reachable.
    for (const n of nodes) if (n.type !== 'boss') expect(n.next.length).toBeGreaterThan(0);
    expect(reachable(nodes, -1).length).toBeGreaterThan(0);
    // No crossing edges: for neighbours x and x+1 on a row, (x -> x+1) and (x+1 -> x) never both exist.
    for (const a of nodes) for (const bId of a.next) {
      const b = nodes[bId]!;
      if (b.x === a.x + 1) {
        const c = nodes.find((n) => n.y === a.y && n.x === a.x + 1);
        if (c) expect(c.next.some((id) => nodes[id]!.x === a.x)).toBe(false);
      }
    }
  });

  it('the next Drift is previewable on the map and advances two places per node', () => {
    let r = start();
    r = applyRunAction(r, { type: 'driftSkip' }).state;
    expect(r.phase).toBe('map');
    const preview = previewNextLine(r.drift).map((c) => c.cardId);
    const node = reachable(r.map, r.at)[0]!;
    r = applyRunAction(r, { type: 'mapChoose', node }).state;
    expect(r.phase).toBe('muster');
    r = applyRunAction(r, { type: 'musterConfirm' }).state;
    expect(r.phase).toBe('battle');
    // Play the battle out with passes to reach the reward and the Drift.
    let guard = 0;
    while (r.phase === 'battle' && guard++ < 200) r = applyRunAction(r, { type: 'battle', action: { type: 'pass' } }).state;
    expect(['reward', 'over']).toContain(r.phase);
    if (r.phase === 'reward') {
      r = applyRunAction(r, { type: 'continue' }).state;
      if (r.phase === 'drift') expect(r.drift.line.map((c) => c.cardId)).toEqual(preview);
    }
  });

  it('three Sparks rekindle into one Flame and the deck shrinks by two', () => {
    let r = start();
    const id = r.deck[0]!.cardId; // the Lamplighter has two copies of card 1
    r.deck.push({ uid: 99, cardId: id, level: 1 });
    const offers = rekindleOffers(r);
    expect(offers).toEqual([{ cardId: id, level: 1, copies: 3 }]);
    const n = r.deck.length;
    r = applyRunAction(r, { type: 'rekindle', cardId: id, level: 1 }).state;
    expect(r.deck.length).toBe(n - 2);
    expect(r.deck.filter((c) => c.cardId === id).map((c) => c.level)).toEqual([2]);
  });

  it('the bot completes whole runs headless with no errors', () => {
    for (const seed of ['a', 'b', 'c']) {
      const res = playRun(seed, 4000);
      expect(res.state.phase).toBe('over');
      expect(res.state.errors).toEqual([]);
      expect(res.state.won === true || res.state.won === false).toBe(true);
    }
  });

  it('legal run actions never include an illegal one', () => {
    let r = start('legal');
    for (let i = 0; i < 60 && r.phase !== 'over' && r.phase !== 'battle'; i++) {
      const acts = legalRunActions(r);
      const a = acts[i % acts.length]!;
      r = applyRunAction(r, a).state;
      expect(r.errors).toEqual([]);
    }
  });
});
