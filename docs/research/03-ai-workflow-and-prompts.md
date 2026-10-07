# 03 — AI-Agent Workflow, Architecture & Prompt Templates

_Research for: browser rogue-lite + card game + auto-battler hybrid built end-to-end by Claude Code (cloud container, Node, Playwright/Chromium). Tailored to `/mnt/project-files/design/design-notes.md`. Researched 2026-10-07._

**Legend:** **[src]** = backed by a cited source · **[rec]** = my recommendation (synthesis, not from a source) · **[unverified]** = seen only in secondary/aggregator sources or not checked first-hand.

---

## TL;DR

1. **Build the game as a pure, seeded, headless TypeScript simulation first**, with rendering as a thin layer on top. Determinism is what lets an agent test, replay bugs, run balance sims and screenshot reliably. [src: solodevstack; Anthropic C-compiler post; OpenAI develop-web-game skill]
2. **The agent needs a check it can run** (tests, sim CLI, screenshots). "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal." [src: Claude Code best practices]
3. **Make state survive across sessions on purpose**: a `features.json` checklist (pass/fail), a `PROGRESS.md` log, a `DECISIONS.md` log, and git commits. Start every session by reading them. [src: Anthropic "Effective harnesses"]
4. **Content is data**: cards are JSON/TS records with a small effect DSL (trigger, target selector, op). Adding a card should never mean writing new engine code. [src: liminalwarmth; rec]
5. **Let the agent see the game**: expose `window.__game.renderToText()` + `advanceTime()` + `dispatch()`, then run Playwright to take screenshots and actually look at them. [src: OpenAI develop-web-game skill]
6. **Keep the reviewer separate from the builder**: a fresh-context subagent or session judges the work against the spec and grades with Playwright. [src: Anthropic "Harness design"; best practices]
7. **Build a vertical slice first** (one battle, about 8 cards, 2 statuses, a text renderer), then the run loop, then content, then polish. [src: howdoiuseai; rec]

---

## 1. Key sources and what they say

| Source | Takeaways for this project |
|---|---|
| Anthropic, *Effective harnesses for long-running agents*: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents | An initializer session writes `feature_list.json` (200+ end-to-end features, all "failing"), `claude-progress.txt` and `init.sh`. Each later session runs `pwd`, reads the progress file and git log, checks the app still works, then does **one feature**. Use JSON, not Markdown, for the feature list, because the model is less likely to rewrite it. "It is unacceptable to remove or edit tests." Without explicit prompting, "Claude tended to mark a feature as complete without proper testing", so require browser end-to-end checks. |
| Anthropic, *Harness design for long-running apps*: https://www.anthropic.com/engineering/harness-design-long-running-apps | Planner → Generator → Evaluator. Run solo, a **2D retro game maker** came out broken ("entities appeared on screen but nothing responded to input"). With the harness (about 6 h, about $200) it was playable. **Sprint contracts**: before building, the generator proposes what it will build and how it will be verified, and the evaluator approves (27 criteria for one level-editor sprint). The evaluator uses **Playwright** to click through and screenshot, and caught things like "rectangle fill only places tiles at drag start/end". "Every component in a harness encodes an assumption about what the model can't do on its own", so simplify the harness as models improve. |
| Anthropic, *Building a C compiler with parallel Claudes*: https://www.anthropic.com/engineering/building-c-compiler | "The task verifier [must be] nearly perfect, otherwise Claude will solve the wrong problem." Test harnesses should print **a few lines** and log details to a file, with errors written as `ERROR <reason>` on one line so grep finds them. Agents are time-blind, so provide a `--fast` mode that runs a 1–10% sample. Keep READMEs and progress files updated so a fresh container can find its bearings. Comparing against a known-good **oracle** is a useful debugging tool. |
| Claude Code best practices: https://code.claude.com/docs/en/best-practices | Give Claude a way to verify its work. Work in the order explore → plan → implement → commit. Keep CLAUDE.md short: "Would removing this cause Claude to make mistakes? If not, cut it." Use **skills** for knowledge needed only sometimes, **hooks** for must-always actions (for example a Stop hook that runs checks), and subagents for investigation and adversarial review. After two failed corrections, `/clear` and start again with a better prompt. Have Claude interview you and write a SPEC, then implement in a fresh session. Ask the reviewer to flag only correctness and requirement gaps, to avoid over-engineering. |
| OpenAI `develop-web-game` skill (Codex; mirrored for Claude Code), e.g. https://playbooks.com/skills/davila7/claude-code-templates/develop-web-game · https://skills.sh/firecrawl/skills/develop-web-game | Loop: implement small → act → pause → observe → adjust. Expose **`render_game_to_text`** (concise JSON of on-screen state) and **`window.advanceTime(ms)`** for deterministic stepping. Run a Playwright client after each change. "You must actually open and visually inspect the latest screenshots… not just generate them." Keep a `progress.md` with the original prompt at the top. _(I read it via mirrors; I could not fetch the canonical openai/skills path, so it is **[unverified]** whether the content matches upstream exactly.)_ |
| *Week 3 Roguelike Vibecoding Tips*: https://liminalwarmth.substack.com/p/claude-code-context-lessons | "The engine is the hardest part to get right." Once it is solid, Claude extends it reliably. Use data-driven, action-driven design with small files. Write tests first, then smoke-test, then run a reviewer subagent, with periodic architecture audits. Pitfalls: stale CLAUDE.md, Claude reinventing existing tools, and architecture rotting without guardrails. |
| *Deterministic simulation architecture for a roguelike*: https://solodevstack.com/blog/deterministic-simulation-architecture-roguelike | The sim takes only (inputs, seed) and "never asks a node a question". You get headless tests of thousands of runs, daily seeds and shareable seed links almost for free. Wiring the sim into the scene graph "costs you every day after." |
| *How to vibe code a 3D game that doesn't fall apart*: https://howdoiuseai.com/blog/2026-08-14-how-to-vibe-code-a-3d-game-that-doesn-t-fall-apart | Ask for **systems, not demos**. Add polish last. Commit often. "A vertical slice you can actually play tells you more in ten minutes than a thousand-word spec." |
| Vibe Jam 2025 recap: https://vibecoding.app/events/recap/pieter-levels-vibe-code-game-jam-2025 · 2026 guide: https://www.summerengine.com/blog/cursor-vibe-jam-2026-guide | 1,170 entries, mostly single-player, no-backend browser games built in 7 days with Cursor, Claude Code, Bolt and similar tools. The format works because scope is small, the game is a static site and demos are instant. Lesson: keep the browser build static and instantly playable. _(Winner details and the "80% AI code" rule are **[unverified]**: the recap I read did not state them.)_ |
| Super Auto Pets trigger glossary: https://superautopets.wiki.gg/wiki/Glossary | A reference trigger vocabulary (Buy, Sell, Start of battle, Faint, Friend faints, Friend summoned, Knockout, Level-up, End turn, Start of turn…). Simultaneous triggers resolve in **attack order** (highest attack first). Your game needs an equally explicit, documented ordering rule. |
| GitHub Spec Kit: https://github.github.com/spec-kit/ | A spec → plan → tasks workflow. It is worth copying the **shape** (spec, plan, tasks files); the tool itself is optional. [rec] |
| Playwright MCP: https://playwright.dev/mcp/introduction | Drives the browser through accessibility-tree snapshots with element refs, not pixels. Good for DOM UIs. **Canvas content is invisible to the snapshot**, which is another reason to render cards and the grid in the DOM or expose `renderToText`. |
| Monte Carlo balancing skill (Godot): https://www.skills.sh/thedivergentai/gd-agentic-skills/godot-monte-carlo-balancer | "Source-extracted, zero config": the balance sim reads the **live game data files**, so its numbers never drift from the game. Copy the idea: the sim imports `src/content/*` directly. |

---

## 2. Recommended architecture (tailored to the design)

### 2.1 Layering [rec, grounded in the sources above]

```
src/
  core/            # PURE. No DOM, no Date.now, no Math.random. Imports nothing from ui/.
    rng.ts         # seeded PRNG (e.g. mulberry32/sfc32), state stored IN GameState
    types.ts       # GameState, BattleState, Unit, Card, Status, Action, GameEvent
    grid.ts        # coords, adjacency, row/column/direction helpers, pattern resolution
    actions.ts     # applyAction(state, action) -> { state, events } (the only mutator)
    battle/        # deploy-phase rules, wave resolution, trigger queue, statuses, win check
    run/           # run state machine: map -> node -> battle|shop|event -> reward -> ...
    effects/       # effect DSL interpreter: selectors, conditions, ops
    ai/            # opponent policies + playtest bots (random, greedy, lookahead)
  content/         # DATA ONLY: cards.ts, statuses.ts, enemies.ts, encounters.ts, relics.ts
  ui/              # renders GameState; turns clicks into Actions; never changes state directly
  debug/           # window.__game hooks, overlays, seed/replay tools
tools/
  sim.ts           # CLI: run N battles/runs headless, write JSON + a short summary
  balance.ts       # per-card stats, dominance report
  shoot.ts         # Playwright: load a seed/scenario, screenshot named views
tests/             # vitest unit + golden replays; e2e/ for Playwright
```

**Hard rules:** `core/` is deterministic and serializable (JSON round-trip). All randomness goes through `state.rng`. The UI dispatches `Action`s only. Every state change emits `GameEvent`s, which drive animations, logs and tests alike.

### 2.2 Design notes mapped to code

| Design element | Modelling suggestion |
|---|---|
| **4x3 grid per side** | `GRID = { cols: 4, rows: 3 }` as constants. **Open question:** is it 4 columns x 3 rows (rows = depth: front, mid, back) or the reverse? Keep it configurable. Cell = `{side, col, row}`. Row 0 is the **front** (nearest the enemy) for both sides, so mirroring is trivial. |
| **Directional / positional attacks** | Attack patterns are data, not code: `attack: { pattern: "forward_first" \| "forward_line" \| "column_pierce" \| "cone" \| "back_row_snipe" \| "adjacent_sweep", range?, damage }`. `grid.ts` resolves a pattern from an attacker cell into target cells. Every pattern gets a table-driven unit test (ASCII grid in, targets out). |
| **Adjacency synergies** | `adjacent(cell)` means orthogonal neighbours (decide whether diagonals count and record it in DECISIONS.md). Use selectors such as `{select:"adjacent_allies"}` and triggers such as `onAdjacentAllyDeployed`. Aura buffs are **recomputed** from the board at defined points, not stored as permanent mutations, which avoids stacking bugs. |
| **Commit placement, moving costs, per-monster movement** | `Unit.move: number` (0 = turtle, 2 = flanker). Movement happens at "start of round" per the notes. A paid reposition is an `Action {type:"move", unitId, to}` with a `cost` (gold, or the cost decided later). Validation lives in `actions.ts`, and illegal moves return an error without changing state. |
| **Wave-based combat in one battle** | Battle FSM: `deploy(turn: P1/P2 alternating) → wave_resolve → upkeep(status ticks) → check_end → deploy …`. Each deploy turn allows **one action** (play as monster, move card to hand, cast spell from hand, fuse, reposition, pass). "Pass" must always be legal, per the design goal that players are never forced to play a monster. |
| **Alternating placement** | Track `initiative`. Measure first-player win rate in sims, since alternating placement often favours one seat. Mitigations (swap each wave, compensation gold) are balance knobs. |
| **Dual-purpose cards** | One `CardDef` with both `monster: {...}` and `spell: {...}`. A card **instance** in the run has `mode: "monster" \| "spell" \| "undecided"` chosen on acquisition (per the notes). Keep it as a field so a later redesign (choose at play time) is a one-line rule change. |
| **Face-up deck, no random draw** | Zones: `deck` (ordered, visible), `hand`, `board`, `bench`?, `discard/exhausted`. "Move to hand" is an action, and "cast from hand" costs gold on a later turn. Since nothing is hidden, `renderToText` can show everything, which makes the game easy for bots and the agent to reason about. |
| **Unified gold resource** | One `gold` number on the run state, used both in the shop and in battle. Every gold change emits an event (`GOLD_CHANGED {delta, reason}`), so sims can chart the "spend now vs save" curve. Monsters deploy free (tentative) and spells cost gold, both set in data. |
| **Fusion** | `fuse(unitA, unitB)` with the same `defId` → level+1. Stats come from `levels: [{atk,hp}, …]` in data. Triggers: `onFuse`. Decide whether 2 or 3 copies are needed and record it in DECISIONS.md. |
| **Status effects** | A `StatusDef` registry: `poison` (stacks, ticks in **upkeep between waves**), `armor` (absorbs damage before HP and breaks), `shield` (blocks the next hit), `regen/heal`, `buff/debuff` (duration in waves), `stun` (skips attack). Each status declares its hooks (`onUpkeep`, `onDamageTaken`…), so statuses are content, not engine branches. |
| **Battle win condition (undecided)** | Isolate it in one function, `checkBattleEnd(state)`, and keep the leading option (player HP buffer, with leaked damage from unblocked lanes or surviving units) behind a config flag so sims can compare the options. |
| **Run flow** | Run FSM: `map → (battle \| shop \| event \| rest) → reward → map … → boss → victory/defeat`. Per-run upgrades only (artifacts/trainers) live in `run.relics`. |

### 2.3 Effect DSL sketch [rec]

```ts
// content/cards.ts — data only
{
  id: "ember_fox", name: "Ember Fox", tier: 1, shopCost: 3, tags: ["beast","fire"],
  monster: {
    atk: 2, hp: 3, move: 2,
    attack: { pattern: "forward_first" },
    abilities: [
      { on: "startOfWave", if: { adjacentAllies: { tag: "fire", min: 1 } },
        do: [{ op: "buff", target: "self", atk: 1, duration: "wave" }] }
    ],
    levels: [{ atk: 2, hp: 3 }, { atk: 4, hp: 5 }, { atk: 7, hp: 8 }]
  },
  spell: {
    cost: 2, target: { select: "enemy_row", choose: "player" },
    do: [{ op: "applyStatus", status: "burn", stacks: 2 }]
  },
  text: "Start of wave: +1 ATK if next to a Fire ally. / Spell: Burn 2 to an enemy row."
}
```

- **Triggers (initial set):** `onDeploy, onStartOfWave, onBeforeAttack, onAttack, onDamaged, onFaint, onKill, onAllyFaint, onAdjacentAllyDeployed, onEndOfWave, onUpkeep, onMove, onFuse, onCast, onBuy, onSell, onBattleStart, onBattleEnd`.
- **Selectors:** `self, adjacent_allies, row, column, front_enemy, lane_enemy, all_enemies, random_enemy (seeded), lowest_hp_ally, player_choice`.
- **Ops:** `damage, heal, buff, debuff, applyStatus, removeStatus, summon, move, gainGold, moveCardToHand, transform`.
- **Trigger queue:** FIFO with a **documented deterministic order** (e.g. active side first, then column then row index; ties never use `Math.random`). Cap it at a max depth (e.g. 200), returning `ERROR TRIGGER_LOOP` to prevent infinite loops. SAP's "highest attack first" rule is the precedent. [src: SAP glossary]
- **Card text:** generate it from the DSL, or validate it against the DSL in a test, so text and behaviour can't drift. [rec]
- **Validation:** a schema test (zod or plain TS types plus a test) runs over every card: unknown op/selector/trigger means the test fails.

### 2.4 Debug and agent-visibility hooks (from the develop-web-game pattern)

```ts
window.__game = {
  seed, getState(), renderToText(),      // compact JSON or ASCII of the current screen
  dispatch(action), legalActions(),       // drive the game without clicking pixels
  advanceTime(ms), skipAnimations(true),  // deterministic stepping; instant mode for tests
  loadScenario(name | json),              // jump straight to "wave 3 vs poison deck"
  exportReplay(), importReplay(r)         // seed + action list = the full bug report
};
```

- Add a **debug overlay** (`?debug=1`) that shows cell coordinates, unit ids, active statuses, the trigger queue and the last 20 events.
- Use an ASCII board in `renderToText` so the agent can read the battle in its terminal:
  ```
  ENEMY  r2 [ .  ][Gob2][ .  ][ .  ]
         r0 [Wlf3][ .  ][Sk1p][ .  ]   ← front
  YOU    r0 [Fox2*][ . ][Trt1][ .  ]   * = poison 2
  ```

---

## 3. Verification loops (ranked by cost and value)

| Loop | What | When |
|---|---|---|
| **Unit and rule tests** (vitest) | Grid patterns, adjacency, each status, each op, trigger ordering, fusion, gold accounting. Table-driven with ASCII fixtures. | Every change. Must stay under about 10 s. |
| **Golden replays** | `tests/replays/*.json` = seed + actions + expected final-state hash and key events. Every fixed bug adds one. | Every change. Catches regressions, the top pitfall in AI-built games. |
| **Invariant / fuzz sim** | Random-legal bots play 1k battles: no exceptions, HP never NaN, gold ≥ 0, battles end within N waves, no trigger loops. Errors print `ERROR <reason> seed=<n>`. | `npm run check`, using the `--fast` sample [src: C-compiler post] |
| **Balance Monte Carlo** | 10k+ battles with greedy/lookahead bots. Per-card **win-rate delta when included**, pick rate, average waves per battle, first-seat win rate, gold-spent-in-battle vs shop, status damage share. The sim imports live `content/` [src: balancer skill]. Prints a **10-line summary** and writes full JSON to `reports/`. | Balance passes; nightly/CI |
| **Playwright smoke + screenshots** | Load fixed scenarios with `?seed=&scenario=`, click through main menu → map → shop → battle → reward, take named screenshots, collect console errors. The agent must **open and look at** the PNGs. | After UI changes; at end of each session |
| **Visual regression** | `expect(page).toHaveScreenshot()` on 5–10 stable scenarios with animations off. | After UI is stable (not during early churn) |
| **Evaluator review** | A fresh-context subagent or session grades a feature against its sprint contract and criteria (functionality, rules match spec, UX clarity, visual craft), using Playwright. | Before marking a feature "passing" |

**Bots:** `random` (fuzzing), `greedy` (one-ply: try each legal action on a cloned state, score by a board-value heuristic) and `lookahead` (N rollouts per action, possible because the sim is pure and cheap). The greedy bot doubles as the **enemy AI** at first. [rec]

**Watch out:** don't let balance tests "assert" exact win rates. Assert **bands** (e.g. no card above a 60% include-win-rate, first seat between 45% and 55%) and report the rest. [rec]

---

## 4. Recommended workflow for this project

### Phase plan ("vertical slice first")

| Phase | Deliverable | Exit check |
|---|---|---|
| **0. Spec and scaffold** | `docs/SPEC.md` (rules as precise as possible, open questions listed), `docs/DECISIONS.md`, `features.json` (all `"passes": false`), Vite + TS + Vitest + Playwright, `npm run check`, CLAUDE.md, `init.sh`. | `npm run check` green on an empty game |
| **1. Headless battle core** | Grid, 6–8 cards (data), 3 attack patterns, 2 statuses (poison, armor), alternating deploy, 3 waves, win check, seeded RNG, ASCII `renderToText`, `tools/sim.ts`. | 1k random battles with no ERROR; golden replays pass |
| **2. Playable battle UI** | DOM grid and cards, click to deploy/move/cast/pass, event-driven animation queue (skippable), debug overlay, `window.__game`. | Playwright plays one battle to the end; screenshots reviewed |
| **3. Run loop** | Map, shop (unified monsters and cards, single gold), dual-purpose choice on acquire, face-up deck, deck add/remove, rewards, per-run relics, 3 enemy encounters plus a boss. | A bot completes a full run headless; Playwright completes a run on seed X |
| **4. Systems breadth** | Fusion, movement costs, the full trigger set, more statuses, persistence-granting cards. | Each feature has tests plus a replay |
| **5. Content and balance** | 40–80 cards, encounter tuning, balance reports per pass. | Balance bands met |
| **6. Juice and art** | Consistent art direction, SFX, tooltips, onboarding. | Visual regression baseline; evaluator UX grade |

### Per-session protocol (put in CLAUDE.md) [src: Effective harnesses; rec]

1. `cat PROGRESS.md | tail -60`, `git log --oneline -15`, read `features.json` (failing items), `npm run check`.
2. If anything is red, **fix that first**.
3. Pick **one** feature or task. Write or confirm its acceptance criteria (a mini sprint contract) in PROGRESS.md.
4. Write failing tests or a replay → implement → `npm run check` → (UI) `npm run shoot` and look at the screenshots.
5. Use a fresh-context reviewer subagent for anything non-trivial.
6. Flip `passes` in `features.json` **only** with evidence. Append to PROGRESS.md (what was done, evidence, next step, gotchas). Commit.

### Guardrails

- **Hooks:** a Stop hook runs `npm run check:fast`, and a SessionStart hook runs `npm ci` in cloud sessions. [src: best practices; the session-start-hook skill exists in this environment]
- **Scope control:** new ideas go to `docs/IDEAS.md`, never straight into code. The agent may not change `docs/SPEC.md` rules without logging the change in DECISIONS.md and flagging it for Daniel.
- **Context hygiene:** test and sim output stays at 10 lines or fewer, with detail in `reports/` and `logs/`. `/clear` between unrelated tasks. Use subagents for codebase exploration. [src: C-compiler post; best practices]
- **Model the decision points the design leaves open** as config flags, so sims can compare options (win condition, adjacency with or without diagonals, fusion copies, move cost).

---

## 5. Draft `CLAUDE.md` for the game repo

```markdown
# <Game Name> — Card Roguelite Auto-Battler (browser)

Design source of truth: docs/SPEC.md (rules) · docs/DECISIONS.md (why) · docs/IDEAS.md (parked ideas)
Progress: PROGRESS.md (append-only log) · features.json (pass/fail checklist, NEVER delete or weaken entries)

## Commands
- `npm run dev`            Vite dev server (http://localhost:5173, ?seed=N&scenario=NAME&debug=1)
- `npm run check`          typecheck + lint + unit + golden replays + fast fuzz sim (must be green before commit)
- `npm run check:fast`     same, sampled (~10s)
- `npm run sim -- --battles 1000 --bot greedy --seed 1`   headless sims → summary + reports/sim-*.json
- `npm run balance`        10k-battle balance report → reports/balance-*.md
- `npm run shoot -- <scenario...>`  Playwright screenshots → shots/<scenario>.png (OPEN AND LOOK AT THEM)
- `npm run e2e`            Playwright end-to-end (full run on fixed seed)

## Architecture (do not violate)
- src/core is PURE and DETERMINISTIC: no DOM, no Date.now, no Math.random, no imports from src/ui.
  All randomness via state.rng. GameState must JSON round-trip.
- The ONLY way to change state: applyAction(state, action) -> {state, events}. UI dispatches Actions and renders events.
- Content (cards, statuses, enemies, encounters, relics) is DATA in src/content using the effect DSL
  (trigger / condition / selector / op). Adding content must not require engine edits; if it does,
  add a generic DSL op/selector + tests first.
- Trigger resolution order is defined in src/core/battle/triggers.ts and documented in SPEC §Triggers. Never use randomness to break ties.
- Grid: 4x3 per side, row 0 = front (facing enemy). Adjacency = orthogonal (see DECISIONS #?).

## Game rules quick ref (details in SPEC.md)
- Battle = alternating deploy turns (1 action each: play-as-monster | move-card-to-hand | cast-from-hand | fuse | reposition | pass)
  → wave resolves → upkeep (statuses tick) → repeat until checkBattleEnd.
- One gold resource for shop AND in-battle spells. Every gold change emits GOLD_CHANGED.
- Cards are dual-purpose (monster + spell); instance.mode chosen on acquire. Deck is face-up; no random draw.

## Workflow rules
- Start of session: read tail of PROGRESS.md, `git log --oneline -15`, failing items in features.json, run `npm run check`. Fix red first.
- Do ONE feature per loop. Write acceptance criteria first, then failing test/replay, then code.
- Every bug fix adds a golden replay in tests/replays/.
- Mark a feature passing only with evidence (test name, sim summary, screenshot path) recorded in PROGRESS.md.
- UI changes: run `npm run shoot` and inspect the PNGs before claiming done.
- Tool output must be short: print ≤10 lines, write details to reports/ or logs/. Errors as `ERROR <reason> seed=<n>`.
- Don't invent rules. Ambiguity → choose the simplest option behind a config flag, log in DECISIONS.md, flag in PROGRESS.md "Questions for Daniel".
- New ideas → docs/IDEAS.md, not code.
- Commit after each green loop with a descriptive message.

## Gotchas
- (append real ones as they are found: e.g. "aura buffs are recomputed, never stored")
```

_(Keep it this short. Move long how-tos into `.claude/skills/` (e.g. `add-card`, `balance-pass`, `playtest`) so they load only when needed. [src: best practices])_

Suggested `features.json` entry shape [src: Effective harnesses]:
```json
{ "id": "BATTLE-007", "area": "battle", "desc": "Poison ticks during upkeep between waves, before deploy",
  "verify": ["unit: statuses.poison.ticksInUpkeep", "replay: poison-kills-between-waves"], "passes": false }
```

---

## 6. Reusable prompt templates

Fill in `<…>`. Each one ends with an evidence requirement. These work well as `.claude/skills/<name>/SKILL.md` or `.claude/commands/`.

### 6.1 Session kickoff (autonomous loop)
```
Get your bearings: tail PROGRESS.md, git log -15, list failing features.json items, run `npm run check`.
If anything is red, fix it first. Otherwise pick the highest-priority failing feature <or: feature ID X>.
Before coding, write a sprint contract into PROGRESS.md: what you'll build, files touched, how it'll be verified
(test names, replay names, screenshots). Then implement with tests first. Finish with `npm run check`
(and `npm run shoot` if UI changed — open the PNGs and describe what you see). Update features.json only with evidence,
append a PROGRESS.md entry (done / evidence / next / gotchas), commit. Stop after one feature.
```

### 6.2 Add a new card
```
Add card "<name>" to src/content/cards.ts.
Monster side: ATK <a>, HP <h>, move <m>, attack pattern <pattern>, abilities: <plain-English>. Levels: <…>.
Spell side: cost <g> gold, target <…>, effect: <plain-English>.
Rules:
- Express it ONLY with existing DSL triggers/selectors/ops. If something is missing, stop and propose the smallest
  generic DSL addition (name, semantics, tests) before implementing it.
- Add a unit test per ability using an ASCII-grid fixture, covering adjacency/direction edge cases (edge columns, empty front row).
- Ensure generated card text matches behavior (card-text test).
- Run `npm run sim -- --battles 2000 --focus <id>` and report include-win-rate vs baseline in ≤5 lines.
- Screenshot the card in the shop scenario and check it renders legibly.
```

### 6.3 Add a mechanic, status or trigger
```
Implement <status/trigger/mechanic> per SPEC §<x>. First, quote the spec text and list ambiguities;
resolve each with the simplest option behind a config flag and log it in DECISIONS.md.
Define exact timing in the battle FSM (deploy / wave / upkeep) and its place in trigger order.
Tests: timing, stacking, interaction with armor/poison/fusion/movement, and a golden replay.
Add 1–2 example cards using it. Run the fuzz sim (1k battles) and confirm no ERROR lines.
```

### 6.4 Balance pass
```
Run `npm run balance -- --battles 10000 --bot greedy`. Read reports/balance-latest.md.
Report in a table: top 5 and bottom 5 cards by include-win-rate delta, first-seat win rate, mean/p90 waves per battle,
avg gold spent in-battle vs shop, status damage share.
Targets: no card > +8% delta, none < −8%; first seat 45–55%; median battle 4–6 waves.
Propose ≤5 numeric changes (data only, no engine changes), each with rationale. Apply them, rerun, show before/after.
Do not change rules or add mechanics in a balance pass. Log the changes in docs/BALANCE_LOG.md.
```

### 6.5 Playtest and report (bot + visual)
```
Playtest seed <n> (and 2 random seeds) end-to-end:
1) Headless: run greedy bot through a full run; summarize floors reached, deaths, gold curve, any ERRORs.
2) Browser: `npm run e2e -- --seed <n>` and `npm run shoot -- menu map shop battle-wave1 battle-wave3 reward`.
   Open every screenshot and critique: readability of grid/directions/adjacency, whether statuses are visible,
   whether gold cost/affordability is clear, layout overflow, anything that looks broken.
3) Read window.__game.renderToText() at 3 points and confirm it matches the screenshot.
Output: a bug list (repro = seed + action index), UX issues ranked by severity, and 3 "fun" observations
(dead turns, dominant strategies, decisions that felt meaningful). Do not fix anything in this task — file items into features.json/IDEAS.md.
```

### 6.6 Fix a bug from a replay
```
Bug: <symptom>. Repro: replay <file> or seed <n> + actions <…>.
First write a failing test/golden replay that reproduces it. Find the root cause in src/core (not a UI patch),
fix it, run `npm run check`. Explain the cause in 2 lines in PROGRESS.md gotchas if it's a trap others could fall into.
```

### 6.7 UI screen / visual iteration
```
Implement the <screen> UI per docs/ui/<screen>.md (or the attached mock). Use existing tokens in src/ui/theme.css.
After each change, `npm run shoot -- <scenario>`, open the PNG, list differences from the spec/mock, fix, repeat (max 5 rounds).
Check at 1280×720 and 390×844. No state changes in UI code: dispatch Actions only.
```

### 6.8 Evaluator / reviewer (fresh-context subagent)
```
You are the evaluator. You did not write this code. Review feature <id> against its sprint contract in PROGRESS.md and SPEC §<x>.
Run `npm run check`, then use Playwright (`npm run shoot`/e2e) to exercise it in the browser. Grade 1–5 on:
rules correctness vs spec, test coverage of edge cases, UX clarity, visual craft. List ONLY gaps that break the spec or
correctness — not style preferences. Verdict: PASS / FAIL with repro steps.
```

### 6.9 Design-decision interview (with Daniel)
```
Read docs/SPEC.md open questions. Interview me (one question at a time, with 2–3 concrete options and the
trade-off each implies for the grid/wave/economy loop). After I answer, update SPEC.md + DECISIONS.md and add/adjust features.json items.
```

### 6.10 Architecture audit (periodic, e.g. every ~10 features)
```
Audit for drift: any Math.random/Date.now/DOM in src/core? Any card logic hard-coded in engine instead of DSL?
Duplicate helpers? Files > 400 lines? CLAUDE.md rules that are stale or ignored? Tests that are skipped or weakened?
Report findings with file:line; fix only clear-cut violations; propose the rest.
```

---

## 7. Pitfalls and mitigations (from the write-ups)

| Pitfall | Mitigation |
|---|---|
| Declaring victory early / features stubbed ("button toggles but no mic capture") [src: Harness design] | JSON feature list, evidence required, separate evaluator |
| Regressions as the codebase grows [src: howdoiuseai; liminalwarmth] | Golden replays for every bug, `npm run check` gate (Stop hook), frequent commits |
| Losing track of state across sessions [src: Effective harnesses] | PROGRESS.md + features.json + git log as the startup ritual |
| Context flooded by test/sim output [src: C-compiler] | ≤10-line summaries, details to files, `--fast` sampling |
| Stale or overlong CLAUDE.md gets ignored [src: best practices; liminalwarmth] | Prune regularly; move how-tos to skills; hooks for must-dos |
| Agent invents rules or expands scope | SPEC/DECISIONS/IDEAS separation; config flags for undecided rules |
| Game logic tangled into rendering [src: solodevstack] | Pure `core/`, lint rule forbidding ui imports in core |
| Canvas UI invisible to tooling [src: Playwright MCP docs] | DOM-rendered grid and cards, plus `renderToText` |
| Non-determinism makes tests and screenshots flaky [src: develop-web-game] | Seeded RNG, `advanceTime`, `skipAnimations` |
| Inconsistent art across sessions [general, **unverified** for card games specifically; see makko.ai: https://blog.makko.ai/ai-game-art-generator/] | A single `docs/ART.md` style guide plus design tokens. Start with a coherent **procedural/SVG/emoji-glyph + CSS** card frame system the agent can produce consistently. Add generated or bought art later in one batch with one fixed style prompt. |
| Over-engineering after reviewer nitpicks [src: best practices] | The reviewer reports correctness and spec gaps only |

---

## 8. Tools and MCP (brief)

- **Playwright** (library, already in the container): the main tool. Use scripts (`tools/shoot.ts`) for repeatable screenshots, and Playwright `toHaveScreenshot` for visual regression.
- **Playwright MCP** (`npx @playwright/mcp@latest`): interactive exploration through accessibility snapshots. Useful to the evaluator for ad-hoc poking. https://playwright.dev/mcp/introduction
- **Chrome DevTools MCP** (Google): console, performance traces. **[unverified]**, not researched here.
- **Godot MCP servers** (Coding-Solo/godot-mcp, GDAI MCP and others): only relevant if the project switched to Godot. Not recommended for a browser-first TS build. https://www.summerengine.com/blog/best-godot-mcp-server
- **Claude Code features:** skills (`.claude/skills/add-card`, `balance-pass`, `playtest`), subagents (`.claude/agents/evaluator.md`), hooks (Stop → check; SessionStart → npm ci), `claude -p` for scripted batch content generation. https://code.claude.com/docs/en/best-practices
- **Spec Kit** for spec → plan → tasks structure, if a formal flow is wanted: https://github.github.com/spec-kit/

---

## 9. Open questions to settle early (each affects architecture)

1. Is the grid 4 columns x 3 rows deep, or 3x4? Which way is "forward"?
2. Does adjacency include diagonals?
3. Battle end: player HP buffer? How is damage "leaked" (unblocked lanes, surviving units' attack, or a fixed amount per lost wave)?
4. Is monster vs spell chosen on acquisition (per the notes) or at play time? How many waves per battle (fixed, or until a condition)?
5. Fusion: 2 or 3 copies? Can units fuse mid-battle?
6. Reposition cost: gold or an action?
7. Do enemies use the same card system (recommended: yes, the same data with an AI policy) or a scripted wave list?
