import { applyAction, newBattle, type BattleConfig } from '../battle/battle';
import { hashState } from '../battle/hash';
import type { Action, BattleState } from '../types';

/** A golden replay: a battle config, the actions taken, and the hash of the final state. */
export interface Replay {
  name: string;
  config: BattleConfig;
  actions: Action[];
  hash: string;
  /** What the replay guards; shown when it fails. */
  note?: string;
}

export function runReplay(r: Replay): { state: BattleState; hash: string } {
  let st = newBattle(r.config).state;
  for (const a of r.actions) st = applyAction(st, a).state;
  return { state: st, hash: hashState(st) };
}

export function recordReplay(name: string, config: BattleConfig, actions: Action[], note?: string): Replay {
  return { name, config, actions, hash: runReplay({ name, config, actions, hash: '' }).hash, note };
}
