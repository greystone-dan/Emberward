# Progress log

Append-only. Newest phase summary at the top; the loop log below it.

## Questions for Daniel

1. **Losing bonus health.** Kinship and Brawler health are recomputed from the board. When a unit loses a neighbour its max health drops; I made it keep at least 1 health rather than die (flag `bonusHpLossNeverKills`). Recommended: keep it, it avoids "my unit died because its friend moved".
2. **Fire level.** Fire is in (stats ×1.5, free spell, the six hand-written lines work). The other 54 Fire lines are not written: reaching Fire needs 9 copies of a card, which a 15-minute Act I run can't do. Recommended: leave Fire by formula for the demo and write the lines for Act II.
3. **Tokens and traits.** Wisps, Bats, Rubble and Bone Walls don't count toward trait tiers (they aren't cards). Recommended: keep.

## Phase 1: headless battle — done (2026-10-08)

- The whole battle runs headless: 4×3 grids, revealed decks, waves with alternating actions, Summon and Cast, free Swift moves and paid steps, Pass, the three-beat Clash with all six shapes and Taunt, Burn/Poison/Shield/Stun, Kindle/Last Gasp/Wave Start/Wave End triggers, tokens, trait counting with live tiers, Kinship, auras (Chanter diagonals), the wave-6 face-damage tiebreak, and a text renderer.
- All 60 cards (Spark and Flame), 9 enemy units and 5 tokens are data in the effect DSL (`src/content/effects/cards.ts`); a test checks every rules text's keywords and numbers against the data.
- `npm run sim -- --battles 1000` plays 1,000 random battles in about 4 seconds with zero errors (also with the scripted enemy). 24 golden replays guard the rules.
- Numbers (random player vs scripted enemy, 1,000 battles): player wins 65%, 41% of battles go to wave 6. Not balance data yet; the player bot is random.
- Tests: 101. features.json: 44 passing.

## Phase 0: foundations — done (2026-10-07)

- `npm run check` (typecheck, lint, 13 unit tests) is green; CI runs it plus the build and a Playwright smoke test on every PR.
- All of `content/cards.json` is typed and validated: 60 cards, 17 traits, 4 Wardens, 12 relics, 9 enemy units, 8 fights, 3 elites, the boss and 5 events.
- Sprite pipeline: `npm run sprites` and `npm run sprites:sheet` render code-authored 32×32 sprites (one placeholder so far).
- features.json: 96 entries, 6 passing.

## Loop log

### 2026-10-07 · Phase 0 foundations
**Contract.** Add ESLint (core purity rules), Playwright, `npm run check`, CI; expand CLAUDE.md; create PROGRESS.md, features.json (96 entries from SPEC), docs/IDEAS.md, CREDITS.md; type all of cards.json with a schema test over all 60 cards; sprite pipeline skeleton (`npm run sprites`, `npm run sprites:sheet`); config flags for every SPEC [flag].
**Evidence.** `npm run check` green; `src/content/cards.test.ts` (8 tests over 60 cards, 17 traits, wardens, fights, elites, boss, events, relics, combos, comps); `reports/sprites-sheet.png` opened and checked (placeholder lantern reads at ×1 and ×4).
**Gotchas.** The container's Chromium is older than Playwright 1.64; `playwright.config.ts` uses `/opt/pw-browsers/chromium` when it exists.

### 2026-10-08 · Phase 1 headless battle
**Contract.** Core types, grid helpers, effect DSL + interpreter, Clash, wave flow, applyAction/legalActions, trait and aura maths, text renderer, Clash preview, state hash, scripted T0 enemy AI, sim tool, golden replays; tests for flow, shapes, Taunt, beats, Wave End order, statuses, triggers, traits, card-text validation, levels.
**Evidence.** `npm run check` green (101 tests); `npm run sim -- --battles 1000 --seed 21` and `--bot scripted --seed 22`: 0 errors; `src/core/replays/golden.json` (24 replays, 712 actions).
**Gotchas.** (1) Within a beat, deaths are deferred until all damage lands, or a unit that dies loses its simultaneous attack. (2) Derived max HP (Kinship) can drop below damage taken; the clamp must skip units already marked dead or it resurrects them. (3) Tests must remember the enemy attacks too: a 2-HP shooter in the Back row dies to a Front-row striker before the Back beat. (4) The first side to pass gains 1✦, so ember expectations in tests include it.
