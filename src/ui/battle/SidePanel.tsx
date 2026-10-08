import { activeTiers, traitCounts } from '../../core/battle/stats';
import { content } from '../../content/cards';
import type { BattleState, Side } from '../../core/types';
import { traitTip } from '../tooltip';

/** Active trait tiers for both sides and the battle log. */
export function SidePanel({ state, log }: { state: BattleState; log: string[] }) {
  return (
    <div className="side">
      <Tiers state={state} side={0} title="Your traits" />
      <Tiers state={state} side={1} title="Enemy traits" />
      <div className="panel-title">Log</div>
      <div className="log" data-testid="log">
        {log.slice(-12).map((l, i, arr) => (
          <div key={log.length - arr.length + i} className={i === arr.length - 1 ? 'hot' : ''}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

function Tiers({ state, side, title }: { state: BattleState; side: Side; title: string }) {
  const counts = [...traitCounts(state, side)].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const active = new Map(activeTiers(state, side).map((t) => [t.trait, t.n]));
  return (
    <>
      <div className="panel-title">{title}</div>
      <div className="tiers" data-testid={`tiers-${side}`}>
        {counts.length === 0 && <div className="tier t">none on the board</div>}
        {counts.slice(0, 6).map(([trait, n]) => {
          const def = content.traits[trait];
          const tier = active.get(trait);
          const next = def.tiers.find((t) => t.n > n);
          return (
            <div key={trait} className="tier" style={{ color: tier ? def.col : undefined }} data-tip={traitTip(trait)}>
              <span className="n">{n}</span>
              <span>{trait}</span>
              <span className="t">{tier ? def.tiers.find((t) => t.n === tier)?.text : next ? `(${next.n} for a bonus)` : ''}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
