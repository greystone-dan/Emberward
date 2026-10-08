import { Fragment, useEffect, useState } from 'react';
import { content } from '../content/cards';
import { TRAITS, type Trait } from '../content/types';

/**
 * Keyword tooltips (SPEC §7 and §8). `Keywords` wraps every known keyword in a piece of rules text with a
 * data-tip; `TooltipLayer` shows one floating tooltip for whatever `[data-tip]` the mouse is over, so every
 * keyword and trait on any screen explains itself on hover.
 */

export const GLOSSARY: Record<string, string> = {
  Shield: 'Shield N: absorbs N damage before health. Expires at Wave End unless an effect says otherwise.',
  Burn: 'Burn N: at Wave End the unit takes N damage, then each neighbour that is not Burning catches Burn ⌊N/2⌋, then N drops by 1.',
  Poison: 'Poison N: at Wave End the unit takes N damage that ignores Shield, then N drops by 1.',
  Stun: 'Stunned: the unit skips its next attack.',
  Stunned: 'Stunned: the unit skips its next attack.',
  Taunt: 'Taunt: enemies ahead of this unit must attack it instead of what is behind it. "Covering both neighbouring lanes" extends that to the lanes beside it.',
  Swift: 'Swift N: N free steps per wave. Steps beyond that cost 1✦ each.',
  Rooted: 'Rooted: cannot move, except by an effect that says "even if Rooted".',
  Kindle: 'Kindle: triggers when the card is summoned.',
  'Last Gasp': 'Last Gasp: triggers when the unit dies.',
  'Wave Start': 'Wave Start: triggers at the start of each wave, after wave 1.',
  'Wave End': 'Wave End: triggers after the Clash, before the next wave.',
  Aura: 'Aura (direction): a continuous effect on the units in that direction, recomputed from the board.',
  Pull: 'Pull: moves an enemy toward its own Front row. A blocked pull does nothing.',
  Persist: 'Persist: the unit stays on the board into the next battle, in its cell.',
  Wisp: 'Wisp: a 1/1 Spirit token with Strike. Tokens do not count toward trait tiers.',
  Rubble: 'Rubble: a 0/3 Rooted token with no traits and no attack.',
  'Bone Wall': 'Bone Wall: a 0/N Rooted token with no traits and no attack.',
  Chorister: 'Chorister: a 1/1 token with an Aura (Beside): +1 Power.',
  Kinship: 'Kinship: +1/+1 for each orthogonal neighbour sharing a trait, up to +2/+2.',
  Strike: 'Strike: hits the enemy ahead in its lane, or the face if the lane is open.',
  Shoot: 'Shoot: hits the frontmost enemy in its lane from any row.',
  Pierce: 'Pierce: hits the first two enemies in its lane.',
  Cleave: 'Cleave: hits the enemy ahead and the ones beside it.',
  Lob: 'Lob: hits the backmost enemy in its lane.',
  Ahead: 'Ahead: the cell in front of this one, toward the enemy.',
  Behind: 'Behind: the cell behind this one, away from the enemy.',
  Beside: 'Beside: the cells to the left and right in the same row.',
  Across: 'Across: the enemy cell facing this one in the same lane and row.',
  Around: 'Around: the cell and its orthogonal neighbours.',
  Power: 'Power: the damage a unit deals with each hit.',
  Clash: 'The Clash: when both sides pass, units attack row by row (Front, Mid, Back). Arrows preview it.',
  Muster: 'Muster: before a battle, choose up to 10 cards from your deck to bring.',
  Drift: 'The Drift: a line of cards after each fight. The front two are free; each place further back costs 1✦ more.',
  Rekindle: 'Rekindling: three copies of a card merge into one of the next level (Spark → Flame → Fire), thinning the deck.',
  Rekindling: 'Rekindling: three copies of a card merge into one of the next level (Spark → Flame → Fire), thinning the deck.',
  Sigil: 'Sigil: inscribes an extra trait on a card for the rest of the run. One per card.',
  Echo: 'Echo: a copy of a card you already own, offered toward a Rekindle.',
  Omens: 'Omens: three traits that appear 1.5× as often in this act’s Drifts.',
  Embers: 'Embers (✦): the one resource. Summoning is free; spells, paid steps, Drift reaches and the market cost embers.',
  Dark: 'A dark lane: your units in it cannot attack and spells cannot target it. The boss snuffs lanes a wave ahead.',
};

for (const t of TRAITS as readonly Trait[]) {
  const def = content.traits[t];
  if (def) GLOSSARY[t] = `${t} (${def.kind}): ${def.what} ${def.tiers.map((x) => `${x.n}: ${x.text}`).join(' ')}`;
}

const KEYS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const RE = new RegExp(`\\b(${KEYS.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`, 'g');

/** Rules text with every keyword wrapped for hover. */
export function Keywords({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(RE);
  return (
    <>
      {parts.map((p, i) =>
        GLOSSARY[p] ? (
          <span key={i} className="kw" data-tip={GLOSSARY[p]}>
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

export function traitTip(t: string): string {
  return GLOSSARY[t] ?? t;
}

/** One floating tooltip for whatever [data-tip] the mouse is over. */
export function TooltipLayer() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null;
      if (!el) {
        setTip(null);
        return;
      }
      const r = el.getBoundingClientRect();
      const app = document.querySelector('.app')?.getBoundingClientRect() ?? { left: 0, top: 0 };
      setTip({ text: el.dataset.tip ?? '', x: r.left - app.left + r.width / 2, y: r.bottom - app.top + 6 });
    };
    const out = () => setTip(null);
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', out);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', out);
    };
  }, []);
  if (!tip) return null;
  const left = Math.min(Math.max(tip.x, 150), 1280 - 150);
  const flip = tip.y > 600;
  return (
    <div className={`tooltip${flip ? ' up' : ''}`} style={{ left, top: flip ? undefined : tip.y, bottom: flip ? 720 - tip.y + 30 : undefined }} data-testid="tooltip" role="tooltip">
      {tip.text}
    </div>
  );
}
