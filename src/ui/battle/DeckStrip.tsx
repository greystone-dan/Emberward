import { spellCost } from '../../core/battle/battle';
import { defFor } from '../../core/battle/defs';
import type { BattleState, Side } from '../../core/types';
import type { GameStore } from '../store';

/** Every card a side brought, as chips. Spent cards grey out; the enemy's next play carries an intent marker. */
export function DeckStrip({ store, state, side }: { store: GameStore; state: BattleState; side: Side }) {
  const s = state.sides[side];
  const sel = store.ui.selection;
  const intent = side === 1 ? store.intent() : null;
  const intentCard = intent && intent.action.type !== 'pass' && intent.action.type !== 'move' ? intent.action.card : undefined;
  const targetCards = new Set(side === 0 && store.ui.mode === 'cast' ? store.nextTargets().flatMap((t) => ('card' in t ? [t.card] : [])) : []);
  const onBoard = new Set(state.units.map((u) => u.cardUid));
  return (
    <div className={`strip${side === 1 ? ' enemy' : ''}`} data-testid={`strip-${side}`}>
      {s.cards.map((c) => {
        const def = defFor(c.key, c.level);
        const selected = !!sel && sel.kind === 'card' && sel.uid === c.uid && sel.side === side;
        const cls = ['chip'];
        if (side === 1) cls.push('enemy');
        if (c.spent) cls.push('spent');
        if (selected) cls.push('selected');
        if (targetCards.has(c.uid)) cls.push('targetable');
        if (onBoard.has(c.uid)) cls.push('fielded');
        return (
          <div key={c.uid} className={cls.join(' ')} data-testid={`card-${c.uid}`} data-name={def.name} onClick={() => store.clickCard(c.uid, side)} title={def.name}>
            {c.level > 1 && <span className="lvl">{c.level === 2 ? '✦✦' : '✦✦✦'}</span>}
            {def.spell && !c.spent && <span className="cost">{spellCost(state, side, c)}✦</span>}
            <span className="cname">{def.name}</span>
            <span className="cstats">
              {def.shape === 'none' && def.atk === 0 ? 'spell' : `${def.atk}/${def.hp}`}
            </span>
            <span className="cshape">{def.shape === 'none' ? '' : def.shape}</span>
            {intentCard === c.uid && <span className="intent">next</span>}
          </div>
        );
      })}
    </div>
  );
}
