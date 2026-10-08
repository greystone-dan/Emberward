/**
 * Player settings (SPEC phase 7): volumes and animation speed. Stored per browser; read synchronously so the
 * battle clock and the audio layer can consult them on every tick without a store round trip.
 */
export interface Settings {
  /** 0..1 */
  sfx: number;
  /** 0..1 */
  music: number;
  /** Animation speed multiplier; 0 means instant. */
  speed: 0.5 | 1 | 2 | 0;
}

const KEY = 'emberward.settings.v1';
const DEFAULTS: Settings = { sfx: 0.6, music: 0.4, speed: 1 };
let current: Settings = load();
const listeners = new Set<() => void>();

function load(): Settings {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return { ...DEFAULTS };
    const p = JSON.parse(raw) as Partial<Settings>;
    return { sfx: clamp(p.sfx), music: clamp(p.music), speed: [0.5, 1, 2, 0].includes(p.speed as number) ? (p.speed as Settings['speed']) : 1 };
  } catch {
    return { ...DEFAULTS };
  }
}
function clamp(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : DEFAULTS.sfx;
}

export function getSettings(): Settings {
  return current;
}

export function setSettings(patch: Partial<Settings>): void {
  current = { ...current, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(current));
  } catch {
    /* private mode */
  }
  for (const l of listeners) l();
}

export function subscribeSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** How many animation milliseconds pass per real millisecond (Infinity when instant). */
export function animationRate(): number {
  const s = current.speed;
  return s === 0 ? Infinity : s;
}
