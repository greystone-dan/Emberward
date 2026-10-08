import { LANE_NAMES, ROW_NAMES, unitAt } from '../../core/grid';
import { previewClash } from '../../core/battle/preview';
import { effectiveAtk, effectiveMaxHp, hpOf, tauntLanes } from '../../core/battle/stats';
import type { BattleState, Cell, Lane, Row, Unit } from '../../core/types';
import { Sprite } from '../sprites';
import type { GameStore, Pop } from '../store';
import { BOARD_H, BOARD_W, cellCentre, DIVIDER_Y, facePoint } from './layout';

/** Both grids, the lane and row labels, the Clash preview arrows and floating numbers. */
export function Board({ store, view, state }: { store: GameStore; view: BattleState; state: BattleState }) {
  const ui = store.ui;
  const summon = store.summonCells();
  const moves = store.moveCells();
  const next = ui.mode === 'cast' ? store.nextTargets() : [];
  const intent = store.intent();
  const intentCell = intent?.cell;
  const dark = new Set(state.boss?.darkLanes ?? []);
  const targetLanes = new Set(next.flatMap((t) => ('lane' in t ? [t.lane] : [])));
  const targetRows = new Set(next.flatMap((t) => ('row' in t ? [t.row] : [])));
  const targetUnits = new Set(next.flatMap((t) => ('unit' in t ? [t.unit] : [])));
  const targetCells = next.flatMap((t) => ('cell' in t ? [t.cell] : []));
  const has = (cells: Cell[], c: Cell) => cells.some((x) => x.lane === c.lane && x.row === c.row);
  const selectedUnit = ui.selection && ui.selection.kind === 'unit' ? ui.selection.id : undefined;

  const cell = (side: 0 | 1, lane: Lane, row: Row) => {
    const u = unitAt(view.units, side, lane, row);
    const c = { lane, row };
    const cls = ['cell'];
    if (side === 1) cls.push('enemy');
    if (!u) cls.push('empty');
    if (side === 0 && !u && (has(summon, c) || has(moves, c))) cls.push('playable');
    if (side === 0 && has(targetCells, c)) cls.push('targetable');
    if (side === 1 && intentCell && intentCell.lane === lane && intentCell.row === row && !u) cls.push('intent');
    if (side === 0 && dark.has(lane)) cls.push('dark');
    return (
      <div
        key={`${side}-${lane}-${row}`}
        className={cls.join(' ')}
        data-testid={`cell-${side}-${lane}-${row}`}
        onClick={() => (side === 0 ? store.clickCell(c) : store.clearSelection())}
      >
        {lane === 0 && (
          <span className={`rowlabel${targetRows.has(row) && side === 0 ? ' targetable' : ''}`} onClick={(e) => (e.stopPropagation(), store.clickRow(row))}>
            {ROW_NAMES[row]}
          </span>
        )}
        {u && <UnitView st={view} u={u} selected={u.id === selectedUnit} targetable={targetUnits.has(u.id)} onClick={() => store.clickUnit(u)} />}
        {!u && side === 1 && intentCell && intentCell.lane === lane && intentCell.row === row && <span className="intent-mark">next</span>}
      </div>
    );
  };

  return (
    <div className="board" style={{ width: BOARD_W, height: BOARD_H }} data-testid="board">
      <div className="lanes">
        {LANE_NAMES.map((n, i) => (
          <div key={n} className={`lane-label${targetLanes.has(i as Lane) ? ' targetable' : ''}${intentCell?.lane === i ? ' preferred' : ''}${dark.has(i as Lane) ? ' dark' : ''}`} onClick={() => store.clickLane(i)}>
            Lane {n}
          </div>
        ))}
      </div>
      <div className="grid" data-testid="grid-enemy">{([2, 1, 0] as Row[]).map((row) => ([0, 1, 2, 3] as Lane[]).map((lane) => cell(1, lane, row)))}</div>
      <div className="divider">
        <span className="face">⚔</span>
      </div>
      <div className="grid" data-testid="grid-player">{([0, 1, 2] as Row[]).map((row) => ([0, 1, 2, 3] as Lane[]).map((lane) => cell(0, lane, row)))}</div>
      <Arrows st={state} busy={store.busy} />
      <Pops pops={store.pops} />
    </div>
  );
}

function UnitView({ st, u, selected, targetable, onClick }: { st: BattleState; u: Unit; selected: boolean; targetable: boolean; onClick: () => void }) {
  const hp = hpOf(st, u);
  const max = effectiveMaxHp(st, u);
  const atk = effectiveAtk(st, u);
  const shield = u.shield + u.shieldPersist;
  const taunt = tauntLanes(st, u).length > 0;
  return (
    <div
      className={`unit${u.side === 0 ? ' mine' : ' theirs'}${selected ? ' selected' : ''}${targetable ? ' targetable' : ''}`}
      data-testid={`unit-${u.id}`}
      data-name={u.name}
      onClick={(e) => (e.stopPropagation(), onClick())}
      title={`${u.name} ${atk}/${hp}`}
    >
      <Sprite unitKey={u.key} level={u.level} scale={1} />
      <div className="ustats">
        <span className="atk">{atk}⚔</span>
        <span className={`hp${hp < max ? ' hurt' : ''}`}>{hp}♥</span>
      </div>
      {u.level > 1 && <span className={`level-mark l${u.level}`}>{u.level === 2 ? '✦✦' : '✦✦✦'}</span>}
      <div className="badges">
        {shield > 0 && <span className="badge shield">S{shield}</span>}
        {u.burn > 0 && <span className="badge burn">B{u.burn}</span>}
        {u.poison > 0 && <span className="badge poison">P{u.poison}</span>}
        {u.stunned && <span className="badge stun">Z</span>}
        {taunt && <span className="badge taunt">T</span>}
      </div>
      <span className="uname">{u.name}</span>
    </div>
  );
}

/** Live Clash preview: one arrow per projected hit, labelled with its damage. Hidden while animating. */
function Arrows({ st, busy }: { st: BattleState; busy: boolean }) {
  if (busy || st.phase !== 'action') return <svg className="arrows" width={BOARD_W} height={BOARD_H} />;
  const arrows = previewClash(st);
  return (
    <svg className="arrows" width={BOARD_W} height={BOARD_H} data-testid="arrows" data-count={arrows.length}>
      <defs>
        <marker id="ah-p" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#feae34" />
        </marker>
        <marker id="ah-e" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#e43b44" />
        </marker>
      </defs>
      {arrows.map((a, i) => {
        const from = cellCentre(a.attackerSide, { lane: a.from.lane as Lane, row: a.from.row as Row });
        const to = a.to ? cellCentre(a.attackerSide === 0 ? 1 : 0, { lane: a.to.lane as Lane, row: a.to.row as Row }) : facePoint(a.attackerSide === 0 ? 1 : 0, a.from.lane);
        const col = a.attackerSide === 0 ? '#feae34' : '#e43b44';
        // Shorten so heads don't sit under the sprite, and offset player/enemy arrows so they don't overlap.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const off = a.attackerSide === 0 ? 10 : -10;
        const x1 = from.x + ux * 22 + off;
        const y1 = from.y + uy * 22;
        const x2 = to.x - ux * (a.to ? 26 : 2) + off;
        const y2 = to.y - uy * (a.to ? 26 : 2);
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        return (
          <g key={i} opacity={0.9}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={col} strokeWidth={2} strokeDasharray={a.shape === 'lob' || a.shape === 'shoot' || a.shape === 'pierce' ? '5 3' : undefined} markerEnd={`url(#${a.attackerSide === 0 ? 'ah-p' : 'ah-e'})`} />
            <rect x={mx - 10} y={my - 8} width={20} height={14} fill="#181425" stroke={col} strokeWidth={1} />
            <text x={mx} y={my + 3} textAnchor="middle" fill={col}>
              {a.damage}
            </text>
          </g>
        );
      })}
      <text x={BOARD_W - 4} y={DIVIDER_Y - 8} textAnchor="end" fill="#8b9bb4" fontSize={10}>
        preview
      </text>
    </svg>
  );
}

function Pops({ pops }: { pops: Pop[] }) {
  return (
    <>
      {pops.map((p, i) => {
        const at = p.at.cell ? cellCentre(p.at.side, p.at.cell) : facePoint(p.at.side, 1.5);
        const cls = p.kind === 'dmg' ? 'dmg' : p.kind === 'heal' ? 'heal' : p.kind === 'face' || p.kind === 'embers' ? 'face' : 'status';
        return (
          <span key={p.key} className={`pop ${cls}`} style={{ left: at.x - 10 + (i % 3) * 8, top: at.y - 14 - Math.floor(i / 3) * 10 }}>
            {p.text}
          </span>
        );
      })}
    </>
  );
}
