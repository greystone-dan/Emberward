import type { Passive } from '../content/effects/dsl';
import type { Shape, Trait } from '../content/types';
import type { RngState } from './rng';

export type Side = 0 | 1;
export const PLAYER: Side = 0;
export const ENEMY: Side = 1;
export type Lane = 0 | 1 | 2 | 3;
export type Row = 0 | 1 | 2;
export type Level = 1 | 2 | 3;

export interface Cell {
  lane: Lane;
  row: Row;
}

/** A card in a battle: a definition key ('c12' for card 12, 'e_sentry' for an enemy unit) and its level. */
export interface BattleCard {
  uid: number;
  key: string;
  level: Level;
  spent: boolean;
  /** A Sigil's extra trait, inscribed for the run. */
  sigil?: Trait;
  /** Permanent Hearth upgrades (Temper). */
  temper?: number;
}

export interface Grant {
  passive: Passive;
  /** Wave number it expires after; undefined = this battle. */
  untilWave?: number;
}

export interface Unit {
  id: number;
  side: Side;
  lane: Lane;
  row: Row;
  /** Definition key: 'c12', 'e_sentry' or 't_wisp'. */
  key: string;
  cardUid?: number;
  name: string;
  level: Level;
  baseAtk: number;
  baseHp: number;
  shape: Shape;
  traits: Trait[];
  token: boolean;
  damage: number;
  shield: number;
  shieldPersist: number;
  burn: number;
  poison: number;
  stunned: boolean;
  stepsUsed: number;
  arrivedWave: number;
  attacksLeft: number;
  buffAtk: number;
  buffHp: number;
  waveBuffAtk: number;
  grants: Grant[];
  returnsLeft: number;
  returnsFull: boolean;
  lastHitTarget?: number;
  cantMoveUntilWave?: number;
  extraTraits: Trait[];
}

export interface FallenRecord {
  key: string;
  level: Level;
  name: string;
  cardUid?: number;
  lane: Lane;
  row: Row;
  side: Side;
  wave: number;
  token: boolean;
}

export interface SideState {
  hp: number;
  maxHp: number;
  embers: number;
  cards: BattleCard[];
  relics: string[];
  wardenName: string;
  /** Spell discounts granted by effects. */
  discountNext: number;
  discountWave: number;
  firstSpellCastThisWave: boolean;
  abyssalFreeUsed: boolean;
  firstBurnThisWave: boolean;
  paidStepsThisWave: number;
  noFaceDamageUntilWave: number;
  noSpellsUntilWave: number;
  shieldsPersistUntilWave: number;
  burnSpreadsFullUntilWave: number;
  /** Lanes under Smokescreen this wave, enemy attacks into them halve. */
  halfDamageLanes: Lane[];
  deathsThisBattle: number;
  deathsThisWave: number;
  bonebound2Used: boolean;
  faceDamageDealt: number;
  /** Tinder Pouch embers that vanish at the end. */
  pouchEmbers: number;
  lastSpell?: { key: string; level: Level; targets: Target[] };
}

export type Target =
  | { unit: number }
  | { lane: Lane }
  | { row: Row }
  | { cell: Cell }
  | { card: number }
  | { fallen: number };

export type Action =
  | { type: 'summon'; card: number; lane: Lane; row: Row }
  | { type: 'cast'; card: number; targets: Target[] }
  | { type: 'move'; unit: number; lane: Lane; row: Row }
  | { type: 'pass' };

export interface EliteRule {
  kind: 'choirAbbot' | 'tideCaller' | 'brazierKnight';
}

export interface BossState {
  /** Lanes dark this wave (player units can't attack from them). */
  darkLanes: Lane[];
  /** Lanes announced for the next wave. */
  nextDarkLanes: Lane[];
  ownLaneDark: boolean;
}

export interface BattleState {
  seed: string;
  rng: RngState;
  wave: number;
  phase: 'action' | 'over';
  initiative: Side;
  turn: Side;
  actionsLeft: [number, number];
  passed: [boolean, boolean];
  firstPass: Side | null;
  sides: [SideState, SideState];
  units: Unit[];
  nextId: number;
  fallen: FallenRecord[];
  winner: Side | null;
  /** How the battle ended. */
  outcome?: 'kill' | 'waveLimit' | 'draw';
  kind: 'fight' | 'elite' | 'boss';
  elite?: EliteRule;
  boss?: BossState;
  errors: string[];
  triggerDepth: number;
}

export type BattleEvent =
  | { type: 'summon'; unit: number; side: Side; cell: Cell; name: string }
  | { type: 'cast'; side: Side; key: string; name: string; targets: Target[] }
  | { type: 'move'; unit: number; from: Cell; to: Cell; paid: boolean }
  | { type: 'pass'; side: Side; first: boolean }
  | { type: 'waveStart'; wave: number; initiative: Side }
  | { type: 'beat'; row: Row }
  | { type: 'attack'; attacker: number; target: number | 'face'; targetSide: Side; damage: number; shape: Shape }
  | { type: 'damage'; unit: number; amount: number; absorbed: number; source: string }
  | { type: 'faceDamage'; side: Side; amount: number; source: string }
  | { type: 'status'; unit: number; status: 'burn' | 'poison' | 'shield' | 'stun'; n: number }
  | { type: 'heal'; unit: number; amount: number }
  | { type: 'death'; unit: number; side: Side; name: string; cell: Cell }
  | { type: 'embers'; side: Side; delta: number; reason: string }
  | { type: 'trigger'; unit: number; on: string; name: string }
  | { type: 'waveEnd'; wave: number }
  | { type: 'battleOver'; winner: Side | null; outcome: 'kill' | 'waveLimit' | 'draw' }
  | { type: 'error'; message: string }
  | { type: 'note'; text: string };

export interface ApplyResult {
  state: BattleState;
  events: BattleEvent[];
}
