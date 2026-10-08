import { scriptedIntent, type Intent } from '../core/ai/scripted';
import { applyAction, legalActions, newBattle, type BattleConfig } from '../core/battle/battle';
import { recordReplay, runReplay, type Replay } from '../core/replays/replay';
import { scenarioFight } from '../core/scenarios';
import { LANE_NAMES, ROW_NAMES } from '../core/grid';
import type { Action, BattleEvent, BattleState, Cell, Target, Unit } from '../core/types';
import { defFor } from '../core/battle/defs';

/**
 * The UI store: the committed battle state, a queue of animation frames derived from engine events,
 * the player's selection, and the scripted enemy. Nothing here decides rules; it only calls applyAction.
 */

export interface Pop {
  key: number;
  kind: 'dmg' | 'heal' | 'face' | 'status' | 'embers';
  text: string;
  /** Where to float: a unit's cell on a side, or a side's face. */
  at: { side: 0 | 1; cell?: Cell };
}

interface Frame {
  view: BattleState;
  pops: Pop[];
  log: string[];
  ms: number;
}

export type Selection = { kind: 'card'; uid: number; side: 0 | 1 } | { kind: 'unit'; id: number } | null;
export type Mode = 'idle' | 'summon' | 'cast' | 'move';

export interface UiState {
  selection: Selection;
  mode: Mode;
  picked: Target[];
}

export type Listener = () => void;

const ANIM_MS = { action: 250, beat: 650, waveEnd: 500, waveStart: 350, think: 400 };

export class GameStore {
  state!: BattleState;
  view!: BattleState;
  config!: BattleConfig;
  actions: Action[] = [];
  ui: UiState = { selection: null, mode: 'idle', picked: [] };
  log: string[] = [];
  pops: Pop[] = [];
  skip = false;
  private frames: Frame[] = [];
  private frameLeft = 0;
  private popKey = 1;
  private listeners = new Set<Listener>();
  private version = 0;
  private timer: ReturnType<typeof setInterval> | undefined;
  private lastTick = 0;
  /** Called after every applied action (both sides), so a run store can mirror the battle. */
  onAction: ((action: Action, state: BattleState) => void) | undefined;

  constructor(config: BattleConfig) {
    this.load(config);
  }

  stopClock(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
  }

  // ---------- subscription ----------
  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  // ---------- lifecycle ----------
  load(config: BattleConfig): void {
    this.config = config;
    this.actions = [];
    const { state, events } = newBattle(config);
    this.state = state;
    this.view = state;
    this.frames = [];
    this.pops = [];
    this.log = describe(events, state);
    this.ui = { selection: null, mode: 'idle', picked: [] };
    this.emit();
    this.maybeEnemy();
  }

  startClock(): void {
    if (this.timer) return;
    this.lastTick = Date.now();
    this.timer = setInterval(() => {
      const now = Date.now();
      const dt = now - this.lastTick;
      this.lastTick = now;
      if (!this.skip) this.advanceTime(dt);
    }, 40);
  }

  skipAnimations(): void {
    this.skip = true;
    this.flush();
  }

  /** Advances the animation clock by ms (also used by the debug API so tests never sleep). */
  advanceTime(ms: number): void {
    if (this.frames.length === 0) {
      if (this.pops.length) {
        this.pops = [];
        this.emit();
      }
      return;
    }
    this.frameLeft -= ms;
    while (this.frameLeft <= 0 && this.frames.length > 0) {
      this.frames.shift();
      const next = this.frames[0];
      if (next) this.show(next);
      else this.drained();
    }
  }

  /** The queue ran dry: show the true state, then let the enemy act if it is up. */
  private drained(): void {
    this.pops = [];
    this.view = this.state;
    this.emit();
    const pending = this.pendingEnemy;
    this.pendingEnemy = undefined;
    if (pending) this.apply(pending);
    if (this.frames.length === 0) this.maybeEnemy();
  }

  private flush(): void {
    while (this.frames.length > 0) {
      const f = this.frames.shift()!;
      this.view = f.view;
      this.log.push(...f.log);
    }
    this.drained();
  }

  private show(f: Frame): void {
    this.view = f.view;
    this.pops = f.pops;
    this.log.push(...f.log);
    if (this.log.length > 400) this.log.splice(0, this.log.length - 400);
    this.frameLeft = f.ms;
    this.emit();
  }

  private enqueue(frames: Frame[]): void {
    const wasIdle = this.frames.length === 0;
    this.frames.push(...frames);
    if (this.skip) this.flush();
    else if (wasIdle) {
      const first = this.frames[0];
      if (first) this.show(first);
    }
  }

  get busy(): boolean {
    return this.frames.length > 0;
  }

  // ---------- actions ----------
  /** The player's action. Illegal actions are rejected by the engine and surface as an error line. */
  dispatch(action: Action): boolean {
    if (this.busy && !this.skip) return false;
    if (this.state.phase !== 'action' || this.state.turn !== 0) return false;
    this.apply(action);
    this.ui = { selection: null, mode: 'idle', picked: [] };
    this.emit();
    return true;
  }

  private apply(action: Action): void {
    const prev = this.state;
    const { state, events } = applyAction(prev, action);
    this.actions.push(action);
    this.state = state;
    this.onAction?.(action, state);
    this.enqueue(this.skip ? [{ view: state, pops: [], log: describe(events, prev, state), ms: 0 }] : buildFrames(prev, events, state, this.nextPop));
  }
  private nextPop = (): number => this.popKey++;

  /** The scripted enemy takes its turn whenever it is up and nothing is animating. */
  private maybeEnemy(): void {
    let guard = 0;
    while (this.state.phase === 'action' && this.state.turn === 1 && this.frames.length === 0 && guard++ < 50) {
      const intent = scriptedIntent(this.state, 1);
      if (!this.skip) {
        // A short pause so the enemy's move reads as a move, then its action.
        this.frames.push({ view: this.state, pops: [], log: [], ms: ANIM_MS.think });
        this.show(this.frames[0]!);
        this.pendingEnemy = intent.action;
        return;
      }
      this.apply(intent.action);
    }
    this.emit();
  }
  private pendingEnemy: Action | undefined;

  /** The enemy's next intended action, computed as if it were its turn now. Null when it is done this wave. */
  intent(): Intent | null {
    const st = this.state;
    if (st.phase !== 'action' || st.passed[1] || st.actionsLeft[1] <= 0) return null;
    const probe: BattleState = st.turn === 1 ? st : { ...st, turn: 1 };
    const it = scriptedIntent(probe, 1);
    return it;
  }

  legal(): Action[] {
    return legalActions(this.state, 0);
  }

  // ---------- selection ----------
  select(sel: Selection): void {
    if (sel && sel.kind === 'card' && sel.side === 0) {
      const card = this.state.sides[0].cards.find((c) => c.uid === sel.uid);
      const mine = this.state.turn === 0 && this.state.phase === 'action' && card && !card.spent;
      this.ui = { selection: sel, mode: mine ? 'summon' : 'idle', picked: [] };
    } else if (sel && sel.kind === 'unit') {
      const u = this.state.units.find((x) => x.id === sel.id);
      const mine = u && u.side === 0 && this.state.turn === 0 && this.state.phase === 'action';
      this.ui = { selection: sel, mode: mine ? 'move' : 'idle', picked: [] };
    } else {
      this.ui = { selection: sel, mode: 'idle', picked: [] };
    }
    this.emit();
  }
  clearSelection(): void {
    this.select(null);
  }
  setMode(mode: Mode): void {
    this.ui = { ...this.ui, mode, picked: [] };
    this.emit();
  }

  selectedCardUid(): number | undefined {
    const s = this.ui.selection;
    return s && s.kind === 'card' && s.side === 0 ? s.uid : undefined;
  }

  /** Cast options for the selected card whose targets start with what has been picked so far. */
  castOptions(): Target[][] {
    const uid = this.selectedCardUid();
    if (uid === undefined || this.ui.mode !== 'cast') return [];
    const picked = this.ui.picked;
    return this.legal()
      .filter((a): a is Extract<Action, { type: 'cast' }> => a.type === 'cast' && a.card === uid)
      .map((a) => a.targets)
      .filter((t) => picked.every((p, i) => sameTarget(p, t[i])));
  }
  /** The next targets the player may pick in cast mode. */
  nextTargets(): Target[] {
    const i = this.ui.picked.length;
    const out: Target[] = [];
    for (const t of this.castOptions()) {
      const n = t[i];
      if (n && !out.some((o) => sameTarget(o, n))) out.push(n);
    }
    return out;
  }
  pick(t: Target): void {
    const uid = this.selectedCardUid();
    if (uid === undefined) return;
    const picked = [...this.ui.picked, t];
    const options = this.castOptions().filter((o) => picked.every((p, i) => sameTarget(p, o[i])));
    if (options.length === 0) return;
    if (options.some((o) => o.length === picked.length)) {
      this.dispatch({ type: 'cast', card: uid, targets: picked });
    } else {
      this.ui = { ...this.ui, picked };
      this.emit();
    }
  }
  /** Casts a spell that needs no target, or begins targeting. */
  beginCast(): void {
    const uid = this.selectedCardUid();
    if (uid === undefined) return;
    const opts = this.legal().filter((a) => a.type === 'cast' && a.card === uid);
    if (opts.length === 0) return;
    const first = opts[0];
    if (opts.length === 1 && first && first.type === 'cast' && first.targets.length === 0) {
      this.dispatch(first);
      return;
    }
    this.setMode('cast');
  }
  summonCells(): Cell[] {
    const uid = this.selectedCardUid();
    if (uid === undefined || this.ui.mode !== 'summon') return [];
    return this.legal()
      .filter((a): a is Extract<Action, { type: 'summon' }> => a.type === 'summon' && a.card === uid)
      .map((a) => ({ lane: a.lane, row: a.row }));
  }
  moveCells(): Cell[] {
    const s = this.ui.selection;
    if (!s || s.kind !== 'unit' || this.ui.mode !== 'move') return [];
    return this.legal()
      .filter((a): a is Extract<Action, { type: 'move' }> => a.type === 'move' && a.unit === s.id)
      .map((a) => ({ lane: a.lane, row: a.row }));
  }
  /** Click on a cell of the player's board. */
  clickCell(cell: Cell): void {
    const uid = this.selectedCardUid();
    if (this.ui.mode === 'summon' && uid !== undefined && this.summonCells().some((c) => c.lane === cell.lane && c.row === cell.row)) {
      this.dispatch({ type: 'summon', card: uid, lane: cell.lane, row: cell.row });
      return;
    }
    if (this.ui.mode === 'move') {
      const s = this.ui.selection;
      if (s && s.kind === 'unit' && this.moveCells().some((c) => c.lane === cell.lane && c.row === cell.row)) {
        this.dispatch({ type: 'move', unit: s.id, lane: cell.lane, row: cell.row });
        return;
      }
    }
    if (this.ui.mode === 'cast') {
      const t = this.nextTargets().find((x) => 'cell' in x && x.cell.lane === cell.lane && x.cell.row === cell.row);
      if (t) this.pick(t);
      return;
    }
    this.clearSelection();
  }
  clickUnit(u: Unit): void {
    if (this.ui.mode === 'cast') {
      const t = this.nextTargets().find((x) => 'unit' in x && x.unit === u.id);
      if (t) {
        this.pick(t);
        return;
      }
    }
    this.select({ kind: 'unit', id: u.id });
  }
  clickCard(uid: number, side: 0 | 1): void {
    if (this.ui.mode === 'cast' && side === 0) {
      const t = this.nextTargets().find((x) => 'card' in x && x.card === uid);
      if (t) {
        this.pick(t);
        return;
      }
    }
    const cur = this.ui.selection;
    if (cur && cur.kind === 'card' && cur.uid === uid && cur.side === side) this.clearSelection();
    else this.select({ kind: 'card', uid, side });
  }
  clickLane(lane: number): void {
    if (this.ui.mode !== 'cast') return;
    const t = this.nextTargets().find((x) => 'lane' in x && x.lane === lane);
    if (t) this.pick(t);
  }
  clickRow(row: number): void {
    if (this.ui.mode !== 'cast') return;
    const t = this.nextTargets().find((x) => 'row' in x && x.row === row);
    if (t) this.pick(t);
  }
  pass(): void {
    this.dispatch({ type: 'pass' });
  }

  // ---------- replays ----------
  exportReplay(): string {
    return JSON.stringify(recordReplay('ui', this.config, this.actions), null, 0);
  }
  importReplay(json: string): void {
    const r = JSON.parse(json) as Replay;
    const { state } = runReplay(r);
    this.config = r.config;
    this.actions = [...r.actions];
    this.state = state;
    this.view = state;
    this.frames = [];
    this.pops = [];
    this.log = ['Replay loaded.'];
    this.ui = { selection: null, mode: 'idle', picked: [] };
    this.emit();
  }
}

export function sameTarget(a: Target | undefined, b: Target | undefined): boolean {
  if (!a || !b) return false;
  if ('unit' in a) return 'unit' in b && a.unit === b.unit;
  if ('lane' in a) return 'lane' in b && a.lane === b.lane;
  if ('row' in a) return 'row' in b && a.row === b.row;
  if ('cell' in a) return 'cell' in b && a.cell.lane === b.cell.lane && a.cell.row === b.cell.row;
  if ('card' in a) return 'card' in b && a.card === b.card;
  return 'fallen' in b && a.fallen === b.fallen;
}

// ---------- frames from events ----------

/** Splits the events of one action into timed frames: the action, each Clash beat, Wave End, then the new wave. */
function buildFrames(prev: BattleState, events: BattleEvent[], next: BattleState, popKey: () => number): Frame[] {
  const hasBeat = events.some((e) => e.type === 'beat');
  if (!hasBeat) return [{ view: next, pops: popsOf(events, next, popKey), log: describe(events, prev, next), ms: ANIM_MS.action }];
  const frames: Frame[] = [];
  let view = structuredClone(prev);
  let seg: BattleEvent[] = [];
  let segMs = ANIM_MS.action;
  const close = (ms: number) => {
    if (seg.length === 0) return;
    view = advanceView(view, seg, next, true);
    frames.push({ view, pops: popsOf(seg, view, popKey), log: describe(seg, view, next), ms: segMs });
    view = advanceView(view, seg, next, false);
    seg = [];
    segMs = ms;
  };
  for (const e of events) {
    if (e.type === 'beat') close(ANIM_MS.beat);
    else if (e.type === 'waveEnd') close(ANIM_MS.waveEnd);
    else if (e.type === 'waveStart' || e.type === 'battleOver') close(ANIM_MS.waveStart);
    seg.push(e);
  }
  close(ANIM_MS.waveStart);
  // The last frame always lands on the true state.
  const last = frames[frames.length - 1];
  if (last) last.view = next;
  else frames.push({ view: next, pops: [], log: [], ms: 0 });
  return frames;
}

/**
 * A rough projection of the board after a segment: damage marks and deaths, so beats read in order.
 * With summonsOnly, only units that appear during the segment are added (so the frame can show them).
 */
function advanceView(view: BattleState, seg: BattleEvent[], next: BattleState, summonsOnly: boolean): BattleState {
  const v = structuredClone(view);
  for (const e of seg) {
    if (e.type === 'summon' && !v.units.some((u) => u.id === e.unit)) {
      const u = next.units.find((x) => x.id === e.unit);
      if (u) v.units.push({ ...structuredClone(u), damage: 0, lane: e.cell.lane, row: e.cell.row });
    }
  }
  if (summonsOnly) return v;
  for (const e of seg) {
    if (e.type === 'damage') {
      const u = v.units.find((x) => x.id === e.unit);
      if (u) {
        const absorbed = Math.min(e.absorbed, u.shield + u.shieldPersist);
        u.shield = Math.max(0, u.shield - absorbed);
        u.damage += e.amount;
      }
    } else if (e.type === 'heal') {
      const u = v.units.find((x) => x.id === e.unit);
      if (u) u.damage = Math.max(0, u.damage - e.amount);
    } else if (e.type === 'death') {
      v.units = v.units.filter((x) => x.id !== e.unit);
    } else if (e.type === 'faceDamage') {
      v.sides[e.side].hp -= e.amount;
    } else if (e.type === 'status') {
      const u = v.units.find((x) => x.id === e.unit);
      if (u) {
        if (e.status === 'burn') u.burn += e.n;
        else if (e.status === 'poison') u.poison += e.n;
        else if (e.status === 'shield') u.shield += e.n;
        else u.stunned = true;
      }
    } else if (e.type === 'embers') {
      v.sides[e.side].embers += e.delta;
    }
  }
  return v;
}

function popsOf(seg: BattleEvent[], view: BattleState, popKey: () => number): Pop[] {
  const out: Pop[] = [];
  const cellOf = (id: number) => {
    const u = view.units.find((x) => x.id === id);
    return u ? { side: u.side, cell: { lane: u.lane, row: u.row } } : undefined;
  };
  for (const e of seg) {
    if (e.type === 'damage' && e.amount + e.absorbed > 0) {
      const at = cellOf(e.unit);
      if (at) out.push({ key: popKey(), kind: 'dmg', text: e.amount > 0 ? `-${e.amount}` : 'blocked', at });
    } else if (e.type === 'heal' && e.amount > 0) {
      const at = cellOf(e.unit);
      if (at) out.push({ key: popKey(), kind: 'heal', text: `+${e.amount}`, at });
    } else if (e.type === 'faceDamage' && e.amount > 0) {
      out.push({ key: popKey(), kind: 'face', text: `-${e.amount}`, at: { side: e.side } });
    } else if (e.type === 'status' && e.n > 0) {
      const at = cellOf(e.unit);
      if (at) out.push({ key: popKey(), kind: 'status', text: `${e.status} ${e.n}`, at });
    } else if (e.type === 'embers' && e.delta !== 0) {
      out.push({ key: popKey(), kind: 'embers', text: `${e.delta > 0 ? '+' : ''}${e.delta}✦`, at: { side: e.side } });
    }
  }
  return out;
}

const SIDE_NAME = ['You', 'Enemy'] as const;

/** Human-readable log lines for events. The state is only used to name units. */
export function describe(events: BattleEvent[], st: BattleState, after?: BattleState): string[] {
  const names = new Map<number, string>();
  for (const u of st.units) names.set(u.id, u.name);
  for (const u of after?.units ?? []) names.set(u.id, u.name);
  for (const e of events) if (e.type === 'summon') names.set(e.unit, e.name);
  const name = (id: number) => names.get(id) ?? `#${id}`;
  const cell = (c: Cell) => `${LANE_NAMES[c.lane]}-${ROW_NAMES[c.row]}`;
  const out: string[] = [];
  for (const e of events) {
    switch (e.type) {
      case 'summon':
        out.push(`${SIDE_NAME[e.side]} summon${e.side === 0 ? '' : 's'} ${e.name} at ${cell(e.cell)}.`);
        break;
      case 'cast':
        out.push(`${SIDE_NAME[e.side]} cast${e.side === 0 ? '' : 's'} ${e.name}.`);
        break;
      case 'move':
        out.push(`${name(e.unit)} moves to ${cell(e.to)}${e.paid ? ' (1✦)' : ''}.`);
        break;
      case 'pass':
        out.push(`${SIDE_NAME[e.side]} pass${e.side === 0 ? '' : 'es'}${e.first ? ' first (+1✦)' : ''}.`);
        break;
      case 'waveStart':
        out.push(`— Wave ${e.wave}. ${e.initiative === 0 ? 'You act' : 'Enemy acts'} first.`);
        break;
      case 'beat':
        out.push(`${ROW_NAMES[e.row]} row strikes.`);
        break;
      case 'attack':
        out.push(`${name(e.attacker)} hits ${e.target === 'face' ? (e.targetSide === 0 ? 'your Warden' : 'the enemy') : name(e.target)} for ${e.damage}.`);
        break;
      case 'faceDamage':
        out.push(`${e.side === 0 ? 'You' : 'Enemy'} take${e.side === 0 ? '' : 's'} ${e.amount} (${e.source}).`);
        break;
      case 'death':
        out.push(`${e.name} dies.`);
        break;
      case 'heal':
        out.push(`${name(e.unit)} heals ${e.amount}.`);
        break;
      case 'status':
        if (e.n > 0) out.push(`${name(e.unit)} gets ${e.status} ${e.n}.`);
        break;
      case 'embers':
        if (e.delta !== 0) out.push(`${SIDE_NAME[e.side]} ${e.delta > 0 ? 'gain' : 'lose'} ${Math.abs(e.delta)}✦ (${e.reason}).`);
        break;
      case 'trigger':
        out.push(`${e.name}: ${e.on}.`);
        break;
      case 'waveEnd':
        out.push(`Wave ${e.wave} ends.`);
        break;
      case 'battleOver':
        out.push(e.winner === 0 ? (e.outcome === 'kill' ? 'Victory. The enemy falls.' : 'Victory. You hold the stair.') : e.winner === 1 ? (e.outcome === 'kill' ? 'Defeat. The light goes out.' : 'The enemy holds the stair and retreats.') : 'Draw.');
        break;
      case 'error':
        out.push(`Error: ${e.message}`);
        break;
      case 'note':
        out.push(e.text);
        break;
      case 'damage':
        break;
    }
  }
  return out;
}

export function unitName(key: string, level: 1 | 2 | 3): string {
  return defFor(key, level).name;
}

/** Builds the battle for a URL scenario name. Unknown names fall back to the first fight. */
export function scenarioConfig(seed: string, scenario: string): BattleConfig {
  const m = /^fight(\d+)$/.exec(scenario);
  if (m) return scenarioFight(seed, 0, Number(m[1]));
  const w = /^warden(\d)-fight(\d+)$/.exec(scenario);
  if (w) return scenarioFight(seed, Number(w[1]), Number(w[2]));
  if (scenario === 'levels') return scenarioFight(seed, 0, 0, [{ key: 'c5', level: 2 }, { key: 'c9', level: 3 }, { key: 'c26', level: 2 }]);
  return scenarioFight(seed, 0, 0);
}
