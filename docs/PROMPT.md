# Build prompt: Emberward browser demo

> Give this whole file to the build model as its task. Put the other kit files in the repo at the paths listed under "Inputs" before it starts.

---

You are the lead engineer and technical artist on **Emberward**, a card roguelite auto-battler. Your job is to build a **playable desktop-browser demo of Act I** that a stranger can finish without help, and that is fun, readable and stable. You will work over many sessions. Optimise for a demo that is correct and polished over one that is broad and buggy.

## The game in five sentences

You are a Warden carrying the last lantern into a drowned gothic city. Your deck is a face-up line called the Procession: the first two cards are free to play, and reaching deeper costs embers. Each card is both a creature (summoned onto a 4×3 grid) and a spell. Battles run in alternating-action waves, followed by a deterministic Clash where creatures attack down shared lanes. Embers are the only currency: they buy cards, pay for spells and reach, and earn interest if saved. Three copies of a card Rekindle into a stronger Flame card that thins your deck.

## Inputs (read all of them before writing code)

| Path in repo | What it is | Authority |
|---|---|---|
| `docs/SPEC.md` | Demo rules | **Source of truth for rules** |
| `docs/ART.md` | Pixel art and audio direction | **Source of truth for look and sound** |
| `content/cards.json` | 60 cards with Flame forms, Orders, Wardens, relics, archetypes, Fire examples, Act I enemies, fights, elites, boss and events | **Source of truth for content**. Convert it to typed content; don't edit the meaning of a card without logging it. |
| `docs/research/03-ai-workflow-and-prompts.md` | Architecture, verification ladder, draft CLAUDE.md, prompt templates | Strong guidance. Follow it unless SPEC says otherwise. |
| `docs/research/05-ai-opponents-and-encounters.md` | Enemy AI ladder, map generator, encounter design | Guidance |
| `docs/research/06-strategic-depth-and-systems.md`, `04-design-references.md` | Design reasoning, reference numbers | Background |
| `docs/research/01-repos-and-engines.md`, `02-assets.md` | Stack and asset licensing | Background. Obey the licence rules. |
| `docs/reference/emberward-pitch.html` | The pitch page (open it in a browser to see the cards, Procession and Rekindling diagrams) | Visual reference for intent, not for pixel style |
| `docs/design-notes.md` | Daniel's original notes | Background |

Where the inputs conflict, SPEC.md beats cards.json beats research. 

## Non-negotiables

1. **Stack:** TypeScript, Vite and React for the DOM UI, Vitest and Playwright. The pixel sprites are rendered from code into an atlas and drawn as `<img>` or `<canvas>` with integer scaling. Keep the board and cards DOM-based so Playwright can drive them by selector.
2. **A pure, deterministic core.**
   - `src/core` has no DOM, `Date.now`, `Math.random` or UI imports.
   - All randomness goes through a seeded RNG stored in state, with separate streams hashed per purpose (map, rewards, market, AI).
   - `applyAction(state, action) → { state, events }` is the only mutator, and the enemy AI calls it too.
   - State JSON round-trips.
3. **Content is data.** Cards, statuses, encounters, relics and events live in `src/content` using a small effect DSL (trigger, condition, selector, op).
   - Adding a card never needs engine code. If it does, add a generic op with tests first.
   - Card rules text must be validated against the DSL by a test.
4. **Every undecided number is a config flag** (SPEC marks them **[flag]**).
5. **Desktop only:** 1280×720 minimum, mouse and keyboard. Don't spend effort on touch or mobile.
6. **Art follows ART.md exactly:**
   - 32×32 sprite per card, Endesga 32 palette only, integer scaling.
   - Spark, Flame and Fire level effects.
   - Inspired by Dark Souls' mood, but nothing recognisably from it.
7. **Licences:** only CC0, CC BY, MIT, OFL or similar. Keep `CREDITS.md` current. Nothing share-alike or no-redistribution in the repo.
8. **Never weaken a test or a `features.json` entry to get green.**

## Working method (every session)

Set this up in phase 0 and follow it from then on (details in research/03 §4–§6):

- Keep these files, and read them at the start of every session:
  - `CLAUDE.md` (adapt the draft in research/03 §5),
  - `PROGRESS.md` (an append-only log),
  - `docs/DECISIONS.md`,
  - `docs/IDEAS.md`,
  - `features.json` (every feature starts `"passes": false`).
- Run `npm run check` (typecheck, lint, unit tests, golden replays, fast fuzz). Fix anything red before doing new work.
- Do **one feature per loop**:
  1. Write its acceptance criteria into PROGRESS.md.
  2. Write a failing test or replay.
  3. Implement.
  4. Run `npm run check`.
  5. If you changed UI, run `npm run shoot` **and open and look at the screenshots**, then describe what you see.
  6. Flip `passes` only with evidence.
  7. Commit.
- Use a fresh-context reviewer subagent before marking any non-trivial feature passing. It checks the work against SPEC and grades UI with Playwright.
- Keep tool output to 10 lines or fewer and write details to `reports/`.
- Expose `window.__game` with `getState`, `renderToText` (an ASCII board), `dispatch`, `legalActions`, `advanceTime`, `skipAnimations`, `loadScenario`, `exportReplay` and `importReplay`. Add `?seed=&scenario=&debug=1` URL params.

## Phases and exit checks

| Phase | Build | Exit check |
|---|---|---|
| **0. Scaffold** | Repo, tooling, CLAUDE.md, features.json (derived from SPEC, roughly 60 to 100 entries), content converted from cards.json with schema validation, sprite pipeline skeleton (`npm run sprites`, `npm run sprites:sheet`) | `npm run check` green; schema test passes on all 60 cards |
| **1. Headless battle** | Grid, shapes, Taunt, Clash beats, statuses, keywords, clusters, Procession with lit cards and reach, Summon and Cast, Pass, moves, win check, ASCII renderer, `tools/sim.ts` | 1,000 random-bot battles with zero `ERROR` lines; golden replays for each shape and status |
| **2. Playable battle** | Battle screen: grid, Procession strip with lit and reach badges, card inspect, live Clash preview arrows, skippable event-driven animations, scripted enemy | Playwright plays a full battle; screenshots reviewed; a human can tell what will happen before pressing End Turn |
| **3. Sprites, pass 1** | All 60 card sprites, plus tokens and Act I enemies, as code; contact sheet; level effects (Spark, Flame, Fire) | Contact sheet reviewed: every sprite reads at ×1, and no two in an Order share a silhouette |
| **4. Run loop** | Warden select, opening draft, Act I map, salvage, Echoes, Omens, market (reroll, hold, sell), Hearth, Shrines, Scout, relics, interest, Rekindling with postpone, Muster screen, Flame forms for all cards | A bot completes a full run headless; Playwright completes a run on a fixed seed |
| **5. Enemies and boss** | 8 fights, 3 elites (each breaks one rule), the Lamplighter Who Drowned; AI ladder (scripted, greedy, boss phases) | 1,000 sim runs per Warden; report win rate by Warden and by node |
| **6. Balance** | `npm run balance`: per-card include win-rate, pick rate, first-seat win rate, ember-spend split, run length | Bands: no card above 60% include-win-rate, first seat between 45% and 55%, median run 15 to 25 minutes (simulated actions × a measured average action time), every archetype reachable |
| **7. Juice and onboarding** | ZzFX SFX, Tone.js music, hover tooltips for every keyword, a first-battle tutorial that teaches lit cards, reach and the Clash preview, run save and resume (IndexedDB), settings (volume, animation speed), defeat screen "The light goes out." | A fresh evaluator completes a run from a cold start with no instructions and reports any confusion |
| **8. Ship the demo** | Production build deployable as static files; `README` with how to run; `CREDITS.md` | `npm run build` output runs from a static server; all features.json entries pass |

Don't start a phase until the previous phase's exit check passes. If something in SPEC turns out to be unfun or broken in simulation, don't redesign it silently. Show the numbers in `PROGRESS.md` under "Questions for Daniel", propose a flag change, and keep building on the current rule.

## What to report back

At the end of each phase, write a short summary at the top of `PROGRESS.md` that a non-programmer can read. It covers:

- what now works,
- 3 to 6 screenshots (paths),
- the balance numbers if there are any,
- open questions for Daniel, each with your recommended answer.

Keep it under 25 lines.

## Definition of done

- A stranger opens the demo URL on a desktop browser and picks a Warden.
- They play Act I to the boss in 15 to 25 minutes, and understand every decision from what the screen shows.
- They never hit an error.
- Every card has a distinct 32×32 sprite, with visible Spark, Flame and Fire levels.
- All checks are green.
