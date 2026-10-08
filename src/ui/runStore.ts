import { botRunAction, continueRun } from '../core/run/bot';
import { applyRunAction, legalRunActions, newRun, type RunOptions } from '../core/run/run';
import type { RunAction, RunEvent, RunState } from '../core/run/types';
import type { Action } from '../core/types';
import { GameStore } from './store';
import { music, sfx } from './audio';
import { kvDel, kvGet, kvSet } from './save';

/**
 * The run store: the RunState, the battle store while a battle is on, and save/resume.
 * Every change goes through applyRunAction; battle actions taken in the GameStore are mirrored here.
 */

const SAVE_KEY = 'run.v1';
const UNLOCK_KEY = 'emberward.unlocks.v1';

export type Screen = 'title' | RunState['phase'];

export class RunStore {
  run: RunState | null = null;
  battle: GameStore | null = null;
  screen: Screen = 'title';
  events: RunEvent[] = [];
  /** UI-only selection for pick screens (Hearth, Shrine, Sigil). */
  picking: 'snuff' | 'temper' | 'sell' | 'shrine' | 'sigil' | null = null;
  sigilTrait: string | null = null;
  private listeners = new Set<() => void>();
  private version = 0;
  private seed: string;
  private skip = false;
  /** The saved run loaded at boot (IndexedDB), kept so the title can offer Continue synchronously. */
  private saved: RunState | null = null;

  constructor(seed: string) {
    this.seed = seed;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getVersion = (): number => this.version;
  private emit(): void {
    this.version++;
    for (const l of this.listeners) l();
  }

  options(): RunOptions {
    return { sextonUnlocked: this.sextonUnlocked() };
  }

  sextonUnlocked(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(UNLOCK_KEY)?.includes('sexton') === true;
    } catch {
      return false;
    }
  }

  /** Loads the saved run from IndexedDB before the first render. */
  async boot(): Promise<void> {
    const r = await kvGet<RunState>(SAVE_KEY);
    this.saved = r && r.phase !== 'over' ? r : null;
    this.emit();
  }

  hasSave(): boolean {
    return this.saved !== null;
  }

  newRun(seed = this.seed): void {
    this.stopBattle();
    this.run = newRun(seed);
    this.screen = 'wardenSelect';
    this.events = [];
    this.sync();
  }

  resume(): boolean {
    if (!this.saved) return false;
    this.run = structuredClone(this.saved);
    this.screen = this.run.phase;
    this.sync();
    return true;
  }

  toTitle(): void {
    this.stopBattle();
    this.screen = 'title';
    music(null);
    this.emit();
  }

  skipAnimations(): void {
    this.skip = true;
    this.battle?.skipAnimations();
  }

  dispatch(action: RunAction): boolean {
    if (!this.run) return false;
    if (action.type !== 'battle' && this.battle) this.stopBattle();
    const { state, events } = applyRunAction(this.run, action, this.options());
    this.run = state;
    this.events.push(...events);
    for (const e of events) {
      if (e.type === 'draft' && e.price > 0) sfx('reach');
      else if (e.type === 'rekindle') sfx('rekindle');
      else if (e.type === 'buy' || e.type === 'relic' || e.type === 'sigil') sfx('click');
    }
    if (this.events.length > 200) this.events.splice(0, this.events.length - 200);
    this.picking = null;
    this.sync();
    return events.every((e) => e.type !== 'error');
  }

  legal(): RunAction[] {
    return this.run ? legalRunActions(this.run, this.options()) : [];
  }

  /** Lets the headless bot play `steps` actions (tests, screenshots). Battles are skipped through. */
  bot(steps: number): void {
    if (!this.run) return;
    this.skipAnimations();
    let rng = this.run.rng.bot;
    for (let i = 0; i < steps && this.run.phase !== 'over'; i++) {
      const [a, r] = botRunAction(this.run, rng, this.options());
      rng = r;
      if (!a) break;
      if (a.type === 'battle' && this.battle) {
        if (this.run.battle!.turn === 0) this.battle.dispatch(a.action);
        else this.battle.advanceTime(10_000);
      } else this.dispatch(a);
    }
  }

  /** Plays the run to its end headless (e2e). */
  finish(): void {
    if (!this.run) return;
    this.stopBattle();
    this.run = continueRun(this.run, 10_000, this.options()).state;
    this.sync();
  }

  setPicking(p: RunStore['picking']): void {
    this.picking = p;
    this.emit();
  }
  setSigilTrait(t: string | null): void {
    this.sigilTrait = t;
    this.emit();
  }

  /** Keeps the screen, the battle store and the save in step with the run state. */
  private sync(): void {
    const run = this.run;
    if (!run) return;
    if (run.phase === 'battle' && run.battleConfig) {
      if (!this.battle) {
        const gs = new GameStore(run.battleConfig);
        if (this.skip) gs.skipAnimations();
        gs.onAction = (action: Action) => {
          // Mirror into the run; the engine is deterministic so both states agree.
          const r = this.run;
          if (!r || r.phase !== 'battle') return;
          this.run = applyRunAction(r, { type: 'battle', action }, this.options()).state;
          if (this.run.phase !== 'battle') this.afterBattle();
          else this.save();
          this.emit();
        };
        this.battle = gs;
      }
      this.screen = 'battle';
    } else if (this.battle && run.phase !== 'battle') {
      // The battle ended: keep the battle store around until the player continues from the overlay.
      this.screen = 'battle';
    } else {
      this.screen = run.phase;
    }
    if (run.phase === 'over' && run.won) this.unlockSexton();
    music(run.phase === 'over' ? null : run.phase === 'battle' && run.battleConfig?.kind === 'boss' ? 'boss' : 'stair', run.seed);
    this.save();
    this.emit();
  }

  private afterBattle(): void {
    this.save();
    if (this.run?.phase === 'over' && this.run.won) this.unlockSexton();
  }

  /** From the battle-over overlay: drop the battle store and show the reward (or the run's end). */
  leaveBattle(): void {
    this.stopBattle();
    if (this.run) this.screen = this.run.phase;
    this.emit();
  }

  private stopBattle(): void {
    this.battle?.stopClock();
    this.battle = null;
  }

  private save(): void {
    if (this.run && this.run.phase !== 'over') {
      this.saved = this.run;
      void kvSet(SAVE_KEY, this.run);
    } else {
      this.saved = null;
      void kvDel(SAVE_KEY);
    }
  }

  private unlockSexton(): void {
    try {
      localStorage.setItem(UNLOCK_KEY, 'sexton');
    } catch {
      /* ignore */
    }
  }
}
