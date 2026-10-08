import { cardsById, content } from '../../content/cards';
import { defFor, cardKey } from '../../core/battle/defs';
import type { Level } from '../../core/types';
import { Sprite } from '../sprites';
import { Keywords, traitTip } from '../tooltip';

/** A card outside battle: sprite, name, traits, both halves. `size` 'mini' for lines and decks, 'full' for detail. */
export function CardFace({
  cardId,
  level = 1,
  size = 'mini',
  badge,
  price,
  selected,
  dim,
  echo,
  sigil,
  temper,
  onClick,
  testId,
}: {
  cardId: number;
  level?: Level;
  size?: 'mini' | 'full';
  badge?: string;
  price?: number;
  selected?: boolean;
  dim?: boolean;
  echo?: boolean;
  sigil?: string;
  temper?: number;
  onClick?: () => void;
  testId?: string;
}) {
  const card = cardsById.get(cardId);
  if (!card) return null;
  const def = defFor(cardKey(cardId), level);
  const traits = [...def.traits, ...(sigil && !def.traits.includes(sigil as never) ? [sigil] : [])];
  const cls = ['face', size, `l${level}`];
  if (selected) cls.push('selected');
  if (dim) cls.push('dim');
  if (onClick) cls.push('clickable');
  return (
    <div className={cls.join(' ')} onClick={onClick} data-testid={testId} data-card={cardId} title={`${def.name}: ${def.text} ${def.spellName} (${def.spellCost}✦): ${def.spellText}`}>
      <div className="fhead">
        <span className="fname">{def.name}</span>
        <span className="frar">{card.rarity}</span>
      </div>
      <div className="fart">
        <Sprite unitKey={cardKey(cardId)} level={level} scale={size === 'full' ? 4 : 2} />
        {price !== undefined && <span className={`fprice${price === 0 ? ' free' : ''}`}>{price === 0 ? 'free' : `${price}✦`}</span>}
        {badge && <span className="fbadge">{badge}</span>}
        {echo && <span className="fecho">Echo</span>}
        {level > 1 && <span className={`flevel l${level}`}>{level === 2 ? 'Flame' : 'Fire'}</span>}
      </div>
      <div className="ftraits">
        {traits.map((t) => (
          <span key={t} className="tchip" style={{ color: content.traits[t as keyof typeof content.traits].col, borderColor: content.traits[t as keyof typeof content.traits].col }} data-tip={traitTip(t)}>
            {t}
          </span>
        ))}
      </div>
      <div className="fstats">
        {def.atk + (temper ?? 0)}/{def.hp + (temper ?? 0)} {def.shape}
        {temper ? <span className="ftemper"> +{temper}</span> : null}
      </div>
      {size === 'full' && (
        <>
          <div className="half">
            <Keywords text={def.text} />
          </div>
          <div className="half spell">
            <div className="head">
              <span>{def.spellName}</span>
              <span>{def.spellCost}✦</span>
            </div>
            <Keywords text={def.spellText} />
          </div>
        </>
      )}
    </div>
  );
}
