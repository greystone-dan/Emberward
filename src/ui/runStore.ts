import { botRunAction, continueRun } from '../core/run/bot';
import { applyRunAction, legalRunActions, newRun, type RunOptions } from '../core/run/run';
import type { RunAction, RunEvent, RunState } from '../core/run/types';
import type { Action } from '../core/types';
import { GameStore } from './store';

/**
 * The run store: the RunState, the battle store while a battle is on, and save/resume.
 * Every change goes through applyRunAction; battle actions taken in the GameStore are mirrored here.
 */

const SAVE_KEY = 'emberward.run.v1';
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

  hasSave(): boolean {
    try {
      return typeof localStorage !== 'undefined' && localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  }

  newRun(seed = this.seed): void {
    this.stopBattle();
    this.run = newRun(seed);
    this.screen = 'wardenSelect';
    this.events = [];
    this.sync();
  }

  resume(): boolean {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      this.run = JSON.parse(raw) as RunState;
      this.screen = this.run.phase;
      this.sync();
      return true;
    } catch {
      return false;
    }
  }

  toTitle(): void {
    this.stopBattle();
    this.screen = 'title';
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
    try {
      if (typeof localStorage === 'undefined') return;
      if (this.run && this.run.phase !== 'over') localStorage.setItem(SAVE_KEY, JSON.stringify(this.run));
      else localStorage.removeItem(SAVE_KEY);
    } catch {
      /* private mode */
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
