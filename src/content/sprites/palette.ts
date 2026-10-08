/**
 * Endesga 32 by Endesga (via Lospec). The only colours allowed anywhere in Emberward's art and UI.
 * Index i is addressed in sprite grids by PALETTE_CHARS[i]; '.' is transparent.
 */
export const ENDESGA32: readonly string[] = [
  '#be4a2f', '#d77643', '#ead4aa', '#e4a672', '#b86f50', '#733e39', '#3e2731', '#a22633',
  '#e43b44', '#f77622', '#feae34', '#fee761', '#63c74d', '#3e8948', '#265c42', '#193c3e',
  '#124e89', '#0099db', '#2ce8f5', '#ffffff', '#c0cbdc', '#8b9bb4', '#5a6988', '#3a4466',
  '#262b44', '#181425', '#ff0044', '#68386c', '#b55088', '#f6757a', '#e8b796', '#c28569',
];

/** One character per palette index, in order: 0-9 then a-v. */
export const PALETTE_CHARS = '0123456789abcdefghijklmnopqrstuv';
export const TRANSPARENT = '.';

export const P = {
  rust: 0, copper: 1, cream: 2, bronze: 3, leather: 4, brown: 5, darkBrown: 6, blood: 7,
  red: 8, orange: 9, amber: 10, gold: 11, green: 12, moss: 13, pine: 14, deepTeal: 15,
  navy: 16, teal: 17, cyan: 18, white: 19, bone: 20, steel: 21, slate: 22, indigo: 23,
  midnight: 24, outline: 25, pink: 26, plum: 27, mauve: 28, rose: 29, sand: 30, tan: 31,
} as const;

export function paletteIndex(ch: string): number {
  if (ch === TRANSPARENT) return -1;
  const i = PALETTE_CHARS.indexOf(ch);
  if (i < 0) throw new Error(`Not a palette character: "${ch}"`);
  return i;
}

export function hexToRgb(hex: string): [number, number, number] {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}
