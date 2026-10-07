/**
 * window.__game: the debug and test API (PROMPT.md "Working method"). Phase 1 wires the real engine in.
 */
export interface DebugApi {
  getState(): unknown;
  renderToText(): string;
  dispatch(action: unknown): void;
  legalActions(): unknown[];
  advanceTime(ms: number): void;
  skipAnimations(): void;
  loadScenario(name: string): void;
  exportReplay(): string;
  importReplay(json: string): void;
  params: { seed: string; scenario: string; debug: boolean };
}

export function readParams(): DebugApi['params'] {
  const q = new URLSearchParams(window.location.search);
  return { seed: q.get('seed') ?? 'demo', scenario: q.get('scenario') ?? '', debug: q.get('debug') === '1' };
}

export function installDebugApi(): DebugApi {
  const api: DebugApi = {
    getState: () => null,
    renderToText: () => '(no battle)',
    dispatch: () => undefined,
    legalActions: () => [],
    advanceTime: () => undefined,
    skipAnimations: () => undefined,
    loadScenario: () => undefined,
    exportReplay: () => '[]',
    importReplay: () => undefined,
    params: readParams(),
  };
  (window as unknown as { __game: DebugApi }).__game = api;
  return api;
}
