import { useEffect, useSyncExternalStore } from 'react';
import { FLAGS } from '../../config/flags';
import { LANE_NAMES, ROW_NAMES } from '../../core/grid';
import { defFor } from '../../core/battle/defs';
import type { GameStore } from '../store';
import { Board } from './Board';
import { CardPanel } from './CardPanel';
import { DeckStrip } from './DeckStrip';
import { SidePanel } from './SidePanel';

export function BattleScreen({ store, onRestart, restartLabel = 'Fight again' }: { store: GameStore; onRestart: () => void; restartLabel?: string }) {
  useSyncExternalStore(store.subscribe, store.getVersion);
  useEffect(() => store.startClock(), [store]);
  const state = store.state;
  const view = store.view;
  const me = view.sides[0];
  const foe = view.sides[1];
  const myTurn = state.phase === 'action' && state.turn === 0;
  const intent = store.intent();
  const intentText = (() => {
    if (state.phase !== 'action') return '';
    if (!intent) return state.passed[1] ? 'Enemy has passed.' : 'Enemy is out of actions.';
    const a = intent.action;
    if (a.type === 'summon') return `Enemy will play ${defFor(intent.cardKey ?? '', 1).name} at ${LANE_NAMES[a.lane]}-${ROW_NAMES[a.row]}.`;
    if (a.type === 'cast') return `Enemy will cast ${defFor(intent.cardKey ?? '', 1).name}.`;
    return 'Enemy will pass.';
  })();
  const hint = (() => {
    if (state.phase === 'over') return '';
    if (store.busy) return 'Resolving…';
    if (!myTurn) return 'Enemy is acting…';
    const n = state.actionsLeft[0];
    if (store.ui.mode === 'summon') return 'Pick a highlighted cell to summon.';
    if (store.ui.mode === 'cast') return 'Pick a target for the spell.';
    if (store.ui.mode === 'move') return 'Pick a highlighted cell to move, or click elsewhere.';
    return `Your turn: ${n} action${n === 1 ? '' : 's'} left this wave. Summon, cast, or End Turn.`;
  })();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') store.clearSelection();
      if ((e.key === 'e' || e.key === 'Enter') && myTurn && !store.busy) store.pass();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, myTurn]);

  return (
    <div className="battle" data-testid="battle" data-wave={state.wave} data-turn={state.turn} data-phase={state.phase}>
      <div className="hud-top">
        <div className="warden">
          <span className="name">{foe.wardenName || 'Enemy'}</span>
          <div className="hpbar">
            <div style={{ width: `${Math.max(0, (100 * foe.hp) / foe.maxHp)}%` }} />
          </div>
          <span className="hp" data-testid="hp-1">
            {foe.hp}/{foe.maxHp} ♥ · {foe.embers}✦
          </span>
        </div>
        <DeckStrip store={store} state={view} side={1} />
        <div className="turn" data-testid="intent">{intentText}</div>
      </div>
      <div className="left">
        <div className="wave" data-testid="wave">
          Wave {state.wave} / {FLAGS.wavesPerBattle}
        </div>
        <div className={`turn${myTurn ? ' mine' : ''}`}>{state.phase === 'over' ? 'Battle over' : myTurn ? 'Your turn' : 'Enemy turn'} · {state.initiative === 0 ? 'you' : 'enemy'} act first this wave</div>
        <SidePanel state={view} log={store.log} />
      </div>
      <div className="centre">
        <Board store={store} view={view} state={state} />
      </div>
      <div className="right">
        <CardPanel store={store} state={state} />
      </div>
      <div className="hud-bottom">
        <div className="warden">
          <span className="name">{me.wardenName || 'You'}</span>
          <div className="hpbar player">
            <div style={{ width: `${Math.max(0, (100 * me.hp) / me.maxHp)}%` }} />
          </div>
          <span className="hp" data-testid="hp-0">
            {me.hp}/{me.maxHp} ♥
          </span>
          <span className="embers" data-testid="embers">
            {me.embers}✦ embers
          </span>
        </div>
        <DeckStrip store={store} state={view} side={0} />
        <div className="end">
          <div className="hint" data-testid="hint">{hint}</div>
          <button className="primary" disabled={!myTurn || store.busy} onClick={() => store.pass()} data-testid="btn-pass" title="Pass (E). The first side to pass gains 1✦.">
            End Turn{state.firstPass === null && myTurn ? ' (+1✦)' : ''}
          </button>
        </div>
      </div>
      {state.phase === 'over' && (
        <div className="overlay" data-testid="overlay">
          <h1 className={state.winner === 0 ? '' : 'lost'}>
            {state.winner === 0 ? (state.outcome === 'kill' ? 'The enemy falls.' : 'You hold the stair.') : state.winner === 1 ? (state.outcome === 'kill' ? 'The light goes out.' : 'The enemy holds the stair.') : 'Both lights gutter.'}
          </h1>
          <p>
            {state.outcome === 'kill'
              ? 'A Warden fell.'
              : `After ${FLAGS.wavesPerBattle} waves the side that dealt more face damage wins (you ${state.sides[0].faceDamageDealt}, enemy ${state.sides[1].faceDamageDealt}).${state.winner === 1 ? ' You take the difference as health and the enemy retreats.' : ''}`}{' '}
            You {me.hp}♥ · Enemy {foe.hp}♥.
          </p>
          <button className="primary" onClick={onRestart} data-testid="btn-restart">
            {restartLabel}
          </button>
        </div>
      )}
    </div>
  );
}
