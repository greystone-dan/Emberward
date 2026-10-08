import type { Action } from '../core/types';
import type { RunAction } from '../core/run/types';
import { renderToText } from '../core/battle/render';
import type { GameStore } from './store';
import type { RunStore } from './runStore';

/**
 * window.__game: the debug and test API (PROMPT.md "Working method"). Playwright and the shoot tool drive the
 * game through it, so nothing in tests depends on DOM timing. In a run, the battle methods address the current battle.
 */
export interface DebugApi {
  getState(): unknown;
  renderToText(): string;
  dispatch(action: unknown): boolean;
  legalActions(): unknown[];
  advanceTime(ms: number): void;
  skipAnimations(): void;
  loadScenario(name: string): void;
  exportReplay(): string;
  importReplay(json: string): void;
  busy(): boolean;
  run?: {
    getState(): unknown;
    dispatch(action: unknown): boolean;
    legal(): unknown[];
    bot(steps: number): void;
    finish(): void;
    newRun(seed?: string): void;
    phase(): string;
  };
  params: { seed: string; scenario: string; debug: boolean };
}

export function readParams(): DebugApi['params'] {
  const q = new URLSearchParams(window.location.search);
  return { seed: q.get('seed') ?? 'demo', scenario: q.get('scenario') ?? '', debug: q.get('debug') === '1' };
}

export function installDebugApi(opts: { battle?: GameStore; run?: RunStore; loadScenario: (name: string) => void }): DebugApi {
  const battle = () => opts.battle ?? opts.run?.battle ?? null;
  const api: DebugApi = {
    getState: () => battle()?.state ?? null,
    renderToText: () => {
      const b = battle();
      return b ? renderToText(b.state) : '(no battle)';
    },
    dispatch: (action) => battle()?.dispatch(action as Action) ?? false,
    legalActions: () => battle()?.legal() ?? [],
    advanceTime: (ms) => battle()?.advanceTime(ms),
    skipAnimations: () => (opts.run ? opts.run.skipAnimations() : opts.battle?.skipAnimations()),
    loadScenario: opts.loadScenario,
    exportReplay: () => battle()?.exportReplay() ?? '[]',
    importReplay: (json) => battle()?.importReplay(json),
    busy: () => battle()?.busy ?? false,
    params: readParams(),
  };
  if (opts.run) {
    const r = opts.run;
    api.run = {
      getState: () => r.run,
      dispatch: (a) => r.dispatch(a as RunAction),
      legal: () => r.legal(),
      bot: (n) => r.bot(n),
      finish: () => r.finish(),
      newRun: (seed) => r.newRun(seed),
      phase: () => r.screen,
    };
  }
  (window as unknown as { __game: DebugApi }).__game = api;
  return api;
}
