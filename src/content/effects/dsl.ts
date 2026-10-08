import type { Shape, Trait } from '../types';

/**
 * The effect DSL. Cards, tokens, enemy units and relics are written in it; src/core interprets it.
 * trigger → condition → selector → op. Keep every piece generic: a new card should be new data only.
 */

/** A number, or one read from the context at resolve time. */
export type Num =
  | number
  | {
      ref: 'targetPower' | 'targetPoison' | 'targetBurn' | 'selfPower' | 'unitPoison' | 'unitBurn' | 'deathsThisWave' | 'poisonedEnemies';
      mult?: number;
      min?: number;
      max?: number;
    };

export type Cond =
  | 'burning'
  | 'poisoned'
  | 'notBurning'
  | 'stunned'
  | 'isToken'
  | 'notAround'
  | 'allyDiedThisWave'
  | 'anyEnemyPoisoned'
  | { wave: number }
  | { hpAtMost: number }
  | { hpAtMostPoisonTimes: number }
  | { trait: Trait }
  | { shape: Shape }
  | { row: 0 | 1 | 2 };

/** Which units an op applies to. 'target*' refer to the chosen spell targets. */
export type UnitSel =
  | 'self'
  | 'ahead'
  | 'behind'
  | 'beside'
  | 'around'
  | 'across'
  | 'acrossBeside'
  | 'acrossAround'
  | 'allies'
  | 'otherAllies'
  | 'enemies'
  | 'allUnits'
  | 'allyFront'
  | 'allyMid'
  | 'allyBack'
  | 'enemyFront'
  | 'enemyMid'
  | 'enemyBack'
  | 'enemyFrontMid'
  | 'target'
  | 'targetLaneEnemies'
  | 'targetLaneAllies'
  | 'targetLaneFrontmost'
  | 'targetLaneBackmost'
  | 'targetRowEnemies'
  | 'targetBeside'
  | 'targetAround'
  | 'lastHitTarget'
  | 'ownLaneEnemyBackmost'
  | 'besideLanesEnemyBackmost'
  | 'mostDamagedAlly'
  | 'killer'
  | 'victim'
  | { sel: UnitSel; where: Cond[] }
  | { sel: UnitSel; n: number };

export type CellSel =
  | 'selfCell'
  | 'besideEmpty'
  | 'bothSidesEmpty'
  | 'allyEmpty'
  | 'allyFrontEmpty'
  | 'allyMidEmpty'
  | 'allyBackEmpty'
  | 'allyFrontMidEmpty'
  | 'allyBackMidEmpty'
  | 'targetCell'
  | 'targetCells'
  | 'victimCell'
  | 'victimBesideEmpty'
  | 'enemyEmptyOfVictimSide'
  | 'victimLaneOwnEmpty';

export type TokenId = 'wisp' | 'bat' | 'rubble' | 'boneWall' | 'chorister';

export type Status = 'burn' | 'poison' | 'shield';

export type Op =
  | { op: 'damage'; n: Num; to: UnitSel; ignoreShield?: boolean }
  | { op: 'status'; status: Status; n: Num; to: UnitSel; persist?: boolean }
  | { op: 'heal'; n: Num; to: UnitSel }
  | { op: 'stun'; to: UnitSel }
  | { op: 'pull'; to: UnitSel; rows: 1 | 'front'; intoTauntLane?: boolean }
  | { op: 'push'; to: UnitSel; rows: 1; blockedDamage: number; blockedStun: boolean }
  | { op: 'summon'; token: TokenId; hp?: number; atk?: number; shape?: Shape; where: CellSel; count?: number | 'fill' }
  | { op: 'embers'; n: Num; side?: 'self' | 'enemy' }
  | { op: 'healWarden'; n: number }
  | { op: 'destroy'; to: UnitSel }
  | { op: 'buff'; atk?: number; hp?: number; to: UnitSel; duration: 'battle' | 'wave' }
  | { op: 'grant'; passive: Passive; to: UnitSel; duration?: 'battle' | 'wave' | 'nextWave' }
  | { op: 'move'; to: UnitSel; cells: number; ignoreRooted?: boolean }
  | { op: 'swap'; count?: 1 | 2 }
  | { op: 'returnToDeck'; to: UnitSel }
  | { op: 'exhume'; count: number }
  | { op: 'revive'; count: number; fullHealth: boolean }
  | { op: 'spellDiscount'; n: number; scope: 'next' | 'wave' }
  | { op: 'tickBurn'; to: UnitSel; spread: boolean }
  | { op: 'multiplyStatus'; status: 'burn' | 'poison'; factor: number; to: UnitSel }
  | { op: 'attackAgain'; to: UnitSel; selfDamage: number }
  | { op: 'laneHalfDamage'; lanes: 1 | 2 }
  | { op: 'noFaceDamage'; waves: 1 | 2 }
  | { op: 'enemyNoSpells'; waves: 1 | 2 }
  | { op: 'shieldsPersist'; waves: 1 | 2 }
  | { op: 'burnSpreadsFull'; waves: 1 }
  | { op: 'triggerLastGasps'; times: 1 | 2 }
  | { op: 'recastLast'; times: 1 | 2 }
  | { op: 'sellCard'; priceMult: number }
  | { op: 'removeSwift'; to: UnitSel }
  | { op: 'stripShield'; to: UnitSel }
  | { op: 'embersPerKill'; n: number; max?: number }
  | { op: 'unspendCard' }
  | { op: 'copyTrait'; from: 'beside'; count: 1 | 'each' }
  | { op: 'chance'; p: number; do: Op[] };

export type AuraDir = 'ahead' | 'behind' | 'beside' | 'around';

export interface AuraEffect {
  power?: number;
  hitsApply?: { status: 'burn' | 'poison'; n: number };
  rangedReduce?: number;
  shieldEachWave?: number;
  /** Only units with one of these traits benefit. */
  onlyTraits?: Trait[];
}

/** Static rules a unit has while it stands. Derived from its card, never mutated. */
export type Passive =
  | { k: 'taunt'; wide?: boolean; all?: boolean }
  | { k: 'rooted' }
  | { k: 'swift'; n: number }
  | { k: 'persist' }
  | { k: 'immune'; status: 'burn' | 'poison' }
  | { k: 'ignoreShield'; strip?: boolean }
  | { k: 'cantBeHitBy'; shapes: Shape[]; farOnly?: boolean }
  | { k: 'damageReduce'; n: number }
  | { k: 'hitsApply'; status: 'burn' | 'poison'; n: number; spreadFull?: boolean; alsoBeside?: boolean }
  | { k: 'onHitBy'; status: 'burn' | 'poison'; n: number; cantMoveNextWave?: boolean }
  | { k: 'stunPoisonedOnHit'; addPoison?: number }
  | { k: 'powerPerAllyDeath'; n: number }
  | { k: 'powerIfGuardianAhead'; n: number }
  | { k: 'powerToBehind'; traits: Trait[]; n: number; hitsApplyBurn?: number }
  | { k: 'returnsOnDeath'; times: number; fullHealth: boolean }
  | { k: 'returnsAtWaveStart'; shield?: number }
  | { k: 'lastGaspMultiplier'; times: number }
  | { k: 'statusBonus'; status: 'burn' | 'poison'; n: number }
  | { k: 'poisonNoDecay'; grows?: number }
  | { k: 'wispBuff'; atk: number; hp: number; shoot?: boolean }
  | { k: 'pullBeforeAttack'; beside?: boolean }
  | { k: 'enemySpellCost'; n: number }
  | { k: 'faceDamageReduce'; n: number }
  | { k: 'shieldsNeverExpire'; startShield?: number }
  | { k: 'passFirstEmbers'; n: number }
  | { k: 'killLeavesWisp'; atk?: number; hp?: number; inLane?: boolean }
  | { k: 'poisonedDeathWisp'; atk?: number; hp?: number; shoot?: boolean }
  | { k: 'aura'; dirs: AuraDir[]; effect: AuraEffect }
  | { k: 'cantMove' }
  | { k: 'cantBeMoved' }
  | { k: 'strikesFirst' }
  | { k: 'attacksEveryBeat' }
  | { k: 'shieldEachWaveInFront'; n: number }
  | { k: 'shieldAtWaveStart'; n: number | 'power' }
  | { k: 'everyHitAppliesBurn'; n: number }
  | { k: 'burnCantBeRemoved' }
  | { k: 'poisonCantBeRemoved' }
  | { k: 'alliesCantDie'; trait: Trait }
  | { k: 'wispsFillOnDeath' }
  | { k: 'kindleTwice' };

export type TriggerOn =
  | 'kindle'
  | 'lastGasp'
  | 'waveStart'
  | 'waveEnd'
  | 'allyDeath'
  | 'enemyDeath'
  | 'kill'
  | 'passFirst';

export interface Trigger {
  on: TriggerOn;
  /** Conditions on the victim for allyDeath/enemyDeath/kill, or the unit itself otherwise. */
  if?: Cond[];
  /** For allyDeath: only if the death happened this wave, etc. */
  once?: 'wave' | 'battle';
  do: Op[];
}

export type TargetKind = 'enemy' | 'ally' | 'unit' | 'lane' | 'row' | 'emptyCell' | 'spentCard' | 'deckCard' | 'fallen' | 'none';

export interface TargetSpec {
  kind: TargetKind;
  count?: 1 | 2;
  where?: Cond[];
  /** For lane targets: the number of adjacent lanes, 1 or 2. */
  lanes?: 1 | 2;
}

export interface SpellDef {
  target: TargetSpec;
  do: Op[];
}

/** One level (Spark or Flame) of a unit's rules. Fire adds a line on top of Flame. */
export interface LevelEffects {
  passives?: Passive[];
  triggers?: Trigger[];
  spell?: SpellDef;
}

export interface CardEffects {
  spark: LevelEffects;
  flame: LevelEffects;
  /** Hand-written Fire extras (SPEC §10): passives and triggers added on top of Flame. */
  fire?: LevelEffects;
}

/** Enemy-only units and tokens have a single level. */
export type UnitEffects = LevelEffects;
