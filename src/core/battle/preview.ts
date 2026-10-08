import { orderUnits } from '../grid';
import type { BattleState, Row, Side } from '../types';
import { planAttack } from './clash';

export interface PreviewArrow {
  attacker: number;
  attackerSide: Side;
  from: { lane: number; row: number };
  target: number | 'face';
  to: { lane: number; row: number } | null;
  damage: number;
  shape: string;
  beat: Row;
}

/** The projected Clash from the current board, as arrows. Does not mutate state; later beats assume earlier ones change nothing. */
export function previewClash(st: BattleState): PreviewArrow[] {
  const out: PreviewArrow[] = [];
  for (const u of orderUnits(st.units, st.initiative)) {
    if (u.stunned) continue;
    const plan = planAttack(st, u);
    if (!plan) continue;
    if (plan.face) {
      out.push({ attacker: u.id, attackerSide: u.side, from: { lane: u.lane, row: u.row }, target: 'face', to: null, damage: plan.damage, shape: plan.shape, beat: u.row });
      continue;
    }
    for (const t of plan.targets) out.push({ attacker: u.id, attackerSide: u.side, from: { lane: u.lane, row: u.row }, target: t.id, to: { lane: t.lane, row: t.row }, damage: plan.damage, shape: plan.shape, beat: u.row });
    for (const t of plan.splash) out.push({ attacker: u.id, attackerSide: u.side, from: { lane: u.lane, row: u.row }, target: t.id, to: { lane: t.lane, row: t.row }, damage: plan.shape === 'cleave' ? plan.damage : 1, shape: plan.shape, beat: u.row });
  }
  return out;
}
