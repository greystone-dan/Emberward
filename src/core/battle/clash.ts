import { FLAGS } from '../../config/flags';
import { cellAhead, cellsBeside, laneEnemies, orderUnits, other, unitAt, unitsOf } from '../grid';
import type { BattleState, Row, Side, Unit } from '../types';
import { defFor } from './defs';
import { applyStatus, damageUnit, faceDamage, flushDeaths, type Ctx, healWarden, hitStatuses, killUnit, makeUnit, placeUnit, pullUnit, runTriggers, summonToken, tickBurn, tickPoison, type Scope } from './engine';
import { effectiveAtk, effectiveShape, find, has, hasRelic, hasTier, tauntLanes, unitTraits } from './stats';

/** A planned attack from one unit, computed from the board at the start of a beat. */
export interface PlannedAttack {
  attacker: Unit;
  targets: Unit[];
  face: boolean;
  damage: number;
  shape: Unit['shape'];
  splash: Unit[];
}

function canBeHitBy(st: BattleState, target: Unit, attacker: Unit, shape: Unit['shape']): boolean {
  for (const p of find(st, target, 'cantBeHitBy')) {
    if (!p.shapes.includes(shape)) continue;
    if (p.farOnly) {
      if (attacker.row >= 1) return false;
    } else return false;
  }
  return true;
}

/** Computes what a unit would attack right now. Pure on the state. */
export function planAttack(st: BattleState, u: Unit): PlannedAttack | undefined {
  const shape = effectiveShape(st, u);
  if (shape === 'none') return undefined;
  if (st.boss && u.side === 0 && st.boss.darkLanes.includes(u.lane)) return undefined;
  if (st.boss && u.side === 1 && st.boss.ownLaneDark && u.lane === 3) return undefined;
  const power = effectiveAtk(st, u);
  const foe = other(u.side);
  const lane = laneEnemies(st.units, u.side, u.lane).filter((e) => canBeHitBy(st, e, u, shape));
  const ignoresTaunt = shape === 'pierce' || shape === 'lob' || (unitTraits(u).includes('Spirit') && hasTier(st, u.side, 'Spirit', 2));
  const spirit3 = (e: Unit) => unitTraits(e).includes('Spirit') && hasTier(st, e.side, 'Spirit', 3) && e.arrivedWave === st.wave && (shape === 'strike' || shape === 'cleave');
  const taunter = ignoresTaunt
    ? undefined
    : orderUnits(unitsOf(st.units, foe), foe).find((e) => tauntLanes(st, e).includes(u.lane) && canBeHitBy(st, e, u, shape) && !spirit3(e));
  const base: PlannedAttack = { attacker: u, targets: [], face: false, damage: power, shape, splash: [] };
  const frontMost = lane.filter((e) => !spirit3(e))[0];
  switch (shape) {
    case 'strike':
    case 'cleave': {
      if (u.row === 2) return undefined;
      if (u.row === 1) {
        const a = cellAhead(u)!;
        if (unitAt(st.units, u.side, a.lane, a.row)) return undefined;
      }
      const t = taunter ?? frontMost;
      if (!t) return { ...base, face: true };
      base.targets = [t];
      if (shape === 'cleave') base.splash = cellsBeside(t).flatMap((c) => (unitAt(st.units, foe, c.lane, c.row) ? [unitAt(st.units, foe, c.lane, c.row)!] : []));
      return base;
    }
    case 'shoot': {
      const t = taunter ?? frontMost;
      if (!t) return { ...base, face: true };
      base.targets = [t];
      return base;
    }
    case 'pierce': {
      if (lane.length === 0) return { ...base, face: true };
      base.targets = lane;
      return base;
    }
    case 'lob': {
      if (u.row === 0) return undefined;
      const t = lane[lane.length - 1];
      if (!t) return undefined;
      base.targets = [t];
      if (hasTier(st, u.side, 'Artillery', 2)) base.splash = cellsBeside(t).flatMap((c) => (unitAt(st.units, foe, c.lane, c.row) ? [unitAt(st.units, foe, c.lane, c.row)!] : []));
      return base;
    }
  }
  return undefined;
}

function resolveAttack(ctx: Ctx, plan: PlannedAttack): void {
  const st = ctx.st;
  const u = plan.attacker;
  const foe = other(u.side);
  const ranged = plan.shape === 'shoot' || plan.shape === 'lob' || plan.shape === 'pierce';
  const ignoreShield = has(st, u, 'ignoreShield') || (unitTraits(u).includes('Marksman') && hasTier(st, u.side, 'Marksman', 4));
  const strip = find(st, u, 'ignoreShield').some((p) => p.strip);
  if (plan.face) {
    ctx.events.push({ type: 'attack', attacker: u.id, target: 'face', targetSide: foe, damage: plan.damage, shape: plan.shape });
    faceDamage(ctx, foe, plan.damage, u.name, u.side);
    return;
  }
  for (const t of plan.targets) {
    if (!st.units.includes(t)) continue;
    ctx.events.push({ type: 'attack', attacker: u.id, target: t.id, targetSide: foe, damage: plan.damage, shape: plan.shape });
    damageUnit(ctx, t, plan.damage, { source: u, ignoreShield, stripShield: strip, ranged, reason: u.name, attack: true, bySide: u.side });
  }
  if (plan.splash.length) {
    const art3 = hasTier(st, u.side, 'Artillery', 3);
    const splashDmg = plan.shape === 'cleave' ? plan.damage : art3 ? 2 : 1;
    for (const s of plan.splash) {
      if (!st.units.includes(s)) continue;
      ctx.events.push({ type: 'attack', attacker: u.id, target: s.id, targetSide: foe, damage: splashDmg, shape: plan.shape });
      damageUnit(ctx, s, splashDmg, { source: plan.shape === 'cleave' || art3 ? u : undefined, ignoreShield, ranged, reason: `${u.name} splash`, attack: true, bySide: u.side });
    }
  }
}

/** One beat: all attacks in a row from both sides are planned from the same board, then applied. */
function resolveBeat(ctx: Ctx, row: Row): void {
  const st = ctx.st;
  ctx.events.push({ type: 'beat', row });
  const groups: Unit[][] = [[], []];
  for (const u of orderUnits(st.units, st.initiative)) {
    if (u.row !== row && !has(st, u, 'attacksEveryBeat')) continue;
    const first = has(st, u, 'strikesFirst') || (unitTraits(u).includes('Beast') && hasTier(st, u.side, 'Beast', 3));
    groups[first ? 0 : 1]!.push(u);
  }
  for (const group of groups) {
    let again = true;
    let rounds = 0;
    while (again && rounds < 4) {
      again = false;
      rounds++;
      const plans: PlannedAttack[] = [];
      for (const u of group) {
        if (!st.units.includes(u) || u.attacksLeft <= 0) continue;
        if (u.stunned) {
          u.stunned = false;
          u.attacksLeft = 0;
          ctx.events.push({ type: 'note', text: `${u.name} is Stunned and skips its attack` });
          continue;
        }
        for (const p of find(st, u, 'pullBeforeAttack')) {
          const target = laneEnemies(st.units, u.side, u.lane)[0];
          if (target) {
            pullUnit(ctx, target, 'front', u.side);
            if (p.beside) for (const c of cellsBeside(target)) {
              const b = unitAt(st.units, target.side, c.lane, c.row);
              if (b) pullUnit(ctx, b, 'front', u.side);
            }
          }
        }
        const plan = planAttack(st, u);
        u.attacksLeft -= 1;
        if (plan) plans.push(plan);
      }
      ctx.deferDeaths = true;
      for (const plan of plans) resolveAttack(ctx, plan);
      flushDeaths(ctx);
      if (group.some((u) => st.units.includes(u) && u.attacksLeft > 0)) again = true;
    }
  }
}

export function resolveClash(ctx: Ctx): void {
  const st = ctx.st;
  for (const u of st.units) u.attacksLeft = Math.max(u.attacksLeft, 1);
  for (const row of [0, 1, 2] as Row[]) {
    resolveBeat(ctx, row);
    if (checkWin(ctx)) return;
  }
  waveEnd(ctx);
}

export function checkWin(ctx: Ctx): boolean {
  const st = ctx.st;
  if (st.phase === 'over') return true;
  const p = st.sides[0].hp <= 0,
    e = st.sides[1].hp <= 0;
  if (!p && !e) return false;
  st.phase = 'over';
  st.outcome = 'kill';
  st.winner = p && e ? (FLAGS.simultaneousZeroPlayerWins ? 0 : 1) : p ? 1 : 0;
  ctx.events.push({ type: 'battleOver', winner: st.winner, outcome: 'kill' });
  return true;
}

/** SPEC §6.2: Burn, Poison, Wave End triggers, Shields expire, win check. */
export function waveEnd(ctx: Ctx): void {
  const st = ctx.st;
  const ordered = () => orderUnits(st.units, st.initiative);
  for (const u of ordered()) tickBurn(ctx, u, true);
  if (checkWin(ctx)) return;
  for (const u of ordered()) tickPoison(ctx, u);
  if (checkWin(ctx)) return;
  for (const side of [st.initiative, other(st.initiative)] as Side[]) {
    for (const u of orderUnits(unitsOf(st.units, side), side)) {
      if (!st.units.includes(u)) continue;
      runTriggers(ctx, u, 'waveEnd', { side: u.side, source: u, targets: [], targetUnits: [], kills: 0 });
    }
    // Pilgrim 2: gain 1 if a Pilgrim survived the Clash.
    if (hasTier(st, side, 'Pilgrim', 2) && unitsOf(st.units, side).some((u) => unitTraits(u).includes('Pilgrim'))) {
      st.sides[side].embers += 1;
      ctx.events.push({ type: 'embers', side, delta: 1, reason: 'Pilgrim' });
    }
  }
  // Elites: Choir Abbot refills; Brazier Knight heals per burning unit.
  eliteWaveEnd(ctx);
  // Bonebound 6: each fallen Bonebound returns once at Wave End.
  for (const side of [0, 1] as Side[]) {
    if (!hasTier(st, side, 'Bonebound', 6)) continue;
    for (let i = st.fallen.length - 1; i >= 0; i--) {
      const f = st.fallen[i]!;
      if (f.side !== side || f.token || !defFor(f.key, f.level).traits.includes('Bonebound')) continue;
      if (unitAt(st.units, side, f.lane, f.row)) continue;
      st.fallen.splice(i, 1);
      placeUnit(ctx, makeUnit(ctx, side, f.key, f.level, { lane: f.lane, row: f.row }, f.cardUid, { returnsLeft: 0 }));
    }
  }
  // Shields expire unless kept.
  for (const u of st.units) {
    const side = st.sides[u.side];
    const keep =
      st.wave <= side.shieldsPersistUntilWave ||
      unitsOf(st.units, u.side).some((a) => has(st, a, 'shieldsNeverExpire')) ||
      (unitTraits(u).includes('Bellforged') && hasTier(st, u.side, 'Bellforged', 4));
    if (!keep) u.shield = 0;
    u.waveBuffAtk = 0;
  }
  ctx.events.push({ type: 'waveEnd', wave: st.wave });
  if (checkWin(ctx)) return;
  if (st.wave >= FLAGS.wavesPerBattle) {
    endByWaveLimit(ctx);
    return;
  }
  startWave(ctx, st.wave + 1);
}

function endByWaveLimit(ctx: Ctx): void {
  const st = ctx.st;
  st.phase = 'over';
  const p = st.sides[0].faceDamageDealt,
    e = st.sides[1].faceDamageDealt;
  if (p === e) {
    st.winner = null;
    st.outcome = 'draw';
  } else {
    st.winner = p > e ? 0 : 1;
    st.outcome = 'waveLimit';
    if (st.winner === 1) st.sides[0].hp -= e - p;
  }
  ctx.events.push({ type: 'battleOver', winner: st.winner, outcome: st.outcome });
}

function eliteWaveEnd(ctx: Ctx): void {
  const st = ctx.st;
  if (!st.elite) return;
  if (st.elite.kind === 'choirAbbot' && st.units.some((u) => u.side === 1 && u.key === 'e_abbot')) {
    for (const c of [...unitsOf(st.units, 1)].length < 12 ? emptyCellsOf(st, 1) : []) summonToken(ctx, 1, 'chorister', c);
  }
  if (st.elite.kind === 'brazierKnight' && st.units.some((u) => u.side === 1 && u.key === 'e_brazierKnight')) {
    const burning = st.units.filter((u) => u.burn > 0).length;
    if (burning > 0) healWarden(ctx, 1, burning);
  }
}
function emptyCellsOf(st: BattleState, side: Side) {
  const out = [];
  for (let lane = 0; lane < 4; lane++) for (let row = 0; row < 3; row++) if (!unitAt(st.units, side, lane, row)) out.push({ lane: lane as 0 | 1 | 2 | 3, row: row as Row });
  return out;
}

/** Wave Start: initiative, actions, per-wave resets, Wave Start triggers and per-wave shields. */
export function startWave(ctx: Ctx, wave: number): void {
  const st = ctx.st;
  st.wave = wave;
  st.initiative = FLAGS.alternateInitiative ? (wave % 2 === 1 ? 0 : 1) : 0;
  st.turn = st.initiative;
  const n = wave === 1 ? FLAGS.actionsInWaveOne : FLAGS.actionsPerWave;
  st.actionsLeft = [n, n];
  st.passed = [false, false];
  st.firstPass = null;
  for (const side of st.sides) {
    side.discountWave = 0;
    side.firstSpellCastThisWave = false;
    side.firstBurnThisWave = false;
    side.paidStepsThisWave = 0;
    side.halfDamageLanes = [];
    side.deathsThisWave = 0;
    side.bonebound2Used = false;
  }
  for (const u of st.units) {
    u.stepsUsed = 0;
    u.attacksLeft = 1;
  }
  ctx.events.push({ type: 'waveStart', wave, initiative: st.initiative });
  // Boss lanes advance.
  if (st.boss) {
    st.boss.darkLanes = [...st.boss.nextDarkLanes];
    const hp = st.sides[1].hp;
    const next = wave % 4;
    st.boss.nextDarkLanes = hp <= FLAGS.bossPhase2Hp ? [next as 0 | 1 | 2 | 3, ((next + 1) % 4) as 0 | 1 | 2 | 3] : [next as 0 | 1 | 2 | 3];
    st.boss.ownLaneDark = hp <= FLAGS.bossPhase3Hp;
    if (wave > 1 && hp <= FLAGS.bossPhase2Hp) kilnBreath(ctx);
  }
  // Bone Bellwether returns at the next Wave Start.
  for (let i = st.fallen.length - 1; i >= 0; i--) {
    const f = st.fallen[i]!;
    if (f.token || f.wave >= wave) continue;
    const def = defFor(f.key, f.level);
    const ret = def.passives.find((p) => p.k === 'returnsAtWaveStart');
    if (!ret || ret.k !== 'returnsAtWaveStart') continue;
    if (unitAt(st.units, f.side, f.lane, f.row)) continue;
    st.fallen.splice(i, 1);
    const u = placeUnit(ctx, makeUnit(ctx, f.side, f.key, f.level, { lane: f.lane, row: f.row }, f.cardUid));
    if (ret.shield) applyStatus(ctx, u, 'shield', ret.shield, f.side);
  }
  if (wave > 1) {
    for (const side of [st.initiative, other(st.initiative)] as Side[]) {
      for (const u of orderUnits(unitsOf(st.units, side), side)) {
        if (!st.units.includes(u)) continue;
        runTriggers(ctx, u, 'waveStart', { side, source: u, targets: [], targetUnits: [], kills: 0 });
      }
    }
    eliteWaveStart(ctx);
    if (hasTier(st, 0, 'Waxborn', 6)) for (const u of orderUnits(st.units, st.initiative)) if (u.side === 1) tickBurn(ctx, u, true);
    if (hasTier(st, 1, 'Waxborn', 6)) for (const u of orderUnits(st.units, st.initiative)) if (u.side === 0) tickBurn(ctx, u, true);
  }
  perWaveShields(ctx);
  checkWin(ctx);
}

/** "Each wave" shields: Bellforged tiers, Guardian 2, Chain Acolyte auras, Bell Warden, Belfry Crab. */
function perWaveShields(ctx: Ctx): void {
  const st = ctx.st;
  for (const side of [0, 1] as Side[]) {
    const bell = hasTier(st, side, 'Bellforged', 4) ? 4 : hasTier(st, side, 'Bellforged', 2) ? 2 : 0;
    const guard = hasTier(st, side, 'Guardian', 4) ? 4 : hasTier(st, side, 'Guardian', 2) ? 2 : 0;
    for (const u of orderUnits(unitsOf(st.units, side), side)) {
      const traits = unitTraits(u);
      if (bell && traits.includes('Bellforged')) applyStatus(ctx, u, 'shield', bell, side, { persist: hasTier(st, side, 'Bellforged', 4) });
      if (guard && u.row === 0 && traits.includes('Guardian')) {
        const behind = [1, 2].map((r) => unitAt(st.units, side, u.lane, r)).find((x) => x);
        if (behind) applyStatus(ctx, behind, 'shield', guard, side);
      }
      for (const p of find(st, u, 'shieldEachWaveInFront')) if (u.row === 0) applyStatus(ctx, u, 'shield', p.n, side);
      for (const p of find(st, u, 'shieldAtWaveStart')) applyStatus(ctx, u, 'shield', p.n === 'power' ? effectiveAtk(st, u) : p.n, side);
      const aura = aurasOnShield(st, u);
      if (aura > 0) applyStatus(ctx, u, 'shield', aura, side);
    }
  }
}
import { aurasOn } from './stats';
function aurasOnShield(st: BattleState, u: Unit): number {
  return aurasOn(st, u).shieldEachWave;
}

/** Boss phase 2 (The Long Dark): Kiln Breath burns the player's frontmost unit and the units beside it. Deterministic: lowest row, then lane A first. */
function kilnBreath(ctx: Ctx): void {
  const st = ctx.st;
  const mine = unitsOf(st.units, 0).sort((a, b) => a.row - b.row || a.lane - b.lane);
  const target = mine[0];
  if (!target) return;
  ctx.events.push({ type: 'note', text: `Kiln Breath scorches ${target.name}` });
  const victims = [target, ...cellsBeside(target).map((c) => unitAt(st.units, 0, c.lane, c.row)).filter((u): u is Unit => !!u)];
  for (const v of victims) applyStatus(ctx, v, 'burn', FLAGS.kilnBreathBurn, 1);
}

function eliteWaveStart(ctx: Ctx): void {
  const st = ctx.st;
  if (st.elite?.kind === 'tideCaller' && st.units.some((u) => u.side === 1 && u.key === 'e_tideCaller')) {
    // Pull the player's whole Front row one lane toward lane A.
    for (const u of unitsOf(st.units, 0).filter((x) => x.row === 0).sort((a, b) => a.lane - b.lane)) {
      if (u.lane === 0 || has(st, u, 'rooted') || has(st, u, 'cantBeMoved')) continue;
      const dest = { lane: (u.lane - 1) as 0 | 1 | 2 | 3, row: 0 as Row };
      if (!unitAt(st.units, 0, dest.lane, 0)) {
        ctx.events.push({ type: 'move', unit: u.id, from: { lane: u.lane, row: 0 }, to: dest, paid: false });
        u.lane = dest.lane;
      }
    }
  }
}

export function killIfDead(ctx: Ctx, u: Unit): void {
  killUnit(ctx, u, undefined, 'check');
}

export { hitStatuses, hasRelic, type Scope };
