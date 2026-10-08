import { FLAGS } from '../../config/flags';
import { TOKENS } from '../../content/effects/cards';
import type { CellSel, Cond, Num, Op, Passive, TokenId, Trigger, TriggerOn, UnitSel } from '../../content/effects/dsl';
import type { Shape, Trait } from '../../content/types';
import { allCells, cellAhead, cellBehind, cellsAround, cellsBeside, emptyCells, laneEnemies, orderUnits, other, unitAt, unitsOf } from '../grid';
import type { BattleEvent, BattleState, Cell, Lane, Level, Row, Side, Target, Unit } from '../types';
import { cardPrice, defFor } from './defs';
import { aurasOn, effectiveAtk, effectiveMaxHp, find, has, hasRelic, hasTier, hpOf, isRooted, passivesOf, tauntLanes, unitTraits } from './stats';

/**
 * The working context for one applyAction: a cloned state that the engine mutates, plus events.
 * Everything outside src/core/battle sees only the pure applyAction.
 */
export interface Ctx {
  st: BattleState;
  events: BattleEvent[];
  /** During a beat, deaths wait until all damage is applied (SPEC §6: "then deaths resolve"). */
  deferDeaths?: boolean;
  pendingDeaths?: { unit: Unit; killer?: Unit; reason: string }[];
}

/** Resolves deaths deferred during a beat, in board order. */
export function flushDeaths(ctx: Ctx): void {
  const pending = ctx.pendingDeaths ?? [];
  ctx.pendingDeaths = [];
  ctx.deferDeaths = false;
  for (const p of orderUnits(pending.map((x) => x.unit), ctx.st.initiative).map((u) => pending.find((x) => x.unit === u)!)) {
    if (ctx.st.units.includes(p.unit)) killUnit(ctx, p.unit, p.killer, p.reason);
  }
}

/** What an op resolves against: the acting side, the source unit (if any) and the chosen targets. */
export interface Scope {
  side: Side;
  source?: Unit;
  targets: Target[];
  /** Units chosen as targets, resolved up front. */
  targetUnits: Unit[];
  victim?: Unit;
  killer?: Unit;
  /** Kills caused while resolving this scope (for embersPerKill). */
  kills: number;
  spellKey?: string;
}

export function err(ctx: Ctx, message: string): void {
  ctx.st.errors.push(message);
  ctx.events.push({ type: 'error', message });
}

// ---------- unit creation ----------

export function makeUnit(ctx: Ctx, side: Side, key: string, level: Level, cell: Cell, cardUid?: number, extra?: Partial<Unit>): Unit {
  const def = defFor(key, level);
  const u: Unit = {
    id: ctx.st.nextId++,
    side,
    lane: cell.lane,
    row: cell.row,
    key,
    cardUid,
    name: def.name,
    level,
    baseAtk: def.atk,
    baseHp: def.hp,
    shape: def.shape,
    traits: [...def.traits],
    token: def.token,
    damage: 0,
    shield: 0,
    shieldPersist: 0,
    burn: 0,
    poison: 0,
    stunned: false,
    stepsUsed: 0,
    arrivedWave: ctx.st.wave,
    attacksLeft: 1,
    buffAtk: 0,
    buffHp: 0,
    waveBuffAtk: 0,
    grants: [],
    returnsLeft: 0,
    returnsFull: false,
    extraTraits: [],
    ...extra,
  };
  const ret = def.passives.find((p): p is Extract<Passive, { k: 'returnsOnDeath' }> => p.k === 'returnsOnDeath');
  if (ret) {
    u.returnsLeft = ret.times;
    u.returnsFull = ret.fullHealth;
  }
  return u;
}

export function placeUnit(ctx: Ctx, u: Unit, silent = false): Unit {
  ctx.st.units.push(u);
  if (!silent) ctx.events.push({ type: 'summon', unit: u.id, side: u.side, cell: { lane: u.lane, row: u.row }, name: u.name });
  return u;
}

export function summonToken(ctx: Ctx, side: Side, token: TokenId, cell: Cell, over?: { atk?: number; hp?: number; shape?: Shape }): Unit | undefined {
  if (unitAt(ctx.st.units, side, cell.lane, cell.row)) return undefined;
  const t = TOKENS[token]!;
  const u = makeUnit(ctx, side, t.id, 1, cell);
  if (over?.atk !== undefined) u.baseAtk = over.atk;
  if (over?.hp !== undefined) u.baseHp = over.hp;
  if (over?.shape !== undefined) u.shape = over.shape;
  if (token === 'wisp' && hasRelic(ctx.st, side, 'Grave Lantern') && !ctx.st.units.some((x) => x.side === side && x.key === 't_wisp')) {
    u.baseAtk = Math.max(u.baseAtk, 2);
    u.baseHp = Math.max(u.baseHp, 2);
  }
  placeUnit(ctx, u);
  runTriggers(ctx, u, 'kindle', { side, source: u, targets: [], targetUnits: [], kills: 0 });
  return u;
}

// ---------- numbers, conditions, selectors ----------

export function num(ctx: Ctx, n: Num, scope: Scope, unit?: Unit): number {
  if (typeof n === 'number') return n;
  let v = 0;
  const t = scope.targetUnits[0];
  switch (n.ref) {
    case 'targetPower':
      v = t ? effectiveAtk(ctx.st, t) : 0;
      break;
    case 'targetPoison':
      v = t?.poison ?? 0;
      break;
    case 'targetBurn':
      v = t?.burn ?? 0;
      break;
    case 'selfPower':
      v = scope.source ? effectiveAtk(ctx.st, scope.source) : 0;
      break;
    case 'unitPoison':
      v = unit?.poison ?? 0;
      break;
    case 'unitBurn':
      v = unit?.burn ?? 0;
      break;
    case 'deathsThisWave':
      v = ctx.st.sides[scope.side].deathsThisWave;
      break;
    case 'poisonedEnemies':
      v = unitsOf(ctx.st.units, other(scope.side)).filter((u) => u.poison > 0).length;
      break;
  }
  v = Math.floor(v * (n.mult ?? 1));
  if (n.min !== undefined) v = Math.max(n.min, v);
  if (n.max !== undefined) v = Math.min(n.max, v);
  return v;
}

export function cond(ctx: Ctx, c: Cond, u: Unit | undefined, scope: Scope): boolean {
  const st = ctx.st;
  if (c === 'burning') return !!u && u.burn > 0;
  if (c === 'poisoned') return !!u && u.poison > 0;
  if (c === 'notBurning') return !!u && u.burn === 0;
  if (c === 'stunned') return !!u && u.stunned;
  if (c === 'isToken') return !!u && u.token;
  if (c === 'notAround') return !!u && !!scope.source && !cellsAround(scope.source).some((x) => x.lane === u.lane && x.row === u.row);
  if (c === 'allyDiedThisWave') return st.sides[scope.side].deathsThisWave > 0;
  if (c === 'anyEnemyPoisoned') return unitsOf(st.units, other(scope.side)).some((e) => e.poison > 0);
  if ('wave' in c) return st.wave === c.wave;
  if ('hpAtMost' in c) return !!u && hpOf(st, u) <= c.hpAtMost;
  if ('hpAtMostPoisonTimes' in c) return !!u && u.poison > 0 && hpOf(st, u) <= u.poison * c.hpAtMostPoisonTimes;
  if ('trait' in c) return !!u && unitTraits(u).includes(c.trait);
  if ('shape' in c) return !!u && u.shape === c.shape;
  if ('row' in c) return !!u && u.row === c.row;
  return false;
}

function atCells(ctx: Ctx, side: Side, cells: Cell[]): Unit[] {
  const out: Unit[] = [];
  for (const c of cells) {
    const u = unitAt(ctx.st.units, side, c.lane, c.row);
    if (u) out.push(u);
  }
  return out;
}

export function select(ctx: Ctx, sel: UnitSel, scope: Scope): Unit[] {
  const st = ctx.st;
  const me = scope.side,
    foe = other(scope.side);
  const src = scope.source;
  const lane = (l: number) => laneEnemies(st.units, me, l);
  if (typeof sel !== 'string') {
    if ('where' in sel) return select(ctx, sel.sel, scope).filter((u) => sel.where.every((c) => cond(ctx, c, u, scope)));
    return select(ctx, sel.sel, scope).slice(0, sel.n);
  }
  switch (sel) {
    case 'self':
      return src ? [src] : [];
    case 'ahead': {
      const c = src && cellAhead(src);
      return c ? atCells(ctx, me, [c]) : [];
    }
    case 'behind': {
      const c = src && cellBehind(src);
      return c ? atCells(ctx, me, [c]) : [];
    }
    case 'beside':
      return src ? atCells(ctx, me, cellsBeside(src)) : [];
    case 'around':
      return src ? atCells(ctx, me, cellsAround(src)) : [];
    case 'across': {
      if (!src) return [];
      const u = lane(src.lane)[0];
      return u ? [u] : [];
    }
    case 'acrossBeside': {
      if (!src) return [];
      const u = lane(src.lane)[0];
      return u ? atCells(ctx, foe, cellsBeside(u)) : [];
    }
    case 'acrossAround': {
      if (!src) return [];
      const across: Cell = { lane: src.lane, row: 0 };
      return atCells(ctx, foe, [across, ...cellsAround(across)]);
    }
    case 'allies':
      return orderUnits(unitsOf(st.units, me), me);
    case 'otherAllies':
      return orderUnits(unitsOf(st.units, me), me).filter((u) => u.id !== src?.id);
    case 'enemies':
      return orderUnits(unitsOf(st.units, foe), foe);
    case 'allUnits':
      return orderUnits(st.units, me);
    case 'allyFront':
      return orderUnits(unitsOf(st.units, me), me).filter((u) => u.row === 0);
    case 'allyMid':
      return orderUnits(unitsOf(st.units, me), me).filter((u) => u.row === 1);
    case 'allyBack':
      return orderUnits(unitsOf(st.units, me), me).filter((u) => u.row === 2);
    case 'enemyFront':
      return orderUnits(unitsOf(st.units, foe), foe).filter((u) => u.row === 0);
    case 'enemyMid':
      return orderUnits(unitsOf(st.units, foe), foe).filter((u) => u.row === 1);
    case 'enemyBack':
      return orderUnits(unitsOf(st.units, foe), foe).filter((u) => u.row === 2);
    case 'enemyFrontMid':
      return orderUnits(unitsOf(st.units, foe), foe).filter((u) => u.row <= 1);
    case 'target':
      return scope.targetUnits.filter((u) => st.units.includes(u));
    case 'targetLaneEnemies':
      return scope.targets.flatMap((t) => ('lane' in t ? lane(t.lane) : []));
    case 'targetLaneAllies':
      return scope.targets.flatMap((t) => ('lane' in t ? unitsOf(st.units, me).filter((u) => u.lane === t.lane) : []));
    case 'targetLaneFrontmost':
      return scope.targets.flatMap((t) => ('lane' in t ? lane(t.lane).slice(0, 1) : []));
    case 'targetLaneBackmost':
      return scope.targets.flatMap((t) => ('lane' in t ? lane(t.lane).slice(-1) : []));
    case 'targetRowEnemies':
      return scope.targets.flatMap((t) => ('row' in t ? orderUnits(unitsOf(st.units, foe), foe).filter((u) => u.row === t.row) : []));
    case 'targetBeside':
      return scope.targetUnits.flatMap((t) => atCells(ctx, t.side, cellsBeside(t)));
    case 'targetAround':
      return scope.targetUnits.flatMap((t) => atCells(ctx, t.side, cellsAround(t)));
    case 'lastHitTarget': {
      const u = src?.lastHitTarget !== undefined ? st.units.find((x) => x.id === src.lastHitTarget) : undefined;
      return u ? [u] : [];
    }
    case 'ownLaneEnemyBackmost': {
      const u = src ? lane(src.lane).slice(-1)[0] : undefined;
      return u ? [u] : [];
    }
    case 'besideLanesEnemyBackmost':
      return src ? cellsBeside(src).flatMap((c) => lane(c.lane).slice(-1)) : [];
    case 'mostDamagedAlly': {
      const list = unitsOf(st.units, me)
        .filter((u) => u.id !== src?.id && u.damage > 0)
        .sort((a, b) => b.damage - a.damage || a.lane - b.lane || a.row - b.row);
      return list.slice(0, 1);
    }
    case 'killer':
      return scope.killer ? [scope.killer] : [];
    case 'victim':
      return scope.victim ? [scope.victim] : [];
  }
}

export function selectCells(ctx: Ctx, sel: CellSel, scope: Scope): Cell[] {
  const st = ctx.st;
  const me = scope.side;
  const src = scope.source;
  const empty = (side: Side, filter?: (c: Cell) => boolean) => emptyCells(st.units, side).filter(filter ?? (() => true));
  switch (sel) {
    case 'selfCell':
      return src ? [{ lane: src.lane, row: src.row }] : [];
    case 'besideEmpty':
      return src ? cellsBeside(src).filter((c) => !unitAt(st.units, me, c.lane, c.row)) : [];
    case 'bothSidesEmpty':
      return src ? cellsBeside(src).filter((c) => !unitAt(st.units, me, c.lane, c.row)) : [];
    case 'allyEmpty':
      return empty(me);
    case 'allyFrontEmpty':
      return empty(me, (c) => c.row === 0);
    case 'allyMidEmpty':
      return empty(me, (c) => c.row === 1);
    case 'allyBackEmpty':
      return empty(me, (c) => c.row === 2);
    case 'allyFrontMidEmpty':
      return empty(me, (c) => c.row <= 1);
    case 'allyBackMidEmpty':
      return empty(me, (c) => c.row >= 1).sort((a, b) => b.row - a.row || a.lane - b.lane);
    case 'targetCell':
    case 'targetCells':
      return scope.targets.flatMap((t) => ('cell' in t ? [t.cell] : []));
    case 'victimCell':
      return scope.victim ? [{ lane: scope.victim.lane, row: scope.victim.row }] : [];
    case 'victimBesideEmpty':
      return scope.victim ? cellsBeside(scope.victim).filter((c) => !unitAt(st.units, me, c.lane, c.row)) : [];
    case 'enemyEmptyOfVictimSide':
      return scope.victim ? empty(scope.victim.side) : [];
    case 'victimLaneOwnEmpty':
      return scope.victim ? empty(me, (c) => c.lane === scope.victim!.lane) : [];
  }
}

// ---------- damage and statuses ----------

export function statusBonus(ctx: Ctx, side: Side, status: 'burn' | 'poison', source?: Unit): number {
  let n = 0;
  for (const u of unitsOf(ctx.st.units, side)) for (const p of find(ctx.st, u, 'statusBonus')) if (p.status === status) n += p.n;
  if (status === 'burn' && hasTier(ctx.st, side, 'Waxborn', 4)) n += 1;
  if (status === 'poison' && hasTier(ctx.st, side, 'Drowned', 2)) n += 1;
  if (status === 'burn' && hasRelic(ctx.st, side, 'Tinderbox') && !ctx.st.sides[side].firstBurnThisWave) {
    ctx.st.sides[side].firstBurnThisWave = true;
    n += 1;
  }
  void source;
  return n;
}

export function applyStatus(ctx: Ctx, u: Unit, status: 'burn' | 'poison' | 'shield', n: number, bySide: Side, opts?: { persist?: boolean; raw?: boolean }): void {
  if (n <= 0) return;
  if (status === 'shield') {
    if (opts?.persist) u.shieldPersist += n;
    else u.shield += n;
    ctx.events.push({ type: 'status', unit: u.id, status, n });
    return;
  }
  if (find(ctx.st, u, 'immune').some((p) => p.status === status)) return;
  if (ctx.st.elite?.kind === 'brazierKnight' && status === 'burn' && u.side === 1 && u.key === 'e_brazierKnight') return;
  const amount = n + (opts?.raw ? 0 : statusBonus(ctx, bySide, status));
  if (status === 'burn') u.burn += amount;
  else u.poison += amount;
  ctx.events.push({ type: 'status', unit: u.id, status, n: amount });
}

export interface HitOpts {
  source?: Unit;
  ignoreShield?: boolean;
  stripShield?: boolean;
  ranged?: boolean;
  reason: string;
  /** True for Clash attacks; false for spells and ticks. */
  attack?: boolean;
  bySide: Side;
}

/** Deals damage to a unit, through Shield, with reductions. Returns damage that reached health. */
export function damageUnit(ctx: Ctx, u: Unit, amount: number, opts: HitOpts): number {
  const st = ctx.st;
  if (!st.units.includes(u)) return 0;
  let dmg = amount;
  if (opts.attack) {
    dmg -= damageReductionFor(ctx, u, opts);
    if (u.poison > 0 && hasTier(st, opts.bySide, 'Drowned', 4)) dmg += 1;
    if (u.burn > 0 && hasTier(st, opts.bySide, 'Waxborn', 2)) dmg += 1;
    if (opts.source && st.sides[u.side].halfDamageLanes.includes(u.lane)) dmg = Math.floor(dmg / 2);
  }
  dmg = Math.max(0, dmg);
  let absorbed = 0;
  if (!opts.ignoreShield) {
    const total = u.shield + u.shieldPersist;
    absorbed = Math.min(total, dmg);
    let left = absorbed;
    const fromTemp = Math.min(u.shield, left);
    u.shield -= fromTemp;
    left -= fromTemp;
    u.shieldPersist -= left;
    dmg -= absorbed;
    if (absorbed > 0 && opts.source && unitTraits(u).includes('Bellforged') && hasTier(st, u.side, 'Bellforged', 6)) {
      damageUnit(ctx, opts.source, absorbed, { reason: 'reflect', bySide: u.side });
    }
  }
  if (opts.stripShield) {
    u.shield = 0;
    u.shieldPersist = 0;
  }
  u.damage += dmg;
  ctx.events.push({ type: 'damage', unit: u.id, amount: dmg, absorbed, source: opts.reason });
  if (opts.source && opts.attack) {
    opts.source.lastHitTarget = u.id;
    onHit(ctx, opts.source, u);
  }
  if (hpOf(st, u) <= 0) {
    if (ctx.deferDeaths) {
      ctx.pendingDeaths ??= [];
      if (!ctx.pendingDeaths.some((p) => p.unit === u)) ctx.pendingDeaths.push({ unit: u, killer: opts.source, reason: opts.reason });
    } else killUnit(ctx, u, opts.source, opts.reason);
  }
  return dmg;
}

function damageReductionFor(ctx: Ctx, u: Unit, opts: HitOpts): number {
  let n = 0;
  for (const p of find(ctx.st, u, 'damageReduce')) n += p.n;
  if (opts.ranged) n += aurasOn(ctx.st, u).rangedReduce;
  return n;
}

/** Statuses an attacker's hits apply (passives, auras, trait tiers). */
export function hitStatuses(ctx: Ctx, attacker: Unit): { status: 'burn' | 'poison'; n: number; spreadFull?: boolean; alsoBeside?: boolean }[] {
  const out: { status: 'burn' | 'poison'; n: number; spreadFull?: boolean; alsoBeside?: boolean }[] = [];
  for (const p of find(ctx.st, attacker, 'hitsApply')) out.push({ status: p.status, n: p.n, spreadFull: p.spreadFull, alsoBeside: p.alsoBeside });
  for (const a of aurasOn(ctx.st, attacker).hitsApply) out.push({ status: a.status, n: a.n });
  for (const p of find(ctx.st, attacker, 'everyHitAppliesBurn')) out.push({ status: 'burn', n: p.n });
  return out;
}

function onHit(ctx: Ctx, attacker: Unit, target: Unit): void {
  const st = ctx.st;
  if (!st.units.includes(target)) {
    // Target died from this hit: statuses still land before death resolution? Keep it simple: no.
    return;
  }
  for (const s of hitStatuses(ctx, attacker)) {
    applyStatus(ctx, target, s.status, s.n, attacker.side);
    if (s.alsoBeside) for (const b of atCells(ctx, target.side, cellsBeside(target))) applyStatus(ctx, b, s.status, s.n, attacker.side);
  }
  for (const p of find(st, attacker, 'stunPoisonedOnHit')) {
    if (target.poison > 0) {
      target.stunned = true;
      ctx.events.push({ type: 'status', unit: target.id, status: 'stun', n: 1 });
      if (p.addPoison) applyStatus(ctx, target, 'poison', p.addPoison, attacker.side);
    }
  }
  for (const p of find(st, target, 'onHitBy')) {
    applyStatus(ctx, attacker, p.status, p.n, target.side);
    if (p.cantMoveNextWave) attacker.cantMoveUntilWave = st.wave + 1;
  }
}

export function faceDamage(ctx: Ctx, side: Side, amount: number, reason: string, bySide: Side): void {
  const st = ctx.st;
  const s = st.sides[side];
  if (st.wave <= s.noFaceDamageUntilWave) return;
  let dmg = amount;
  for (const u of unitsOf(st.units, side)) for (const p of find(st, u, 'faceDamageReduce')) dmg -= p.n;
  dmg = Math.max(0, dmg);
  if (dmg === 0) return;
  s.hp -= dmg;
  st.sides[bySide].faceDamageDealt += dmg;
  ctx.events.push({ type: 'faceDamage', side, amount: dmg, source: reason });
}

export function healUnit(ctx: Ctx, u: Unit, n: number): void {
  const before = u.damage;
  u.damage = Math.max(0, u.damage - n);
  if (before !== u.damage) ctx.events.push({ type: 'heal', unit: u.id, amount: before - u.damage });
}

export function healWarden(ctx: Ctx, side: Side, n: number): void {
  const s = ctx.st.sides[side];
  s.hp = Math.min(s.maxHp, s.hp + n);
}

export function gainEmbers(ctx: Ctx, side: Side, n: number, reason: string): void {
  const s = ctx.st.sides[side];
  const before = s.embers;
  s.embers = Math.max(0, s.embers + n);
  if (s.embers !== before) ctx.events.push({ type: 'embers', side, delta: s.embers - before, reason });
}

// ---------- deaths ----------

export function killUnit(ctx: Ctx, u: Unit, killer: Unit | undefined, reason: string): void {
  const st = ctx.st;
  const idx = st.units.indexOf(u);
  if (idx < 0) return;
  // Lampwick Squire Fire: Waxborn allies can't be destroyed while it stands.
  for (const g of unitsOf(st.units, u.side)) {
    for (const p of find(st, g, 'alliesCantDie')) {
      if (g.id !== u.id && unitTraits(u).includes(p.trait)) {
        u.damage = Math.max(0, effectiveMaxHp(st, u) - 1);
        return;
      }
    }
  }
  if (u.returnsLeft > 0) {
    u.returnsLeft -= 1;
    u.damage = u.returnsFull ? 0 : effectiveMaxHp(st, u) - 1;
    u.burn = 0;
    u.poison = 0;
    ctx.events.push({ type: 'note', text: `${u.name} returns` });
    return;
  }
  st.units.splice(idx, 1);
  clampDerivedHp(ctx);
  const side = st.sides[u.side];
  side.deathsThisBattle += 1;
  side.deathsThisWave += 1;
  st.fallen.push({ key: u.key, level: u.level, name: u.name, cardUid: u.cardUid, lane: u.lane, row: u.row, side: u.side, wave: st.wave, token: u.token });
  ctx.events.push({ type: 'death', unit: u.id, side: u.side, name: u.name, cell: { lane: u.lane, row: u.row } });
  const scope: Scope = { side: u.side, source: u, targets: [], targetUnits: [], victim: u, killer, kills: 0 };

  // Last Gasp, possibly multiplied (Lich, Martyr 4).
  let times = 1;
  for (const a of unitsOf(st.units, u.side)) for (const p of find(st, a, 'lastGaspMultiplier')) times = Math.max(times, p.times);
  if (unitTraits(u).includes('Martyr') && hasTier(st, u.side, 'Martyr', 4)) times *= 2;
  const gasps = defFor(u.key, u.level).triggers.filter((t) => t.on === 'lastGasp');
  for (let i = 0; i < times; i++) for (const t of gasps) fireTrigger(ctx, u, t, scope);
  if (gasps.length && hasTier(st, u.side, 'Martyr', 2)) healWarden(ctx, u.side, 2);

  // Bone Bellwether: returns at the next Wave Start (handled in wave start via fallen records + passive).
  // Bonebound 2: the first ally to die each wave leaves a Wisp.
  if (!u.token && hasTier(st, u.side, 'Bonebound', 2) && !side.bonebound2Used) {
    side.bonebound2Used = true;
    summonToken(ctx, u.side, 'wisp', { lane: u.lane, row: u.row });
  }
  // Drowned Bride: poisoned enemies that die become wisps on your side.
  if (killer || reason) {
    const foe = other(u.side);
    for (const b of unitsOf(st.units, foe)) {
      for (const p of find(st, b, 'poisonedDeathWisp')) {
        if (u.poison > 0) {
          const cell = emptyCells(st.units, foe).find((c) => c.lane === u.lane) ?? emptyCells(st.units, foe)[0];
          if (cell) summonToken(ctx, foe, 'wisp', cell, { atk: p.atk, hp: p.hp, shape: p.shoot ? 'shoot' : undefined });
        }
      }
    }
  }
  // Spirit 5: when a Spirit dies, its spell face is cast for free.
  if (!u.token && unitTraits(u).includes('Spirit') && hasTier(st, u.side, 'Spirit', 5)) {
    const def = defFor(u.key, u.level);
    if (def.spell && def.spell.target.kind === 'none') runOps(ctx, def.spell.do, { ...scope, source: undefined });
  }
  // Ally and enemy death triggers on other units.
  for (const a of orderUnits([...st.units], u.side)) {
    const on: TriggerOn = a.side === u.side ? 'allyDeath' : 'enemyDeath';
    for (const t of defFor(a.key, a.level).triggers) {
      if (t.on !== on) continue;
      if (t.if && !t.if.every((c) => cond(ctx, c, u, { ...scope, side: a.side }))) continue;
      fireTrigger(ctx, a, t, { ...scope, side: a.side, source: a });
    }
  }
  // Killer rewards: Reaper tiers, Grey Reaper wisps, Beast 4.
  if (killer && st.units.includes(killer)) {
    const kt = unitTraits(killer);
    if (kt.includes('Reaper') && hasTier(st, killer.side, 'Reaper', 2)) gainEmbers(ctx, killer.side, 1, 'Reaper');
    if (kt.includes('Reaper') && hasTier(st, killer.side, 'Reaper', 3)) killer.damage = 0;
    for (const p of find(st, killer, 'killLeavesWisp')) {
      const cells = emptyCells(st.units, killer.side);
      const cell = p.inLane ? (cells.find((c) => c.lane === u.lane) ?? cells[0]) : cells[0];
      if (cell) summonToken(ctx, killer.side, 'wisp', cell, { atk: p.atk, hp: p.hp });
    }
    if (kt.includes('Beast') && hasTier(st, killer.side, 'Beast', 4)) killer.attacksLeft += 1;
  }
}

// ---------- triggers ----------

export function runTriggers(ctx: Ctx, u: Unit, on: TriggerOn, scope: Scope): void {
  const def = defFor(u.key, u.level);
  for (const t of def.triggers) {
    if (t.on !== on) continue;
    if (t.if && !t.if.every((c) => cond(ctx, c, u, scope))) continue;
    fireTrigger(ctx, u, t, scope);
    if (on === 'kindle' && (has(ctx.st, u, 'kindleTwice') || (u.level >= 2 && hasRelic(ctx.st, u.side, "Saint's Reliquary")))) fireTrigger(ctx, u, t, scope);
  }
}

export function fireTrigger(ctx: Ctx, u: Unit, t: Trigger, scope: Scope): void {
  const st = ctx.st;
  if (st.triggerDepth >= FLAGS.triggerQueueCap) {
    if (!st.errors.includes('TRIGGER_LOOP')) err(ctx, 'TRIGGER_LOOP');
    return;
  }
  st.triggerDepth += 1;
  ctx.events.push({ type: 'trigger', unit: u.id, on: t.on, name: u.name });
  runOps(ctx, t.do, { ...scope, source: u, side: u.side });
}

// ---------- ops ----------

export function runOps(ctx: Ctx, ops: Op[], scope: Scope): void {
  for (const op of ops) runOp(ctx, op, scope);
}

function unitsFor(ctx: Ctx, sel: UnitSel, scope: Scope): Unit[] {
  return select(ctx, sel, scope).filter((u) => ctx.st.units.includes(u));
}

export function runOp(ctx: Ctx, op: Op, scope: Scope): void {
  const st = ctx.st;
  const me = scope.side;
  switch (op.op) {
    case 'damage':
      for (const u of unitsFor(ctx, op.to, scope)) {
        const before = st.units.length;
        damageUnit(ctx, u, num(ctx, op.n, scope, u), { ignoreShield: op.ignoreShield, reason: scope.spellKey ?? 'effect', bySide: me, source: scope.source });
        if (st.units.length < before) scope.kills += 1;
      }
      return;
    case 'status':
      for (const u of unitsFor(ctx, op.to, scope)) applyStatus(ctx, u, op.status, num(ctx, op.n, scope, u), me, { persist: op.persist });
      return;
    case 'heal':
      for (const u of unitsFor(ctx, op.to, scope)) healUnit(ctx, u, num(ctx, op.n, scope, u));
      return;
    case 'stun':
      for (const u of unitsFor(ctx, op.to, scope)) {
        u.stunned = true;
        ctx.events.push({ type: 'status', unit: u.id, status: 'stun', n: 1 });
      }
      return;
    case 'pull':
      for (const u of unitsFor(ctx, op.to, scope)) pullUnit(ctx, u, op.rows, me, op.intoTauntLane);
      return;
    case 'push':
      for (const u of unitsFor(ctx, op.to, scope)) {
        const to = cellBehind(u);
        if (to && !unitAt(st.units, u.side, to.lane, to.row) && !has(st, u, 'cantBeMoved')) moveUnitTo(ctx, u, to, false);
        else {
          damageUnit(ctx, u, op.blockedDamage, { reason: 'push', bySide: me });
          if (op.blockedStun && st.units.includes(u)) u.stunned = true;
        }
      }
      return;
    case 'summon': {
      const cells = selectCells(ctx, op.where, scope);
      const n = op.count === 'fill' ? cells.length : (op.count ?? 1);
      let made = 0;
      for (const c of cells) {
        if (made >= n) break;
        if (summonToken(ctx, me, op.token, c, { atk: op.atk, hp: op.hp, shape: op.shape })) made++;
      }
      return;
    }
    case 'embers':
      gainEmbers(ctx, op.side === 'enemy' ? other(me) : me, num(ctx, op.n, scope), scope.spellKey ?? 'effect');
      return;
    case 'healWarden':
      healWarden(ctx, me, op.n);
      return;
    case 'destroy':
      for (const u of unitsFor(ctx, op.to, scope)) {
        const before = st.units.length;
        killUnit(ctx, u, scope.source, scope.spellKey ?? 'destroy');
        if (st.units.length < before) scope.kills += 1;
      }
      return;
    case 'buff':
      for (const u of unitsFor(ctx, op.to, scope)) {
        if (op.duration === 'wave') u.waveBuffAtk += op.atk ?? 0;
        else {
          u.buffAtk += op.atk ?? 0;
          u.buffHp += op.hp ?? 0;
        }
      }
      return;
    case 'grant':
      for (const u of unitsFor(ctx, op.to, scope)) {
        u.grants.push({ passive: op.passive, untilWave: op.duration === 'wave' ? st.wave : op.duration === 'nextWave' ? st.wave + 1 : undefined });
        if (op.passive.k === 'returnsOnDeath') {
          u.returnsLeft += op.passive.times;
          u.returnsFull = op.passive.fullHealth;
        }
      }
      return;
    case 'move':
      for (const u of unitsFor(ctx, op.to, scope)) {
        const dest = scope.targets.find((t): t is { cell: Cell } => 'cell' in t);
        if (dest) moveUnitTo(ctx, u, dest.cell, false);
      }
      return;
    case 'swap': {
      const [a, b] = scope.targetUnits;
      if (a && b && st.units.includes(a) && st.units.includes(b) && a.side === b.side) {
        const al = a.lane,
          ar = a.row;
        a.lane = b.lane;
        a.row = b.row;
        b.lane = al;
        b.row = ar;
        ctx.events.push({ type: 'move', unit: a.id, from: { lane: al, row: ar }, to: { lane: a.lane, row: a.row }, paid: false });
      }
      return;
    }
    case 'returnToDeck':
      for (const u of unitsFor(ctx, op.to, scope)) {
        const i = st.units.indexOf(u);
        if (i >= 0) st.units.splice(i, 1);
        const card = u.cardUid !== undefined ? st.sides[u.side].cards.find((c) => c.uid === u.cardUid) : undefined;
        if (card) card.spent = false;
        ctx.events.push({ type: 'note', text: `${u.name} returns to the deck` });
      }
      return;
    case 'exhume': {
      let n = op.count;
      for (let i = st.fallen.length - 1; i >= 0 && n > 0; i--) {
        const f = st.fallen[i]!;
        if (f.side !== me || f.token || f.cardUid === undefined) continue;
        const card = st.sides[me].cards.find((c) => c.uid === f.cardUid);
        if (card && card.spent) {
          card.spent = false;
          st.fallen.splice(i, 1);
          n--;
        }
      }
      return;
    }
    case 'revive': {
      let n = op.count;
      for (let i = st.fallen.length - 1; i >= 0 && n > 0; i--) {
        const f = st.fallen[i]!;
        if (f.side !== me || f.token) continue;
        if (unitAt(st.units, me, f.lane, f.row)) continue;
        st.fallen.splice(i, 1);
        const u = makeUnit(ctx, me, f.key, f.level, { lane: f.lane, row: f.row }, f.cardUid);
        if (!op.fullHealth) u.damage = u.baseHp - 1;
        placeUnit(ctx, u);
        n--;
      }
      return;
    }
    case 'spellDiscount':
      if (op.scope === 'next') st.sides[me].discountNext += op.n;
      else st.sides[me].discountWave += op.n;
      return;
    case 'tickBurn':
      for (const u of unitsFor(ctx, op.to, scope)) tickBurn(ctx, u, op.spread);
      return;
    case 'multiplyStatus':
      for (const u of unitsFor(ctx, op.to, scope)) {
        if (op.status === 'burn') u.burn *= op.factor;
        else u.poison *= op.factor;
      }
      return;
    case 'attackAgain':
      for (const u of unitsFor(ctx, op.to, scope)) {
        u.attacksLeft += 1;
        if (op.selfDamage) damageUnit(ctx, u, op.selfDamage, { reason: 'overcharge', bySide: me });
      }
      return;
    case 'laneHalfDamage': {
      const lanes = scope.targets.flatMap((t) => ('lane' in t ? [t.lane] : []));
      for (const l of lanes) if (!st.sides[me].halfDamageLanes.includes(l)) st.sides[me].halfDamageLanes.push(l);
      return;
    }
    case 'noFaceDamage':
      st.sides[me].noFaceDamageUntilWave = Math.max(st.sides[me].noFaceDamageUntilWave, st.wave + op.waves - 1);
      return;
    case 'enemyNoSpells':
      st.sides[other(me)].noSpellsUntilWave = Math.max(st.sides[other(me)].noSpellsUntilWave, st.wave + op.waves);
      return;
    case 'shieldsPersist':
      st.sides[me].shieldsPersistUntilWave = Math.max(st.sides[me].shieldsPersistUntilWave, st.wave + op.waves - 1);
      return;
    case 'burnSpreadsFull':
      st.sides[me].burnSpreadsFullUntilWave = Math.max(st.sides[me].burnSpreadsFullUntilWave, st.wave + op.waves - 1);
      return;
    case 'triggerLastGasps': {
      const fallen = st.fallen.filter((f) => f.side === me && !f.token);
      for (let i = 0; i < op.times; i++) {
        for (const f of fallen) {
          const ghost = makeUnit(ctx, me, f.key, f.level, { lane: f.lane, row: f.row }, f.cardUid);
          const gscope: Scope = { side: me, source: ghost, targets: [], targetUnits: [], victim: ghost, kills: 0 };
          for (const t of defFor(f.key, f.level).triggers) if (t.on === 'lastGasp') fireTrigger(ctx, ghost, t, gscope);
        }
      }
      return;
    }
    case 'recastLast': {
      const last = st.sides[me].lastSpell;
      if (!last) return;
      const def = defFor(last.key, last.level);
      if (!def.spell) return;
      for (let i = 0; i < op.times; i++) {
        const targetUnits = last.targets.flatMap((t) => ('unit' in t ? st.units.filter((u) => u.id === t.unit) : []));
        runOps(ctx, def.spell.do, { side: me, targets: last.targets, targetUnits, kills: 0, spellKey: last.key });
      }
      return;
    }
    case 'sellCard': {
      const t = scope.targets.find((x): x is { card: number } => 'card' in x);
      const cards = st.sides[me].cards;
      const i = t ? cards.findIndex((c) => c.uid === t.card) : -1;
      if (i >= 0) {
        const card = cards[i]!;
        cards.splice(i, 1);
        gainEmbers(ctx, me, Math.floor(cardPrice(card.key) * op.priceMult), 'Pawn');
      }
      return;
    }
    case 'removeSwift':
      for (const u of unitsFor(ctx, op.to, scope)) u.grants.push({ passive: { k: 'cantMove' } });
      return;
    case 'stripShield':
      for (const u of unitsFor(ctx, op.to, scope)) {
        u.shield = 0;
        u.shieldPersist = 0;
      }
      return;
    case 'embersPerKill': {
      const n = op.max !== undefined ? Math.min(op.max, scope.kills) : scope.kills;
      if (n > 0) gainEmbers(ctx, me, n * op.n, scope.spellKey ?? 'refund');
      return;
    }
    case 'unspendCard':
      for (const t of scope.targets) {
        if ('card' in t) {
          const card = st.sides[me].cards.find((c) => c.uid === t.card);
          if (card) card.spent = false;
        }
      }
      return;
    case 'copyTrait': {
      const src = scope.source;
      if (!src) return;
      const beside = atCells(ctx, me, cellsBeside(src));
      const picks = op.count === 'each' ? beside : beside.slice(0, 1);
      for (const b of picks) {
        const t = unitTraits(b).find((x) => !unitTraits(src).includes(x));
        if (t) src.extraTraits.push(t as Trait);
      }
      return;
    }
    case 'chance':
      // Deterministic: use the AI stream so replays stay stable.
      runOps(ctx, op.do, scope);
      return;
  }
}

export function moveUnitTo(ctx: Ctx, u: Unit, to: Cell, paid: boolean): void {
  const from = { lane: u.lane, row: u.row };
  u.lane = to.lane;
  u.row = to.row;
  ctx.events.push({ type: 'move', unit: u.id, from, to: { ...to }, paid });
  clampDerivedHp(ctx);
}

/** After the board changes, units whose derived max HP shrank keep at least 1 HP (flag) or die. */
export function clampDerivedHp(ctx: Ctx): void {
  const st = ctx.st;
  for (const u of [...st.units]) {
    if (!st.units.includes(u)) continue;
    if (ctx.pendingDeaths?.some((p) => p.unit === u)) continue; // lethal damage is not a derived-HP loss
    const max = effectiveMaxHp(st, u);
    if (u.damage >= max) {
      if (FLAGS.bonusHpLossNeverKills) u.damage = max - 1;
      else killUnit(ctx, u, undefined, 'lost bonus health');
    }
  }
}

/** Pull an enemy toward its own Front row. Blocked pulls do nothing. Binder 2/3 add Stun and damage. */
export function pullUnit(ctx: Ctx, u: Unit, rows: 1 | 'front', bySide: Side, intoTauntLane?: boolean): void {
  const st = ctx.st;
  if (has(st, u, 'cantBeMoved')) return;
  let moved = false;
  if (intoTauntLane) {
    const taunter = unitsOf(st.units, bySide).find((a) => tauntLanes(st, a).length > 0);
    if (taunter) {
      const dest: Cell = { lane: taunter.lane, row: 0 };
      if (!unitAt(st.units, u.side, dest.lane, dest.row) || (dest.lane === u.lane && dest.row === u.row)) {
        if (!(dest.lane === u.lane && dest.row === u.row)) {
          moveUnitTo(ctx, u, dest, false);
          moved = true;
        }
      }
    }
  }
  if (!moved) {
    const steps = rows === 'front' ? u.row : 1;
    for (let i = 0; i < steps; i++) {
      const a = cellAhead(u);
      if (!a || unitAt(st.units, u.side, a.lane, a.row)) break;
      moveUnitTo(ctx, u, a, false);
      moved = true;
    }
  }
  if (moved) {
    if (hasTier(st, bySide, 'Binder', 2)) {
      u.stunned = true;
      ctx.events.push({ type: 'status', unit: u.id, status: 'stun', n: 1 });
    }
    if (hasTier(st, bySide, 'Binder', 3)) damageUnit(ctx, u, 3, { reason: 'Binder', bySide });
  }
}

/** One Burn tick on a unit: N damage, spread to neighbours, then decay (SPEC §7). */
export function tickBurn(ctx: Ctx, u: Unit, spread: boolean): void {
  const st = ctx.st;
  if (u.burn <= 0 || !st.units.includes(u)) return;
  const n = u.burn;
  const foe = other(u.side);
  damageUnit(ctx, u, n, { reason: 'burn', bySide: foe });
  if (spread) {
    const full = st.wave <= st.sides[foe].burnSpreadsFullUntilWave || hasTier(st, foe, 'Waxborn', 6) || unitsOf(st.units, foe).some((a) => find(st, a, 'hitsApply').some((p) => p.status === 'burn' && p.spreadFull));
    const amount = full ? n : Math.floor(n / FLAGS.burnSpreadDivisor);
    if (amount > 0) {
      for (const c of cellsAround(u)) {
        const o = unitAt(st.units, u.side, c.lane, c.row);
        if (o && o.burn === 0) applyStatus(ctx, o, 'burn', amount, foe, { raw: true });
      }
    }
  }
  if (st.units.includes(u)) {
    const locked = unitsOf(st.units, foe).some((a) => has(st, a, 'burnCantBeRemoved'));
    if (!locked) u.burn = Math.max(0, u.burn - 1);
  }
}

export function tickPoison(ctx: Ctx, u: Unit): void {
  const st = ctx.st;
  if (u.poison <= 0 || !st.units.includes(u)) return;
  const foe = other(u.side);
  const times = hasTier(st, foe, 'Drowned', 6) ? 2 : 1;
  for (let i = 0; i < times; i++) {
    if (!st.units.includes(u)) return;
    damageUnit(ctx, u, u.poison, { reason: 'poison', bySide: foe, ignoreShield: true });
  }
  if (!st.units.includes(u)) return;
  const noDecay = unitsOf(st.units, foe).flatMap((a) => find(st, a, 'poisonNoDecay'));
  if (noDecay.length === 0 && FLAGS.poisonDecays) u.poison = Math.max(0, u.poison - 1);
  for (const p of noDecay) if (p.grows) u.poison += p.grows;
}

export function allCellsOf(): Cell[] {
  return allCells();
}

export function laneOf(n: number): Lane {
  return n as Lane;
}
export function rowOf(n: number): Row {
  return n as Row;
}

export { passivesOf, isRooted };
