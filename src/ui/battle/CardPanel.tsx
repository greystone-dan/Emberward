import { spellCost, stepCost } from '../../core/battle/battle';
import { defFor } from '../../core/battle/defs';
import { effectiveAtk, effectiveMaxHp, hpOf, kinship, swiftOf, isRooted } from '../../core/battle/stats';
import { cards, content } from '../../content/cards';
import type { Shape } from '../../content/types';
import { cardIdOf } from '../../core/battle/defs';
import type { BattleState, Level } from '../../core/types';
import { Sprite } from '../sprites';
import type { GameStore } from '../store';
import { Keywords, traitTip } from '../tooltip';

const SHAPE_CELLS: Record<Shape, number[]> = {
  // 3x3 mini grid, the attacker at the bottom centre (index 7). Lit cells show what the shape reaches.
  strike: [1],
  shoot: [1],
  pierce: [1, 4],
  cleave: [0, 1, 2],
  lob: [1],
  none: [],
};
const SHAPE_TEXT: Record<Shape, string> = {
  strike: 'Strike: hits the enemy ahead in its lane, or the face if the lane is open.',
  shoot: 'Shoot: hits the frontmost enemy in its lane from any row.',
  pierce: 'Pierce: hits the first two enemies in its lane.',
  cleave: 'Cleave: hits the enemy ahead and the ones beside it.',
  lob: 'Lob: hits the backmost enemy in its lane.',
  none: 'Does not attack.',
};

/** The inspected card or unit: art, traits, both halves, and the actions the player can take with it. */
export function CardPanel({ store, state }: { store: GameStore; state: BattleState }) {
  const sel = store.ui.selection;
  if (!sel) return <Empty />;
  let key: string, level: Level, uid: number | undefined, side: 0 | 1;
  const unit = sel.kind === 'unit' ? state.units.find((u) => u.id === sel.id) : undefined;
  if (sel.kind === 'card') {
    const c = state.sides[sel.side].cards.find((x) => x.uid === sel.uid);
    if (!c) return <Empty />;
    key = c.key;
    level = c.level;
    uid = c.uid;
    side = sel.side;
  } else {
    if (!unit) return <Empty />;
    key = unit.key;
    level = unit.level;
    side = unit.side;
  }
  const def = defFor(key, level);
  const id = cardIdOf(key);
  const card = id === undefined ? undefined : cards.find((c) => c.id === id);
  const myTurn = state.turn === 0 && state.phase === 'action' && !store.busy;
  const battleCard = uid === undefined ? undefined : state.sides[side].cards.find((c) => c.uid === uid);
  const canAct = side === 0 && myTurn && battleCard && !battleCard.spent;
  const castLegal = canAct && store.legal().some((a) => a.type === 'cast' && a.card === uid);
  const cost = battleCard && def.spell ? spellCost(state, side, battleCard) : def.spellCost;
  const mode = store.ui.mode;
  const picked = store.ui.picked.length;
  return (
    <div className={`card l${level}`} data-testid="card-panel">
      <div className="title">
        <span>{def.name}</span>
        <span className="rar">{card ? ({ C: 'Common', U: 'Uncommon', R: 'Rare' } as const)[card.rarity] : def.token ? 'Token' : 'Enemy'} · {['', 'Spark', 'Flame', 'Fire'][level]}</span>
      </div>
      <div className="art">
        <Sprite unitKey={key} level={level} scale={4} />
      </div>
      <div className="traits">
        {def.traits.map((t) => (
          <span key={t} className="tchip" style={{ color: content.traits[t].col, borderColor: content.traits[t].col }} data-tip={traitTip(t)}>
            {t}
          </span>
        ))}
        {def.token && <span className="tchip" style={{ color: '#8b9bb4', borderColor: '#8b9bb4' }}>token (no traits count)</span>}
      </div>
      {!(def.shape === 'none' && def.atk === 0 && def.hp === 0) && (
        <div className="half">
          <div className="head">
            <span>
              {unit ? `${effectiveAtk(state, unit)}/${hpOf(state, unit)} of ${effectiveMaxHp(state, unit)}` : `${def.atk}/${def.hp}`} {def.shape}
              <ShapeMini shape={def.shape} />
            </span>
            <span>{unit ? `${isRooted(state, unit) ? 'Rooted' : `Swift ${swiftOf(state, unit)}`}` : ''}</span>
          </div>
          <div>
            <Keywords text={def.text || SHAPE_TEXT[def.shape]} />
          </div>
          {unit && kinship(state, unit) > 0 && <div className="muted">Kinship +{kinship(state, unit)}/+{kinship(state, unit)} from neighbours.</div>}
        </div>
      )}
      {def.spell && (
        <div className="half spell">
          <div className="head">
            <span>{def.spellName}</span>
            <span>{cost}✦</span>
          </div>
          <div>
            <Keywords text={def.spellText} />
          </div>
        </div>
      )}
      {canAct && (
        <div className="actions">
          <button className={mode === 'summon' ? 'primary' : ''} onClick={() => store.setMode('summon')} data-testid="btn-summon">
            Summon
          </button>
          {def.spell && (
            <button className={mode === 'cast' ? 'primary' : ''} disabled={!castLegal} onClick={() => store.beginCast()} data-testid="btn-cast" title={castLegal ? '' : 'Not enough embers or no target'}>
              Cast {cost}✦
            </button>
          )}
        </div>
      )}
      {canAct && mode === 'summon' && <div className="hint">Pick a highlighted cell.</div>}
      {canAct && mode === 'cast' && <div className="hint">{picked > 0 ? 'Pick the next target.' : 'Pick a target.'}</div>}
      {unit && unit.side === 0 && myTurn && (
        <div className="hint">{isRooted(state, unit) ? 'Rooted: cannot move.' : `Click a highlighted cell to move (${stepCost(state, unit) === 0 ? 'free' : `${stepCost(state, unit)}✦`}). Moving keeps your turn.`}</div>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="card" data-testid="card-panel">
      <div className="title">
        <span>Emberward</span>
      </div>
      <div className="half">Click a card in your deck to inspect and play it. Click a unit on the board to see it or move it. Arrows show what the Clash will do when both sides pass.</div>
    </div>
  );
}

function ShapeMini({ shape }: { shape: Shape }) {
  const on = new Set(SHAPE_CELLS[shape]);
  return (
    <span className="shape" title={shape}>
      {Array.from({ length: 9 }, (_, i) => (
        <i key={i} className={on.has(i) ? 'on' : i === 7 ? 'me' : ''} />
      ))}
    </span>
  );
}
