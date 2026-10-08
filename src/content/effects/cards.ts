import type { CardEffects, LevelEffects, Num, Op, Passive, Trigger, UnitEffects, UnitSel } from './dsl';

/**
 * Every card's rules, as data. Numbers mirror content/cards.json; a test checks the text against this.
 * Keys are card ids. Spark = level 1, Flame = level 2, Fire = Flame plus the hand-written line.
 */

const k = (...ops: Op[]): Trigger => ({ on: 'kindle', do: ops });
const gasp = (...ops: Op[]): Trigger => ({ on: 'lastGasp', do: ops });
const ws = (...ops: Op[]): Trigger => ({ on: 'waveStart', do: ops });
const we = (...ops: Op[]): Trigger => ({ on: 'waveEnd', do: ops });
const burn = (n: Num, to: UnitSel): Op => ({ op: 'status', status: 'burn', n, to });
const poison = (n: Num, to: UnitSel): Op => ({ op: 'status', status: 'poison', n, to });
const shield = (n: number, to: UnitSel): Op => ({ op: 'status', status: 'shield', n, to });
const dmg = (n: Num, to: UnitSel): Op => ({ op: 'damage', n, to });
const taunt: Passive = { k: 'taunt' };
const rooted: Passive = { k: 'rooted' };
const swift = (n: number): Passive => ({ k: 'swift', n });
const lvl = (passives: Passive[], triggers: Trigger[], spell?: LevelEffects['spell']): LevelEffects => {
  const out: LevelEffects = {};
  if (passives.length) out.passives = passives;
  if (triggers.length) out.triggers = triggers;
  if (spell) out.spell = spell;
  return out;
};

export const CARD_EFFECTS: Record<number, CardEffects> = {
  1: {
    spark: lvl([], [k(shield(2, 'self'))], { target: { kind: 'lane' }, do: [dmg(3, 'targetLaneFrontmost')] }),
    flame: lvl([], [k(shield(4, 'self'), shield(2, 'beside'))], { target: { kind: 'lane' }, do: [dmg(5, 'targetLaneFrontmost')] }),
    fire: lvl([{ k: 'alliesCantDie', trait: 'Waxborn' }], [k(shield(4, 'allies'))]),
  },
  2: {
    spark: lvl([swift(1), { k: 'hitsApply', status: 'burn', n: 1 }], [], { target: { kind: 'enemy' }, do: [burn(2, 'target')] }),
    flame: lvl([swift(2), { k: 'hitsApply', status: 'burn', n: 2, spreadFull: true }], [], { target: { kind: 'enemy' }, do: [burn(4, 'target')] }),
    fire: lvl([{ k: 'everyHitAppliesBurn', n: 1 }], []),
  },
  3: {
    spark: lvl([{ k: 'hitsApply', status: 'burn', n: 1 }], [], { target: { kind: 'enemy' }, do: [{ op: 'tickBurn', to: 'target', spread: false }] }),
    flame: lvl([{ k: 'hitsApply', status: 'burn', n: 2 }], [we({ op: 'tickBurn', to: 'lastHitTarget', spread: false })], {
      target: { kind: 'none' },
      do: [{ op: 'tickBurn', to: { sel: 'enemies', where: ['burning'] }, spread: false }],
    }),
  },
  4: {
    spark: lvl([{ k: 'aura', dirs: ['ahead'], effect: { power: 1 } }], [], { target: { kind: 'none' }, do: [{ op: 'spellDiscount', n: 1, scope: 'next' }] }),
    flame: lvl([{ k: 'aura', dirs: ['ahead', 'behind'], effect: { power: 2 } }], [], { target: { kind: 'none' }, do: [{ op: 'spellDiscount', n: 1, scope: 'wave' }] }),
  },
  5: {
    spark: lvl([swift(1)], [gasp(burn(2, 'across'))], { target: { kind: 'none' }, do: [burn(1, 'enemyFront')] }),
    flame: lvl([swift(2)], [gasp(burn(4, 'across'), burn(4, 'acrossBeside'))], { target: { kind: 'none' }, do: [burn(2, 'enemyFrontMid')] }),
  },
  6: {
    spark: lvl([{ k: 'hitsApply', status: 'burn', n: 2 }], [], { target: { kind: 'enemy' }, do: [burn(3, 'target'), burn(3, 'targetBeside')] }),
    flame: lvl([{ k: 'hitsApply', status: 'burn', n: 3, alsoBeside: true }], [], { target: { kind: 'enemy' }, do: [burn(5, 'target'), burn(5, 'targetAround')] }),
  },
  7: {
    spark: lvl([rooted, { k: 'ignoreShield' }], [], { target: { kind: 'ally', where: [{ trait: 'Waxborn' }] }, do: [{ op: 'attackAgain', to: 'target', selfDamage: 2 }] }),
    flame: lvl([rooted, { k: 'ignoreShield', strip: true }], [], { target: { kind: 'ally', where: [{ trait: 'Waxborn' }] }, do: [{ op: 'attackAgain', to: 'target', selfDamage: 0 }] }),
  },
  8: {
    spark: lvl([{ k: 'aura', dirs: ['around'], effect: { rangedReduce: 1 } }], [], { target: { kind: 'lane' }, do: [{ op: 'laneHalfDamage', lanes: 1 }] }),
    flame: lvl([{ k: 'aura', dirs: ['around'], effect: { rangedReduce: 2 } }], [], { target: { kind: 'lane', lanes: 2 }, do: [{ op: 'laneHalfDamage', lanes: 2 }] }),
  },
  9: {
    spark: lvl([rooted, { k: 'immune', status: 'burn' }], [we(burn(1, 'beside'))], { target: { kind: 'enemy' }, do: [{ op: 'multiplyStatus', status: 'burn', factor: 2, to: 'target' }] }),
    flame: lvl([rooted, { k: 'immune', status: 'burn' }], [we(burn(2, 'acrossAround'))], { target: { kind: 'enemy' }, do: [{ op: 'multiplyStatus', status: 'burn', factor: 3, to: 'target' }] }),
  },
  10: {
    spark: lvl([], [we({ op: 'heal', n: 2, to: 'around' })], { target: { kind: 'none' }, do: [{ op: 'revive', count: 1, fullHealth: true }] }),
    flame: lvl([], [we({ op: 'heal', n: 4, to: 'around' }, { op: 'heal', n: 2, to: { sel: 'allies', where: ['notAround'] } })], { target: { kind: 'none' }, do: [{ op: 'revive', count: 2, fullHealth: true }] }),
  },
  11: {
    spark: lvl([], [{ on: 'enemyDeath', if: ['burning'], do: [{ op: 'embers', n: 1 }, { op: 'healWarden', n: 2 }] }], {
      target: { kind: 'none' },
      do: [burn(2, 'enemies'), { op: 'burnSpreadsFull', waves: 1 }],
    }),
    flame: lvl([], [{ on: 'enemyDeath', if: ['burning'], do: [{ op: 'embers', n: 2 }, { op: 'healWarden', n: 3 }] }], {
      target: { kind: 'none' },
      do: [burn(3, 'enemies'), { op: 'burnSpreadsFull', waves: 1 }],
    }),
  },
  12: {
    spark: lvl([rooted, { k: 'hitsApply', status: 'burn', n: 4 }], [], { target: { kind: 'none' }, do: [dmg(3, 'enemies'), { op: 'stripShield', to: 'enemies' }] }),
    flame: lvl([rooted, { k: 'hitsApply', status: 'burn', n: 6 }, { k: 'burnCantBeRemoved' }], [], { target: { kind: 'none' }, do: [dmg(5, 'enemies'), { op: 'stripShield', to: 'enemies' }] }),
  },
  13: {
    spark: lvl([], [gasp({ op: 'summon', token: 'wisp', where: 'selfCell' })], { target: { kind: 'none' }, do: [dmg(1, 'enemyBack')] }),
    flame: lvl([], [gasp({ op: 'summon', token: 'wisp', atk: 2, hp: 2, shape: 'shoot', where: 'selfCell' })], { target: { kind: 'none' }, do: [dmg(2, 'enemyBack')] }),
  },
  14: {
    spark: lvl([swift(2)], [], { target: { kind: 'ally' }, do: [{ op: 'move', to: 'target', cells: 2, ignoreRooted: true }] }),
    flame: lvl([swift(3), { k: 'strikesFirst' }], [], { target: { kind: 'ally', count: 2 }, do: [{ op: 'move', to: 'target', cells: 2, ignoreRooted: true }] }),
    fire: lvl([swift(4), { k: 'attacksEveryBeat' }], []),
  },
  15: {
    spark: lvl([], [gasp({ op: 'summon', token: 'wisp', where: 'selfCell' })], { target: { kind: 'ally' }, do: [{ op: 'destroy', to: 'target' }, { op: 'embers', n: 2 }] }),
    flame: lvl([], [gasp({ op: 'summon', token: 'wisp', where: 'selfCell' }, { op: 'summon', token: 'wisp', where: 'besideEmpty' })], {
      target: { kind: 'ally' },
      do: [{ op: 'destroy', to: 'target' }, { op: 'embers', n: 4 }],
    }),
    fire: lvl([], [gasp({ op: 'summon', token: 'wisp', where: 'allyEmpty', count: 'fill' })]),
  },
  16: {
    spark: lvl([{ k: 'powerPerAllyDeath', n: 1 }], [], { target: { kind: 'none' }, do: [{ op: 'exhume', count: 1 }] }),
    flame: lvl([{ k: 'powerPerAllyDeath', n: 2 }], [], { target: { kind: 'none' }, do: [{ op: 'exhume', count: 2 }] }),
  },
  17: {
    spark: lvl([swift(2)], [k({ op: 'summon', token: 'bat', atk: 1, hp: 1, where: 'besideEmpty' })], { target: { kind: 'ally', count: 2 }, do: [{ op: 'swap', count: 1 }] }),
    flame: lvl([swift(3)], [k({ op: 'summon', token: 'bat', atk: 2, hp: 2, where: 'bothSidesEmpty', count: 2 })], { target: { kind: 'ally', count: 2 }, do: [{ op: 'swap', count: 2 }] }),
  },
  18: {
    spark: lvl([], [gasp({ op: 'buff', atk: 1, to: 'around', duration: 'battle' })], { target: { kind: 'lane' }, do: [dmg(2, 'targetLaneEnemies'), { op: 'embersPerKill', n: 2, max: 1 }] }),
    flame: lvl([], [gasp({ op: 'buff', atk: 2, to: 'around', duration: 'battle' }, shield(2, 'around'))], {
      target: { kind: 'lane' },
      do: [dmg(3, 'targetLaneEnemies'), { op: 'embersPerKill', n: 2 }],
    }),
  },
  19: {
    spark: lvl([{ k: 'returnsOnDeath', times: 1, fullHealth: false }], [], { target: { kind: 'unit' }, do: [{ op: 'grant', passive: { k: 'returnsOnDeath', times: 1, fullHealth: false }, to: 'target' }] }),
    flame: lvl([{ k: 'returnsOnDeath', times: 2, fullHealth: true }], [], {
      target: { kind: 'unit', count: 2 },
      do: [{ op: 'grant', passive: { k: 'returnsOnDeath', times: 1, fullHealth: true }, to: 'target' }],
    }),
  },
  20: {
    spark: lvl([{ k: 'wispBuff', atk: 1, hp: 1 }], [], { target: { kind: 'none' }, do: [{ op: 'summon', token: 'wisp', where: 'allyBackEmpty', count: 2 }] }),
    flame: lvl([{ k: 'wispBuff', atk: 2, hp: 2, shoot: true }], [], { target: { kind: 'none' }, do: [{ op: 'summon', token: 'wisp', where: 'allyBackMidEmpty', count: 3 }] }),
  },
  21: {
    spark: lvl([], [{ on: 'waveEnd', if: ['allyDiedThisWave'], do: [{ op: 'embers', n: 1 }] }], { target: { kind: 'spentCard' }, do: [{ op: 'unspendCard' }] }),
    flame: lvl([], [{ on: 'waveEnd', if: ['allyDiedThisWave'], do: [{ op: 'embers', n: { ref: 'deathsThisWave', mult: 1, max: 3 } }] }], {
      target: { kind: 'spentCard', count: 2 },
      do: [{ op: 'unspendCard' }],
    }),
  },
  22: {
    spark: lvl([], [{ on: 'allyDeath', do: [{ op: 'summon', token: 'wisp', where: 'victimBesideEmpty' }] }], { target: { kind: 'none' }, do: [{ op: 'summon', token: 'wisp', where: 'allyFrontEmpty', count: 'fill' }] }),
    flame: lvl([], [{ on: 'allyDeath', do: [{ op: 'summon', token: 'wisp', atk: 2, hp: 2, where: 'victimBesideEmpty', count: 'fill' }] }], {
      target: { kind: 'none' },
      do: [{ op: 'summon', token: 'wisp', atk: 2, hp: 2, where: 'allyFrontMidEmpty', count: 'fill' }],
    }),
  },
  23: {
    spark: lvl([{ k: 'killLeavesWisp' }], [], { target: { kind: 'none' }, do: [{ op: 'destroy', to: { sel: 'enemies', where: [{ hpAtMost: 2 }] } }] }),
    flame: lvl([{ k: 'killLeavesWisp', atk: 2, hp: 2, inLane: true }], [], { target: { kind: 'none' }, do: [{ op: 'destroy', to: { sel: 'enemies', where: [{ hpAtMost: 4 }] } }] }),
  },
  24: {
    spark: lvl([{ k: 'lastGaspMultiplier', times: 2 }], [], { target: { kind: 'none' }, do: [{ op: 'triggerLastGasps', times: 1 }] }),
    flame: lvl([{ k: 'lastGaspMultiplier', times: 3 }], [], { target: { kind: 'none' }, do: [{ op: 'triggerLastGasps', times: 2 }] }),
  },
  25: {
    spark: lvl([{ k: 'hitsApply', status: 'poison', n: 1 }], [], { target: { kind: 'lane' }, do: [poison(3, 'targetLaneFrontmost')] }),
    flame: lvl([{ k: 'hitsApply', status: 'poison', n: 3 }], [], { target: { kind: 'lane' }, do: [poison(5, 'targetLaneFrontmost')] }),
    fire: lvl([{ k: 'hitsApply', status: 'poison', n: 5 }, { k: 'poisonCantBeRemoved' }], []),
  },
  26: {
    spark: lvl([swift(1)], [], { target: { kind: 'enemy' }, do: [{ op: 'pull', to: 'target', rows: 1 }] }),
    flame: lvl([swift(2)], [k({ op: 'pull', to: 'across', rows: 1 })], { target: { kind: 'enemy' }, do: [{ op: 'pull', to: 'target', rows: 'front' }] }),
  },
  27: {
    spark: lvl([rooted, { k: 'aura', dirs: ['ahead'], effect: { hitsApply: { status: 'poison', n: 1 } } }], [], {
      target: { kind: 'enemy' },
      do: [{ op: 'removeSwift', to: 'target' }, { op: 'grant', passive: { k: 'cantMove' }, to: 'target' }],
    }),
    flame: lvl([rooted, { k: 'aura', dirs: ['ahead', 'beside'], effect: { hitsApply: { status: 'poison', n: 2 } } }], [], {
      target: { kind: 'enemy', count: 2 },
      do: [{ op: 'removeSwift', to: 'target' }, { op: 'grant', passive: { k: 'cantMove' }, to: 'target' }],
    }),
  },
  28: {
    spark: lvl([], [{ on: 'waveEnd', if: ['anyEnemyPoisoned'], do: [{ op: 'embers', n: 1 }] }], { target: { kind: 'none' }, do: [{ op: 'embers', n: 2 }] }),
    flame: lvl([], [{ on: 'waveEnd', if: ['anyEnemyPoisoned'], do: [{ op: 'embers', n: { ref: 'poisonedEnemies', mult: 0.5, min: 1 } }] }], {
      target: { kind: 'none' },
      do: [{ op: 'embers', n: 4 }],
    }),
  },
  29: {
    spark: lvl([{ k: 'onHitBy', status: 'poison', n: 1 }], [], { target: { kind: 'enemy' }, do: [poison(2, 'target'), { op: 'grant', passive: { k: 'cantMove' }, to: 'target' }] }),
    flame: lvl([taunt, { k: 'onHitBy', status: 'poison', n: 2 }], [], {
      target: { kind: 'enemy' },
      do: [poison(4, 'target'), { op: 'grant', passive: { k: 'cantMove' }, to: 'target' }, { op: 'grant', passive: { k: 'cantBeMoved' }, to: 'target' }],
    }),
  },
  30: {
    spark: lvl([{ k: 'aura', dirs: ['beside'], effect: { hitsApply: { status: 'poison', n: 1 } } }], [], { target: { kind: 'enemy' }, do: [{ op: 'pull', to: 'target', rows: 'front' }, poison(3, 'target')] }),
    flame: lvl([{ k: 'aura', dirs: ['around'], effect: { hitsApply: { status: 'poison', n: 2 } } }], [], { target: { kind: 'enemy' }, do: [{ op: 'pull', to: 'target', rows: 'front' }, poison(5, 'target')] }),
  },
  31: {
    spark: lvl([], [ws({ op: 'pull', to: 'ownLaneEnemyBackmost', rows: 1 })], { target: { kind: 'lane' }, do: [{ op: 'pull', to: 'targetLaneEnemies', rows: 'front' }] }),
    flame: lvl([], [ws({ op: 'pull', to: 'ownLaneEnemyBackmost', rows: 1 }, { op: 'pull', to: 'besideLanesEnemyBackmost', rows: 1 })], {
      target: { kind: 'lane', lanes: 2 },
      do: [{ op: 'pull', to: 'targetLaneEnemies', rows: 'front' }],
    }),
  },
  32: {
    spark: lvl([{ k: 'statusBonus', status: 'poison', n: 1 }], [], { target: { kind: 'row' }, do: [poison(2, 'targetRowEnemies')] }),
    flame: lvl([{ k: 'statusBonus', status: 'poison', n: 2 }], [], { target: { kind: 'row' }, do: [poison(3, 'targetRowEnemies')] }),
  },
  33: {
    spark: lvl([{ k: 'stunPoisonedOnHit' }], [], { target: { kind: 'enemy' }, do: [{ op: 'stun', to: 'target' }, poison(2, 'target')] }),
    flame: lvl([{ k: 'stunPoisonedOnHit', addPoison: 2 }], [], { target: { kind: 'enemy', count: 2 }, do: [{ op: 'stun', to: 'target' }, poison(3, 'target')] }),
  },
  34: {
    spark: lvl([rooted, { k: 'persist' }], [], { target: { kind: 'none' }, do: [{ op: 'push', to: 'enemyFront', rows: 1, blockedDamage: 4, blockedStun: true }] }),
    flame: lvl([rooted, { k: 'persist' }], [ws(shield(4, 'self'))], { target: { kind: 'none' }, do: [{ op: 'push', to: 'enemyFront', rows: 1, blockedDamage: 6, blockedStun: true }] }),
  },
  35: {
    spark: lvl([{ k: 'poisonNoDecay' }], [], { target: { kind: 'none' }, do: [{ op: 'multiplyStatus', status: 'poison', factor: 2, to: 'enemies' }] }),
    flame: lvl([{ k: 'poisonNoDecay', grows: 1 }], [], { target: { kind: 'none' }, do: [{ op: 'multiplyStatus', status: 'poison', factor: 3, to: 'enemies' }] }),
  },
  36: {
    spark: lvl([{ k: 'pullBeforeAttack' }], [], { target: { kind: 'enemy', where: ['poisoned', { row: 0 }, { hpAtMost: 6 }] }, do: [{ op: 'destroy', to: 'target' }] }),
    flame: lvl([{ k: 'pullBeforeAttack', beside: true }], [], { target: { kind: 'enemy', where: ['poisoned', { hpAtMost: 10 }] }, do: [{ op: 'destroy', to: 'target' }] }),
  },
  37: {
    spark: lvl([taunt, rooted], [], { target: { kind: 'unit' }, do: [shield(5, 'target')] }),
    flame: lvl([taunt, rooted], [ws(shield(3, 'self'))], { target: { kind: 'unit', count: 2 }, do: [shield(6, 'target')] }),
  },
  38: {
    spark: lvl([{ k: 'shieldEachWaveInFront', n: 1 }], [], { target: { kind: 'none' }, do: [shield(2, 'allyFront')] }),
    flame: lvl([taunt, { k: 'shieldEachWaveInFront', n: 3 }], [], { target: { kind: 'none' }, do: [shield(4, 'allyFront')] }),
    fire: lvl([{ k: 'taunt', all: true }, { k: 'shieldsNeverExpire' }], []),
  },
  39: {
    spark: lvl([rooted], [gasp({ op: 'summon', token: 'rubble', hp: 3, where: 'selfCell' })], { target: { kind: 'emptyCell' }, do: [{ op: 'summon', token: 'rubble', hp: 3, where: 'targetCell' }] }),
    flame: lvl([rooted], [gasp({ op: 'summon', token: 'rubble', hp: 6, where: 'selfCell' }, { op: 'summon', token: 'rubble', hp: 6, where: 'besideEmpty' })], {
      target: { kind: 'emptyCell', count: 2 },
      do: [{ op: 'summon', token: 'rubble', hp: 6, where: 'targetCells' }],
    }),
  },
  40: {
    spark: lvl([{ k: 'aura', dirs: ['behind'], effect: { shieldEachWave: 1 } }], [], { target: { kind: 'enemy', where: [{ row: 0 }] }, do: [{ op: 'stun', to: 'target' }] }),
    flame: lvl([{ k: 'aura', dirs: ['behind', 'beside'], effect: { shieldEachWave: 2 } }], [], { target: { kind: 'enemy', count: 2, where: [{ row: 0 }] }, do: [{ op: 'stun', to: 'target' }] }),
  },
  41: {
    spark: lvl([{ k: 'powerIfGuardianAhead', n: 1 }], [], { target: { kind: 'lane' }, do: [dmg(2, 'targetLaneBackmost')] }),
    flame: lvl([{ k: 'powerIfGuardianAhead', n: 2 }, { k: 'cantBeHitBy', shapes: ['lob'] }], [], { target: { kind: 'lane' }, do: [dmg(4, 'targetLaneBackmost')] }),
  },
  42: {
    spark: lvl([{ k: 'taunt', wide: true }], [], { target: { kind: 'none' }, do: [{ op: 'noFaceDamage', waves: 1 }] }),
    flame: lvl([{ k: 'taunt', wide: true }, { k: 'damageReduce', n: 1 }], [], { target: { kind: 'none' }, do: [{ op: 'noFaceDamage', waves: 2 }] }),
  },
  43: {
    spark: lvl([rooted], [ws(shield(2, 'around'))], { target: { kind: 'lane' }, do: [{ op: 'stun', to: 'targetLaneEnemies' }] }),
    flame: lvl([rooted], [ws(shield(4, 'around')), { on: 'waveStart', if: [{ wave: 1 }], do: [{ op: 'stun', to: 'across' }] }], {
      target: { kind: 'lane', lanes: 2 },
      do: [{ op: 'stun', to: 'targetLaneEnemies' }],
    }),
  },
  44: {
    spark: lvl([{ k: 'damageReduce', n: 1 }], [], { target: { kind: 'unit' }, do: [{ op: 'grant', passive: { k: 'damageReduce', n: 1 }, to: 'target' }] }),
    flame: lvl([{ k: 'damageReduce', n: 2 }], [], { target: { kind: 'unit', count: 2 }, do: [{ op: 'grant', passive: { k: 'damageReduce', n: 2 }, to: 'target' }] }),
  },
  45: {
    spark: lvl([{ k: 'cantBeHitBy', shapes: ['lob'] }], [], { target: { kind: 'none' }, do: [{ op: 'shieldsPersist', waves: 1 }] }),
    flame: lvl([{ k: 'cantBeHitBy', shapes: ['lob'] }, { k: 'cantBeHitBy', shapes: ['shoot'], farOnly: true }], [], { target: { kind: 'none' }, do: [{ op: 'shieldsPersist', waves: 2 }] }),
  },
  46: {
    spark: lvl([taunt, { k: 'shieldsNeverExpire' }], [], { target: { kind: 'none' }, do: [shield(6, 'allies')] }),
    flame: lvl([taunt, { k: 'shieldsNeverExpire', startShield: 2 }], [], { target: { kind: 'none' }, do: [shield(10, 'allies')] }),
  },
  47: {
    spark: lvl([rooted], [], { target: { kind: 'ally' }, do: [{ op: 'grant', passive: rooted, to: 'target' }, { op: 'buff', atk: 3, hp: 6, to: 'target', duration: 'battle' }] }),
    flame: lvl([rooted], [ws({ op: 'status', status: 'shield', n: { ref: 'selfPower' }, to: 'self' })], {
      target: { kind: 'ally' },
      do: [{ op: 'grant', passive: rooted, to: 'target' }, { op: 'buff', atk: 5, hp: 10, to: 'target', duration: 'battle' }],
    }),
  },
  48: {
    spark: lvl([rooted, { k: 'enemySpellCost', n: 1 }, { k: 'faceDamageReduce', n: 2 }], [], { target: { kind: 'none' }, do: [{ op: 'enemyNoSpells', waves: 1 }] }),
    flame: lvl([rooted, { k: 'enemySpellCost', n: 2 }, { k: 'faceDamageReduce', n: 3 }], [], { target: { kind: 'none' }, do: [{ op: 'enemyNoSpells', waves: 2 }] }),
  },
  49: {
    spark: lvl([taunt, { k: 'powerToBehind', traits: ['Marksman', 'Artillery'], n: 1 }], [], {
      target: { kind: 'none' },
      do: [shield(3, 'allyFront'), { op: 'buff', atk: 2, to: 'allyBack', duration: 'wave' }],
    }),
    flame: lvl([taunt, { k: 'powerToBehind', traits: ['Marksman', 'Artillery'], n: 2, hitsApplyBurn: 1 }], [], {
      target: { kind: 'none' },
      do: [shield(5, 'allyFront'), { op: 'buff', atk: 3, to: 'allyBack', duration: 'wave' }],
    }),
  },
  50: {
    spark: lvl([], [gasp(burn(3, 'across'))], {
      target: { kind: 'ally' },
      do: [burn({ ref: 'targetPower' }, 'targetLaneEnemies'), { op: 'destroy', to: 'target' }],
    }),
    flame: lvl([], [gasp(burn(5, 'across'), burn(5, 'acrossBeside'))], {
      target: { kind: 'ally' },
      do: [burn({ ref: 'targetPower', mult: 2 }, 'targetLaneEnemies'), { op: 'destroy', to: 'target' }],
    }),
  },
  51: {
    spark: lvl([], [we(poison(1, { sel: 'enemies', where: ['burning'] }), burn(1, { sel: 'enemies', where: ['poisoned'] }))], {
      target: { kind: 'none' },
      do: [burn({ ref: 'unitPoison' }, { sel: 'enemies', where: ['poisoned'] })],
    }),
    flame: lvl([], [we(poison(2, { sel: 'enemies', where: ['burning'] }), burn(2, { sel: 'enemies', where: ['poisoned'] }))], {
      target: { kind: 'none' },
      do: [burn({ ref: 'unitPoison', mult: 2 }, { sel: 'enemies', where: ['poisoned'] })],
    }),
  },
  52: {
    spark: lvl([taunt, { k: 'returnsAtWaveStart' }], [], { target: { kind: 'none' }, do: [{ op: 'summon', token: 'boneWall', hp: 3, where: 'allyFrontEmpty', count: 'fill' }] }),
    flame: lvl([taunt, { k: 'returnsAtWaveStart', shield: 4 }], [], { target: { kind: 'none' }, do: [{ op: 'summon', token: 'boneWall', hp: 5, where: 'allyFrontMidEmpty', count: 'fill' }] }),
  },
  53: {
    spark: lvl([{ k: 'poisonedDeathWisp' }], [], { target: { kind: 'enemy', where: ['poisoned', { hpAtMostPoisonTimes: 2 }] }, do: [{ op: 'destroy', to: 'target' }] }),
    flame: lvl([{ k: 'poisonedDeathWisp', atk: 2, hp: 2, shoot: true }], [], { target: { kind: 'enemy', where: ['poisoned', { hpAtMostPoisonTimes: 3 }] }, do: [{ op: 'destroy', to: 'target' }] }),
  },
  54: {
    spark: lvl([taunt, { k: 'onHitBy', status: 'poison', n: 2 }], [], { target: { kind: 'enemy' }, do: [{ op: 'pull', to: 'target', rows: 'front', intoTauntLane: true }] }),
    flame: lvl([taunt, { k: 'onHitBy', status: 'poison', n: 3, cantMoveNextWave: true }], [], {
      target: { kind: 'enemy', count: 2 },
      do: [{ op: 'pull', to: 'target', rows: 'front', intoTauntLane: true }],
    }),
  },
  55: {
    spark: lvl([], [gasp({ op: 'embers', n: 2 })], { target: { kind: 'none' }, do: [{ op: 'embers', n: 2 }] }),
    flame: lvl([], [gasp({ op: 'embers', n: 4 })], { target: { kind: 'none' }, do: [{ op: 'embers', n: 4 }] }),
  },
  56: {
    spark: lvl([swift(1)], [], { target: { kind: 'unit' }, do: [{ op: 'heal', n: 4, to: 'target' }] }),
    flame: lvl([swift(2)], [k({ op: 'heal', n: 3, to: 'mostDamagedAlly' })], { target: { kind: 'unit' }, do: [{ op: 'heal', n: 8, to: 'target' }] }),
  },
  57: {
    spark: lvl([], [k({ op: 'spellDiscount', n: 1, scope: 'next' })], { target: { kind: 'ally' }, do: [{ op: 'returnToDeck', to: 'target' }, { op: 'embers', n: 1 }] }),
    flame: lvl([], [k({ op: 'spellDiscount', n: 1, scope: 'wave' })], { target: { kind: 'ally', count: 2 }, do: [{ op: 'returnToDeck', to: 'target' }, { op: 'embers', n: 2 }] }),
  },
  58: {
    spark: lvl([rooted], [], { target: { kind: 'emptyCell' }, do: [{ op: 'summon', token: 'rubble', hp: 4, where: 'targetCell' }] }),
    flame: lvl([rooted, taunt], [], { target: { kind: 'emptyCell', count: 2 }, do: [{ op: 'summon', token: 'rubble', hp: 6, where: 'targetCells' }] }),
  },
  59: {
    spark: lvl([], [k({ op: 'copyTrait', from: 'beside', count: 1 })], { target: { kind: 'none' }, do: [{ op: 'recastLast', times: 1 }] }),
    flame: lvl([], [k({ op: 'copyTrait', from: 'beside', count: 'each' })], { target: { kind: 'none' }, do: [{ op: 'recastLast', times: 2 }] }),
  },
  60: {
    spark: lvl([{ k: 'passFirstEmbers', n: 2 }], [], { target: { kind: 'deckCard' }, do: [{ op: 'sellCard', priceMult: 1 }] }),
    flame: lvl([{ k: 'passFirstEmbers', n: 3 }], [], { target: { kind: 'deckCard' }, do: [{ op: 'sellCard', priceMult: 1.5 }] }),
  },
};

/** Enemy-only units (content/cards.json → enemyUnits), one level each. */
export const ENEMY_EFFECTS: Record<string, UnitEffects> = {
  e_sentry: lvl([rooted, { k: 'hitsApply', status: 'poison', n: 1 }], []),
  e_hook: lvl([], [ws({ op: 'pull', to: 'across', rows: 1 })]),
  e_salthound: lvl([swift(1)], []),
  e_chorister: lvl([{ k: 'aura', dirs: ['beside'], effect: { power: 1 } }], []),
  e_shambler: lvl([], [gasp({ op: 'summon', token: 'wisp', where: 'selfCell' })]),
  e_thief: lvl([swift(2)], [k({ op: 'embers', n: -1, side: 'enemy' })]),
  e_waxen: lvl([taunt], [gasp(burn(2, 'acrossAround'))]),
  e_ghoulbell: lvl([taunt], []),
  e_crab: lvl([{ k: 'shieldAtWaveStart', n: 2 }], []),
};

export interface TokenDef {
  id: string;
  name: string;
  atk: number;
  hp: number;
  shape: 'strike' | 'shoot' | 'none';
  effects: UnitEffects;
}

/** Tokens (SPEC §7). Rubble and Bone Wall hp is set by the summoning op. */
export const TOKENS: Record<string, TokenDef> = {
  wisp: { id: 't_wisp', name: 'Wisp', atk: 1, hp: 1, shape: 'strike', effects: {} },
  bat: { id: 't_bat', name: 'Bat', atk: 1, hp: 1, shape: 'strike', effects: {} },
  rubble: { id: 't_rubble', name: 'Rubble', atk: 0, hp: 3, shape: 'none', effects: { passives: [rooted] } },
  boneWall: { id: 't_boneWall', name: 'Bone Wall', atk: 0, hp: 3, shape: 'none', effects: { passives: [rooted] } },
  chorister: { id: 't_chorister', name: 'Chorister', atk: 1, hp: 1, shape: 'strike', effects: { passives: [{ k: 'aura', dirs: ['beside'], effect: { power: 1 } }] } },
};
