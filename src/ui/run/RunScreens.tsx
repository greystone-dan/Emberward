import { useState } from 'react';
import { FLAGS } from '../../config/flags';
import { content } from '../../content/cards';
import { TRAITS, type Trait } from '../../content/types';
import { previewNextLine } from '../../core/run/drift';
import { reachable } from '../../core/run/map';
import { canInscribe, cardName, encounterName, priceAt } from '../../core/run/run';
import type { MapNode, RunCard, RunState } from '../../core/run/types';
import { defFor, cardKey } from '../../core/battle/defs';
import { Sprite } from '../sprites';
import type { RunStore } from '../runStore';
import { CardFace } from './CardFace';
import { Coach, tutorialWanted } from '../tutorial';
import { eliteConfig, bossConfig, fightConfig } from '../../core/run/encounters';

// ---------- shared ----------

export function TopBar({ store, run, title }: { store: RunStore; run: RunState; title: string }) {
  return (
    <div className="runbar" data-testid="runbar">
      <span className="rtitle">{title}</span>
      <span className="rwarden">{run.wardenName}</span>
      <span className="rhp" data-testid="run-hp">
        {run.hp}/{run.maxHp} ♥
      </span>
      <span className="embers" data-testid="run-embers">
        {run.embers}✦
      </span>
      <span className="rdeck">{run.deck.length} cards</span>
      {run.sigils > 0 && (
        <button className="small" onClick={() => store.setPicking(store.picking === 'sigil' ? null : 'sigil')} data-testid="btn-sigil">
          Sigils: {run.sigils}
        </button>
      )}
      <span className="rrelics" title={run.relics.map((r) => `${r}: ${relicText(r)}`).join('\n')}>
        {run.relics.map((r) => (
          <span key={r} className="relic" title={relicText(r)}>
            {r}
          </span>
        ))}
      </span>
      <span className="romens" title="Omens: these traits appear more often this act">
        Omens: {run.omens.join(' · ')}
      </span>
    </div>
  );
}

export function relicText(name: string): string {
  const r = content.relics.find((x) => x.name === name);
  if (r) return r.text;
  const w = content.wardens.find((x) => x.relic.startsWith(name));
  return w ? w.relic.split(':').slice(1).join(':').trim() : '';
}

/** The deck as a strip of mini faces; optional click handler for pick screens. */
export function DeckStrip({ run, onPick, selectable, label }: { run: RunState; onPick?: (c: RunCard) => void; selectable?: (c: RunCard) => boolean; label?: string }) {
  return (
    <div className="deckpanel" data-testid="deck">
      <div className="panel-title">{label ?? `Your deck (${run.deck.length})`}</div>
      <div className="faces">
        {run.deck.map((c) => (
          <CardFace key={c.uid} cardId={c.cardId} level={c.level} sigil={c.sigil} temper={c.temper} dim={selectable ? !selectable(c) : false} onClick={onPick && (!selectable || selectable(c)) ? () => onPick(c) : undefined} testId={`deck-${c.uid}`} />
        ))}
      </div>
    </div>
  );
}

export function RekindleModal({ store, run }: { store: RunStore; run: RunState }) {
  if (run.rekindle.length === 0 || run.rekindlePostponed || run.phase === 'battle') return null;
  const o = run.rekindle[0]!;
  return (
    <div className="overlay" data-testid="rekindle">
      <h1>Rekindle</h1>
      <p>
        You hold {o.copies} {o.level === 1 ? 'Sparks' : 'Flames'} of {cardName(o.cardId)}. Three become one {o.level === 1 ? 'Flame' : 'Fire'}; the deck grows two cards shorter.
      </p>
      <div className="faces">
        <CardFace cardId={o.cardId} level={o.level} />
        <span className="arrow">→</span>
        <CardFace cardId={o.cardId} level={(o.level + 1) as 2 | 3} />
      </div>
      <div className="row">
        <button className="primary" onClick={() => store.dispatch({ type: 'rekindle', cardId: o.cardId, level: o.level })} data-testid="btn-rekindle">
          Rekindle
        </button>
        <button onClick={() => store.dispatch({ type: 'postponeRekindle' })}>Later (next Hearth or Market)</button>
      </div>
    </div>
  );
}

export function SigilPicker({ store, run }: { store: RunStore; run: RunState }) {
  if (store.picking !== 'sigil' || run.sigils <= 0) return null;
  const trait = store.sigilTrait as Trait | null;
  return (
    <div className="overlay" data-testid="sigil-picker">
      <h1>Inscribe a Sigil</h1>
      <p>Pick a trait, then the card that will carry it for the rest of the run. One Sigil per card; no Origin on an Abyssal.</p>
      <div className="traitgrid">
        {TRAITS.map((t) => (
          <button key={t} className={trait === t ? 'primary' : ''} style={{ borderColor: content.traits[t].col }} onClick={() => store.setSigilTrait(t)}>
            {t}
          </button>
        ))}
      </div>
      {trait && <DeckStrip run={run} selectable={(c) => canInscribe(c, trait)} onPick={(c) => store.dispatch({ type: 'inscribe', uid: c.uid, trait })} label="Choose the card" />}
      <button onClick={() => store.setPicking(null)}>Cancel</button>
    </div>
  );
}

// ---------- screens ----------

export function TitleScreen({ store }: { store: RunStore }) {
  return (
    <div className="screen title" data-testid="title">
      <div className="embers-rise" aria-hidden>
        {Array.from({ length: 14 }, (_, i) => (
          <i key={i} style={{ left: `${8 + i * 6.3}%`, animationDelay: `${(i * 0.53) % 7}s`, animationDuration: `${6 + (i % 4)}s` }} />
        ))}
      </div>
      <div className="lantern">
        <Sprite unitKey="placeholder" level={1} scale={5} />
      </div>
      <h1>Emberward</h1>
      <p className="tag">Carry the lantern down the drowned stair.</p>
      <div className="row">
        <button className="primary" onClick={() => store.newRun()} data-testid="btn-new-run">
          New run
        </button>
        {store.hasSave() && (
          <button onClick={() => store.resume()} data-testid="btn-continue-run">
            Continue run
          </button>
        )}
      </div>
      <p className="muted">Mouse and keyboard. 1280×720 or larger.</p>
    </div>
  );
}

export function WardenSelect({ store, run }: { store: RunStore; run: RunState }) {
  const unlocked = store.sextonUnlocked();
  void run;
  return (
    <div className="screen" data-testid="warden-select">
      <h1>Choose your Warden</h1>
      <p className="hint wardens-hint">Each Warden carries a lantern down the same stair with a different deck, a different leaning and one relic. The Bell-Keeper is the safest first descent.</p>
      <div className="wardens">
        {content.wardens.map((w, i) => {
          const locked = w.locked && !unlocked;
          return (
            <div key={w.name} className={`wardencard${locked ? ' locked' : ''}`} data-testid={`warden-${i}`}>
              <div className="wportrait">
                <Sprite unitKey={cardKey(w.deck[w.deck.length - 1]!)} scale={4} />
              </div>
              <h2>{w.name}</h2>
              <div className="worigin" style={{ color: content.traits[w.origin].col }}>
                {w.origin}
              </div>
              <div className="wrelic">{w.relic}</div>
              <div className="faces small">
                {w.deck.map((id, k) => (
                  <span key={k} className="minisprite" title={cardName(id)}>
                    <Sprite unitKey={cardKey(id)} scale={2} />
                  </span>
                ))}
              </div>
              <div className="muted">{w.deck.map((id) => cardName(id)).join(', ')}</div>
              <button className="primary" disabled={locked} onClick={() => store.dispatch({ type: 'chooseWarden', warden: i })} data-testid={`btn-warden-${i}`}>
                {locked ? 'Locked: win a run' : 'Take up the lantern'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DriftScreen({ store, run }: { store: RunStore; run: RunState }) {
  const [inspect, setInspect] = useState<number | null>(null);
  const opening = run.visited.length === 0;
  const [coach, setCoach] = useState(() => tutorialWanted('drift'));
  const canSkip = store.legal().some((a) => a.type === 'driftSkip');
  return (
    <div className="screen" data-testid="drift">
      <TopBar store={store} run={run} title={opening ? 'The opening Drift' : 'The Drift'} />
      <p className="hint">
        {run.drift.takes > 0 ? `Take ${run.drift.takes} card${run.drift.takes === 1 ? '' : 's'}. The front ${run.relics.includes('Long Wick') ? 'three' : 'two'} are free; each place behind costs 1✦ more.` : 'The Drift has passed.'}
        {run.drift.doubled ? ' Paid reaches cost double this time.' : ''}
      </p>
      <div className="river">
        {run.drift.line.map((c, i) => {
          const price = priceAt(run, i);
          const can = run.drift.takes > 0 && price <= run.embers;
          return (
            <div key={`${i}-${c.cardId}`} className={`slot${can ? '' : ' cant'}`} data-testid={`drift-slot-${i}`}>
              <CardFace cardId={c.cardId} price={price} echo={c.echo} onClick={() => setInspect(c.cardId)} />
              <button className="primary small" disabled={!can} onClick={() => store.dispatch({ type: 'driftTake', slot: i })} data-testid={`btn-take-${i}`}>
                Take
              </button>
            </div>
          );
        })}
      </div>
      <div className="row">
        {canSkip && <button onClick={() => store.dispatch({ type: 'driftSkip' })}>Let it pass (+{FLAGS.driftSkipReward}✦)</button>}
        <button onClick={() => store.dispatch({ type: 'driftDone' })} data-testid="btn-drift-done">
          {run.drift.takes > 0 ? 'Take nothing more' : 'Continue'}
        </button>
      </div>
      <div className="split">
        <DeckStrip run={run} />
        {inspect !== null && <CardFace cardId={inspect} size="full" />}
      </div>
      <RekindleModal store={store} run={run} />
      <SigilPicker store={store} run={run} />
      {coach && run.rekindle.length === 0 && <Coach tour="drift" onDone={() => setCoach(false)} />}
    </div>
  );
}

const NODE_GLYPH: Record<MapNode['type'], string> = { fight: '⚔', elite: '☠', market: '⚖', hearth: '♨', shrine: '✧', scout: '👁', boss: '☗' };
const NODE_NAME: Record<MapNode['type'], string> = { fight: 'Fight', elite: 'Elite', market: 'Market', hearth: 'Hearth', shrine: 'Shrine', scout: 'Scout', boss: 'The Lamplighter Who Drowned' };

export function MapScreen({ store, run }: { store: RunStore; run: RunState }) {
  const next = reachable(run.map, run.at);
  const W = FLAGS.mapWidth;
  const H = FLAGS.mapHeight;
  const cw = 92;
  const ch = 38;
  const px = (n: MapNode) => ({ x: n.x * cw + cw / 2, y: (H - 1 - n.y) * ch + ch / 2 + 18 });
  const preview = previewNextLine(run.drift);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="screen" data-testid="map">
      <TopBar store={store} run={run} title="The Stair" />
      <div className="split">
        <div className="mapwrap">
          <svg className="mapsvg" width={W * cw} height={H * ch + 20} data-testid="map-svg">
            {run.map.map((n) =>
              n.next.map((to) => {
                const a = px(n);
                const b = px(run.map[to]!);
                const lit = run.visited.includes(n.id) && run.visited.includes(to);
                return <line key={`${n.id}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={lit ? '#feae34' : '#3a4466'} strokeWidth={lit ? 3 : 2} />;
              }),
            )}
            {run.map.map((n) => {
              const p = px(n);
              const here = n.id === run.at;
              const can = next.includes(n.id);
              const done = run.visited.includes(n.id);
              const scouted = run.scouted.includes(n.id);
              return (
                <g key={n.id} className={`node ${n.type}${can ? ' can' : ''}${here ? ' here' : ''}${done ? ' done' : ''}`} onClick={() => can && store.dispatch({ type: 'mapChoose', node: n.id })} onMouseEnter={() => setHover(n.id)} onMouseLeave={() => setHover(null)} data-testid={`node-${n.id}`} style={{ cursor: can ? 'pointer' : 'default' }}>
                  <circle cx={p.x} cy={p.y} r={n.type === 'boss' ? 16 : 13} fill={here ? '#feae34' : done ? '#3a4466' : can ? '#193c3e' : '#262b44'} stroke={can ? '#fee761' : n.type === 'elite' || n.type === 'boss' ? '#e43b44' : '#5a6988'} strokeWidth={can ? 3 : 2} />
                  <text x={p.x} y={p.y + 5} textAnchor="middle" fontSize={14} fill={here ? '#181425' : '#ead4aa'}>
                    {NODE_GLYPH[n.type]}
                  </text>
                  {(scouted || n.type === 'boss' || hover === n.id) && (
                    <text x={p.x} y={p.y - 17} textAnchor="middle" fontSize={10} fill="#2ce8f5">
                      {scouted || n.type === 'boss' ? encounterName(n) : NODE_NAME[n.type]}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="mapside">
          <div className="panel-title">Choose a path</div>
          <div className="hint">{next.length ? `${next.length} way${next.length === 1 ? '' : 's'} forward. Hover a node to see what it is.` : 'The stair ends here.'}</div>
          <div className="legend">
            {(Object.keys(NODE_GLYPH) as MapNode['type'][]).map((t) => (
              <span key={t}>
                {NODE_GLYPH[t]} {NODE_NAME[t]}
              </span>
            ))}
          </div>
          <div className="panel-title">Next Drift</div>
          <div className="faces small" data-testid="drift-preview">
            {preview.map((c, i) => (
              <span key={i} className="minisprite" title={`${cardName(c.cardId)} (${priceAt({ ...run, drift: { ...run.drift, line: preview } }, i) || 'free'})`}>
                <Sprite unitKey={cardKey(c.cardId)} scale={1} />
              </span>
            ))}
          </div>
          <DeckStrip run={run} />
        </div>
      </div>
      <RekindleModal store={store} run={run} />
      <SigilPicker store={store} run={run} />
    </div>
  );
}

export function MusterScreen({ store, run }: { store: RunStore; run: RunState }) {
  const node = run.map[run.at]!;
  const enemy = node.type === 'boss' ? bossConfig() : node.type === 'elite' ? eliteConfig(node.encounter) : fightConfig(node.encounter);
  const chosen = new Set(run.muster);
  const toggle = (c: RunCard) => {
    const uids = chosen.has(c.uid) ? run.muster.filter((u) => u !== c.uid) : [...run.muster, c.uid];
    if (uids.length <= FLAGS.musterLimit) store.dispatch({ type: 'musterSet', uids });
  };
  const rule = node.type === 'elite' ? content.elites[node.encounter]?.rule : node.type === 'boss' ? content.boss.rule : content.fights[node.encounter]?.lesson;
  return (
    <div className="screen" data-testid="muster">
      <TopBar store={store} run={run} title={`Muster: ${enemy.wardenName}`} />
      <div className="split">
        <div className="enemyside">
          <div className="panel-title">
            Enemy deck ({enemy.cards.length}) · {enemy.hp} ♥ · {enemy.embers}✦
          </div>
          <div className="faces small">
            {enemy.cards.map((c, i) => {
              const def = defFor(c.key, c.level);
              return (
                <div key={i} className={`face mini enemy${i < 3 ? ' firstwave' : ''}`} title={`${def.name}: ${def.text}`}>
                  <div className="fhead">
                    <span className="fname">{def.name}</span>
                  </div>
                  <div className="fart">
                    <Sprite unitKey={c.key} level={c.level} scale={2} />
                    {i < 3 && <span className="fbadge">wave 1</span>}
                  </div>
                  <div className="fstats">
                    {def.atk}/{def.hp} {def.shape}
                  </div>
                </div>
              );
            })}
            {(enemy.board ?? []).map((b, i) => (
              <div key={`b${i}`} className="face mini enemy firstwave" title="Already on the board">
                <div className="fhead">
                  <span className="fname">{defFor(b.key, b.level ?? 1).name}</span>
                </div>
                <div className="fart">
                  <Sprite unitKey={b.key} level={b.level ?? 1} scale={2} />
                  <span className="fbadge">on board</span>
                </div>
              </div>
            ))}
          </div>
          {rule && <p className="muted">{rule}</p>}
        </div>
        <div className="musterside">
          <div className="panel-title">
            Bring up to {FLAGS.musterLimit} · {run.muster.length} chosen
          </div>
          <div className="faces">
            {run.deck.map((c) => (
              <CardFace key={c.uid} cardId={c.cardId} level={c.level} sigil={c.sigil} temper={c.temper} selected={chosen.has(c.uid)} dim={!chosen.has(c.uid)} onClick={() => toggle(c)} testId={`muster-${c.uid}`} />
            ))}
          </div>
          <button className="primary" disabled={run.muster.length === 0} onClick={() => store.dispatch({ type: 'musterConfirm' })} data-testid="btn-muster-confirm">
            To battle
          </button>
        </div>
      </div>
      <RekindleModal store={store} run={run} />
      <SigilPicker store={store} run={run} />
    </div>
  );
}

export function RewardScreen({ store, run }: { store: RunStore; run: RunState }) {
  const r = run.result!;
  const anchor = run.relics.includes('Anchorstone');
  const kind = r.kind === 'boss' ? 'The Lamplighter Who Drowned' : r.kind === 'elite' ? 'The elite' : 'The patrol';
  const line = r.won
    ? r.outcome === 'kill'
      ? `${kind} is snuffed. The stair is quiet for a while.`
      : `${kind} falls back when the sixth wave breaks. You hold the stair.`
    : `${kind} drives you back down the stair. You lose ${r.hpLost} health.`;
  const rows: [string, string][] = [[r.won ? 'Pay' : 'Salvage', `+${r.pay}✦`]];
  if (r.won && r.interest > 0) rows.push(['Interest', `+${r.interest}✦`]);
  if (r.relic) rows.push(['Relic', `${r.relic}: ${relicText(r.relic)}`]);
  if (r.sigil) rows.push(['Sigil', 'a trait of your choosing, set into one card']);
  return (
    <div className="screen" data-testid="reward">
      <TopBar store={store} run={run} title={r.won ? 'Victory' : 'The enemy retreats'} />
      <div className="reward">
        <div className="reward-tablet">
          <div className="reward-head">{r.won ? 'The lane holds' : 'The light gutters'}</div>
          <p className="reward-line">{line}</p>
          <div className="reward-rows">
            {rows.map(([k, v]) => (
              <div key={k} className="reward-row">
                <span className="reward-k">{k}</span>
                <span className="reward-v">{v}</span>
              </div>
            ))}
          </div>
          {anchor && r.survivors.length > 0 && (
            <>
              <div className="panel-title">Anchorstone: one survivor persists</div>
              <div className="faces">
                {r.survivors.map((s, i) => (
                  <div key={i} className={`face mini${r.persisted && r.persisted.lane === s.lane && r.persisted.row === s.row ? ' selected' : ''}`} onClick={() => store.dispatch({ type: 'persistChoose', index: i })}>
                    <div className="fhead">
                      <span className="fname">{s.name}</span>
                    </div>
                    <div className="fart">
                      <Sprite unitKey={s.key} level={s.level} scale={2} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <button className="primary" onClick={() => store.dispatch({ type: 'continue' })} data-testid="btn-reward-continue">
            {r.kind === 'boss' ? 'Continue' : 'Continue to the Drift'}
          </button>
        </div>
      </div>
      <RekindleModal store={store} run={run} />
    </div>
  );
}

export function MarketScreen({ store, run }: { store: RunStore; run: RunState }) {
  const m = run.market!;
  const reroll = FLAGS.rerollBase + m.rerolls;
  const selling = store.picking === 'sell';
  return (
    <div className="screen" data-testid="market">
      <TopBar store={store} run={run} title="Market" />
      <div className="river">
        {m.cards.map((c, i) =>
          c ? (
            <div key={i} className="slot" data-testid={`market-slot-${i}`}>
              <CardFace cardId={c.cardId} price={m.cardPrices[i]} echo={c.echo} />
              <div className="row">
                <button className="primary small" disabled={(m.cardPrices[i] ?? 0) > run.embers} onClick={() => store.dispatch({ type: 'marketBuy', slot: i })} data-testid={`btn-buy-${i}`}>
                  Buy
                </button>
                <button className="small" disabled={m.held !== null} onClick={() => store.dispatch({ type: 'marketHold', slot: i })} title="Hold this card for the next market">
                  Hold
                </button>
              </div>
            </div>
          ) : (
            <div key={i} className="slot empty">
              <div className="face mini empty">sold</div>
            </div>
          ),
        )}
        <div className="slot">
          <div className="face mini relicface">
            <div className="fhead">
              <span className="fname">{m.relic ?? 'Relic sold'}</span>
            </div>
            <div className="fdesc">{m.relic ? relicText(m.relic) : ''}</div>
          </div>
          {m.relic && (
            <button className="primary small" disabled={m.relicPrice > run.embers} onClick={() => store.dispatch({ type: 'marketBuyRelic' })}>
              Buy {m.relicPrice}✦
            </button>
          )}
        </div>
        <div className="slot">
          <div className="face mini relicface">
            <div className="fhead">
              <span className="fname">Sigil</span>
            </div>
            <div className="fdesc">Inscribe a trait on a card for the run.</div>
          </div>
          {m.sigil && (
            <button className="primary small" disabled={FLAGS.sigilPrice > run.embers} onClick={() => store.dispatch({ type: 'marketBuySigil' })}>
              Buy {FLAGS.sigilPrice}✦
            </button>
          )}
        </div>
      </div>
      <div className="row">
        <button disabled={reroll > run.embers} onClick={() => store.dispatch({ type: 'marketReroll' })}>
          Reroll ({reroll}✦)
        </button>
        <button className={selling ? 'primary' : ''} onClick={() => store.setPicking(selling ? null : 'sell')}>
          {selling ? 'Click a card to sell it' : 'Sell a card'}
        </button>
        <button onClick={() => store.dispatch({ type: 'leave' })} data-testid="btn-leave">
          Leave
        </button>
      </div>
      <DeckStrip run={run} onPick={selling ? (c) => store.dispatch({ type: 'sell', uid: c.uid }) : undefined} label={selling ? 'Sell which? (half price)' : undefined} />
      <RekindleModal store={store} run={run} />
      <SigilPicker store={store} run={run} />
    </div>
  );
}

export function HearthScreen({ store, run }: { store: RunStore; run: RunState }) {
  const used = run.hearthUsed;
  const p = store.picking;
  const heal = Math.min(run.maxHp - run.hp, Math.ceil(run.maxHp * FLAGS.hearthHealFraction));
  return (
    <div className="screen" data-testid="hearth">
      <TopBar store={store} run={run} title="Hearth" />
      <p className="hint">A lantern-shrine in a flooded chapel. Rest once: heal, snuff a card from the deck, or temper one.</p>
      <div className="row">
        <button className="primary" disabled={used} onClick={() => store.dispatch({ type: 'hearthHeal' })} data-testid="btn-heal">
          Rest (+{heal} ♥)
        </button>
        <button className={p === 'snuff' ? 'primary' : ''} disabled={used} onClick={() => store.setPicking(p === 'snuff' ? null : 'snuff')}>
          Snuff a card
        </button>
        <button className={p === 'temper' ? 'primary' : ''} disabled={used} onClick={() => store.setPicking(p === 'temper' ? null : 'temper')}>
          Temper a card (+1/+1)
        </button>
        <button onClick={() => store.dispatch({ type: 'leave' })} data-testid="btn-leave">
          {used ? 'Back to the stair' : 'Leave without resting'}
        </button>
      </div>
      <DeckStrip run={run} onPick={p === 'snuff' ? (c) => store.dispatch({ type: 'hearthSnuff', uid: c.uid }) : p === 'temper' ? (c) => store.dispatch({ type: 'hearthTemper', uid: c.uid }) : undefined} label={p === 'snuff' ? 'Snuff which card?' : p === 'temper' ? 'Temper which card?' : undefined} />
      <RekindleModal store={store} run={run} />
      <SigilPicker store={store} run={run} />
    </div>
  );
}

export function ShrineScreen({ store, run }: { store: RunStore; run: RunState }) {
  const s = run.shrine!;
  const ev = content.events[s.event]!;
  return (
    <div className="screen" data-testid="shrine">
      <TopBar store={store} run={run} title={ev.name} />
      <div className="shrine">
        <p className="flavour">{ev.flavour}</p>
        {s.chosen === null ? (
          <div className="options">
            {ev.options.map((o, i) => (
              <button key={i} onClick={() => store.dispatch({ type: 'shrineChoose', option: i })} data-testid={`btn-shrine-${i}`}>
                {o}
              </button>
            ))}
          </div>
        ) : s.needsPick ? (
          <DeckStrip run={run} onPick={(c) => store.dispatch({ type: 'shrinePick', uid: c.uid })} label={s.needsPick === 'remove' ? 'Remove which card?' : s.needsPick === 'duplicate' ? 'Duplicate which card?' : 'Rekindle which pair?'} selectable={s.needsPick === 'rekindle' ? (c) => run.deck.filter((x) => x.cardId === c.cardId && x.level === c.level).length >= 2 : undefined} />
        ) : (
          <>
            <p>{run.log[run.log.length - 1]}</p>
            <button className="primary" onClick={() => store.dispatch({ type: 'leave' })} data-testid="btn-leave">
              Continue
            </button>
          </>
        )}
      </div>
      <RekindleModal store={store} run={run} />
    </div>
  );
}

export function ScoutScreen({ store, run }: { store: RunStore; run: RunState }) {
  const names = run.scouted.map((id) => run.map[id]!).filter((n) => n.y > (run.map[run.at]?.y ?? 0));
  return (
    <div className="screen" data-testid="scout">
      <TopBar store={store} run={run} title="Scout" />
      <p className="hint">From this ledge you can see what waits below.</p>
      <ul className="scoutlist">
        {names.map((n) => (
          <li key={n.id}>
            Row {n.y + 1}: {encounterName(n)}
          </li>
        ))}
      </ul>
      <button className="primary" onClick={() => store.dispatch({ type: 'leave' })} data-testid="btn-leave">
        Back to the stair
      </button>
    </div>
  );
}

export function RunOverScreen({ store, run }: { store: RunStore; run: RunState }) {
  return (
    <div className="screen title" data-testid="run-over">
      <h1 className={run.won ? '' : 'lost'}>{run.won ? 'The light holds.' : 'The light goes out.'}</h1>
      <p>
        {run.wardenName} · {run.battlesWon} battles won · {run.visited.length} steps down the stair · {run.deck.length} cards.
      </p>
      {run.won && <p className="muted">The Sexton is unlocked.</p>}
      <div className="row">
        <button className="primary" onClick={() => store.newRun(`${Date.now()}`)} data-testid="btn-new-run">
          New run
        </button>
        <button onClick={() => store.toTitle()}>Title</button>
      </div>
    </div>
  );
}
