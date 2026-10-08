import { useEffect, useLayoutEffect, useState } from 'react';

/**
 * Onboarding (SPEC phase 7): two short coached tours, shown once each. The first battle teaches the revealed
 * decks, the traits panel and the Clash preview; the first Drift teaches free and paid reach. Each step points
 * at a real element and never blocks the game; the player clicks Next or Skip. `?tutorial=1` shows them again,
 * `?debug=1` hides them unless `tutorial=1` (tests and screenshots).
 */

export type Tour = 'battle' | 'drift';
interface Step {
  target: string;
  title: string;
  text: string;
  place?: 'below' | 'above' | 'left' | 'right';
}

const TOURS: Record<Tour, Step[]> = {
  battle: [
    { target: '[data-testid="strip-1"]', title: 'Their whole deck is face up', text: 'These are every card the enemy brought. The one marked "next" is what it plays on its turn, and the aimed cell glows on the board. No draws, no surprises.', place: 'below' },
    { target: '[data-testid="strip-0"]', title: 'So is yours', text: 'Click any card to inspect it, then Summon it to a cell for free or Cast its spell for embers (✦). Each wave you get a few actions; passing first earns 1✦.', place: 'above' },
    { target: '[data-testid="tiers-0"]', title: 'Traits count on the board', text: 'Each card carries traits. Reach two, four or six different cards with a trait on your side and the tier bonus switches on. Neighbours sharing a trait also get Kinship, +1/+1 each.', place: 'right' },
    { target: '[data-testid="board"]', title: 'Arrows show the Clash', text: 'When both sides pass, units attack row by row: Front, then Mid, then Back. The arrows show exactly who hits what. A lane with none of your units lets their attacks through to your Warden, so cover the lanes they strike from.', place: 'left' },
    { target: '[data-testid="btn-pass"]', title: 'End the turn when ready', text: 'Pass with this button or press E. The battle lasts six waves; empty the enemy Warden’s health, or lead on face damage when the waves run out.', place: 'above' },
  ],
  drift: [
    { target: '[data-testid="drift-slot-0"]', title: 'The front of the Drift is free', text: 'After every fight a line of cards drifts past. The first two are free to take.', place: 'below' },
    { target: '[data-testid="drift-slot-3"]', title: 'Reaching further costs embers', text: 'Each place further back costs 1✦ more. Pay to reach the card you want, or take what floats to you and keep your embers for the market.', place: 'below' },
    { target: '[data-testid="btn-drift-done"]', title: 'The line keeps moving', text: 'What you leave drifts two places closer by the next node, and the front two wash away. Take three cards now to build on your Warden’s start.', place: 'above' },
  ],
};

const KEY = 'emberward.tutorial.v1';

function seen(): Record<Tour, boolean> {
  try {
    return { battle: false, drift: false, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Record<Tour, boolean>>) };
  } catch {
    return { battle: false, drift: false };
  }
}
function markSeen(t: Tour): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...seen(), [t]: true }));
  } catch {
    /* ignore */
  }
}

/** Whether a tour should show: not seen, and not suppressed by the URL. */
export function tutorialWanted(t: Tour): boolean {
  if (typeof window === 'undefined') return false;
  const q = new URLSearchParams(window.location.search);
  if (q.get('tutorial') === '1') return true;
  if (q.get('tutorial') === '0' || q.get('debug') === '1') return false;
  return !seen()[t];
}

export function Coach({ tour, onDone }: { tour: Tour; onDone?: () => void }) {
  const steps = TOURS[tour];
  const [i, setI] = useState(0);
  const [box, setBox] = useState<DOMRect | null>(null);
  const step = steps[i];
  useLayoutEffect(() => {
    if (!step) return;
    const el = document.querySelector(step.target);
    const app = document.querySelector('.app')?.getBoundingClientRect();
    if (!el || !app) {
      setBox(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setBox(new DOMRect(r.left - app.left, r.top - app.top, r.width, r.height));
  }, [step, i]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') finish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const finish = () => {
    markSeen(tour);
    onDone?.();
    setI(steps.length);
  };
  if (!step) return null;
  const next = () => (i + 1 < steps.length ? setI(i + 1) : finish());
  // Card placement relative to the highlighted box.
  const place = step.place ?? 'below';
  const style: React.CSSProperties = { position: 'absolute' };
  const W = 340;
  if (box) {
    const cx = Math.min(Math.max(box.x + box.width / 2 - W / 2, 12), 1280 - W - 12);
    if (place === 'below') Object.assign(style, { left: cx, top: box.y + box.height + 12 });
    else if (place === 'above') Object.assign(style, { left: cx, bottom: 720 - box.y + 12 });
    else if (place === 'right') Object.assign(style, { left: Math.min(box.x + box.width + 12, 1280 - W - 12), top: Math.max(12, box.y) });
    else Object.assign(style, { left: Math.max(12, box.x - W - 12), top: Math.max(12, box.y) });
  } else Object.assign(style, { left: 640 - W / 2, top: 300 });
  return (
    <div className="coach" data-testid="coach" data-step={i}>
      {box && <div className="coach-ring" style={{ left: box.x - 6, top: box.y - 6, width: box.width + 12, height: box.height + 12 }} />}
      <div className="coach-card" style={{ ...style, width: W }}>
        <div className="coach-title">{step.title}</div>
        <div className="coach-text">{step.text}</div>
        <div className="row">
          <span className="muted">
            {i + 1} / {steps.length}
          </span>
          <button className="small" onClick={finish} data-testid="coach-skip">
            Skip
          </button>
          <button className="primary small" onClick={next} data-testid="coach-next">
            {i + 1 < steps.length ? 'Next' : 'Got it'}
          </button>
        </div>
      </div>
    </div>
  );
}
