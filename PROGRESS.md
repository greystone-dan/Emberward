# Progress log

Append-only. Newest phase summary at the top; the loop log below it.

## Questions for Daniel

1. **Losing bonus health.** Kinship and Brawler health are recomputed from the board. When a unit loses a neighbour its max health drops; I made it keep at least 1 health rather than die (flag `bonusHpLossNeverKills`). Recommended: keep it, it avoids "my unit died because its friend moved".
2. **Fire level.** Fire is in (stats ×1.5, free spell, the six hand-written lines work). The other 54 Fire lines are not written: reaching Fire needs 9 copies of a card, which a 15-minute Act I run can't do. Recommended: leave Fire by formula for the demo and write the lines for Act II.
3. **Tokens and traits.** Wisps, Bats, Rubble and Bone Walls don't count toward trait tiers (they aren't cards). Recommended: keep.
5. **The Bell-Keeper is the easy Warden, by a lot.** With the bot playing, it wins 94% of runs against 46% and 43%, and it loses no HP in fights or at the boss. Fourteen nerfs were measured (DECISIONS.md, Elite tuning and Bell-Keeper notes): Cracked Bell 2, Bulwark 5 HP, deck swaps, Bellforged tiers weakened or moved to 5, 40 or 35 starting HP, 5 starting embers, and all of those together (96%). None moves it, because the Guardian-and-Marksman start simply never takes damage from the scripted fights. Options: (a) leave it as the stated easy Warden and tune later with real play data, (b) make fights hit harder for everyone (enemy fight decks or 12 → 14 HP), (c) give the Bell-Keeper a worse map (more elites). Recommended: (a) for the demo.
6. **A lost first fight can cost 35 of 50 HP.** SPEC §9 as written: face damage taken in battle is run HP, and a wave-limit loss adds the face-damage difference on top. A Ferryman click-through that placed one unit a turn took 27 in battle and 8 more as the difference in fight 1 (seed c5). Options: (a) keep the literal rule, (b) cap the added difference (flag, say 10), (c) count only the difference and heal battle damage back on a retreat. Recommended: (a) until people play; the bot and the probe never cover lanes, a person will.
4. ~~**The boss is a wall (phase 5 numbers).**~~ Resolved 2026-10-08: the boss was playing its Sun Furnaces in wave 1; its phases are now enforced (DECISIONS.md, Balance decisions) and HP stays 40. Daniel left balance to Claude. Original note: With the elites' real units and the greedy enemy AI in, 1,000 bot runs per Warden (seed 11) end: Lamplighter 0% wins, Ferryman 0%, Bell-Keeper 10%. Of the Bell-Keeper's 1,000 runs, 746 reach the boss and die there; the elites take most of the rest (rows 6-7 the worst). In a fixed test the boss goes 20/20 against the bot's deck with the greedy AI and 0/20 with the scripted one, every time on the wave limit: the boss starts at 40 HP, its three Sun Furnaces hit for 7, and the face-damage race at wave 6 is never close. The bot is a weak player (it never casts spells or pays to move), so a person will do better, but not 40 HP better. Phase 6 will tune this; proposals, all flags: (a) `enemyHp.boss` 40 → 30, (b) the boss's deck plays two Sun Furnaces rather than three, (c) Kiln Breath Burn 3 → 2. Recommended: (a) first and re-measure. Until you say, the rule stays as written (SPEC: HP 40).

## Phase 8: ship — done (2026-10-08)

- `npm run build` output (relative paths) verified from a plain static server under a sub-path (`/Emberward/`):
  title → Warden select in Chromium with no console errors or failed requests.
- `pages.yml` workflow deploys `main` to GitHub Pages; README explains how to run and play; CREDITS.md lists every
  licence (Endesga 32, Pixelify Sans and Silkscreen OFL, ZzFX and Tone.js MIT, the toolchain).
- The three test-named entries CLASH-009, STATUS-005 and TRAIT-004 now pass with evidence: triggers.test.ts (order and
  the 200 cap), statuses.test.ts (Pull, Persist, Swift, Rooted), traits.test.ts (all 17 traits; Artillery 2, Kindler 2,
  Martyr 2 and Spirit 2 tests added). Fixing the Martyr test found a real bug (DECISIONS.md, Rules clarifications).
- features.json 95/96; BAL-002 stays open on the Bell-Keeper's dominance.

## Phase 7: juice and onboarding — done (2026-10-08)

- Settings (gear, every screen): sound effects and music volume, animation speed Slow/Normal/Fast/Instant; stored per browser.
- Audio: ZzFX effects (wick-light summon, ember-crackle reach, bronze clang Shield, hiss Poison, the Rekindle whoomph, plus hit, death and a click) fired from the animation frames; Tone.js loops seeded from the run (the Stair: low drone, plucked drips, a distant bell; the boss: FM drone and a membrane pulse). Audio unlocks on the first click; everything is safe without a device and `window.__audio` logs the hooks for tests.
- Save and resume moved to IndexedDB (`src/ui/save.ts`, localStorage fallback), loaded before the title renders.
- Tooltips for every keyword, shape, direction and trait on hover (one glossary, `src/ui/tooltip.tsx`).
- Two coached tours shown once: the first battle (revealed decks, traits, Clash arrows, End Turn) and the first Drift (free front, paid reach, the moving line). `?tutorial=1` replays them; `?debug=1` hides them for tests and screenshots.
- Evidence: `npm run check` green (124 tests), `npx playwright test` 10 passed, screenshots reviewed. features.json 91/96. Not done by a machine: nobody has listened to the music yet.

## Balance pass 2 (2026-10-08, after Daniel left balance to Claude)

- Boss phases enforced (`fromWave` on battle cards), Cracked Bell fixed, Lamplighter deck swap: bot win rates 42% / 34% / 88% (1,000 runs, seed 3). The boss is no longer the wall; the Bell-Keeper is now too safe and its drafted rares (Kiln Mortar, Lantern Sentry, Brazier Golem) carry run-level include win rates over 60%, so BAL-002 is back to failing on that band and on Abyssal reach. Next balance loop: trim the Bell-Keeper start (the Guardian-and-Marksman lane coverage is what the bot exploits) and check the Abyssal pool's Drift weight.

## Phase 6: balance — harness done, boss question open (2026-10-08)

- `npm run balance -- --runs 1000 --seed 2 --mirrors 24` (2 min) writes reports/balance-latest.md: per-card include win rate (battle level and run level), pick rate (taken ÷ offered across Drift and market), first-seat win rate (scripted AI over seat-swapped comp pairings 50%; random play on mirrored comps 54%), ember-spend split (Market 68%, Spells 20%, Drift reach 12%; the bot hoards, income is twice spend), run length (measured animation times plus stated human decision times: 17.4 min median for runs that reach the boss, 14.1 min over all runs), and trait 4-tiers (every trait reached by at least one bot deck; Abyssal, Artillery and Reaper only 2-4 times in 1,000).
- Bands: all four pass on the readings in DECISIONS.md, but the include-win band passes only because runs are almost never won (Question 4). No card tuning was done on these numbers; the boss dominates every other signal, so card tuning waits for the boss decision.

## Phase 5: enemies and boss — done (2026-10-08)

- The three elites are real enemy units in `content/cards.json` (`e_abbot`, `e_tideCaller`, `e_brazierKnight`) with their own sprites; each starts on the board and its rule is an engine hook keyed on its id: the Abbot refills every empty cell with a Chorister at Wave End, the Tide-Caller pulls the Front row toward lane A at Wave Start, the Brazier Knight has Taunt, is immune to Burn and heals its Warden one per Burning unit at Wave End.
- The boss has its three phases: one dark lane a wave shown a wave ahead (the lane label says "dark next"), two lanes and Kiln Breath (Burn 3 on the frontmost player unit and the units beside it) at 26 HP, its own lane D dark at 12 HP. Numbers are flags (`bossPhase2Hp`, `bossPhase3Hp`, `kilnBreathBurn`).
- AI ladder: `enemyIntent` picks the scripted AI for fights and `greedyIntent` (1-ply with Clash lookahead: try each pruned candidate, pass both sides, score the post-Clash state) for elites and the boss. Deterministic ties; it only calls `legalActions` and `applyAction`. The intent markers work for both.
- `npm run sim:runs -- --runs 1000 --warden N` for each Warden: 0% / 0% / 10% wins, almost all deaths at the boss. See Questions for Daniel 4; balance is phase 6's job.
- Battle scenarios `elite0..2`, `boss`, `boss-waveN` for screenshots and debugging. features.json 84/96 passing.

## Phase 4: run loop — done (2026-10-08)

- The whole run plays: title (new run, continue), Warden select (Sexton locked until a win), the opening Drift (8 cards, 3 takes), the Act I map (7×15 lattice, 6 walks, Hearth before the boss, elites from row 5) with the next Drift previewed, Muster (enemy deck and first wave shown, bring up to 10), battle, reward (pay after interest, elite relic and Sigil, Anchorstone pick), the post-fight Drift (front 2 free, +1✦ per place, skip for 3✦, advance 2 per node, Echoes, Omens, rarity pity), market (4 cards with an Echo, relic, Sigil, rising reroll, hold, sell), Hearth (heal 30%, Snuff, Temper), the 5 Shrines, Scout, Rekindling with postpone, Sigil inscribing, and the run's end.
- `src/core/run/` is pure: `applyRunAction` is the run's only mutator and forwards battle actions to `applyAction`. A run bot (`playRun`) completes runs headless; `npm run sim:runs -- --runs 60` plays 60 runs in 3.4 s with zero errors (early numbers: Lamplighter 25%, Ferryman 35%, Bell-Keeper 85% wins; most losses at the boss). Not balance yet.
- Save and resume through localStorage (the features entry asks for IndexedDB, so it stays open until phase 7).
- Playwright: a run from the title through Warden select, Drift, map, Muster into battle, then finished by the bot; save and resume. 9 run unit tests. Screenshots of every run screen reviewed.
- Open: elites and the boss use composed decks (phase 5); features.json 79 passing.

## Phase 3: sprites, pass 1 — done (2026-10-08)

- 75 code-authored 32×32 sprites in Endesga 32: all 60 cards, 5 tokens, 9 enemy units and the placeholder, split by Origin in `src/content/sprites/*.ts`. A test checks every card, token and enemy key has a valid sprite (outline, padding, palette, unique ids).
- `reports/sprites-sheet.png` reviewed at ×1 and ×4: every sprite reads at ×1; Origins have distinct silhouettes (nine Bonebound, fourteen Drowned, twelve Bellforged, seventeen Waxborn checked pairwise by eye). Weakest reads noted for a later pass: Gloomshot's wings, Bone Gnawer's face, Crypt Keeper's spade, Pearl Diver's head, Bell Warden's shield at ×1, Scalding Font's steam.
- Level effects: Flame and Fire get a pixel rim-light (amber, gold); board units show a Spark mote, Flame crest or Fire aura; card frames iron, bronze, gold. Board sprites now draw at ×2 (integer scaling only), cards at ×4.
- features.json: 58 passing.

## Phase 2: playable battle — done (2026-10-08)

- The battle screen is playable with the mouse: both grids, every card of both decks in strips (spent greyed, fielded dashed, the enemy's next play marked "next" with its aimed cell and lane), card inspect with art, traits, both halves and the level frame, Summon by clicking a highlighted cell, Cast with step-by-step targeting (units, lanes, rows, cells, cards), free or paid moves that keep the turn, End Turn (E), trait tiers for both sides, a log, floating damage numbers, and a victory/defeat overlay.
- Live Clash preview: `previewClash` arrows with damage labels redraw after every action, so you can tell what will happen before pressing End Turn.
- Animations are event-driven frames on a fixed tick (action, each beat, Wave End, new wave); `skipAnimations` and `advanceTime` make tests and screenshots deterministic. The scripted enemy answers after a short think pause.
- `window.__game` is wired to the store; `?seed=&scenario=&debug=1` honoured (`fightN`, `wardenW-fightN`, `battle-wave1/3/5`, `card-inspect`).
- Playwright plays a full battle through the UI (`e2e/battle.spec.ts`: summon, move, pass, intent marker, arrows, spent chips, spell targeting, overlay). Screenshots in `shots/` reviewed.
- features.json: 53 passing. Sprites are still the placeholder lantern (Phase 3).

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

### 2026-10-08 · Phase 2 playable battle
**Contract.** UI store (committed state + frame queue from events, selection and targeting, scripted enemy turns, replays), battle screen components (Board with arrows and pops, DeckStrip, CardPanel, SidePanel, HUD), debug API and URL scenarios, fonts, a full-battle Playwright test, screenshot scenarios.
**Evidence.** `npm run check` green (101 tests); `npx playwright test` 3 passed; `npm run shoot -- battle-wave1 battle-wave3 card-inspect` opened and reviewed (layout holds at 1280×720, arrows land on cells, intent marker reads).
**Gotchas.** (1) The engine returns only the final state, so beat-by-beat frames project damage and deaths onto a clone of the previous state and the last frame snaps to the true state. (2) `new ImageData(Uint8ClampedArray)` fails TS strict typing with shared buffers; use `ctx.createImageData` and `set`. (3) The enemy's intent is computed on a shallow copy with `turn` forced to the enemy, since `legalActions` returns nothing off-turn. (4) Chip cost badges overlapped names until the chip got top padding.

### 2026-10-08 · Phase 3 sprites pass 1
**Contract.** One sprite per card, token and enemy as code; registry wired behind ArtProvider; coverage test; contact sheet reviewed; level effects; integer scaling on the board.
**Evidence.** `npm run check` green (105 tests); `npm run sprites:sheet` → reports/sprites-sheet.png opened and reviewed; `npm run shoot -- battle-wave3 levels` reviewed.
**Gotchas.** (1) The board drew 32px canvases at 48px CSS, a ×1.5 scale that ART.md forbids; cells grew to 72px so sprites draw at an exact ×2. (2) Drawing 74 sprites in one pass is parallel work: four artists, one file per Origin group, each with its own validate-and-look loop before registering.

### 2026-10-08 · Phase 4 run loop
**Contract.** Run types, map generator, Drift maths, run reducer with every node type, Rekindling, Sigils, relics; run bot and `sim:runs`; run store with save/resume mirroring the battle store; run screens; e2e run test.
**Evidence.** `npm run check` green (114 tests); `npx playwright test` 5 passed; `npm run sim:runs -- --runs 60 --seed 3` 0 errors; `npm run shoot -- run-warden run-drift run-map run-muster run-market run-hearth run-shrine` reviewed.
**Gotchas.** (1) The battle store must be dropped when any non-battle run action arrives, or the battle overlay stays on screen after the run has moved on. (2) The enemy's last summon of a wave can resolve the Clash inside the same applyAction, so the run reducer never assumes a battle action leaves the battle in 'action'. (3) The Ferryman's first reach is free, which an e2e test forgot when asserting the third Drift slot costs 1✦. (4) The boss cannot "retreat" on the wave limit; the run ends either way.

### 2026-10-08 · Phase 5 enemies and boss
**Contract.** Elite units as content with sprites; elite boards; boss Kiln Breath and phase flags; greedy 1-ply AI with Clash lookahead and the `enemyIntent` ladder; tests for elites, boss phases, scripted fights and the greedy AI; elite and boss scenarios; "dark next" lane marker; 1,000 runs per Warden.
**Evidence.** `npm run check` green (122 tests); `npx playwright test` green; `npm run sim:runs -- --runs 1000 --seed 11 --warden 0|1|2` → reports/runs-11.json, 0 errors; `npm run shoot -- elite0 elite1 elite2 boss boss-wave3 boss-wave5` opened and reviewed.
**Gotchas.** (1) `effects.test.ts` wants every number in a unit's rules text in its DSL data and a DSL trigger behind every "Wave Start:" / "Wave End:" prefix, so engine-hook units word their text as "At Wave End, …" with numbers as words. (2) The greedy AI is cheap enough (about 4 s per 30 runs) because it prunes to three cells per card and passes both sides rather than searching the opponent's replies. (3) A glyph like ◌ is not in Pixelify Sans; markers are words.

### 2026-10-08 · Phase 6 balance harness
**Contract.** tools/balance.ts with the five PROMPT metrics and the four bands; ANIM_MS exported for the time model; report to reports/.
**Evidence.** `npm run balance -- --runs 1000 --seed 2 --mirrors 24` 0 errors, 3 + 1 bands pass (see above); `npm run check` green.
**Gotchas.** (1) Identical decks under a deterministic AI draw almost every mirror, so first seat is measured on seat-swapped pairings of different comps. (2) Candle Thief's Kindle takes the player's ember on the enemy's turn; a spend split must attribute ember drops to the side that acted. (3) Pay and interest land inside the battle action that ends the battle, not on "continue".

### 2026-10-08 · Phase 7 juice and onboarding
**Contract.** settings.ts, audio.ts (ZzFX + Tone), save.ts (IndexedDB), tooltip.tsx, tutorial.tsx, SettingsPanel.tsx; store frames carry sfx and the clock scales by the speed setting; e2e onboarding.spec.ts (5 tests).
**Evidence.** `npm run check` green (124 tests); `npx playwright test` 10 passed; `npm run shoot -- "run-drift?tutorial=1" "run-battle?tutorial=1" run-over` reviewed.
**Gotchas.** (1) Headless Chromium does run WebAudio: Tone's transport reports 'started', so the music test is real. (2) `page.evaluate` serialises objects, so a debug `state()` method must be called inside the page. (3) ESLint's no-sparse-arrays rejects ZzFX's usual `[,,440,...]` style; write `undefined`. (4) The tutorial must step aside for a Rekindle offer, which can appear on the third take of the opening Drift.

## Loop: gloom art pass (2026-10-08)
Daniel: "it looks like a windows menu (cards), I want more of a gloomy theme as well with torchlite and shadows".
- Added `src/ui/gloom.css` + `Gloom.tsx`: near-black wet-stone background, two flickering torch glows and a drowned
  teal light, vignette, slate card/panel frames with bronze hairlines and lit art windows, iron/ember buttons,
  rising embers and a lantern on the title. `run-title` scenario added for screenshots.
- Evidence: shots/run-title, run-warden, run-drift, battle-wave3, run-market, card-inspect (looked at all six).
- `npm run check` green (124 tests), Playwright 10/10.

## Loop: phase 8 (2026-10-08)
- Added traits tests for Artillery 2, Kindler 2, Martyr 2, Spirit 2; Martyr 2 failed because the dying unit had left
  the board before the tier was read. Fixed in engine.ts (tier read before removal), golden replay `martyr-2-heal`.
- Static build probe: dist served by `python3 -m http.server` under /Emberward/, Playwright clicked New run, no errors.
- Pages workflow, README, CREDITS. `npm run check` + `npm run e2e` green before the commit.

## Loop: elite tuning (2026-10-08)
- Per-battle probe over 150 runs per Warden: fights and the boss are won by every Warden; elites decide runs. The
  Choir Abbot at 3–8% for every Warden was the outlier; the Brazier Knight next.
- Abbot refill capped at two cells (flag), Abbot 6→4 HP; Knight 3/8→2/6, heal capped at 2 (flag). Elite rule texts
  updated; tests updated (refill order and count, heal cap). Numbers and the ten rejected Bell-Keeper nerfs in
  DECISIONS.md, Elite tuning. `npm run check` green (129 tests). Balance report re-run follows.
- Balance report after the elite tuning (1,000 runs, seed 4): wins Lamplighter 46%, Ferryman 43%, Bell-Keeper 94%;
  first seat 50% PASS; median 17.5 min PASS; include-win FAIL (Bell-Keeper cards dominate the list because the
  Bell-Keeper wins); Abyssal 4-tier FAIL. The elites were the only thing the Bell-Keeper lost to, so softening them
  raised it further: the next loop must take something from the Bell-Keeper itself (candidates: starting HP, starting
  embers, or a weaker Cracked Bell), measured against the same probe.
- Bell-Keeper handicaps (40 HP, 35 HP, 5 embers, combined with Shield nerfs and no Bulwark): 94–96% every time.
  Stopped; logged as Question 5. The Warden is the easy one for the demo.

## Loop: reward screen (2026-10-08)
- The reward screen was one line and a button on an empty page. It is now a lit tablet: a heading, a line that says
  how the battle ended (kill or wave limit), salvage rows (Pay, Interest, Relic, Sigil), the Anchorstone survivors
  and the Continue. Evidence: shots/run-reward.png. check + e2e green.
- Shrine events sit on the same tablet (shots/run-shrine.png).
- Deck chips (both strips in battle) now carry the card's sprite with the name and stats over it, stats and shape on
  one line, the enemy's "next" marker on top. shots/battle-wave3.png, card-inspect.png.
- First-fight losses (bot): the starting decks alone, scripted vs scripted, are deterministic: the Lamplighter stalls
  against fight 1 and the Ferryman against fight 2 to the wave limit every time, the Bell-Keeper wins all three. In
  runs the opening Drift changes that (87% / 74% / 100% at the first fight). The scripted bot never casts spells, so
  a person does better; no tuning from this.
- Warden select: each card gets a lit portrait (its signature card at 4×), 2× deck sprites in framed cells and a
  one-line hint; the four cards now fill the 720px height. shots/run-warden.png.
- Market stalls share one height so the Buy and Hold buttons sit on a single counter line (shots/run-market.png).
- Production build verified: `vite preview` on the e2e port, full Playwright suite 10/10 against the built bundle
  (save/resume, tutorials, audio hooks, a whole bot run). The artifact build for Daniel is this bundle.
- Drift inspect card no longer runs off the bottom of a 720px window (top-aligned, sticky); shots/run-drift-inspect.png.
- Balance report seed 5 (1,000 runs): wins 49% / 44% / 95%; first seat 50% PASS; 17.4 min PASS; 4-tiers reachable PASS
  this time (Abyssal reached); include-win FAIL on the Bell-Keeper's cards as before.

## Loop: keyboard (2026-10-08)
- Battle: 1-9 select the nth unspent card in your strip (then the board highlights cells as with a click); E or
  Enter ends the turn; Escape clears. The turn hint says so.

## Loop: click-through (2026-10-08)
- A Playwright probe played whole runs with only clicks and keys (1 then a lit cell, E to end the turn; Rekindle,
  Drift, map, Muster, reward, Market, Hearth, Shrine, Scout), three Wardens, no console errors, no 404s but the
  favicon. Random placement loses to the first elite, as expected without spells.
- Fixed from its screenshots: the battle-over line read "A Warden fell. You 50♥ · Enemy -8♥" on a win; it now says
  whose Warden fell and clamps HP at 0. The Scout screen was a bare list over a full-width button; it sits on the
  shrine tablet (shots/run-scout.png, scenario run-scout). Added a pixel-ember favicon (public/favicon.svg).

## Loop: crash safety (2026-10-08)
- There was no error boundary: a render error would have left Daniel a blank page. `ErrorBoundary` now shows a lit
  panel ("The lantern gutters.") with Reload and Start fresh (drops the saved run). Debug builds expose
  `__game.crash()`; e2e covers panel → Start fresh → title (shots/crash.png).
- A saved run that does not look like a RunState (older build, damaged store) is ignored at boot instead of being
  resumed; `looksLikeRun` unit-tested.
- Click-through batch 2 (seeds c4 to c7, random placement, no spells): two of four runs beat the boss (Bell-Keeper
  28♥ left, Lamplighter 33♥ left); the other two died to elites. Fights and the boss stay easy, the elites decide,
  as the bot said. Left as is for the demo (BAL-002 open).
- Why the Ferryman probe bled: one unit a turn left three lanes open, 27 face damage in six waves, then 8 more as the
  wave-limit difference (Question 6). The "Arrows show the Clash" coach card now says an uncovered lane lets attacks
  through to your Warden.
- Click-through batch 3 (seeds c8 to c11): no errors, no stuck screens. Boss beaten by random placement in 2 of 4
  again (Ferryman 39♥, Bell-Keeper 33♥); the other two died to an elite and a late fight. Across eight random runs,
  4 boss wins: fights and the boss are soft for anyone who covers lanes; the elites carry the difficulty. Tune after
  Daniel's first plays (BAL-002).

## Loop: hosting (2026-10-08 06:40Z)
- Daniel chose "Make repo public" on the hosting card. pages.yml deploys on push to main again; the repository
  is still private at this writing, so the first run waits for the visibility change, then
  https://greystone-dan.github.io/Emberward/ is the demo address.
