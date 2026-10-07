# 05 — Opponent AI, Encounters, Procedural Generation & Simulation Balancing

_Research for the card roguelite auto-battler (4x3 grids, directional attacks, adjacency, alternating one-at-a-time placement, wave combat, dual-purpose cards, face-up no-draw deck, one gold resource, fusion, status effects). Compiled 2026-10-07. Targets: browser demo, then Steam, then iOS._

**How to read this.** Each section has the findings, then a **Recommendation** for this game. Sources are linked inline. **[UNVERIFIED]** marks things I recall but could not confirm against a primary source during this research (mostly decompiled Slay the Spire constants). **[DESIGN]** marks my own proposals, not established fact.

---

## TL;DR

1. **The game state is perfect information.** Decks are face-up, the board is visible and placement alternates. If wave combat is also deterministic (strongly recommended, as in Into the Breach), the opponent AI is a **two-player alternating game with no hidden information**. That allows **alpha-beta / beam minimax** within a wave, with a deterministic combat simulator as the transition function. ISMCTS (built for hidden information) isn't needed.
2. **Build one headless, deterministic, pure-function rules engine first** (TypeScript). The game, the AI, async ghosts and the balancing harness all run the same code. Every successful AI or balancing project here (sts_lightspeed, SabberStone, Forge, bottled_ai, The Sims Mobile study) depends on a fast headless simulator.
3. **AI ladder:** scripted intents (normal enemies) → greedy 1-ply plus combat lookahead (Normal) → beam alpha-beta within the wave (Hard / elites) → iterative-deepening search across waves with a bigger budget (bosses, ghost pilots). Make difficulty mostly with **rules and content** (Ascension-style modifiers), not by making the AI smarter.
4. **Telegraphing comes free:** the enemy's face-up deck *is* its intent queue. Show "next card + preferred lane + attack arrows" the way StS shows intents and Into the Breach shows attack tiles.
5. **Map:** use the StS algorithm (7x15 lattice, 6 non-crossing walks, constrained room assignment), retuned for a gold-centric economy (more shops, a Fusion/Forge node).
6. **Balancing:** AI-vs-AI self-play in Node workers. Track per-card win-rate-added, use logistic regression / Bradley-Terry for card strength, pairwise lift for degenerate combos, MAP-Elites for deck-space exploration, and "restricted play" to measure how much each card or mechanic matters.

---

## 1. Opponent AI

### 1.1 What the field does (survey)

| Approach | Where it's used | Strengths | Weaknesses | Source |
|---|---|---|---|---|
| **Hand-written heuristics / per-effect logic** | Forge (MTG): "mostly based on heuristics", with per-effect AI logic classes and card-specific `AILogic` hints. Strong with aggro/midrange, weak with combo. Headless AI-vs-AI tournaments via CLI. | Cheap, predictable, debuggable, card-by-card control | Scales poorly as card count grows; misses combos | [Forge wiki: AI](https://github.com/Card-Forge/forge/wiki/ai) |
| **Exhaustive enumeration + weighted evaluation** | **bottled_ai** (Slay the Spire): enumerates every way to play the hand with a graph traversal and simulation, then scores outcomes with ~40 weighted values. No ML. ~52% win rate with its best Watcher strategy. | Very strong for single-turn puzzles; tunable "personality" via weights | Single-turn horizon; weights hand-tuned | [bottled_ai](https://github.com/xaved88/bottled_ai) (runs on [CommunicationMod](https://github.com/ForgottenArbiter/CommunicationMod), a stdin/stdout JSON protocol for controlling StS) |
| **Fast simulator + tree search** | **sts_lightspeed**: C++ StS clone, "1M random playouts in 5s with 16 threads", tree search when the RNG state is known | Shows that deterministic, known-RNG states make search very effective | Needs 100% rules fidelity | [sts_lightspeed](https://github.com/gamerpuppy/sts_lightspeed) |
| **MCTS + learned value network** | Hearthstone: MCTS with a value network for early cutoff and tree-policy bias won 72.9% vs vanilla MCTS at 1 s/move. A "board solver" heuristic orders attacks (check lethal first, then whether the opponent wins next turn). Simulator ran ~10K games/s. Hybrid ISMCTS / PIMC for hidden hands. | State of the art for CCGs with hidden information | Engineering-heavy; value net needs self-play data | [Świechowski et al. 2018](https://ar5iv.arxiv.org/html/1808.04794) |
| **ISMCTS** | Hidden-information card games (Cowling, Powley, Whitehouse 2012) | Handles hidden hands and decks | **Not needed here:** our deck is face-up | [IEEE 6203567](https://ieeexplore.ieee.org/document/6203567/references), [WRRO](https://eprints.whiterose.ac.uk/75048/) |
| **AI competitions / testbeds** | Hearthstone AI Competition (SabberStone), Legends of Code & Magic (LOCM, 5 years of competitions), Tales of Tribute | Good reference agents and baselines | — | [HS AI Competition](https://arxiv.org/pdf/1906.04238), [SabberStone fork](https://github.com/s13n4/SabberStone), [LOCM summary](https://arxiv.org/abs/2305.11814v2), [LOCM exploitability](https://arxiv.org/pdf/2404.16689), [Many AI Challenges of Hearthstone](https://arxiv.org/pdf/1907.06562) |
| **Utility AI (IAUS)** | Dave Mark's Infinite Axis Utility System: each action scored by multiplied "considerations" passed through response curves | Designer-friendly; good for scripted enemies with "personality" | No lookahead | [gameai.com IAUS](https://gameai.com/iaus.php), [Wikipedia: Utility system](https://en.wikipedia.org/wiki/Utility_system) |
| **Telegraphed fixed intents** | Into the Breach: enemies commit and show attacks before the player acts; damage previews and undo make outcomes fully knowable. Slay the Spire: weighted random moves with anti-repeat rules (e.g. Acid Slime L: 30/40/30 weights, no Tackle twice in a row, no move three times in a row), shown as intents. | Players read and outplay the AI. The "AI" is really content design. | Not adaptive | [Into the Breach & imperfection](https://intothespine.com/2019/05/06/into-the-breach-and-imperfection/), [ItB GDC postmortem](https://gdcvault.com/play/1025772/-Into-the-Breach-Design), [StS Slimes](https://slaythespire.wiki.gg/wiki/Slimes) |

**Key takeaways for us**
- No published roguelite deckbuilder ships a "smart" PvE AI. StS and Into the Breach use scripted, telegraphed behaviour, and the depth comes from the player solving a readable puzzle. Smart search AI matters for **(a)** a mirror opponent that plays the same card system you do, **(b)** async-ghost pilots, and **(c)** balancing bots.
- Our game sits in between: the opponent has a grid, deck and gold, so it is a "player". It needs a real decision-maker, but its next options are visible to the human.

### 1.2 Why perfect-information search fits this design

- **Deck face-up + board visible + alternating placement** means a deterministic, alternating, two-player, perfect-information game *within a wave*. That is classic minimax territory (chess-like, not poker-like).
- **Wave combat resolution** is a deterministic transition `resolveCombat(state) → state'`. **[DESIGN]** Keep combat RNG-free (or seed it and show results in advance). Otherwise the search becomes expectimax, which costs about 10x more and kills Into-the-Breach-style readability. If you want variance, put it in the *shop / rewards / map*, not in combat.
- **Branching estimate [DESIGN]:** each action is roughly *(deck cards ≤ ~12) × (empty cells ≤ 12)* placements, plus *(hand spells × targets)*, plus *(unit moves)*, plus *pass*: about **80–250 actions**. A wave's placement phase is maybe 2–3 actions per side (4–6 ply). Full minimax is infeasible (200⁴ ≈ 1.6e9), but **beam search with K = 8–16 heuristic-ordered children** gives 8⁴–16⁴ ≈ 4K–65K leaves, each needing one combat sim. In a Web Worker that is well under a second if a combat sim runs in ~10–50 µs (target: a 4x3 grid with ≤24 units and ≤10 combat ticks).
- **Across waves** the horizon is long (gold carries over between battles, poison ticks). Don't search the whole battle. Use an **evaluation function at the end-of-wave boundary**, which is the natural "quiescent" point (like chess quiescence after captures).

### 1.3 Evaluation function (the most important AI asset)

Score `eval(state, side)` at a wave boundary, after combat resolves. All features are **[DESIGN]**. Tune the weights by self-play (§4.4).

```
eval(s, me) =
    w_hp      * (heroHP[me] - heroHP[opp])                          // win-condition progress (assumes Spire-style hero HP)
  + w_lethal  * (oppDeadNextWave ? +BIG : 0) - (meDeadNextWave ? BIG : 0)
  + w_board   * (boardValue(me) - boardValue(opp))                  // Σ unit value = (atk*attacksPerWave + effectValue) * hpFrac
  + w_threat  * (projectedDamage(me→opp) - projectedDamage(opp→me)) // simulate one "empty" wave: both pass, resolve combat
  + w_lane    * laneControl(me)                                     // columns where my front unit outlives theirs
  + w_adj     * (adjacencySynergy(me) - adjacencySynergy(opp))      // active buffs/combos from neighbours
  + w_pos     * positionalFit(me)                                   // tanks front, ranged back, flankers on edges, buffers centred
  + w_status  * (statusValue(me) - statusValue(opp))                // poison: stacks * wavesRemainingEstimate; armor: absorbs; etc.
  + w_fuse    * fusionPotential(me)                                 // copies in deck that can still fuse with units on board
  + w_cards   * (cardsAvailable(me) - cardsAvailable(opp))          // face-up deck + hand still to deploy (tempo reserve)
  + w_gold    * goldValue(me)                                       // gold is shared with the shop: value = f(gold, floorsLeft)
```

`goldValue` is unique to this design, because gold spent in battle is gold not spent in the shop. For PvE opponents, set `w_gold = 0` (enemies don't shop). For the **player-pilot bot** (balancing, ghosts), the bot needs a per-floor gold valuation, e.g. `goldValue = gold * marginalShopValue(floor)`, fitted from run-level simulations.

### 1.4 Recommended architecture: layered AI with difficulty tiers

| Tier | Used for | Algorithm | Budget |
|---|---|---|---|
| **T0 Scripted** | Normal PvE enemies | Authored **intent queue** (their face-up deck order) + utility-scored placement rules ("place in the lane facing the player's weakest front unit") | ~0 ms |
| **T1 Greedy** | Easy mode, early act 1, tutorial | For each legal action: apply it, simulate the wave as if both then pass, `eval`. Pick by softmax(score / τ). Higher τ means more mistakes. | <5 ms |
| **T2 Beam minimax** | Normal/Hard elites, mirror opponents | Alpha-beta over the rest of this wave's placement phase, top-K move ordering, leaf = `eval(resolveCombat(s))` | 50–300 ms |
| **T3 Deep** | Bosses, Hard+, async-ghost pilots, balancing "strong" agent | Iterative deepening across the current wave + 1 more wave, transposition table, killer moves; optional MCTS variant with T1 as rollout policy | 0.5–2 s (Web Worker) |

**Difficulty knobs, in order of preference [DESIGN]:**
1. **Content and rules** (Ascension-like): more enemy HP, an extra elite unit, enemies start with armor, bosses get an extra phase. Players perceive rules; they barely notice AI depth.
2. **Search budget**: beam width K, depth, time limit.
3. **Noise**: softmax temperature τ, or "blunder probability" (pick the 2nd–3rd best move).
4. **Feature blindness**: Easy ignores adjacency and status terms (weights zeroed). This produces believable, human-like mistakes instead of random ones.
5. Avoid gold or card cheats on higher tiers when the opponent is a mirror. They break the "fair perfect-information puzzle" promise.

### 1.5 Pseudocode — recommended opponent AI

```ts
// ---------- Engine contract (shared by game, AI, ghosts, balancing) ----------
// Pure functions. State is immutable (or apply/undo with a Zobrist hash).
interface Engine {
  legalActions(s: State): Action[];            // PlaceMonster(card, cell) | MoveToHand(card) | CastSpell(card, target)
                                               // | MoveUnit(unit, cell) | Fuse(a,b) | Pass
  apply(s: State, a: Action): State;
  phase(s: State): 'PLACEMENT' | 'COMBAT' | 'BATTLE_OVER';
  resolveCombat(s: State): State;              // deterministic wave resolution (ticks, statuses, deaths)
  sideToAct(s: State): Side;
  hash(s: State): bigint;                      // Zobrist, for transposition table
}

// ---------- Move ordering: cheap static score, no simulation ----------
function quickScore(s: State, a: Action, me: Side): number {
  let v = 0;
  if (a.kind === 'Pass') v -= 5;                       // passing is legal (design goal: no forced plays) but rarely best
  if (a.kind === 'PlaceMonster') {
    v += unitValue(a.card) + adjacencyGain(s, a.cell, a.card, me) * 2;
    v += laneThreatCovered(s, a.cell, me) * 3;         // blocks an incoming directional attack
    v += lethalLaneOpened(s, a.cell, me) ? 50 : 0;
  }
  if (a.kind === 'CastSpell') v += spellImpactEstimate(s, a);
  if (a.kind === 'Fuse') v += 8;
  if (a.kind === 'MoveUnit') v += moveGain(s, a) - moveCost(a);
  return v;
}

// ---------- T1 greedy ----------
function greedy(s: State, me: Side, tau: number, rng: Rng): Action {
  const scored = engine.legalActions(s).map(a => {
    const s1 = engine.apply(s, a);
    const s2 = engine.resolveCombat(passUntilCombat(s1));   // assume both sides pass for the rest of the wave
    return { a, v: evaluate(s2, me) };
  });
  return softmaxPick(scored, tau, rng);                     // tau≈0 → best move; larger → more human errors
}

// ---------- T2/T3 beam alpha-beta within a wave (+ optional extra wave) ----------
function search(s: State, me: Side, cfg: { K: number; maxDepth: number; extraWaves: number; deadlineMs: number }): Action {
  let best: Action = greedy(s, me, 0, NO_RNG);              // always have a fallback
  for (let depth = 1; depth <= cfg.maxDepth && !timeUp(cfg); depth++) {   // iterative deepening
    const r = alphabeta(s, depth, -INF, +INF, me, cfg.extraWaves, cfg);
    if (!r.aborted) best = r.move;
  }
  return best;
}

function alphabeta(s, depth, alpha, beta, me, wavesLeft, cfg): { value: number; move?: Action; aborted?: boolean } {
  if (timeUp(cfg)) return { value: 0, aborted: true };
  const tt = TT.get(engine.hash(s));
  if (tt && tt.depth >= depth) return tt.result;

  if (engine.phase(s) === 'BATTLE_OVER') return { value: terminalValue(s, me) };
  if (engine.phase(s) === 'COMBAT') {
    const after = engine.resolveCombat(s);                    // deterministic chance-free transition
    if (wavesLeft === 0 || engine.phase(after) === 'BATTLE_OVER') return { value: evaluate(after, me) };
    return alphabeta(after, depth, alpha, beta, me, wavesLeft - 1, cfg);   // continue into next wave's placement
  }
  if (depth === 0) {
    // Leaf: quiesce by letting both sides pass and resolving this wave
    return { value: evaluate(engine.resolveCombat(passUntilCombat(s)), me) };
  }

  const maximizing = engine.sideToAct(s) === me;
  const moves = engine.legalActions(s)
    .map(a => ({ a, q: quickScore(s, a, engine.sideToAct(s)) }))
    .sort((x, y) => y.q - x.q)
    .slice(0, cfg.K)                                          // BEAM: only the K most promising
    .map(x => x.a);
  if (tt?.result.move) moves.unshift(tt.result.move);          // PV / TT move first

  let bestMove = moves[0], bestVal = maximizing ? -INF : INF;
  for (const a of moves) {
    const r = alphabeta(engine.apply(s, a), depth - 1, alpha, beta, me, wavesLeft, cfg);
    if (r.aborted) return r;
    if (maximizing ? r.value > bestVal : r.value < bestVal) { bestVal = r.value; bestMove = a; }
    if (maximizing) alpha = Math.max(alpha, bestVal); else beta = Math.min(beta, bestVal);
    if (beta <= alpha) break;
  }
  const result = { value: bestVal, move: bestMove };
  TT.set(engine.hash(s), { depth, result });
  return result;
}

// ---------- Tier presets ----------
const TIERS = {
  easy:   (s, me) => greedy(s, me, /*tau*/ 2.0, rng),                       // + zeroed adjacency/status weights
  normal: (s, me) => greedy(s, me, 0.3, rng),
  hard:   (s, me) => search(s, me, { K: 10, maxDepth: 4, extraWaves: 0, deadlineMs: 250 }),
  boss:   (s, me) => search(s, me, { K: 14, maxDepth: 6, extraWaves: 1, deadlineMs: 1500 }),
};
```

**Implementation notes [DESIGN]**
- Run the AI in a **Web Worker** in the browser demo. Keep the engine in TypeScript with no DOM dependencies, so it runs unchanged in Node (balancing farm), in an Electron/Tauri Steam build, and on iOS (JavaScriptCore / WebView, or a later C#/C++ port if you move to Unity/Godot).
- Determinism: integer math for damage and HP; no floating-point ordering differences; seeded PRNG (see §3.5).
- **Explainability:** keep the top-3 root moves and their score breakdown. Use them for (a) debugging, (b) telegraphs ("The Warlord will likely place Ogre in your weakest lane"), and (c) a player **hint** system.
- **Pass and hold:** because "you aren't forced to play every turn" is a design goal, `Pass` must be legal and evaluated honestly. The `w_gold` term is what makes passing (saving gold) sometimes correct for the player-pilot bot.

### 1.6 Telegraphing in an alternating game [DESIGN]

The face-up deck gives intent telegraphing at no extra cost:
- Show the enemy's **next 1–3 cards** (their face-up queue) with a **"likely lane" ghost marker** computed by the AI's current best root move, plus **attack-direction arrows** for every unit on the board for the upcoming combat (Into the Breach tiles).
- For **T0 scripted enemies**, the telegraph is a commitment: they *will* play that card in that lane. That gives Into-the-Breach-style puzzle play.
- For **T2/T3 enemies**, show the card but mark the lane "?". The commitment is the card, not the cell, which preserves reactive play.

---

## 2. Enemy & Encounter Design

### 2.1 Lessons from references
- **StS intents:** each enemy picks weighted-random moves with anti-repeat constraints and shows the intent (attack value, block, buff, debuff), e.g. the Acid Slime L pattern ([wiki](https://slaythespire.wiki.gg/wiki/Slimes)). The player plays against a visible plan, not a hidden mind.
- **Into the Breach:** enemies declare attacks before the player moves. Players can redirect or push them, and the "AI" exists mainly to create interesting declared threats ([ItB analysis](https://intothespine.com/2019/05/06/into-the-breach-and-imperfection/), [GDC postmortem](https://gdcvault.com/play/1025772/-Into-the-Breach-Design)).
- **StS encounter structure [UNVERIFIED, from memory of the decompiled source / wiki]:** each act has a **weak pool** (first ~3 hallway fights) and a **strong pool** (the rest), 3 elites and 3 bosses per act. The act boss is **shown on the map from the start**, so the run can be planned around it. Repeats are avoided for recently seen encounters. Room weights are on the [Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) / [Map Locations](https://slaythespire.wiki.gg/wiki/Map_Locations) wiki pages.
- **Ascension:** StS's 20 stacking difficulty modifiers. At A1, elites increase by ~60% ([wiki](https://slaythespire.wiki.gg/wiki/Map_Generation)). Difficulty is rules, not AI.

### 2.2 Enemy archetypes mapped to the 4x3 grid [DESIGN]

| Archetype | Grid behaviour | Counterplay it teaches |
|---|---|---|
| **Brute** | Front row, high HP, hits the unit straight ahead | Basic lane blocking, armor |
| **Archer** | Back row, hits the first unit in its column (pierces empty cells) | Front-liners matter; empty lanes are dangerous |
| **Lobber / Artillery** | Hits your **back row** ignoring the front | Don't over-stack backline buffers |
| **Flanker** | Moves 2 at wave start, attacks sideways or diagonally | Edge columns, movement cost decisions |
| **Totem / Banner** | Immobile, buffs adjacent allies | Kill priority, adjacency denial |
| **Summoner** | Adds a token to an adjacent empty cell each wave | Tempo and burst; filling cells to deny spawns |
| **Bomb / Volatile** | Explodes on death, damaging adjacent cells **on both grids' facing lane** | Placement spacing |
| **Splitter** | Splits into 2 smaller units in adjacent cells when killed | Board space as a resource |
| **Poisoner / Plaguebearer** | Applies poison that ticks between waves; spreads to adjacent on death | Cleanse, healing, spacing |
| **Armorer / Shieldwall** | Grants armor to its row | Pierce and back-row damage |
| **Saboteur** | Places **junk units/rubble on *your* empty cells** (StS status-card analogue) | Cell denial, movement |
| **Tax Collector** | **Steals gold** each wave it survives | Uses the unified-resource tension: kill it fast or lose shop money |
| **Mirror** | Copies your strongest unit's stats next wave | Don't over-invest in one unit |

### 2.3 Elites and bosses with unique rules [DESIGN]
Every elite or boss should **break one rule** of the base game, the way StS bosses do (e.g. Time Eater's card-count limit):
- **Elites:** *Hydra* (grows a new head in an adjacent cell each wave), *Warden* (your units can't move this battle), *Gilded Golem* (deals no damage; you lose 5 gold per wave until it dies — a pure economy-pressure fight), *Twin Knights* (adjacent pair; killing one enrages the other).
- **Bosses (phased, 3 per act, one revealed at act start):** *The Cartographer* (rotates your grid 90° every 2 waves, so directional attacks flip), *Plague Mother* (poison never decays; she heals from poisoned units), *The Collector* (on wave 3, takes the card in your deck you have most copies of — punishes fusion-only builds), *Siege Engine* (back-row artillery that targets columns telegraphed one wave in advance).
- Each boss should **test one build axis** so that "boss revealed at act start" forces adaptation, as StS does.

### 2.4 Encounter pools & difficulty curve [DESIGN]
- **Hand-authored encounters, with budgeted variation.** Each encounter template has a fixed core (identity) plus `threatBudget` points spent on optional adds. Each enemy card has a threat cost. Budget = `base[act] * floorScale(floor) * ascensionMult`.
- **Pools per act:** `easy` (floors 1–3), `normal`, `elite`, `boss`. Don't repeat an encounter within the last 2 fights.
- **Curve:** target a player win-rate of ~85–95% per hallway fight and ~65–80% per elite at baseline difficulty, measured by the balancing bots (§4). Tune per floor so **HP attrition**, not outright losses, is the main pressure (StS model).
- **Waves inside a battle:** enemy decks escalate. Wave 1 shows 1–2 cheap units, wave 2 the core threat, wave 3+ the payoff or boss phase.

### 2.5 Async PvP ghosts (later option)
- **Super Auto Pets:** Arena battles are asynchronous against other players' teams, or AI-generated teams when no players are available for that turn ([Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)).
- **Backpack Battles:** you fight snapshots of builds uploaded earlier by players with a similar record or rank. An abandonment penalty prevents rerolling bad RNG ([Steam discussion](https://steamcommunity.com/app/2427700/discussions/0/6770657417430301203); community-sourced, details **[UNVERIFIED]**).
- **The Bazaar:** uses "ghosts" of other players as combat encounters, so you can leave mid-run ([Mobalytics](https://mobalytics.gg/the-bazaar/guides/what-is-the-bazaar)).
- **Important difference for us:** those games' battles are **non-interactive**, so a ghost is just a stored board. **Our battles are interactive**: a ghost is a stored *deck + board + gold + relics* that **must be piloted by our AI (T3)**. Ghost quality equals AI quality, which is another reason to invest in the search AI. Option: record the human's placement policy statistics (preferred lanes, spell timing) and bias the pilot's move ordering to mimic them ("ghost personality").
- **Minimal backend [DESIGN]:** on reaching node N, upload `{seasonId, act, floor, wins, rating, snapshot}`. Matchmake on `(act, floor, ±rating)` with an AI-generated fallback (SAP model). Validate snapshots server-side by replaying the seeded run with the deterministic engine (anti-cheat comes for free from determinism).

---

## 3. Procedural Generation

### 3.1 Slay the Spire map algorithm (reference)
From [StS wiki: Map Generation](https://slaythespire.wiki.gg/wiki/Map_Generation) and [KosGames guide](https://kosgames.com/slay-the-spire-map-generation-guide-26769/):
- **7 x 15 lattice** (irregular, isometric-looking); up to 6 rooms per floor; 17 floors counting boss and chest.
- **6 path walks** from floor 1 upward. Each step goes to one of the 3 nearest nodes on the next floor. **Paths cannot cross.** The first two starting nodes must differ.
- **Fixed floors:** floor 1 = monsters, floor 9 = treasure, floor 15 = rest, then the boss.
- **Assignment rules:** no Elite/Rest below floor 6; no Rest on floor 14; Elite/Merchant/Rest can't be consecutive along a path; a node's children must have distinct types.
- **Base weights** (wiki): Monster 53%, Event/Unknown 22%, Rest 12%, Elite 8%, Merchant 5%. A20 differs (Elites ~16%). Unknown rooms are rolled on entry, with probabilities that shift according to what you've seen.
- Alternative look: [yurkth/stsmapgen](https://github.com/yurkth/stsmapgen) uses Poisson-disk sampling → Delaunay triangulation → repeated A* with random node removal. It looks more organic but is harder to constrain.

### 3.2 Recommended map generator (pseudocode, adapted) [DESIGN]

Changes for this game: gold is **both** the shop currency and the battle fuel, so shops are central. Add a **Forge** node (fuse, remove, or upgrade cards — your "remove cards from deck" requirement) and a **Trainer** node (per-run stat upgrades).

```ts
const W = 7, H = 15, PATHS = 6;
type Room = 'M' | 'E' | 'R' | '$' | '?' | 'T' | 'F' | 'X' | 'BOSS';   // Monster, Elite, Rest, Shop, Event, Treasure, Forge, Trainer
const WEIGHTS = { M: 0.45, '?': 0.20, R: 0.11, '$': 0.09, E: 0.09, F: 0.04, X: 0.02 };  // tune via sims; shops > StS's 5%

function generateMap(rng: Rng, act: number, asc: number): MapGraph {
  const nodes = grid(W, H);                        // nodes[y][x] = { x, y, out: Set<x>, in: Set<x>, room?: Room }
  // 1) Walks
  let firstStart = -1;
  for (let p = 0; p < PATHS; p++) {
    let x = rng.int(0, W - 1);
    if (p === 1) while (x === firstStart) x = rng.int(0, W - 1);    // first two starts differ
    if (p === 0) firstStart = x;
    for (let y = 0; y < H - 1; y++) {
      const candidates = [x - 1, x, x + 1].filter(nx => nx >= 0 && nx < W && !crosses(nodes, x, y, nx));
      const nx = rng.pick(candidates.length ? candidates : [x]);
      nodes[y][x].out.add(nx); nodes[y + 1][nx].in.add(x);
      x = nx;
    }
  }
  // A crossing happens if we go diagonally (x→x±1) while the neighbour does the mirror diagonal.
  function crosses(n, x, y, nx) {
    if (nx === x) return false;
    return n[y][nx].out.has(x);                     // edge (nx,y)->(x,y+1) exists ⇒ X-shaped crossing
  }
  const used = allNodes(nodes).filter(n => n.in.size > 0 || n.out.size > 0);   // keep only nodes some walk touched

  // 2) Fixed floors
  for (const n of used) {
    if (n.y === 0) n.room = 'M';                    // easy-pool fights
    else if (n.y === 8) n.room = 'T';               // midpoint treasure
    else if (n.y === H - 1) n.room = 'R';           // pre-boss rest
  }
  // 3) Assign remaining by weighted roll + constraint rejection (StS rules + ours)
  const bag = buildShuffledBag(rng, WEIGHTS, used.filter(n => !n.room).length, asc);   // exact-count bag, not i.i.d.
  for (const n of used.filter(n => !n.room).sort(byFloorThenX)) {
    for (let tries = 0; tries < bag.length; tries++) {
      const r = bag[tries];
      if (violates(n, r)) continue;
      n.room = r; bag.splice(tries, 1); break;
    }
    n.room ??= 'M';                                 // fallback
  }
  function violates(n, r): boolean {
    if ((r === 'E' || r === 'R') && n.y < 5) return true;           // no elite/rest before floor 6
    if (r === 'R' && n.y === H - 2) return true;                    // no rest right before the forced rest
    if (['E', 'R', '$', 'F'].includes(r) && parents(n).some(p => p.room === r)) return true;  // no consecutive specials
    if (siblingsOf(n).some(s => s.room === r && r !== 'M')) return true;   // a fork should offer different choices
    if (r === '$' && n.y < 2) return true;          // need some gold before the first shop
    return false;
  }
  // 4) Validate the design guarantees; regenerate (new sub-seed) if any fail
  assert(everyPathHas(used, '$', 1));               // ≥1 shop reachable on every path (economy is core)
  assert(someLowRiskPathExists(used));              // ≥1 path with ≤1 elite
  assert(somePathHasEliteCount(used, 2));           // greedy route exists
  const boss = pickBoss(rng, act);                  // revealed at act start
  return { nodes: used, boss };
}
```

Notes:
- Use an **exact-count shuffled bag** for room types (an [UNVERIFIED] memory says StS does something similar), so every map has a predictable mix instead of i.i.d. streaks.
- **Validate, then reroll** (step 4) is cheap and guarantees route variety. Seeded rerolls keep it deterministic.
- `?` nodes: resolve on entry with shifting odds (StS-style "unknown" behaviour): each `?` that turns into an event raises the chance that the next one is a fight, shop or treasure.

### 3.3 Event design [DESIGN, informed by StS]
- Events should **trade between the run's currencies**: HP ↔ gold ↔ cards ↔ deck thinning ↔ unit levels. With one unified gold resource, events are the main place to offer *off-economy* trades ("Lose 8 max HP: fuse any two cards for free").
- Give each event 2–3 options, at least one safe. Avoid pure-random outcomes or show the odds (in keeping with the no-random-draw philosophy).
- Gate events by act and by run state (e.g. "Forge Spirit" only if the deck has 2+ copies of a card).
- Grid-specific events: "Cursed Cell" (one of your cells is permanently disabled but adjacent units get +1/+1), "Rotate Formation" (permanent relic that changes attack directions).

### 3.4 Reward tables [DESIGN, with StS reference values]
| Node | Gold | Card offer | Other |
|---|---|---|---|
| Hallway | 10–20 (StS: 10–20 **[UNVERIFIED]**) | Pick 1 of 3 (or skip for +gold, our twist) | — |
| Elite | 25–35 | Pick 1 of 3 at higher rarity | Relic/Trainer |
| Boss | 75–100 | Rare pick | Boss relic (rule-changer) |
| Treasure | — | — | Relic |
- **Rarity pity [UNVERIFIED, StS decompiled behaviour]:** StS tracks a rare-chance offset that grows each time a common is shown and resets when a rare appears. Copy the idea: `rareChance = base + offset`; `offset += 1%` per common shown; reset on rare.
- **"Skip for gold"** is especially meaningful here because gold also fuels battles. It makes each reward a three-way choice: body, spell, or tempo.

### 3.5 Seeded runs, daily challenges, RNG hygiene
- **Separate RNG streams per system** (map, encounters, card rewards, shop, events, combat if any, AI tie-breaks), so a player's choice in one system (e.g. rerolling the shop) doesn't change another (e.g. the next elite). This is standard practice ([Unity discussion](https://discussions.unity.com/t/seedable-deterministic-rng-slay-the-spire-balatro-spelunky-etc/1583758)). StS 1 uses named streams such as `monsterRng`, `cardRng`, `mapRng`, `eventRng` **[UNVERIFIED names, from decompiled code]**.
- **Cautionary tale:** Slay the Spire 2 seeded its streams with offsets of one base seed using C# `System.Random`, whose output is *linear in the seed*. Streams became correlated: one curse was ~54% Debt instead of ~11%, and first-combat potion drops were 76% in one act vs 4% in another. **Use PCG32 / xoshiro, or derive each stream as `hash(runSeed, streamName, floor)`** with a strong hash, and test for cross-stream correlation ([tck.mn analysis](https://tck.mn/blog/correlated-randomness-sts2/)).
- **Derive per-node seeds** (`hash(runSeed, 'encounter', act, floor, x)`) instead of advancing one long stream. Map choices then don't reshuffle later content, and replays, ghost validation and bug reports stay reproducible.
- **Daily climb** (StS model): everyone gets the same seed plus 1–3 modifiers, with a leaderboard ([StS Custom Mode](https://slaythespire.wiki.gg/wiki/Custom_Mode), [Kotaku on daily challenges](https://kotaku.com/slay-the-spires-daily-challenges-keep-getting-better-1823780588)). With a deterministic engine, leaderboard runs can be **verified by replaying the input log** server-side.
- **Seed tooling:** the Balatro community built seed searchers (e.g. [Brainstorm-Rerolled](https://github.com/ABGamma/Brainstorm-Rerolled); GPU seed finders, **[UNVERIFIED]** specifics). Expect players to search your seeds too, so don't let a single seed leak overpowered guaranteed content. Validate generated maps and shops against outlier rules.

---

## 4. Simulation-Based Balancing

### 4.1 Prior art
| Work | Method | Relevance |
|---|---|---|
| Slay the Spire, Mega Crit, GDC 2019 | Metrics-driven balancing from early access telemetry plus community feedback | Ship with telemetry from the demo onward ([Game Developer](https://www.gamedeveloper.com/design/learn-i-slay-the-spire-i-s-metrics-driven-approach-to-game-balancing-at-gdc-2019), [GDC Vault](https://www.gdcvault.com/browse/gdc-19/play/1025731)) |
| **Ludus** (AAAI 2022) | Automated playtesting + global search over **auto-battler card parameters**; sampling-based approximation to cut sim cost; "metagame health" metrics | Closest match to our genre ([AAAI](https://ojs.aaai.org/index.php/AAAI/article/view/21550)) |
| Evolving the Hearthstone Meta (de Mesentier Silva et al. 2019) | GA over cost/attack/HP changes (−3..+3); fitness = distance of matchup win rates from 50%; 300 SabberStone games per candidate | Template for automated stat tuning ([arXiv](https://ar5iv.arxiv.org/html/1907.01623)) |
| Metagame Autobalancing (Hernandez et al. 2020) | Designer draws a *target* win-rate graph (fair or rock-paper-scissors); Bayesian optimisation finds parameters; 9–16% error; ~96 h compute | Aim for **intended counters**, not flat 50% ([arXiv](https://arxiv.org/pdf/2006.04419)) |
| Restricted Play (Jaffe et al., AIIDE 2012) | Compare a restricted agent (e.g. "never uses X") with an unrestricted one to quantify how much X matters | Measures card/mechanic importance and dominance ([AAAI](https://ojs.aaai.org/index.php/AIIDE/article/view/12513)) |
| MAP-Elites with Sliding Boundaries (Fontaine et al. 2019) | Quality-diversity search over the Hearthstone deck space (avg cost × variance); found must-include cards like Sunwalker | Finds degenerate decks you didn't think of ([arXiv](https://arxiv.org/pdf/1904.10656)) |
| Evolving card sets towards balancing Dominion (Mahlmann, Togelius, Yannakakis 2012) | Evolved card sets with AI agents of different skill to find balanced kingdoms | Balancing *pools* (our shop pool) ([PDF](https://um.edu.mt/library/oar/bitstream/123456789/22933/1/Evolving_card_sets_towards_balancing_dominion.pdf)) |
| Automated Playtesting with AI agents, The Sims Mobile (EA, 2018) | Rebuilt the core mechanics as a fast simulator (~1000x human speed), A* agents with designer-question-specific heuristics | Build question-specific bots, not one universal bot ([arXiv](https://arxiv.org/pdf/1811.06962)) |
| Hearthstone simulators / MCTS | SabberStone, HearthSim; MCTS + value nets | Engine-first architecture ([HearthSim](https://github.com/oyachai/HearthSim), [paper](https://ar5iv.arxiv.org/html/1808.04794)) |
| 17lands (MTG Arena) | Crowd telemetry metrics: **GIH WR** (win rate in games where the card was in hand) and **IWD** (improvement when drawn) | Proven per-card metric definitions to copy ([StarCityGames explainer](https://articles.starcitygames.com/2021/03/25/using-17lands-com-as-a-resource-to-improve-at-limited/)) |
| Forge | Headless AI-vs-AI tournaments (bracket / round-robin / Swiss) from the CLI | Practical harness shape ([Forge wiki](https://github.com/Card-Forge/forge/wiki/ai)) |
| bottled_ai / sts_lightspeed | Community StS bots and simulators; documented per-strategy win rates | Proof that roguelite run-bots are feasible ([bottled_ai](https://github.com/xaved88/bottled_ai), [sts_lightspeed](https://github.com/gamerpuppy/sts_lightspeed)) |

### 4.2 Two levels of simulation you need [DESIGN]
1. **Battle-level** (fast, millions of games): fixed decks/boards vs encounter templates or mirror opponents. Answers questions like "is card X too strong?", "is this elite overtuned on floor 6?", and "does going first win too often?".
2. **Run-level** (slower, tens of thousands of runs): a **run-bot** that drafts, shops, paths and fuses with heuristic card ratings (bottled_ai style) plus a T2 battle pilot. It is the only way to balance the **unified gold economy** (spend in battle vs save for shop), card removal, and act-level difficulty.

### 4.3 Metrics to compute
| Metric | Definition | Flags |
|---|---|---|
| **Win-rate added (WRA)** per card | WR(runs/battles where the card was *played*) − WR(baseline), controlling for floor (like 17lands IWD) | Over-/under-powered cards |
| **Mode split** | WRA when used as **monster** vs as **spell** | A dual-purpose card where one side is dominant (always the same pick means a dead choice) |
| **Card strength (Bradley-Terry / logistic regression)** | `P(win) = σ(Σ β_card · present + β_floor + β_ascension)`; β is the card's Elo-like strength | Ranking for the pick-rate vs strength chart |
| **Pairwise lift** | `β_AB` interaction term, or `WR(A∧B) − predicted(A,B)` | **Degenerate combos** (huge positive lift); adjacency combos |
| **Pick vs strength** | Bot (or human) pick rate vs β | Traps (picked a lot, weak) and hidden gems |
| **First-mover advantage** | WR of the side that places first in wave 1 | Alternating placement can favour reacting **second**; fix with a tempo token or by alternating who starts each wave |
| **Battle length** | Waves per battle; % of battles hitting the wave cap | Stalemates, infinite armor/heal loops (target "a couple of minutes") |
| **Decision density** | Number of non-pass actions with eval gap < ε between top-2 moves | "Meaningful decisions" proxy; low = autopilot fights |
| **Comeback rate** | % wins when behind by > X HP after wave 2 | Snowballing |
| **Restricted-play delta** | WR(full agent) − WR(agent forbidden to use card/mechanic M) | Mechanic importance; ~0 = irrelevant card, huge = must-pick |
| **Encounter difficulty** | Expected HP lost and loss rate per encounter per floor | Curve tuning (§2.4) |
| **Economy curve** | Gold held, spent in battle vs shop, per floor | Is "spend now vs save" actually tense? (target: neither dominant) |

### 4.4 Pipeline pseudocode [DESIGN]

```ts
// Node.js, worker_threads; same engine as the game.
for (const patch of candidatePatches) {                    // e.g. stat tweaks from a GA, or the current build
  const results = parallelMap(seeds(100_000), seed => {
    const run = simulateRun(seed, { pilot: TIERS.hard, drafter: heuristicDrafter(ratings), shopper: goldPolicy(theta) });
    return summarize(run);                                 // cards played (+mode), fusions, gold flow, per-battle logs
  });
  const model = fitLogistic(results, features = ['card:*', 'card:*×card:*(sparse, min support 200)', 'floor', 'asc']);
  report({
    overpowered:   model.cards.filter(c => c.beta > +2*sd),
    underpowered:  model.cards.filter(c => c.beta < -2*sd),
    combos:        model.pairs.filter(p => p.lift > threshold).sortBy('lift'),
    modeImbalance: cards.filter(c => abs(c.monsterWRA - c.spellWRA) > 0.05),
    firstMover, waveCapHits, decisionDensity, encounterCurve, economyCurve,
  });
}
// Weight tuning for the AI eval (self-play), Texel-tuning style:
//   minimise log-loss between sigmoid(eval(s)) and actual game outcome over millions of logged wave-boundary states,
//   or run CMA-ES over weights with fitness = win rate vs the previous champion.
// Stat tuning (optional): GA/CMA-ES over card numbers with fitness = distance to a designer target metagame
//   (Silva 2019; Hernandez 2020), using Ludus-style sampling to cut cost.
```

**Caveats**
- **Bots balance for bots.** Use ≥2 pilot styles (aggro, control) and ≥2 skill levels (T1, T2). A card that is only strong under perfect play (T3) may be fine for humans. Cross-check with human telemetry from the demo, as Mega Crit did.
- **Adversarial search for exploits:** run MAP-Elites over deck space (behaviour axes, e.g. *% cards used as monsters* × *avg unit cost*, or *front/back row ratio*) to find broken archetypes before players do.
- Hard caps as safety nets: a wave limit per battle and stack caps on status effects, flagged when bots hit them.

---

## 5. Build-order recommendation [DESIGN]

1. **Engine v0** (TS, pure, deterministic, seeded streams, Zobrist hash) + **CLI battle runner**.
2. **T1 greedy AI** + a hand-tuned `eval`. This is enough for the browser demo's normal fights.
3. **Telegraph UI** fed by the AI's root-move analysis (next card, likely lane, attack arrows).
4. **Batch sim harness** (Node workers). Measure first-mover advantage and battle length *before* designing lots of cards.
5. **Map generator** + encounter pools + reward tables. Then the run-bot to tune the gold economy.
6. **T2 beam alpha-beta** for elites/bosses; Texel/CMA-ES weight tuning from logged games.
7. Post-launch: **async ghosts** piloted by T3, daily climb with server-side replay verification.

---

## Sources (consolidated)
- StS map generation: https://slaythespire.wiki.gg/wiki/Map_Generation · https://kosgames.com/slay-the-spire-map-generation-guide-26769/ · https://slaythespire.wiki.gg/wiki/Map_Locations · https://github.com/yurkth/stsmapgen
- StS monster AI: https://slaythespire.wiki.gg/wiki/Slimes · Custom/daily: https://slaythespire.wiki.gg/wiki/Custom_Mode · https://kotaku.com/slay-the-spires-daily-challenges-keep-getting-better-1823780588
- StS bots/sims: https://github.com/xaved88/bottled_ai · https://github.com/ForgottenArbiter/CommunicationMod · https://github.com/gamerpuppy/sts_lightspeed
- StS balancing talk: https://www.gamedeveloper.com/design/learn-i-slay-the-spire-i-s-metrics-driven-approach-to-game-balancing-at-gdc-2019 · https://www.gdcvault.com/browse/gdc-19/play/1025731
- RNG: https://tck.mn/blog/correlated-randomness-sts2/ · https://discussions.unity.com/t/seedable-deterministic-rng-slay-the-spire-balatro-spelunky-etc/1583758 · https://github.com/ABGamma/Brainstorm-Rerolled
- Into the Breach: https://intothespine.com/2019/05/06/into-the-breach-and-imperfection/ · https://gdcvault.com/play/1025772/-Into-the-Breach-Design
- Forge MTG AI: https://github.com/Card-Forge/forge/wiki/ai
- Hearthstone AI: https://ar5iv.arxiv.org/html/1808.04794 · https://arxiv.org/pdf/1906.04238 · https://arxiv.org/pdf/1907.06562 · https://github.com/s13n4/SabberStone · https://github.com/oyachai/HearthSim
- ISMCTS: https://ieeexplore.ieee.org/document/6203567/references · https://eprints.whiterose.ac.uk/75048/
- LOCM: https://arxiv.org/abs/2305.11814v2 · https://arxiv.org/pdf/2404.16689
- Utility AI: https://gameai.com/iaus.php · https://en.wikipedia.org/wiki/Utility_system
- Async PvP: https://en.wikipedia.org/wiki/Super_Auto_Pets · https://steamcommunity.com/app/2427700/discussions/0/6770657417430301203 · https://mobalytics.gg/the-bazaar/guides/what-is-the-bazaar
- Balancing research: https://ojs.aaai.org/index.php/AAAI/article/view/21550 (Ludus) · https://ar5iv.arxiv.org/html/1907.01623 · https://arxiv.org/pdf/2006.04419 · https://ojs.aaai.org/index.php/AIIDE/article/view/12513 · https://arxiv.org/pdf/1904.10656 · https://um.edu.mt/library/oar/bitstream/123456789/22933/1/Evolving_card_sets_towards_balancing_dominion.pdf · https://arxiv.org/pdf/1811.06962 · https://articles.starcitygames.com/2021/03/25/using-17lands-com-as-a-resource-to-improve-at-limited/
