import { FLAGS } from '../../config/flags';
import { applyAction, newBattle, type BattleConfig } from '../battle/battle';
import { cardKey } from '../battle/defs';
import { cardsByName } from '../../content/cards';
import type { Action, BattleState, Lane, Level, Row, Side, Unit } from '../types';

/** Test helpers: build boards directly, run Clashes by passing, find units by name. */

export interface Placed {
  name: string;
  lane: number;
  row: number;
  level?: Level;
}

export function key(name: string): string {
  if (name.startsWith('e_') || name.startsWith('t_')) return name;
  const c = cardsByName.get(name);
  if (!c) throw new Error(`no card ${name}`);
  return cardKey(c.id);
}

export function setup(opts: {
  player?: Placed[];
  enemy?: Placed[];
  playerCards?: string[];
  enemyCards?: string[];
  embers?: number;
  enemyEmbers?: number;
  relics?: string[];
  seed?: string;
  kind?: 'fight' | 'elite' | 'boss';
}): BattleState {
  const cfg: BattleConfig = {
    seed: opts.seed ?? 't',
    kind: opts.kind,
    player: {
      hp: FLAGS.playerHp,
      embers: opts.embers ?? 10,
      cards: (opts.playerCards ?? []).map((n) => ({ key: key(n), level: 1 })),
      relics: opts.relics,
      board: (opts.player ?? []).map((p) => ({ key: key(p.name), level: p.level ?? 1, lane: p.lane as Lane, row: p.row as Row })),
    },
    enemy: {
      hp: FLAGS.enemyHp.fight,
      embers: opts.enemyEmbers ?? 5,
      cards: (opts.enemyCards ?? []).map((n) => ({ key: key(n), level: 1 })),
      board: (opts.enemy ?? []).map((p) => ({ key: key(p.name), level: p.level ?? 1, lane: p.lane as Lane, row: p.row as Row })),
    },
  };
  return newBattle(cfg).state;
}

export function unit(st: BattleState, name: string, side: Side = 0): Unit {
  const u = st.units.find((x) => x.side === side && x.name === name);
  if (!u) throw new Error(`no unit ${name} on side ${side}`);
  return u;
}
export function maybeUnit(st: BattleState, name: string, side: Side = 0): Unit | undefined {
  return st.units.find((x) => x.side === side && x.name === name);
}
export function at(st: BattleState, side: Side, lane: number, row: number): Unit | undefined {
  return st.units.find((x) => x.side === side && x.lane === lane && x.row === row);
}

export function card(st: BattleState, name: string, side: Side = 0): number {
  const c = st.sides[side].cards.find((x) => x.key === key(name) && !x.spent);
  if (!c) throw new Error(`no unspent card ${name}`);
  return c.uid;
}

export function act(st: BattleState, a: Action): BattleState {
  const r = applyAction(st, a);
  const bad = r.state.errors.filter((e) => e.startsWith('ILLEGAL'));
  if (bad.length) throw new Error(`illegal: ${bad.join(', ')} for ${JSON.stringify(a)}`);
  return r.state;
}

/** Both sides pass: the Clash resolves and the next wave starts. Returns the new state and the events. */
export function clash(st: BattleState) {
  let s = st;
  const events = [];
  for (let i = 0; i < 2 && s.phase === 'action'; i++) {
    const r = applyAction(s, { type: 'pass' });
    s = r.state;
    events.push(...r.events);
  }
  return { state: s, events };
}

export function hp(st: BattleState, u: Unit): number {
  const live = st.units.find((x) => x.id === u.id);
  if (!live) return 0;
  return live.baseHp + live.buffHp - live.damage; // raw; use hpOf for derived
}
