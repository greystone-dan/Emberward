import raw from '../../content/cards.json';

// Typed loader for the card data (source of truth: content/cards.json). Fields not yet typed stay unknown.
export interface CardData {
  id: number;
  name: string;
  rar: string;
  atk: number;
  hp: number;
  text: string;
}

export const cards = raw.cards as unknown as CardData[];
