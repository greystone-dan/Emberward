# Emberward — card roguelite auto-battler (desktop browser demo)

Design source of truth: `docs/SPEC.md` (rules) · `docs/DECISIONS.md` (Daniel's decisions, win over research) · `docs/ART.md` (look and sound) · `docs/IDEAS.md` (parked ideas)
Progress: `PROGRESS.md` (append-only log, "Questions for Daniel" at the top) · `features.json` (pass/fail checklist; NEVER delete or weaken an entry)
Build brief: `docs/PROMPT.md`. Content: `content/cards.json` (never change a card's meaning without logging it).

## Commands
- `npm run dev`            Vite dev server (http://localhost:5173, `?seed=N&scenario=NAME&debug=1`)
- `npm run check`          typecheck + lint + unit tests (incl. golden replays). Must be green before a commit.
- `npm run check:fast`     typecheck + unit tests
- `npm run sim -- --battles 1000 --bot random --seed 1`   headless battles → 10-line summary + reports/sim-*.json
- `npm run balance`        balance report → reports/balance-latest.md
- `npm run sprites` / `npm run sprites:sheet`   atlas → public/sprites; contact sheet → reports/sprites-sheet.png (OPEN AND LOOK)
- `npm run shoot -- <scenario...>`   Playwright screenshots → shots/<scenario>.png (OPEN AND LOOK)
- `npm run e2e`            Playwright end-to-end

## Architecture (do not violate)
- `src/core` is PURE and DETERMINISTIC: no DOM, no `Date.now`, no `Math.random`, no imports from `src/ui` (ESLint enforces it). All randomness through the seeded streams in state. State must JSON round-trip.
- `applyAction(state, action) -> { state, events }` is the ONLY mutator. The UI dispatches actions and renders events; the enemy AI calls the same function.
- Content is DATA in `src/content` (typed loader over `content/cards.json` plus the effect DSL in `src/content/effects/*`). Adding a card never needs engine code; if it does, add a generic DSL op/selector with tests first.
- Every SPEC **[flag]** is a named constant in `src/config/flags.ts`. Tuning lives in `src/config`, never scattered.
- Grid: 4 lanes (A-D) × 3 rows per side; row 0 = Front, nearest the enemy. Adjacency is orthogonal (flag).
- Trigger order: initiative side, lane A→D, Front→Back. Never break a tie randomly. Trigger queue cap 200 → `ERROR TRIGGER_LOOP`.
- Auras, trait tiers and Kinship are recomputed from the board every time, never stored on units.
- Desktop only: 1280×720 minimum, mouse and keyboard. No touch or mobile work.
- Art: 32×32 sprites authored as code, Endesga 32 only, integer scaling, `image-rendering: pixelated`. Licences: CC0 / CC BY / MIT / OFL only; keep `CREDITS.md` current.

## Workflow rules
- Start of session: `tail -60 PROGRESS.md`, `git log --oneline -15`, failing `features.json` items, `npm run check`. Fix red first.
- One feature per loop: acceptance criteria in PROGRESS.md → failing test or replay → implement → `npm run check` → (UI) `npm run shoot` and look at the PNGs → flip `passes` only with evidence → commit.
- Every bug fix adds a golden replay in `src/core/replays/`.
- Keep tool output to 10 lines or fewer; details go to `reports/`. Errors print as `ERROR <reason> seed=<n>`.
- Don't invent rules. Ambiguity → simplest reading behind a flag, log in DECISIONS.md, list under "Questions for Daniel" in PROGRESS.md. New ideas → `docs/IDEAS.md`.
- Work on branches; one PR per phase against `main`; keep `main` green.

## Gotchas
- `content/cards.json` still says "Procession" in the Sigil notes and `order` on enemy units; both are legacy words. Decks are unordered sets, enemy units have no Orders.
- The container's Chromium (/opt/pw-browsers) may be older than the installed Playwright; `playwright.config.ts` points at it when present.
