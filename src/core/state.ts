import { makeRng, type RngState } from './rng';

export interface GameState {
  seed: string;
  turn: number;
  embers: number;
  rng: { map: RngState; rewards: RngState; market: RngState; ai: RngState };
}

export type Action = { type: 'gainEmbers'; amount: number } | { type: 'endTurn' };

export type GameEvent = { type: 'embersChanged'; embers: number } | { type: 'turnEnded'; turn: number };

export function newGame(seed: string): GameState {
  return {
    seed,
    turn: 0,
    embers: 0,
    rng: {
      map: makeRng(seed, 'map'),
      rewards: makeRng(seed, 'rewards'),
      market: makeRng(seed, 'market'),
      ai: makeRng(seed, 'ai'),
    },
  };
}

/** The only mutator. Pure: returns a new state plus events; no DOM, Date or Math.random. */
export function applyAction(state: GameState, action: Action): { state: GameState; events: GameEvent[] } {
  switch (action.type) {
    case 'gainEmbers': {
      const embers = state.embers + action.amount;
      return { state: { ...state, embers }, events: [{ type: 'embersChanged', embers }] };
    }
    case 'endTurn': {
      const turn = state.turn + 1;
      return { state: { ...state, turn }, events: [{ type: 'turnEnded', turn }] };
    }
  }
}
