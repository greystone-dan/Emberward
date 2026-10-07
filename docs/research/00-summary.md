# Research Summary — Card Roguelite Auto-Battler

_Compiled 2026-10-07. Design source: [design/design-notes.md](../design/design-notes.md). Platform path from Daniel: browser demo → Steam → likely iOS._

| File | What's in it |
|---|---|
| [01-repos-and-engines.md](01-repos-and-engines.md) | Engine comparison, Steam/iOS path, open-source repos to study, libraries with current versions |
| [02-assets.md](02-assets.md) | Free/CC0 art, card frames, icons, SFX, music, fonts; two starter kits; CREDITS template |
| [03-ai-workflow-and-prompts.md](03-ai-workflow-and-prompts.md) | How Claude should build this: architecture, verification loop, draft CLAUDE.md, 10 prompt templates |
| [04-design-references.md](04-design-references.md) | StS, Balatro, SAP, TFT, Backpack Battles, Duelyst, Into the Breach etc.; real numbers; balance method; MVP budget |
| [05-ai-opponents-and-encounters.md](05-ai-opponents-and-encounters.md) | Opponent AI ladder with pseudocode, enemy/boss design, map generator, seeded RNG, simulation balancing |
| [06-strategic-depth-and-systems.md](06-strategic-depth-and-systems.md) | Attack shapes for 4x3, auras, clusters, 13 statuses, economy, 6 factions, content plan, Steam market comps |

## Recommended stack
- **TypeScript + Vite.** Game rules live in a pure, deterministic, seeded TS module with zero rendering imports.
- **React DOM UI** (CSS Grid boards, Motion/GSAP animation, dnd-kit or pointer events). Turn-based grid + card UI suits the DOM, and Playwright can test DOM by selector; canvas engines can't. Optional PixiJS layer later for VFX.
- **Steam:** Electron + steamworks.js (NW.js fallback). Avoid Tauri (WebKitGTK on Steam Deck/Linux). **iOS:** Capacitor with the game bundled offline (App Store rule 4.2 risk is unverified).
- **Alternative:** Godot 4.6 (StS2 shipped on it) — better native exports, worse for AI-only dev. Escape hatch: all content as JSON + recorded seed/action replays so any port can be verified.
- Libraries: pure-rand (seed state stored in game state), Immer + Zustand, howler.js, idb-keyval, fast-check, Vitest, Playwright.

## Repos to study
- **open-duelyst/duelyst** (CC0) — commercial grid card game with positional units and adjacency effects; freely borrowable architecture (actions, modifiers).
- yurkth/stsmapgen (MIT) map gen; manny405/sapai (MIT) SAP engine. AGPL/GPL (study only): slaytheweb, pokerogue, fireplace, OpenITB, Wesnoth.

## Assets
- Sandbox can script-fetch npm, raw.githubusercontent.com, Google Fonts — **not** kenney.nl, OpenGameArt, itch.io, freesound (403).
- **Kit A (fetchable now):** game-icons.net SVGs (CC BY 3.0, credit per author), CSS card frames, Lucide, Cinzel/Alegreya fonts, ZzFX/jsfxr SFX, Tone.js music.
- **Kit B (needs Daniel to download zips):** 0x72 DungeonTileset II + DCSS tiles (CC0), Kenney UI/cards/audio (CC0), Pixelify Sans, Endesga 32.
- Avoid: CraftPix/Tiny Swords (no redistribution), Ravenmore frames (share-alike), OpenMoji (share-alike). FreePD is gone.

## How Claude should build it
- Anthropic harness pattern: `features.json` (all start failing) + progress file + init script; one feature per session; short test output.
- Let the agent see the game: expose `renderGameToText()` and `advanceTime(ms)`, take Playwright screenshots and actually look at them.
- One `applyAction(state, action)` function, cards as data with a trigger/condition/target/op effect format, event stream for animation.
- Verification ladder: unit tests on ASCII-grid fixtures → replay tests → random-bot fuzzing → 10k-battle balance sims → screenshots → fresh-context evaluator.
- Vertical slice first. Undecided rules sit behind config flags so sims can compare them.

## Design answers proposed (for Daniel to confirm)
Both design reports converge on these; they differ only in small numbers.
- **Win condition:** players have hero HP. An attack with no enemy in its lane hits the hero. Board wipe ≠ loss. Hard cap at 5–6 waves then enrage/sudden death.
- **Combat:** fully deterministic and previewable (Into the Breach model); randomness only in shop, map and enemy rosters. Resolve per row (front → mid → back), simultaneous.
- **Movement:** per-monster free Move 0/1/2; extra steps cost gold (1–2 per cell) or the turn's action.
- **Dual cards:** choose monster vs spell at play time (not purchase). Monster side is free but uses your placement; spell side is stage-to-hand, then pay 1–3 gold later. Each face ≈ 85% of a single-purpose card's power.
- **Fusion:** 3 copies → ★2 (also thins deck).
- **Economy:** interest +1 per 5 gold at battle end, cap +4, so casting spells costs future interest. Card prices 3/5/8/12, escalating reroll, hold one shop slot, sell for half.
- **Grid vocabulary:** attack shapes Strike/Shoot/Pierce/Cleave/Lob/Fork/Blast/Sweep/Snipe/Support; orthogonal adjacency; aura shapes Ahead/Behind/Beside/Around/Row/Lane; "Cluster" tribe bonus on largest connected group (2/3/5).
- **Statuses:** Poison ignores armor; Burn spreads to adjacent (counter to clumping); 13 total specified in 06.
- **Factions (6):** Ironhold (wall), Mirefang (net), Cinderforge (back-row battery), Galewing (flankers), Verdant Circle (columns), Hollow Choir (fills empty cells).

## Opponent AI
- Face-up decks + deterministic combat = perfect information, so alpha-beta/beam search works (no ISMCTS). Runs in a Web Worker.
- Ladder: scripted (face-up deck = visible intent queue) → greedy 1-ply → wave search (elites) → 2-wave search (bosses, async ghosts).
- Difficulty mainly via Ascension-style rule modifiers. Every elite/boss breaks one base rule.
- Seed each RNG stream separately via hashing (StS2 had a correlated-stream bug).

## Content scale
| Phase | Dual cards | Factions | Relics | Ascension |
|---|---|---|---|---|
| Vertical slice | ~24 | 2 | 8 | — |
| Demo | ~60 | 3 | 20 | 1–3 |
| Early Access | ~150 | 4 | ~60 | 10 |
| 1.0 | ~260–300 | 6 | ~120 | 20 |

Target run length 30–45 min. Market: genre is hot at premium prices (StS2 EA 3M+ week one at $24.99; Backpack Battles 640k first month). Suggested price $14.99–19.99 Steam, $9.99 iOS. Design touch UI for phones from the vertical slice.

## Known gaps
Apple 4.2 review for wrapped web games, Electron Steam overlay reliability, several StS constants from decompiled code, and some launch prices are unverified (marked in each file).
