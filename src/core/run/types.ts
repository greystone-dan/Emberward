import type { Rarity, Trait } from '../../content/types';
import type { RngState } from '../rng';
import type { Action, BattleState, Level } from '../types';
import type { BattleConfig } from '../battle/battle';

/**
 * The run: everything between battles. Pure data; `applyRunAction` is the only mutator (it calls
 * `applyAction` for battle actions). Randomness comes from the named streams in `rng`.
 */

export interface RunCard {
  uid: number;
  cardId: number;
  level: Level;
  sigil?: Trait;
  temper?: number;
}

export type NodeType = 'fight' | 'elite' | 'market' | 'hearth' | 'shrine' | 'scout' | 'boss';

export interface MapNode {
  id: number;
  x: number;
  y: number;
  type: NodeType;
  /** Nodes reachable from this one (next row). */
  next: number[];
  /** Which fight, elite or shrine this node holds (index into content). */
  encounter: number;
}

export interface DriftCard {
  cardId: number;
  rarity: Rarity;
  /** A marked copy of a card the player owns. */
  echo: boolean;
}

export interface DriftState {
  /** The current line, front first. */
  line: DriftCard[];
  /** Cards that will join the back as the line advances. */
  incoming: DriftCard[];
  /** Takes left in this Drift. */
  takes: number;
  /** True while a Drift is open for taking. */
  open: boolean;
  /** Paid reaches cost double this Drift (Lantern-Seller's lantern). */
  doubled: boolean;
  /** The Ferryman's free reach has been used this Drift. */
  freeReachUsed: boolean;
  /** Drifts without a rare, for pity. */
  pity: number;
}

export interface MarketState {
  cards: (DriftCard | null)[];
  cardPrices: number[];
  relic: string | null;
  relicPrice: number;
  sigil: boolean;
  rerolls: number;
  /** A card slot held from the last visit. */
  held: DriftCard | null;
}

export interface RekindleOffer {
  cardId: number;
  level: Level;
  copies: number;
}

export type RunPhase =
  | 'wardenSelect'
  | 'drift'
  | 'map'
  | 'muster'
  | 'battle'
  | 'reward'
  | 'market'
  | 'hearth'
  | 'shrine'
  | 'scout'
  | 'over';

export interface BattleResult {
  kind: 'fight' | 'elite' | 'boss';
  won: boolean;
  outcome: 'kill' | 'waveLimit' | 'draw';
  hpLost: number;
  pay: number;
  interest: number;
  relic?: string;
  sigil?: boolean;
  survivors: { key: string; level: Level; lane: number; row: number; cardUid?: number; name: string }[];
  persisted?: { key: string; level: Level; lane: number; row: number };
}

export interface RunState {
  seed: string;
  rng: Record<'map' | 'drift' | 'market' | 'shrine' | 'omens' | 'bot', RngState>;
  phase: RunPhase;
  warden: number;
  wardenName: string;
  hp: number;
  maxHp: number;
  embers: number;
  deck: RunCard[];
  nextUid: number;
  relics: string[];
  sigils: number;
  omens: Trait[];
  map: MapNode[];
  /** Current node id, or -1 before the first node. */
  at: number;
  visited: number[];
  /** Fight nodes whose enemy is revealed (Scout). */
  scouted: number[];
  drift: DriftState;
  market: MarketState | null;
  /** Cards chosen at the Muster for the next battle. */
  muster: number[];
  battleConfig: BattleConfig | null;
  battle: BattleState | null;
  result: BattleResult | null;
  rekindle: RekindleOffer[];
  rekindlePostponed: boolean;
  /** Units that Persist into the next battle (Anchorstone). */
  persist: { key: string; level: Level; lane: number; row: number }[];
  /** Shrine flags. */
  nextEnemyStunned: boolean;
  nextFightSkipped: boolean;
  shrine: { event: number; chosen: number | null; needsPick?: 'echo' | 'remove' | 'duplicate' | 'rekindle' } | null;
  /** Hearth: one action per visit. */
  hearthUsed: boolean;
  won: boolean | null;
  battlesWon: number;
  turnsTaken: number;
  log: string[];
  errors: string[];
}

export type RunAction =
  | { type: 'chooseWarden'; warden: number }
  | { type: 'driftTake'; slot: number }
  | { type: 'driftSkip' }
  | { type: 'driftDone' }
  | { type: 'mapChoose'; node: number }
  | { type: 'musterSet'; uids: number[] }
  | { type: 'musterConfirm' }
  | { type: 'battle'; action: Action }
  | { type: 'persistChoose'; index: number }
  | { type: 'continue' }
  | { type: 'marketBuy'; slot: number }
  | { type: 'marketBuyRelic' }
  | { type: 'marketBuySigil' }
  | { type: 'marketReroll' }
  | { type: 'marketHold'; slot: number }
  | { type: 'sell'; uid: number }
  | { type: 'inscribe'; uid: number; trait: Trait }
  | { type: 'hearthHeal' }
  | { type: 'hearthSnuff'; uid: number }
  | { type: 'hearthTemper'; uid: number }
  | { type: 'shrineChoose'; option: number }
  | { type: 'shrinePick'; uid: number }
  | { type: 'rekindle'; cardId: number; level: Level }
  | { type: 'postponeRekindle' }
  | { type: 'leave' };

export type RunEvent =
  | { type: 'warden'; name: string }
  | { type: 'draft'; cardId: number; price: number; echo: boolean }
  | { type: 'skipDrift'; embers: number }
  | { type: 'node'; node: MapNode }
  | { type: 'battleStart'; kind: 'fight' | 'elite' | 'boss'; name: string }
  | { type: 'battleEnd'; result: BattleResult }
  | { type: 'embers'; delta: number; reason: string }
  | { type: 'hp'; delta: number; reason: string }
  | { type: 'relic'; name: string }
  | { type: 'sigil'; cardId: number; trait: Trait }
  | { type: 'rekindle'; cardId: number; level: Level }
  | { type: 'remove'; cardId: number }
  | { type: 'temper'; cardId: number }
  | { type: 'buy'; cardId: number; price: number }
  | { type: 'sell'; cardId: number; price: number }
  | { type: 'shrine'; event: string; option: string }
  | { type: 'scout'; names: string[] }
  | { type: 'runOver'; won: boolean }
  | { type: 'error'; message: string };

export interface RunResult {
  state: RunState;
  events: RunEvent[];
}
