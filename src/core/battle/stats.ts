import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import type { AuraEffect, Passive } from '../../content/effects/dsl';
import type { Trait } from '../../content/types';
import { cellAhead, cellBehind, cellsAround, cellsBeside, cellsDiagonal, unitAt, unitsOf } from '../grid';
import type { BattleState, Side, Unit } from '../types';
import { defFor } from './defs';

/**
 * Everything derived from the board: trait counts and tiers, Kinship, auras, effective stats.
 * Nothing here is stored on a unit; it is recomputed on every read (SPEC §8).
 */

export function hasRelic(st: BattleState, side: Side, name: string): boolean {
  return st.sides[side].relics.includes(name);
}

export function unitTraits(u: Unit): Trait[] {
  const out = [...u.traits];
  for (const t of u.extraTraits) if (!out.includes(t)) out.push(t);
  return out;
}

/** Distinct cards per trait on a side's grid. Copies and Flames count once; tokens don't count. */
export function traitCounts(st: BattleState, side: Side): Map<Trait, number> {
  const seen = new Map<Trait, Set<string>>();
  for (const u of unitsOf(st.units, side)) {
    if (u.token && !(u.key === 't_wisp' && hasTier(st, side, 'Bonebound', 4))) continue;
    const traits = unitTraits(u);
    const wispBonebound = u.token && u.key === 't_wisp';
    for (const t of wispBonebound ? (['Bonebound'] as Trait[]) : traits) {
      if (!seen.has(t)) seen.set(t, new Set());
      seen.get(t)!.add(u.token ? `${u.key}#${u.id}` : u.key);
    }
  }
  const out = new Map<Trait, number>();
  for (const [t, keys] of seen) out.set(t, keys.size);
  if (hasRelic(st, side, 'Prism of Vael')) {
    for (const [t, n] of out) {
      const first = content.traits[t].tiers[0]?.n ?? 99;
      if (n >= first) out.set(t, n + 1);
    }
  }
  return out;
}

/** The highest tier reached for a trait, or 0. Tiers stack, so hasTier(n) is "count >= n". */
export function traitCount(st: BattleState, side: Side, trait: Trait): number {
  return traitCounts(st, side).get(trait) ?? 0;
}
export function hasTier(st: BattleState, side: Side, trait: Trait, n: number): boolean {
  // Avoid recursion through the Bonebound 4 wisp rule: count without the wisp bonus.
  const def = content.traits[trait];
  if (!def.tiers.some((t) => t.n === n)) return false;
  return rawCount(st, side, trait) >= n;
}
function rawCount(st: BattleState, side: Side, trait: Trait): number {
  const keys = new Set<string>();
  for (const u of unitsOf(st.units, side)) {
    if (u.token) continue;
    if (unitTraits(u).includes(trait)) keys.add(u.key);
  }
  let n = keys.size;
  if (hasRelic(st, side, 'Prism of Vael') && n >= (content.traits[trait].tiers[0]?.n ?? 99)) n += 1;
  return n;
}

export function activeTiers(st: BattleState, side: Side): { trait: Trait; n: number; count: number }[] {
  const out: { trait: Trait; n: number; count: number }[] = [];
  for (const [trait, count] of traitCounts(st, side)) {
    const tiers = content.traits[trait].tiers.filter((t) => count >= t.n);
    const top = tiers[tiers.length - 1];
    if (top) out.push({ trait, n: top.n, count });
  }
  return out.sort((a, b) => a.trait.localeCompare(b.trait));
}

/** Passives a unit has right now: its definition's plus anything granted this battle. */
export function passivesOf(st: BattleState, u: Unit): Passive[] {
  const def = defFor(u.key, u.level);
  const out = [...def.passives];
  for (const g of u.grants) if (g.untilWave === undefined || st.wave <= g.untilWave) out.push(g.passive);
  // Guardian 4: Front-row Guardians gain Taunt. Rubble Golem Flame etc. come from the def.
  if (u.row === 0 && unitTraits(u).includes('Guardian') && hasTier(st, u.side, 'Guardian', 4)) out.push({ k: 'taunt' });
  if (u.key === 't_wisp' && unitsOf(st.units, u.side).some((a) => passivesOf0(st, a).some((p) => p.k === 'wispBuff' && p.shoot))) {
    /* shape handled in effectiveShape */
  }
  return out;
}
function passivesOf0(st: BattleState, u: Unit): Passive[] {
  const def = defFor(u.key, u.level);
  const out = [...def.passives];
  for (const g of u.grants) if (g.untilWave === undefined || st.wave <= g.untilWave) out.push(g.passive);
  return out;
}

export function has(st: BattleState, u: Unit, k: Passive['k']): boolean {
  return passivesOf(st, u).some((p) => p.k === k);
}
export function find<K extends Passive['k']>(st: BattleState, u: Unit, k: K): Extract<Passive, { k: K }>[] {
  return passivesOf(st, u).filter((p) => p.k === k) as Extract<Passive, { k: K }>[];
}

export function isRooted(st: BattleState, u: Unit): boolean {
  return has(st, u, 'rooted') || has(st, u, 'cantMove') || (u.cantMoveUntilWave !== undefined && st.wave <= u.cantMoveUntilWave);
}

export function swiftOf(st: BattleState, u: Unit): number {
  let n = 0;
  for (const p of find(st, u, 'swift')) n = Math.max(n, p.n);
  if (unitTraits(u).includes('Beast') && hasTier(st, u.side, 'Beast', 2)) n += 1;
  return n;
}

/** Which lanes this unit's Taunt covers (empty if none). */
export function tauntLanes(st: BattleState, u: Unit): number[] {
  const ts = find(st, u, 'taunt');
  if (ts.length === 0) return [];
  if (ts.some((t) => t.all)) return [0, 1, 2, 3];
  const lanes = new Set<number>([u.lane]);
  if (ts.some((t) => t.wide)) {
    if (u.lane > 0) lanes.add(u.lane - 1);
    if (u.lane < 3) lanes.add(u.lane + 1);
  }
  return [...lanes];
}

export function kinship(st: BattleState, u: Unit): number {
  const mine = unitTraits(u);
  if (mine.length === 0) return 0;
  const cells = hasRelic(st, u.side, 'Cracked Lens') ? [...cellsAround(u), ...cellsDiagonal(u)] : cellsAround(u);
  let n = 0;
  for (const c of cells) {
    const o = unitAt(st.units, u.side, c.lane, c.row);
    if (o && unitTraits(o).some((t) => mine.includes(t))) n++;
  }
  return Math.min(2, n);
}

export interface AuraSum {
  power: number;
  hitsApply: { status: 'burn' | 'poison'; n: number }[];
  rangedReduce: number;
  shieldEachWave: number;
}

/** Auras reaching a unit from allies, with Chanter 2 (diagonals) and Chanter 3 (doubled). */
export function aurasOn(st: BattleState, u: Unit): AuraSum {
  const sum: AuraSum = { power: 0, hitsApply: [], rangedReduce: 0, shieldEachWave: 0 };
  const diag = hasTier(st, u.side, 'Chanter', 2);
  const mult = hasTier(st, u.side, 'Chanter', 3) ? 2 : 1;
  const traits = unitTraits(u);
  for (const src of unitsOf(st.units, u.side)) {
    if (src.id === u.id) continue;
    for (const a of find(st, src, 'aura')) {
      if (a.effect.onlyTraits && !a.effect.onlyTraits.some((t) => traits.includes(t))) continue;
      const cells = [];
      for (const d of a.dirs) {
        if (d === 'ahead') {
          const c = cellAhead(src);
          if (c) cells.push(c);
        } else if (d === 'behind') {
          const c = cellBehind(src);
          if (c) cells.push(c);
        } else if (d === 'beside') cells.push(...cellsBeside(src));
        else cells.push(...cellsAround(src));
      }
      if (diag) cells.push(...cellsDiagonal(src));
      if (!cells.some((c) => c.lane === u.lane && c.row === u.row)) continue;
      addAura(sum, a.effect, mult);
    }
    // Beacon Keeper: Marksmen and Artillery Behind it gain Power.
    for (const p of find(st, src, 'powerToBehind')) {
      if (src.lane === u.lane && u.row > src.row && p.traits.some((t) => traits.includes(t))) {
        sum.power += p.n * mult;
        if (p.hitsApplyBurn) sum.hitsApply.push({ status: 'burn', n: p.hitsApplyBurn });
      }
    }
  }
  return sum;
}
function addAura(sum: AuraSum, e: AuraEffect, mult: number): void {
  if (e.power) sum.power += e.power * mult;
  if (e.hitsApply) sum.hitsApply.push({ status: e.hitsApply.status, n: e.hitsApply.n * mult });
  if (e.rangedReduce) sum.rangedReduce += e.rangedReduce * mult;
  if (e.shieldEachWave) sum.shieldEachWave += e.shieldEachWave * mult;
}

export function wispBuff(st: BattleState, side: Side): { atk: number; hp: number; shoot: boolean } {
  const out = { atk: 0, hp: 0, shoot: false };
  for (const u of unitsOf(st.units, side)) {
    for (const p of find(st, u, 'wispBuff')) {
      out.atk += p.atk;
      out.hp += p.hp;
      if (p.shoot) out.shoot = true;
    }
  }
  if (hasTier(st, side, 'Bonebound', 4)) {
    out.atk += 1;
    out.hp += 1;
  }
  return out;
}

export function effectiveAtk(st: BattleState, u: Unit): number {
  let atk = u.baseAtk + u.buffAtk + u.waveBuffAtk + kinship(st, u) + aurasOn(st, u).power;
  const traits = unitTraits(u);
  if (u.key === 't_wisp') atk += wispBuff(st, u.side).atk;
  if (traits.includes('Marksman') && u.row === 2) {
    if (hasTier(st, u.side, 'Marksman', 4)) atk += 3;
    else if (hasTier(st, u.side, 'Marksman', 2)) atk += 1;
  }
  if (traits.includes('Brawler') && cellsBeside(u).some((c) => unitAt(st.units, u.side, c.lane, c.row) && unitTraits(unitAt(st.units, u.side, c.lane, c.row)!).includes('Brawler'))) {
    if (hasTier(st, u.side, 'Brawler', 4)) atk += 3;
    else if (hasTier(st, u.side, 'Brawler', 2)) atk += 1;
  }
  for (const p of find(st, u, 'powerPerAllyDeath')) atk += p.n * st.sides[u.side].deathsThisBattle;
  for (const p of find(st, u, 'powerIfGuardianAhead')) {
    const a = cellAhead(u);
    const o = a && unitAt(st.units, u.side, a.lane, a.row);
    if (o && unitTraits(o).includes('Guardian')) atk += p.n;
  }
  return Math.max(0, atk);
}

export function effectiveMaxHp(st: BattleState, u: Unit): number {
  let hp = u.baseHp + u.buffHp + kinship(st, u);
  const traits = unitTraits(u);
  if (u.key === 't_wisp') hp += wispBuff(st, u.side).hp;
  if (traits.includes('Brawler')) {
    if (hasTier(st, u.side, 'Brawler', 4)) hp += 5;
    else if (hasTier(st, u.side, 'Brawler', 2)) hp += 2;
  }
  if (traits.includes('Abyssal') && hasTier(st, u.side, 'Abyssal', 2)) {
    hp += 3 * cellsAround(u).filter((c) => unitAt(st.units, u.side, c.lane, c.row)).length;
  }
  return Math.max(1, hp);
}

export function hpOf(st: BattleState, u: Unit): number {
  return effectiveMaxHp(st, u) - u.damage;
}

export function effectiveShape(st: BattleState, u: Unit): Unit['shape'] {
  if (u.key === 't_wisp' && wispBuff(st, u.side).shoot) return 'shoot';
  return u.shape;
}

/** Damage reduction on a unit from passives (Iron Penitent, Cathedral Golem Flame, Penance). */
export function damageReduction(st: BattleState, u: Unit): number {
  let n = 0;
  for (const p of find(st, u, 'damageReduce')) n += p.n;
  return n;
}

export const BOARD_DIAGONALS = FLAGS.diagonalAdjacency;
