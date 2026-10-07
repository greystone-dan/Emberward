# 01 — Repos, Engines & Libraries for the Card Roguelite Auto-Battler

_Research date: 2026-10-07. Design context: `/mnt/project-files/design/design-notes.md`. The game uses a 4x3 grid per side, alternating unit placement, combat that resolves in waves, cards that can be played as a monster or a spell, and a face-up deck. Play is **turn-based, not real-time**. Platform path: **browser demo → Steam (desktop) → iOS**._

**How things were checked.** GitHub stars, licenses and last-push dates come from the GitHub search API, queried on 2026-10-07. npm versions come from `registry.npmjs.org` on the same day. Engine and platform facts come from the official pages cited inline. Anything marked **(unverified)** comes from memory or a secondary source I could not confirm.

---

## TL;DR

1. **Recommended stack: TypeScript + Vite, a pure-TS headless rules engine, and a DOM UI (React + CSS Grid + Motion/GSAP).** Ship to Steam with **Electron + steamworks.js** (NW.js is the fallback) and to iOS with **Capacitor**, bundling the game offline. Add a **PixiJS** canvas overlay later only if VFX need it.
2. **Why DOM and not Phaser/Pixi for the main UI:** the game is UI-heavy and turn-based. It has two 4x3 grids, a face-up deck, a hand, a shop, tooltips and keyword text. That is roughly 30–60 interactive elements, not thousands of sprites. DOM and CSS give free layout, text, accessibility, responsive design and Playwright `getByRole/getByTestId` testing. React/TS is also the code AI models write best.
3. **Godot 4 is the serious alternative**, mainly because of native Steam and iOS exports, and because *Slay the Spire 2 shipped on Godot*. For an AI-only codebase, though, it is weaker. GDScript has less training data, the `.tscn` scene files are brittle for an AI to edit, browser screenshot testing is harder, and C# cannot be exported to the web as of 4.6.
4. **Non-negotiable architecture, whatever the engine.** Write a deterministic simulation `step(state, action, rng) → {state, events[]}` with no imports from rendering. Use a seeded RNG that lives inside the state. The UI replays the event log as animations. Replays, save/load, "undo", balance bots and golden tests all fall out of this for free.

---

## 1. Open-source repos worth studying

### 1a. Deckbuilders / roguelites (run structure, card engines)

| Repo | Stars | License | Last push | Stack | What to learn / borrow |
|---|---|---|---|---|---|
| [oskarrough/slaytheweb](https://github.com/oskarrough/slaytheweb) | ~315 | **AGPL-3.0** | 2026-05 | JS/TS, Astro, Bun, Biome; deployed at slaytheweb.cards | The closest web analogue. Self-described "UI agnostic game engine with an example UI for the web": actions → new state, a dungeon/map graph, card definitions as data, tests in `tests/`. It even ships a `CLAUDE.md`. **AGPL means study it, don't copy code.** |
| [pagefaultgames/pokerogue](https://github.com/pagefaultgames/pokerogue) | ~5.9k | **AGPL-3.0** | 2026-10 | **Phaser + TypeScript + Vite + Vitest**, pnpm, Biome | The largest successful open-source browser roguelite. Shows Phaser-at-scale code organization, a headless Vitest suite for battle logic, and data-driven content. Study only (AGPL). |
| [yurkth/stsmapgen](https://github.com/yurkth/stsmapgen) | ~268 | MIT | 2021 (stale) | JS | Procedural Slay-the-Spire-style map generation (layered DAG of nodes, path constraints). Small and MIT-licensed, so it is fine to port. |
| [silverua/slay-the-spire-map-in-unity](https://github.com/silverua/slay-the-spire-map-in-unity) | ~427 | MIT | 2026-08 | Unity C# | A cleaner StS map algorithm with configurable node types and layers. Port the algorithm, not the code. |
| [BigJk/end_of_eden](https://github.com/BigJk/end_of_eden) | ~205 | MIT | 2024-09 | Go (terminal) + Lua content | A StS-like roguelite whose content (cards, artifacts, events) is all **scripted data** separate from the engine. A good pattern for "content as data". |
| [guladam/deck_builder_tutorial](https://github.com/guladam/deck_builder_tutorial) | ~456 | MIT | 2024-10 | Godot 4 GDScript | Godot reference: card UI state machine (idle/dragging/aiming/released), intents and status effects. |
| [Paranoidgrinch/RogueDeck-Core](https://github.com/Paranoidgrinch/RogueDeck-Core) | ~13 | MIT | 2026-10 | C# | Small but on-point: a "deterministic, modular, UI-independent, event-driven" roguelike-deckbuilder combat engine. Read it for event-bus and status-effect patterns. |
| [JavierIslas/Card-Combat-System](https://github.com/JavierIslas/Card-Combat-System) | ~14 | AGPL-3.0 | 2026-10 | Godot 4.6 GDScript | A headless card combat engine with a turn FSM. Study only. |
| [Yrahcaz7/Dungeon-of-Souls](https://github.com/Yrahcaz7/Dungeon-of-Souls) | ~4 | GPL-3.0 | 2026-10 | Vanilla JS | A tiny turn-based roguelike deckbuilder in plain JS. Study only. |
| [ycarowr/UiCard](https://github.com/ycarowr/UiCard) | ~572 | MIT | 2025-07 | Unity C# | Card-hand UI "feel": fan layout, hover lift, drag and return. Reference for motion design. |
| [mixandjam/Balatro-Feel](https://github.com/mixandjam/Balatro-Feel) | ~742 | MIT | 2025-04 | Unity C# | Recreates Balatro's juice: card tilt, wobble, shadow and scale tweens. The same tricks work in CSS 3D transforms and GSAP. |
| [EFHIII/balatro-calculator](https://github.com/EFHIII/balatro-calculator) | ~280 | MIT | 2026-07 | JS | A pure-function scoring pipeline for Balatro's ordered joker triggers. A useful reference for **ordered trigger resolution**. |
| [wuhao21/sts2-cli](https://github.com/wuhao21/sts2-cli) / [Gennadiyev/STS2MCP](https://github.com/Gennadiyev/STS2MCP) | ~271 / ~511 | MIT | 2026 | C# mods for StS2 | Show the value of a **headless/agent-playable interface** to a deckbuilder. Build ours in from day one (a CLI or JSON API on the sim). |

### 1b. Auto battlers (SAP / TFT / Backpack Battles-likes)

Few high-quality open-source TS auto battlers exist. Most SAP repos are Python RL environments, and those are still useful for **simulation design**.

| Repo | Stars | License | Last push | Stack | What to learn |
|---|---|---|---|---|---|
| [manny405/sapai](https://github.com/manny405/sapai) | ~74 | MIT | 2023-04 | Python | A full Super Auto Pets engine built for RL. Shows the **trigger ordering** (start-of-battle, before-attack, hurt, faint, summon), front-to-back resolution and a shop model as pure data/state. |
| [alexdriedger/sapai-gym](https://github.com/alexdriedger/sapai-gym) | ~16 | MIT | 2022 | Python | A gym wrapper over sapai. Pattern: expose `legal_actions(state)` + `step()` so bots can play thousands of games for balance testing. |
| [charlie-collard/super-auto-pets](https://github.com/charlie-collard/super-auto-pets) | ~11 | NOASSERTION | 2022 | Python | A **replay viewer**: it reconstructs battles from a logged action stream. This is the same idea as "sim emits events, UI replays them". |
| [henry-alakazhang/pokemon-autochess](https://github.com/henry-alakazhang/pokemon-autochess) | ~19 | none (all rights reserved) | 2026-04 | Phaser 3 + TS + Jest | A TFT-like built in Phaser. **Useful as a cautionary example:** its README says game logic is badly coupled to Phaser objects, which makes tests painful. That is exactly the mistake to avoid. |
| [guladam/godot_autobattler_course](https://github.com/guladam/godot_autobattler_course) | ~188 | MIT | 2026-01 | Godot 4 GDScript | TFT-like: bench, grid placement, unit combining (3 → star-up), shop and rerolls. A clear reference for **fusion/level-up** and grid drag/drop. |
| [dunnker/AnimalHurted](https://github.com/dunnker/AnimalHurted) | ~14 | Unlicense | 2022 | C# | A SAP-style game ("pets fight until they faint"). The license is public-domain-like, so code can be reused freely. |
| [debris/autobattler](https://github.com/debris/autobattler) | ~14 | none | 2024 | Godot | "Creature collector **deckbuilding autobattler**". Close in spirit to our hybrid. |
| [bencoveney/super-auto-pets-db](https://github.com/bencoveney/super-auto-pets-db) | ~45 | MIT | 2022 | TS | A typed data model for pets/foods/abilities. A good shape for our card JSON schema. |

Backpack Battles-likes: no meaningful open-source clones found (search: "backpack battles", "backpack hero", "inventory autobattler").

### 1c. Grid tactics / lane card games / turn-based tactics (combat resolution code)

This section was added for the 4x3 positional design.

| Repo | Stars | License | Last push | Stack | What to learn |
|---|---|---|---|---|---|
| [open-duelyst/duelyst](https://github.com/open-duelyst/duelyst) | ~3.9k | **CC0-1.0** | 2025-08 | JavaScript (Cocos2d-html5 client, Node server) | **The most relevant repo.** Duelyst was a commercial CCG played on a **9x5 grid** with positional units, adjacency effects (Provoke, Zeal, Backstab, Flying), and "spell vs unit" card plays. Its SDK separates `GameSession`, `Action`s, `Modifier`s (status effects / keyword buffs) and a server-validated action stream. Being **CC0 (public domain)**, its code and patterns can be freely borrowed. Look at `app/sdk/` (actions, modifiers, board). |
| [jleclanche/fireplace](https://github.com/jleclanche/fireplace) | ~742 | AGPL-3.0 | 2025-12 | Python | A Hearthstone simulator with a strong declarative card DSL (`Buff(SELF, ...)`, `Hit(TARGET, 2)`) and event/aura queue resolution. Study the **effect DSL** design, not the code. |
| [HearthSim/SabberStone](https://github.com/HearthSim/SabberStone) | ~288 | AGPL-3.0 | 2022 | C# | A Hearthstone sim built for AI/MCTS: cloneable game state and a task queue for triggers. Shows a **fast state clone for AI lookahead**. |
| [Card-Forge/forge](https://github.com/Card-Forge/forge) | ~2.8k | GPL-3.0 | 2026-10 | Java | A full MTG rules engine (the stack, priority, triggered/static abilities and layers). Useful for **MTG-inspired card design**, and as a warning about how complex full rules get. Keep our rules much simpler. |
| [wesnoth/wesnoth](https://github.com/wesnoth/wesnoth) | ~6.9k | GPL-2.0 | 2026-10 | C++/Lua | Turn-based tactics combat math: attack types, resistances, ZoC, and a well-documented **deterministic RNG + replay** system. Study only. |
| [Hadlock/OpenITB](https://github.com/Hadlock/OpenITB) | ~7 | GPL-2.0 | 2025-09 | Python | An open Into-the-Breach-like with **telegraphed directional attacks** on a small grid and push/knockback. Fits the "monsters attack in directions" idea. |
| [Vap0r1ze/inscrybe-with-friends](https://github.com/Vap0r1ze/inscrybe-with-friends) | ~21 | AGPL-3.0 | 2025-10 | TS / Next.js | A web **lane-based card battler** (Inscryption: units attack straight down their lane, sigils, a damage-scale win condition). Close to our "HP buffer instead of board wipe" idea. Study only. |
| [boardgameio/boardgame.io](https://github.com/boardgameio/boardgame.io) | ~12.5k | MIT | 2026-09 (repo); **npm 0.50.2 published 2022-11** | TS | A turn-based state framework: `moves`, `phases`, `turn.order`, seeded `ctx.random`, a deterministic log, built-in bots (MCTS) and a React client. **Copy its concepts** (immutable G + moves + phases + seeded random + log), but don't depend on it. The npm package hasn't been released in about 4 years. |
| [chrisheninger/matchimals.fun](https://github.com/chrisheninger/matchimals.fun) | ~196 | MIT | 2026-09 | TS + boardgame.io + React | A small, modern example of a React card UI driven by a boardgame.io-style turn engine. |
| [ondras/rot.js](https://github.com/ondras/rot.js) | ~2.7k | BSD-3-Clause | 2024-11 | JS/TS | The roguelike toolkit. Its `RNG` (seedable Alea), FOV, pathfinding and scheduler are handy as references. |

### 1d. ECS / state libraries (do we need ECS?)

**Verdict: no ECS for the rules core.** The battle has at most 24 cells and dozens of entities. Plain typed objects plus pure functions are simpler for an AI to write and test. ECS shines with thousands of real-time entities.

| Lib | Stars | License | npm latest | Notes |
|---|---|---|---|---|
| [NateTheGreatt/bitECS](https://github.com/NateTheGreatt/bitECS) | ~1.5k | MPL-2.0 | 0.4.0 (2025-12) | Fast, data-oriented ECS. Overkill here. |
| [pmndrs/koota](https://github.com/pmndrs/koota) | ~750 | ISC | 0.6.6 (2026-04) | ECS-flavoured state with React bindings. |
| [ecsyjs/ecsy](https://github.com/ecsyjs/ecsy) | ~1.2k | MIT | — | **Archived.** Avoid. |
| [3mcd/javelin](https://github.com/3mcd/javelin) | ~210 | none | — | Stale since 2023. Avoid. |

---

## 2. Engine / framework choice

### 2a. Current versions (verified on npm or official sites, 2026-10-07)

| Option | Latest | Released | License | Notes |
|---|---|---|---|---|
| **Phaser** | **4.2.1 "Giedi"** | 2026-07-09 | MIT | **Phaser 4.0 shipped April 2026** with a new "render node" renderer replacing v3 pipelines. Standard sprites, text and tilemaps migrate "with minimal changes". Phaser says there is "no reason to start on Phaser 3" ([phaser.io/download/stable](https://phaser.io/download/stable), [Phaser 3 vs 4](https://phaser.io/news/2026/05/phaser-3-vs-phaser-4)). ~40k★. Caveat: most AI training data and tutorials are Phaser 3. |
| **PixiJS** | 8.22.0 | 2026-10-01 | MIT | A renderer, not an engine. ~48k★. Ecosystem: `@pixi/react` 8.0.5, `@pixi/ui` 2.4.1, `pixi-filters`, `@pixi/sound`, [pixijs/layout](https://github.com/pixijs/layout) (Yoga flexbox). |
| **KAPLAY** (Kaboom successor) | 3001.0.19 | 2025-06-15 | MIT | ~1.8k★. Fun, but a small ecosystem and slower releases. Not a fit for UI-heavy card games. |
| **Excalibur** | 0.32.0 | 2025-12-23 | BSD-2 | ~2.3k★. Nice TS-first engine, but a small community means less AI familiarity. |
| **Three.js** | r186 (0.186.1) | 2026-09-24 | MIT | ~116k★. 3D is unnecessary here, so skip it (react-three-fiber is an option for 3D card flourishes later). |
| **Godot** | 4.6.x stable (4.6.3 RC seen) | 2026 | MIT | ~118k★. Native exports for Win/Mac/Linux/iOS/Android plus web. **C# cannot be exported to the web, even in 4.6** ([forum, Apr 2026](https://forum.godotengine.org/t/is-there-an-update-on-exporting-c-projects-to-web/128821)). Web export needs WebGL2 + WASM; threads need cross-origin isolation (COOP/COEP) unless you use the single-threaded export ([docs 4.6](https://docs.godotengine.org/en/4.6/tutorials/export/exporting_for_web.html)). |
| **DOM: React** | 19.3.0 | 2026-09-09 | MIT | The best-known UI stack in AI training data. Alternatives: Svelte 5.57 or Solid 1.9. |
| Tooling | Vite 8.3.3, TypeScript 7.0.2, Vitest 5.0.3, Playwright 1.63.0 | 2026 | — | TS 7 is the native (Go) compiler. If any plugin breaks, pin TS 5.x/6.x **(compatibility unverified)**. |

### 2b. Comparison for *this* game (turn-based, a grid of 2×(4x3), card-heavy UI)

Scores: ●●● strong, ●● ok, ● weak.

| Criterion | DOM + React + CSS (+Motion/GSAP) | Phaser 4 | PixiJS 8 (+React) | Godot 4 (GDScript) | KAPLAY / Excalibur |
|---|---|---|---|---|---|
| AI familiarity / training data | ●●● (React/TS is everywhere) | ●● (lots of Phaser 3; v4 is new, so APIs can get mixed up) | ●● (v8 API changed from v7, a mix-up risk) | ●● (GDScript is decent; Godot 3 vs 4 API confusion is common; `.tscn` files are brittle for an AI to edit) | ● |
| Headless testability of logic | ●●● (the logic is plain TS, so Vitest in Node) | ●●● *if* the sim is kept engine-free (PokeRogue does this; pokemon-autochess didn't, and suffered) | ●●● same | ●● (GUT / gdUnit4 run headless via `godot --headless`; CI needs a Godot binary) | ●● |
| UI / E2E testing (Playwright) | ●●● real DOM, so `getByRole`, text assertions and screenshot diffs | ● canvas only: you need screenshot diffs or a debug hook exposing state | ● same as Phaser | ● (web export is a canvas; native has no Playwright) | ● |
| Card UI: text, tooltips, keywords, responsive layout | ●●● CSS Grid for the 4x3 boards, flexbox for the hand, native text and wrapping, i18n | ●● (Phaser text/DOMElement works, but layout is manual) | ●● (`@pixi/layout` helps) | ●●● (Control nodes and containers are good) | ● |
| Animation / tweening for cards | ●●● Motion `layout`/`AnimatePresence` for FLIP card moves, GSAP Flip, CSS 3D tilt | ●●● built-in tweens, particles | ●●● (GSAP + PixiPlugin) | ●●● Tween/AnimationPlayer | ●● |
| VFX (particles, shaders, hit flashes) | ●● (CSS + canvas overlay; add Pixi for heavy FX) | ●●● | ●●● | ●●● | ●● |
| Mobile / touch | ●●● responsive and accessible; Pointer Events | ●● (scale manager) | ●● | ●●● native iOS export | ●● |
| Bundle / tooling | ●●● Vite + TS, HMR | ●●● (official [template-vite-ts](https://github.com/phaserjs/template-vite-ts)) | ●●● | ●● (editor-centric; export templates) | ●●● |
| Steam path | ●●● Electron/NW.js + steamworks.js/greenworks | ●●● same | ●●● same | ●●● native + [GodotSteam](https://github.com/GodotSteam/GodotSteam) (the GitHub repo shows **archived**; I believe it moved to Codeberg **(unverified)**) | ●● |
| iOS path | ●● Capacitor (WKWebView) | ●● Capacitor | ●● Capacitor | ●●● native export | ●● |

### 2c. Recommendation

**Primary: TypeScript + Vite + a pure-TS rules engine + a React DOM UI. Add a PixiJS canvas overlay only when VFX demand it.**

Reasoning:
- **The game is mostly a UI problem, not a rendering problem.** Two 4x3 boards, a face-up deck, a hand, a shop, keyword tooltips and an HP display amount to a few dozen elements on screen. CSS Grid renders a 4x3 board in 10 lines. Text and responsiveness come for free, unlike in canvas.
- **Testability for an AI agent is far better.** Logic gets fast Vitest unit and property tests (fast-check), plus golden-replay snapshots. UI gets Playwright with semantic selectors (`getByTestId('cell-p1-2-1')`) and `toHaveScreenshot()`. A Phaser or Pixi UI forces you into pixel-only assertions or custom debug hooks.
- **Animations:** turn-based combat means "play the event log as a sequence of tweens". Motion (FLIP layout animations) or GSAP Flip/timelines handle card draw, place, attack-lunge, damage numbers and fusion. Both are now free (see §3).
- **Escape hatch:** if the battle scene later needs particles or shaders, mount a transparent `<canvas>` PixiJS layer over the board (Balatro-style juice), or swap only the battle view to Pixi or Phaser. The sim and event log don't change.

**When to pick Phaser 4 instead:** if the team wants sprite-animated monsters walking around, screen shake and particle-heavy waves *as the core feel*. Even then, keep the sim engine-free and render the deck, shop and menus as a DOM overlay. Note that PokeRogue (Phaser + TS + Vitest) shows this scales.

**When to pick Godot 4 instead:** see §4. Choose it if native iOS and console quality become the top priority, and accept the cost to AI-iteration speed.

### 2d. Testing setup that suits an AI agent

- `packages/sim` (pure TS, zero DOM imports): `createBattle(seed, decks)`, `legalActions(state)`, `applyAction(state, action) → {state, events}`. Use **Vitest** for unit tests and **fast-check** (4.10.2) for invariants, e.g. "HP never negative", "same seed + actions → same result", "fusion conserves card count".
- **Golden replays:** keep a list of `{seed, actions[]}` JSON fixtures, snapshot the final state and event log, and run them in CI.
- **Bot vs bot balance runs:** run a random or greedy bot on `legalActions` for N thousand seeded games in Node and report win rates per card. This mirrors the sapai-gym pattern.
- **UI:** Playwright 1.63 with `toHaveScreenshot()` per scene. Expose `window.__game` (state + dispatch) in dev builds so tests can jump straight to a scenario. Use Vitest Browser Mode for component tests.

---

## 3. Useful libraries

| Need | Pick | Version / license | Notes |
|---|---|---|---|
| **Seeded RNG** | [pure-rand](https://github.com/dubzzz/pure-rand) | 8.4.2 (2026-07), MIT | **Pure/immutable generators** (xoroshiro128+, mersenne). The RNG state can live *inside game state*, which makes it serializable for save/replay. Maintained by the fast-check author. |
| | *or* a hand-rolled sfc32/mulberry32 | ~15 LOC | Store the 4×uint32 state in the battle state. Zero deps, which is AI-friendly. |
| | [seedrandom](https://github.com/davidbau/seedrandom) | 3.0.5 (**2019**), MIT on npm (GitHub shows no SPDX license) | Works, but is stale and stateful (it mutates a global or closure). Prefer pure-rand. |
| | rot.js `RNG` / `alea` / `prando` | — | Fine alternatives. Prando 6.0.1 has not been updated since 2021. |
| **State management** | Plain TS reducer + [Immer](https://github.com/immerjs/immer) | 11.1.21, MIT | Immer `produce` gives immutable snapshots for undo/replay with mutable-style code (AIs write it reliably). |
| | [Zustand](https://github.com/pmndrs/zustand) | 5.0.15, MIT | A thin store that connects the sim to React. 58.8k★. |
| | [XState](https://github.com/statelyai/xstate) | 5.33.2, MIT | Optional for the **meta flow** (map → shop → battle wave phases → reward). Phase machines are where bugs hide; XState makes them explicit and testable. |
| **Tweening / animation** | [GSAP](https://github.com/greensock/GSAP) | 3.15.0 (2026-04) | **Now 100% free including all former Club plugins** (SplitText, MorphSVG, Flip, Draggable, Inertia…), with commercial use allowed. Webflow made this change in May 2025 ([Webflow blog](https://webflow.com/blog/gsap-becomes-free)). The license is the custom "Standard 'no charge' license" ([gsap.com/standard-license](https://gsap.com/community/standard-license/)), **not OSI**. Read its terms. My recollection is that it bars use in tools that compete with Webflow's visual builder, which would not affect a game **(unverified)**. Timelines are perfect for event-log playback. |
| | [Motion](https://github.com/motiondivision/motion) (ex-Framer Motion) | 14.0.0, MIT | React-native feel: `layout` / `layoutId` FLIP animations move a card from hand to grid cell automatically. |
| | [tween.js](https://github.com/tweenjs/tween.js) | 25.0.0 (2024), MIT | Minimal, with no DOM coupling. Good inside a Pixi canvas layer. |
| **Drag & drop** | [dnd-kit](https://github.com/clauderic/dnd-kit) | `@dnd-kit/core` 6.3.1 (last npm release 2024-12), MIT, 17.7k★ | React DnD with touch, keyboard and custom collision. Ideal for hand → grid cell and cell → cell (move-with-cost). Note: the repo is active but npm `core` hasn't been released since 2024; the maintainer is working on a new `@dnd-kit/react` **(unverified)**. |
| | [Pragmatic drag and drop](https://github.com/atlassian/pragmatic-drag-and-drop) | 4.0.0 (2026-09), Apache-2.0 (npm) | Framework-agnostic and tiny. Uses native HTML5 DnD, which is **weaker on touch/iOS**. |
| | Hand-rolled Pointer Events | — | For only ~12 drop targets, a 100-line pointer-events implementation plus GSAP Draggable is also reasonable. |
| **Sound** | [howler.js](https://github.com/goldfire/howler.js) | 2.2.4 (**2023**), MIT, 25k★ | Still the standard. It handles iOS audio unlock and sprites. Slow release cadence, but stable. `@pixi/sound` is the alternative if on Pixi. |
| **Save / load** | `localStorage` for small saves; [idb-keyval](https://www.npmjs.com/package/idb-keyval) | 6.3.0 (2026-07), Apache-2.0 | Save = `{version, seed, runState, actionLog}` JSON. Add a migration function per `version`. Avoid localForage (1.10.0, last release **2021**). Use Dexie 4.4.6 only if you need queries. On Electron/Capacitor, swap the adapter to the filesystem or `@capacitor/preferences`, and Steam Cloud then syncs the file. |
| **Property testing** | [fast-check](https://github.com/dubzzz/fast-check) | 4.10.2, MIT | Fuzzes action sequences against the sim. |

### 3a. Deterministic simulation pattern for waves and replays

```
BattleState = { seed/rngState, turn, wave, phase, boards[2][4x3], decks, hands, hp[2], gold, log }
Action      = PlaceMonster | MoveToHand | CastSpell | MoveUnit | Fuse | EndTurn ...
applyAction(state, action) -> { state', events[] }   // pure; validated against legalActions(state)
resolveWave(state)         -> { state', events[] }   // fixed ordering, no Math.random, no Date.now
```

- **Fixed resolution order** (borrowed from SAP and Duelyst). Example: the side with initiative goes first; cells resolve in reading order `(row, col)`; ties go to a stable unit-id. Triggers go into a **FIFO queue**, with a depth cap to stop infinite loops.
- **Events, not animations, in the sim.** Events look like `{type:'attack', from, to, dmg}`, `{type:'statusTick', unit, poison:2}`, `{type:'fuse', into, level}`. The UI turns events into GSAP/Motion timelines, with a speed toggle and skip.
- **Replays = seed + action log.** Desync tests re-run the log and compare state hashes. This also enables async PvP later (SAP-style "ghost" opponents) and bug reports ("paste your replay JSON").
- **Integer math only** (no floats in damage formulas) so results are identical across JS engines and WebViews.
- **Status effects as data:** `{id:'poison', stacks, tickOn:'waveEnd'}` plus a small handler registry. Duelyst's `Modifier` classes and Fireplace's DSL are the references.

---

## 4. Platform path: browser → Steam → iOS

### 4a. Commercial games shipped on web tech (evidence that the path works)

| Game | Web tech | Platform notes | Source |
|---|---|---|---|
| **Vampire Survivors** | Phaser (JS) | Shipped on Steam as a web-tech build, then **moved to Unity on 2023-08-17** for "better cross-platform support, big performance improvements" and local co-op. The likely cause was its thousands of on-screen enemies, a load our turn-based game does not have. | [GamingOnLinux](https://www.gamingonlinux.com/2023/07/vampire-survivors-switching-to-new-game-engine-on-august-17/), [JSLegendDev](https://jslegenddev.substack.com/p/why-text-in-vampire-survivors-used) |
| **CrossCode** | ImpactJS (heavily modified) + NW.js | Steam hit. Later ported to Switch/PS4/Xbox, method not public. | [html5gamedevs](https://www.html5gamedevs.com/topic/42198-cross-code-coming-to-switch-discussion/), [SteamDB Greenworks](https://steamdb.info/tech/SDK/Greenworks) |
| **OMORI, Cookie Clicker, Game Dev Tycoon, SUPERHOT, Hypnospace Outlaw, Melvor Idle** | Greenworks (Steamworks for NW.js/Electron) detected | SteamDB lists ~100 products using Greenworks. | [SteamDB](https://steamdb.info/tech/SDK/Greenworks) |
| RPG Maker MV/MZ and Construct games | NW.js | Thousands of Steam titles (the 5,700+ figure is reported second-hand). | [JSLegendDev](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript) |
| **PokeRogue** | Phaser + TS | A browser-only roguelite with a huge player base, showing web-first roguelites can scale (not on Steam). | [repo](https://github.com/pagefaultgames/pokerogue) |
| *Counterpoint:* **Slay the Spire 2** | **Godot** (Mega Crit moved from Unity after the 2023 runtime-fee controversy) | Early access 2026-03-05, Win/Mac/Linux. A genre-defining deckbuilder on Godot. | [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II) |

### 4b. Desktop / Steam wrappers

| Wrapper | Stars / version | Pros | Cons | Steamworks |
|---|---|---|---|---|
| **Electron** | 123k★, v44.6.0 (2026-10-06), MIT | Consistent Chromium on every OS, the largest ecosystem, plenty of AI familiarity, Linux builds for Steam Deck | ~100–200 MB bundle (fine for games). Cross-building Windows from Mac needs Wine, so use CI matrix builds instead. | [steamworks.js](https://github.com/ceifa/steamworks.js) (633★, MIT, Rust/napi; achievements, cloud, overlay; **npm 0.4.0 is from 2024-08**, repo pushed 2026-04) or [greenworks](https://github.com/greenheartgames/greenworks) (1.6k★, MIT, older C++ addon, used by the hits above). The **Steam overlay is known to be flaky in Chromium wrappers**: one shipped game accepted "overlay will not render for all users" and built fallbacks ([Drawize](https://www.drawize.com/blog/tech-how-to-release-html5-game-on-steam)). |
| **NW.js** | 41k★, MIT | Easiest packaging: download per-OS binaries and drop in `package.nw`, building all OSes from one machine. Same Chromium consistency. Recommended by a dev who shipped a JS game on Steam ([JSLegendDev](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript)). | Smaller community than Electron | greenworks / steamworks.js |
| **Tauri 2** | 112k★, CLI 2.12.1, Apache-2.0/MIT | Tiny bundles, and **also targets iOS/Android** | Uses each OS's webview (WebView2 / WKWebView / **WebKitGTK on Linux and Steam Deck**), so rendering and performance differ per OS. Steamworks needs Rust glue, and each OS must be built on that OS. **Not recommended for a Steam game.** | Rust crates only |

**Steam Deck:** an Electron/NW.js Linux build, or the Windows build under Proton, should both run. Card UIs need controller and touch support anyway, and Pointer Events give the Deck touchscreen for free. Plan gamepad focus navigation (arrow keys / D-pad between grid cells) early. **(Deck verification status unverified; test on hardware or Proton.)**

### 4c. iOS

- **Capacitor** ([ionic-team/capacitor](https://github.com/ionic-team/capacitor), 16.8k★, `@capacitor/core` 8.5.3, MIT) wraps the Vite build in WKWebView with native plugins (haptics, preferences, Game Center via community plugins **(unverified)**).
- **App Store Guideline 4.2 (Minimum Functionality)** rejects "repackaged websites" and lazy URL wrappers ([summary](https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper)). A **fully bundled, offline, complete game** is a different case from a website wrapper, and many HTML5 games pass. Mitigate the risk anyway: ship all assets locally (no remote URL loading), add haptics, safe-area insets, no browser-looking UI, and native IAP via StoreKit if monetized **(the claim that bundled games generally pass is unverified; no authoritative source found)**.
- **Performance:** WKWebView supports WebGL2 and CSS 3D transforms. A DOM card game with ~50 animated elements is well within budget. Prefer `transform`/`opacity` animations (GPU-composited), and avoid animating layout properties and big box-shadows.
- Tauri 2 can also build iOS, but Capacitor is the more mature choice for this.

### 4d. Godot 4 as the alternative path

| | Godot 4.6 | Web stack (recommended) |
|---|---|---|
| Steam | Native export + GodotSteam (C++ GDExtension, mature) | Electron/NW.js + steamworks.js/greenworks (overlay quirks) |
| iOS | Native export (needs a Mac/Xcode) | Capacitor (needs a Mac/Xcode; 4.2 review risk) |
| Web demo | WASM export: larger download, WebGL2 needed, single-threaded build recommended to avoid COOP/COEP headaches. **C# cannot export to web**, so web forces GDScript. Mobile Safari performance varies. | Native target, instant load, smallest payload |
| AI authoring | GDScript is OK. The big friction is that **scenes/resources are `.tscn`/`.tres` text files with node paths and UIDs** that AIs often break, and Godot 3 vs 4 API confusion is common. | Plain TS/React files that AIs write fluently |
| Headless tests | [GUT](https://github.com/bitwes/Gut) (2.7k★) or gdUnit4 via `godot --headless` in CI. C#: [GoDotTest](https://github.com/chickensoft-games/GoDotTest). Workable, but needs the engine binary. | Vitest in Node (milliseconds) + Playwright |
| Visual tests | Screenshots via a custom script; no Playwright | Playwright `toHaveScreenshot` + DOM selectors |
| Precedent | **Slay the Spire 2**, Brotato, etc. **(Brotato on Godot is unverified here)** | CrossCode, OMORI, Vampire Survivors (initially) |

### 4e. Final recommendation and migration story

1. **Phase 1 (browser demo):** use TS + Vite. Put the `sim` package in pure TS. Build the UI in React with CSS Grid, using Motion or GSAP for animation and dnd-kit or Pointer Events for drag. Test with Vitest, fast-check and Playwright. Deploy to static hosting (itch.io / Cloudflare Pages).
2. **Phase 2 (Steam):** wrap the same build in **Electron** (or NW.js if packaging friction bites) with **steamworks.js** for achievements and cloud saves. Add gamepad navigation and a fullscreen/resolution menu, and build Win/Linux/Mac in a CI matrix. Expect to work around overlay quirks.
3. **Phase 3 (iOS):** wrap with **Capacitor**, bundle everything offline, add haptics and safe areas, and submit. Budget time for 4.2 review back-and-forth.
4. **Escape hatch:** keep **all content as JSON** (cards, monsters, statuses, map rules) and keep a **golden replay corpus** (`seed + actions → expected final state`).
   - If web-tech limits ever bite on mobile or consoles, the port is a Godot (or Unity) re-implementation of the sim, validated against those same replay fixtures. This is cheap because the sim is small and fully specified by its tests.
   - Mega Crit's own StS1 → StS2 engine change, and Vampire Survivors' Phaser → Unity port, both show that engine moves after a successful launch are normal.

---

## 5. Unverified / caveats list

- Star counts are approximate and were taken 2026-10-07. Slay the Web's ~315★ is lower than I recalled, but it is what the API returned.
- GodotSteam GitHub repo shows `archived: true`. The project likely moved hosting (Codeberg?), **unverified**.
- GSAP license specifics (the non-compete clause) were not re-read in full: **unverified**.
- That bundled HTML5 games routinely pass App Store 4.2: **unverified** (only general webview-wrapper guidance was found).
- Steam Deck behaviour of Electron builds and Steam overlay reliability in 2026 Electron versions: **unverified**.
- TypeScript 7 (native compiler) compatibility with the Vite/Vitest plugin ecosystem: **unverified**. Pin if needed.
- dnd-kit's next-gen `@dnd-kit/react` package status: **unverified**.
- KAPLAY's newer major line (v4000 alpha) status: **unverified** (npm `latest` is 3001.0.19).
