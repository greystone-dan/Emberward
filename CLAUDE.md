# Emberward

Card roguelite auto-battler, desktop browser only (no mobile work). Stack: TypeScript, Vite, React DOM, Vitest.

- `src/core` is pure and deterministic: no DOM, `Date.now`, `Math.random`. Randomness goes through the seeded streams in state. `applyAction` is the only mutator.
- Card data lives in `content/cards.json`; adding a card should not need engine code.
- Rules docs in `docs/`. NOTE: SPEC.md and PROMPT.md still describe Procession and fixed Orders. Daniel's later decisions win: no factions (TFT-style traits and positional bonuses), the Drift for paid reach in drafting, fully revealed deck in battle, Rekindling Spark -> Flame -> Fire. See `docs/DECISIONS.md`.
- Commands: `npm run dev`, `npm test`, `npm run typecheck`, `npm run build`.
