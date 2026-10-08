import type { BattleState } from '../types';

/** A stable hash of the parts of state that matter, for golden replays. */
export function hashState(st: BattleState): string {
  const view = {
    wave: st.wave,
    phase: st.phase,
    winner: st.winner,
    sides: st.sides.map((s) => ({ hp: s.hp, embers: s.embers, cards: s.cards.map((c) => `${c.key}:${c.level}:${c.spent ? 1 : 0}`) })),
    units: [...st.units]
      .sort((a, b) => a.id - b.id)
      .map((u) => `${u.id}|${u.side}|${u.key}|${u.lane}${u.row}|${u.damage}|${u.shield}|${u.burn}|${u.poison}|${u.stunned ? 1 : 0}`),
    errors: st.errors,
  };
  const s = JSON.stringify(view);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}
