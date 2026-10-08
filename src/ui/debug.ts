import type { Action } from '../core/types';
import { renderToText } from '../core/battle/render';
import type { GameStore } from './store';

/**
 * window.__game: the debug and test API (PROMPT.md "Working method"). Playwright and the shoot tool drive the
 * game through it, so nothing in tests depends on DOM timing.
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
  params: { seed: string; scenario: string; debug: boolean };
}

export function readParams(): DebugApi['params'] {
  const q = new URLSearchParams(window.location.search);
  return { seed: q.get('seed') ?? 'demo', scenario: q.get('scenario') ?? '', debug: q.get('debug') === '1' };
}

export function installDebugApi(store: GameStore, loadScenario: (name: string) => void): DebugApi {
  const api: DebugApi = {
    getState: () => store.state,
    renderToText: () => renderToText(store.state),
    dispatch: (action) => store.dispatch(action as Action),
    legalActions: () => store.legal(),
    advanceTime: (ms) => store.advanceTime(ms),
    skipAnimations: () => store.skipAnimations(),
    loadScenario,
    exportReplay: () => store.exportReplay(),
    importReplay: (json) => store.importReplay(json),
    busy: () => store.busy,
    params: readParams(),
  };
  (window as unknown as { __game: DebugApi }).__game = api;
  return api;
}
