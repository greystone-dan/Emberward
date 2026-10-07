# 06 — Strategic Depth & Systems Design

_Research for the card-roguelite auto-battler (see `/design/design-notes.md`). Written 2026-10-07._
_Scope: systems depth: theory, keywords/synergy, positional statuses, economy, progression, market comps, and concrete recommendations. General design references (StS/Balatro/SAP/TFT overviews) and AI opponents are covered in other reports._

> **Legend.** `[src]` = verified against the linked page during this research. `[unverified]` = from general genre knowledge or secondary sources; confirm before quoting it externally. Every "Proposal" block is a design recommendation, not a fact.

---

## TL;DR (read this if nothing else)

1. **Depth comes from spending decisions, not rule count.** Cut *comprehension* and *tracking* complexity hard so all the complexity goes into depth (choosing the best move). This game's 4 sources of depth are: **(a) spatial, (b) temporal (waves), (c) economic (one purse), (d) dual-use cards.** Every system should feed at least two of them.
2. **Make the grid the win condition.** Proposal: an attack that finds no enemy in its lane **hits the enemy hero**. That turns lane coverage, Taunt, push/pull and empty cells into the core of the game instead of decoration.
3. **Resolve combat by rows ("beats"), simultaneously and deterministically.** Front row first, then mid, then back. Show a full outcome preview (the Into the Breach model). The randomness goes into inputs (shop, map, enemy rosters), never into outputs (no crit or miss rolls).
4. **Tribes count connected clusters, not the whole board.** A tribe bonus scales with your *largest orthogonally connected group* of that tribe. This makes TFT-style traits native to the grid, and it is the most distinctive idea in this report.
5. **Fire spreads, poison stays.** Proposal: Burn jumps to adjacent allies. That punishes the clumping that adjacency auras reward, so positioning becomes a real tradeoff instead of "always cluster."
6. **One action per turn** (deploy / stage to hand / move / fuse / cast / pass) gives movement its cost through tempo, with no second currency. **Interest is computed after battle**, so every gold spent on a mid-battle spell also costs future interest. That is the locked one-resource tension made readable.
7. **Content targets:** vertical slice of about 24 dual cards, demo of about 60, EA of about 150, 1.0 of about 260 to 300 dual cards plus about 120 relics and 20 ascension levels. A dual card is worth about 1.5 normal cards of content.
8. **Market:** the genre is hot and premium-priced (StS2 EA at $24.99, 3M+ in week 1; Mewgenics at 1M in a week; 9 Kings at 800k in EA; Backpack Battles 1.0 at 640k in month 1). The common complaints are balance and meta staleness, thin content, and **trust-breaking monetization** (The Bazaar). Ship premium: $14.99 to $19.99 on Steam, then a $9.99 premium iOS release with touch-first UI.

---

## 1. Strategic depth theory

### 1.1 The frameworks that matter for this project

| Source | Core idea | What it means for us |
|---|---|---|
| **Sid Meier**: "a game is a series of interesting decisions" (GDC 2012 talk, ["Interesting Decisions"](https://gamedeveloper.com/design/video-sid-meier-explores-interesting-decisions-in-gameplay)) | A decision is interesting when no option is obviously best, the options differ in kind, and the player has enough information to reason. `[src: talk exists; summary is paraphrase, unverified]` | Every turn should offer 2 or 3 *different kinds* of good moves, for example deploy for board, stage for a later spell, or reposition. Avoid turns where one move is obviously right. |
| **"Complexity vs. Depth"** ([Game Developer, Design 101](https://www.gamedeveloper.com/design/design-101-complexity-vs-depth)) | Splits complexity into **Comprehension** (bad), **Tracking** (bad), and **Depth** (good: how hard it is to find the best move). Suggests a complexity budget and using clarity as the tiebreaker. `[src]` | Auras and statuses on a 24-cell board create a lot of tracking load. **The UI has to do the tracking** (live previews, aura lines, damage forecasts) so the player's head is spent on depth. |
| **Fabian Fischer**, [Criteria for Strategy Game Design](https://www.gamedeveloper.com/design/criteria-for-strategy-game-design) | Interesting decisions with "enough and insufficient information at the same time"; efficiency; transparency; elegance; variety from **input randomness**; no dominant or dead options; minimize output luck and execution. `[src]` | This supports deterministic combat with a preview, plus random shops and maps. |
| **Keith Burgun**, *Clockwork Game Design* (2015) | Build around one **core mechanism**; cut everything that does not serve it; prefer input randomness over output randomness. `[unverified summary]` | The core mechanism is **placing a dual card on a contested grid with a shared purse**. Test every feature against it. |
| **Soren Johnson**, ["Water Finds a Crack"](https://designer-notes.com/game-developer-column-17-water-finds-a-crack) | "Given the opportunity, players will optimize the fun out of a game." Any hole will be abused over and over, so designers must remove dominant strategies. `[src]` | A face-up, no-draw deck is very open to solved openers. Plan for anti-solving tools early (see 1.4). |
| **Mark Rosewater**, *Ten Things Every Game Needs* ([Part 1](https://magic.wizards.com/en/news/making-magic/ten-things-every-game-needs-part-1-2011-10-24), [Part 2](https://magic.wizards.com/en/news/making-magic/ten-things-every-game-needs-part-1-part-2-2011-12-19)) | Goal, Rules, Interaction, **Catch-up**, **Inertia**, **Surprise**, Strategy, Fun, Flavor, Hook. `[src]` | See the audit in 1.2. Catch-up, Inertia and Surprise are the three at risk in this design. |
| **Rosewater**, *Lenticular design* ([original article, archive](http://archive.wizards.com/Magic/magazine/article.aspx?x=mtg/daily/mm/293); [explainer](https://giantbomb.com/users/4072/articles/hiding-in-plain-sight-lenticular-design-in-games)) | Cards that look simple to new players but hide depth that experts see, for example two same-stat creatures where one also bounces a permanent. `[src]` | Dual-purpose cards are naturally lenticular. A novice reads a body plus a spell; an expert reads tempo, adjacency and resale value. Write card text so the simple reading is never *wrong*, just incomplete. |
| **Rosewater**, *New World Order* ([MTG wiki](https://mtg.wiki/page/New_World_Order); [New NWO](https://magic.wizards.com/en/articles/archive/making-magic/new-new-world-order-2013-03-29)) | Since 2008, complexity at common is a limited resource. Commons shouldn't affect more than one other card on the battlefield, which keeps board tracking manageable. `[src]` | Adopt it directly: **common cards have at most 1 keyword per half, and common auras affect at most 1 cell.** Multi-cell auras, row or lane auras, and conditional chains go at uncommon and above. |

### 1.2 Rosewater's 10 checks applied to this design

| Need | Status | Fix |
|---|---|---|
| Goal | Unclear: the battle win condition is still open | Hero HP plus face damage from unblocked lanes (see §6.1) |
| Interaction | Strong (alternating placement, reacting) | Keep enemy intents visible so the player's reaction has something to work with |
| **Catch-up** | **Risk:** one purse means a rich player buys spells, wins battles, and gets richer | Loss-streak gold, comeback relics, and interest that is capped and taxed by spending (see §3) |
| **Inertia** | **Risk:** wave combat can stall (turtle versus turtle) | Escalation: each wave adds +1 face damage per unblocked lane, plus **Sudden Death at wave 6** (all units gain +2 attack per wave) |
| **Surprise** | **Risk:** a face-up deck plus a deterministic grid gives few surprises | Random shop offers, enemy rosters drawn from a pool, events, and "Omens" (run modifiers). Enemy reinforcements are telegraphed one wave ahead, not a full battle ahead |
| Strategy | Strong | — |
| Hook | "Every card is a monster *and* a spell, and you see your whole deck" | Lead all marketing with it |

### 1.3 Depth sources this design has, and how to protect each one

- **Spatial:** lanes × rows × adjacency. *Protect:* there must be no single best cell. Each row needs a reason to exist: front acts first, back is safe, mid is where auras reach the most neighbors.
- **Temporal:** waves. *Protect:* the action you take in wave 1 should change what wave 3 looks like. Use staging, Grow, Persist and delayed spells.
- **Economic:** the one purse. *Protect:* spending in battle must sometimes be right and sometimes wrong. That needs interest breakpoints and visible future shop value.
- **Dual-use:** monster vs. spell. *Protect:* the gold cost means the **spell half must be stronger per action** than the monster half (which is free). Otherwise everything gets played as a body. Rule of thumb: spell power ≈ monster power × (1 + 0.25 × gold cost).

### 1.4 Avoiding a solved meta (Johnson: "water finds a crack")

1. **Constrained pools per run.** Only 3 or 4 of the 6 factions appear in a given run's shop (comparable to SAP packs and TFT sets). The player picks one starting faction; the others are drawn at random.
2. **Enemy archetypes that each punish one dominant pattern:** artillery enemies punish turtle walls, splash enemies punish clumping, lane-swarmers punish narrow formations, and silencers punish aura towers.
3. **Omens:** one visible run modifier per act ("Burn spreads twice as far", "Back row costs 1 gold to deploy").
4. **Telemetry from day one:** log win rate per card-half and pick rates. Johnson's point is that players will find exploits, so collect the data before EA.
5. **Bot fuzzing:** run the AI opponent (from the other report) against itself at scale to find degenerate loops, especially infinite Regen or Shield.
6. **Ascension modifiers that change rules, not only numbers.** Monster Train 2's 21 preset "Dimensional Challenges" "adjust your strategies… beyond simply making it harder" ([Game Informer](https://gameinformer.com/review/monster-train-2/engine-ingenuity)) `[src]`.

---

## 2. Keywords, synergies, statuses, and the grid

### 2.1 How comparable games make statuses and keywords positional

| Game | Board | Positional mechanics worth stealing | Source |
|---|---|---|---|
| **Into the Breach** | 8×8 | Enemies **telegraph** attacks; push/displacement as an alternative to killing; perfect information; designed for brisk pacing | [Wikipedia](https://en.wikipedia.org/wiki/Into_the_Breach) `[src]` |
| **Duelyst** | 9×5 | **Backstab** (bonus damage from behind), Provoke (taunt for adjacent units), Zeal (bonus when adjacent to the General), Airdrop (deploy anywhere), units that damage adjacent cells when moved | [Kotaku](https://kotaku.com/duelysts-latest-expansion-plays-to-the-card-games-uniqu-1796949377) `[src: backstab, move-adjacent damage]`; Provoke and Zeal [wiki](https://duelyst.fandom.com/wiki/Zeal) `[unverified detail]` |
| **Faeria** | Hex board | The player builds the board (land tiles); wells as contested resource cells; land type gates cards | [Faeria Academy](https://www.faeria.com/the-hub/guide/61-faeria-academy-chapter-2-land-placement) `[src]` |
| **Wildfrost** | 2 rows × 3 per side | **Counter** timers (units act when their counter hits 0); **Snow** freezes counters; Frost reduces the next attack; Shroom is decaying poison; Shell is a second health bar; Block negates hits; Teeth is thorns; **Overburn explodes along the row**; Barrage hits a whole row | [Gameranx](https://gameranx.com/features/id/464170/article/wildfrost-every-effect-explained-tips-tricks-guide/) `[src]` |
| **Cobalt Core** | 1D lane, two ships | Moving the ship lines cannons up with enemy hull gaps; dodging is positional; card position in hand decides movement | [PC Gamer](https://www.pcgamer.com/cobalt-core-review/) `[src]` |
| **StarVaders** | Grid, enemies descend | Deckbuilder plus ITB-style tactics: move to line up shots, an overheat limit on cards per turn, a "Chrono-token" undo | [Rogueliker](https://rogueliker.com/starvaders-review/) `[src]` |
| **Monster Train 1/2** | 3 floors + pyre | Floor capacity limits; a **deployment phase** before combat (MT2); Room cards modify a whole floor; Equipment buffs units | [Deltia's](https://deltiasgaming.com/?p=239890), [GI](https://gameinformer.com/review/monster-train-2/engine-ingenuity) `[src]` |
| **Mechabellum** | Large field | **Units cannot be moved once placed**; you buy and place in alternating rounds against a visible enemy; the opponent loses HP per lost round | [Wikipedia](https://en.wikipedia.org/wiki/Mechabellum) `[src]` |
| **Fire Emblem** | Grid | Weapon ranges 1 / 1–2 / 2 / 3+ (siege); the weapon triangle; "cannot counter at range" makes the attack shape a stat in itself | `[unverified: genre knowledge]` |
| **Chess** | 8×8 | Rook = line, bishop = diagonal, knight = jump over blockers. The shape *is* the identity | — |

**Takeaways for us:**
1. **Telegraph + determinism** (ITB) suits a small grid and a 2-minute battle.
2. **Displacement is a status in itself** (ITB, Duelyst). Pushing a unit out of its lane can do more than damage.
3. **Row/lane effects** (Wildfrost Overburn and Barrage, MT Rooms) are the cheapest way to make statuses positional.
4. **No free repositioning** is proven to work and to sell (Mechabellum). It makes placement a skill.

### 2.2 Board conventions (proposal)

```
 ENEMY     Back  [ . ][ . ][ . ][ . ]
           Mid   [ . ][ . ][ . ][ . ]
           Front [ . ][ . ][ . ][ . ]
           ════════ THE LINE ════════
 YOU       Front [ . ][ . ][ . ][ . ]
           Mid   [ . ][ . ][ . ][ . ]
           Back  [ . ][ . ][ . ][ . ]
                   A    B    C    D     ← lanes are shared: your lane A faces their lane A
```

- **4 lanes × 3 rows per side**, 12 cells each and 24 total. This fits a portrait phone well, which matters for iOS.
- **Adjacency is orthogonal only** (up, down, left, right): 2 to 4 neighbors. Diagonals are reserved for attack shapes, so the two systems never get confused.
- Edge lanes (A, D) have 3 neighbors at most; center lanes have 4. This gives **center lanes a value for auras and edge lanes a value for defense**, so cell choice is meaningful.

### 2.3 Combat resolution (proposal: "beats")

Each wave's **combat step** resolves in 3 beats:

1. **Front beat:** every Front-row unit on *both* sides acts at the same time. Damage is applied at once, then deaths are checked.
2. **Mid beat:** all Mid-row units act.
3. **Back beat:** all Back-row units act.
4. **End of wave:** statuses tick (Poison, Burn, Regen, Grow), Shields expire, and face damage is totalled.

Why: rows become a speed stat. Front units strike first but take the most hits. Back-row artillery acts last, after the targets ahead of it have died or moved. It is deterministic and easy to preview, and the simultaneous resolution means there is no first-player advantage inside a beat.

### 2.4 Attack-pattern taxonomy for a 4×3 grid (proposal)

Patterns are written relative to the attacker's lane (`*` = attacker's lane, `X` = cells hit, on the *enemy* grid seen from your side). "First enemy" means the nearest occupied enemy cell, Front → Mid → Back.

| # | Name | Rule | Shape (enemy grid; bottom row = enemy Front) | Role / counters |
|---|---|---|---|---|
| 1 | **Strike** (melee) | Hits the first enemy in its own lane. **Can only attack from the Front row**, or from Mid if the friendly Front cell in its lane is empty | `. . . .` / `. . . .` / `. X . .` | Baseline. Countered by Thorns and Armor. |
| 2 | **Shoot** (ranged) | Hits the first enemy in its own lane from any row | same as Strike | Backline damage. Countered by Taunt and Bodyguard. |
| 3 | **Pierce** (line) | Hits the first **2** (Pierce II) or **all** (Pierce III) enemies in its own lane; ignores Armor 1 | `. X . .` / `. X . .` / `. X . .` | Punishes stacking in one lane. Rook-like. |
| 4 | **Cleave** | Hits the first enemy in its own lane **and** the units beside it (same row, lanes ±1) | `. . . .` / `. . . .` / `X X X .` | Punishes wide walls. Melee only. |
| 5 | **Lob** (artillery) | Hits the **back-most** enemy in its own lane, ignoring blockers. **Cannot attack from Front** | `. X . .` / `. . . .` / `. . . .` | Counters turtles. Weak to anything that reaches the back row. |
| 6 | **Fork** (diagonal) | Hits the first enemy in each **adjacent lane** (±1), *not* its own lane | `. . . .` / `. . . .` / `X . X .` | Bishop-like. Ideal for center lanes; an edge lane gets only one target. |
| 7 | **Blast** (splash) | Hits the first enemy in lane, plus half damage (rounded down) to the cells orthogonally adjacent to it | `. . . .` / `. X . .` / `X X X .` | Punishes clusters. Pairs with Burn. |
| 8 | **Sweep** | Hits **every** enemy in the enemy Front row for low damage (usually 1–2) | `. . . .` / `. . . .` / `X X X X` | Answers swarms and tokens; strips Shields. |
| 9 | **Snipe** | Hits the lowest-HP enemy *anywhere*. Rare, mythic only | any one cell | Breaks formations; kept rare deliberately. |
| 10 | **Support** (no attack) | Does not attack; its effect targets allies (heal, shield, aura) | — | Healers and banners. Never deals face damage. |

**Face damage rule (proposal):** if a Strike, Shoot or Pierce finds **no enemy in its lane**, it deals its attack to the **enemy hero**. Lob, Fork, Blast, Sweep, Snipe and Support never hit face. Result: **an open lane is a liability**, and Taunt, push/pull and placing to block become the core skill.

**Directional modifiers (optional, uncommon+):** *Backstab*: +2 damage to a unit with no ally in the cell in front of it. *Flank*: Strike may target lanes ±1 if its own lane is empty.

### 2.5 Adjacency and aura rules (proposal)

**Aura shapes** (always relative to the source):

| Keyword | Cells affected | Common? |
|---|---|---|
| **Ahead** | The 1 cell toward the line | ✅ common |
| **Behind** | The 1 cell away from the line | ✅ common |
| **Beside** | Left and right (up to 2) | uncommon |
| **Around** | All orthogonal (2–4) | uncommon |
| **Row** | Every friendly cell in this row (≤3 others) | rare |
| **Lane** | Every friendly cell in this lane (≤2 others) | uncommon |

**Rules:**
1. Auras are **static and continuous**, recomputed whenever any unit is placed, moves, or dies, and shown as lines on the board.
2. **The same aura from two copies of a card does not stack.** Different auras do stack. This stops "4 banners around one carry" from becoming the whole game.
3. **Auras count units, not cells.** An empty cell receives nothing, which avoids invisible state.
4. **NWO rule:** a common card's aura affects at most 1 cell (Ahead or Behind).
5. **Bond X (keyword):** "Bond: while an ally is [shape], gain X." This is the reverse of an aura: the *receiver* names the condition, which makes it easy to read from the card.
6. **Silence** suppresses outgoing auras; it does not touch auras the unit receives.

### 2.6 Tribe/faction synergy: Clusters (the key recommendation)

TFT traits count units **anywhere on the board** and reward breakpoints (2/4/6) `[unverified: genre knowledge; see e.g. Dot Esports trait sheets]`. That ignores position, which wastes our grid.

**Proposal: Cluster bonuses.** A tribe bonus counts the **largest orthogonally connected group** of that tribe.
- Breakpoints at **2 / 3 / 5** (12 cells per side, about 6–9 units on board in a typical wave).
- A unit can belong to 1 tribe (common) or 2 tribes (rare, the "bridge" units).
- The UI outlines the cluster and shows the active tier.

Why it adds depth: clusters fight with **Blast and Burn** (which punish clumping), with **lane coverage** (a 5-cluster in two lanes leaves two lanes open), and with **enemy push** (pushing one unit can break a cluster). Players get "build a shape" puzzles (L-shape, wall, column) instead of "count to 6."

### 2.7 Keyword budget (proposal)

| Milestone | Evergreen keywords | Statuses | Faction-signature keywords |
|---|---|---|---|
| Vertical slice | 6 (Strike, Shoot, Taunt, Armor, Ahead/Behind auras, Deploy) | 3 (Poison, Shield, Stun) | 1 per faction (×2) |
| Demo | 10 | 6 | 1–2 per faction (×3) |
| EA | 14 | 9 | 2 per faction (×4) |
| 1.0 | 18–20 | 11–12 | 2–3 per faction (×6) |

**Per-card budget:** a common has ≤1 keyword per half and ≤12 words of rules text per half. An uncommon has ≤2 per half. A rare has ≤3 per half plus one unique rule. **Two halves means two budgets:** a common dual card can carry 2 keywords in total, which is already as much as an MTG uncommon.

### 2.8 Status effects: exact rules (proposal)

Timing words: **Wave Start** (before deployment), **Beat** (the row act in §2.3), **Wave End** (after the 3 beats).

| Status | Exact rule | Decay | Positional hook | Counter |
|---|---|---|---|---|
| **Poison X** | At Wave End, lose X HP (**ignores Armor and Shield**). | −1 per Wave End | *Spread* (separate keyword): on death, give its Poison to each adjacent ally | Cleanse, Regen race, kill fast |
| **Burn X** | At Wave End, take X damage (Shield absorbs, Armor does not). Then Burn is removed and **each orthogonally adjacent ally gains ⌊X/2⌋ Burn** (only if it has less). | Fully consumed, but spreads | **Punishes clusters**, the counterweight to auras and Clusters | Spread out, Ward, Water/cleanse |
| **Armor X** | Each incoming **hit** is reduced by X (minimum 0). Permanent. | None | Pierce ignores 1 Armor; Lob ignores Armor on back-row targets *(optional)* | Pierce, Poison, many tiny hits *don't* work (that's the point) |
| **Shield X** | Absorbs the next X damage in total. | **Removed at Wave End** (StS Block-like) | *Shieldwall* auras grant Shield to Beside allies | Sweep, Poison, a big single hit |
| **Ward** | Negates the next instance of damage **or** a negative status, then is removed. | Consumed | Rare "Ward Ahead" auras | Sweep (multiple instances), Pierce |
| **Regen X** | At Wave End, heal X (can't exceed max HP). | Permanent while alive | Lifebloom auras grant Regen to Lane allies | Poison is applied first at Wave End; **"Rot" stops healing** |
| **Stun** | Skips its next Beat action and cannot move. Then the unit gains **Steady** (immune to Stun) until the next Wave End. | 1 action | Stun through Push collisions (§2.9) | Steady (built in), Ward |
| **Weak X** | Its attacks deal −X damage. | −1 per Wave End | *Intimidate* auras apply Weak to the enemy cell Ahead | Cleanse, Rally |
| **Mark X** | The next hit against this unit deals +X. Lob and Snipe **prefer** Marked targets. | Consumed on hit | Lets artillery focus fire | Kill the spotter, Ward |
| **Taunt** | Enemy Strike/Shoot/Fork attacks whose pattern covers **this lane or lanes ±1** must target this unit if possible. | Permanent | A center-lane Taunt covers 3 lanes; an edge Taunt covers 2 | Lob, Pierce, Silence, Push |
| **Thorns X** | When hit by Strike or Cleave, the attacker takes X. | Permanent | Fronts with Thorns punish melee walls | Shoot, Lob |
| **Rooted** | Cannot move or be displaced; +1 Armor. | Permanent | The turtle archetype | Lob, Poison |
| **Silence** | Loses all text (abilities and outgoing auras) until Wave End. | 1 wave | Breaks aura towers and Clusters (the unit no longer counts) | Ward |

**Design notes:**
- Poison **ignores** defense and Burn **spreads**: the two damage-over-time statuses have different jobs, which avoids the "Poison vs. Burn are the same" problem.
- Armor (per hit, permanent) vs. Shield (a total, temporary) vs. Ward (one instance) gives three different answers to three attack profiles: many small hits, one big hit, and status bombs.
- Every status shows its **Wave End forecast** in the preview, so tracking complexity is moved into the UI.

### 2.9 Displacement (proposal)

| Keyword | Rule |
|---|---|
| **Push X** | Move the target X cells **away from the line** (Front → Mid → Back). If it is blocked by a unit or the grid edge, **both take 1 collision damage and the target is Stunned.** |
| **Pull X** | Move the target X cells **toward the line**. If it is blocked, as above. |
| **Shove (left/right)** | Move the target 1 lane sideways. If it is blocked, swap positions with the blocker. This **breaks Clusters and opens lanes.** |
| **Swap** | Exchange two friendly units, ignoring Rooted. Rare. |

Displacement makes **enemy position into something you can spend resources on.** Pulling an artillery piece into the Front row before the Front beat is a combo players will discover and share, which is the ITB lesson.

### 2.10 Movement and turn actions (proposal: resolves an open question)

During the deployment step of each wave, players alternate taking **one action** at a time until both pass:

| Action | Gold cost | Notes |
|---|---|---|
| Deploy a card as a monster | 0 | Must go into an empty cell; **Airdrop** (keyword) allows the Back row in contested lanes |
| Stage a card to hand | 0 | Takes it from the face-up deck to your hand |
| Cast a staged spell | 1–4 (the card's cost) | Cannot be cast on the same turn it was staged (per design notes) |
| Move a unit | 0 for its **Swift N** (N cells); otherwise 2 gold per cell | Moving uses up your action, so **its real cost is tempo** |
| Fuse | 0 | Merge a deck copy into an on-board copy (★ level) |
| Pass | — | After both pass in a row, combat starts. The **first to pass gains +1 gold** (a small reason to hold back, and a catch-up lever) |

This keeps **one resource** (gold), while giving movement a cost through tempo (the action) and gold for units without Swift. Turtles (Rooted) cannot move at all; flankers have Swift 2.

---

## 3. Economy depth

### 3.1 Reference numbers

| Game | Income | Saving / interest | Shop | Source |
|---|---|---|---|---|
| **TFT** | ~5 base/round + streak | +1 per 10 banked, **cap +5 at 50**; win/loss streaks +1 (2–3), +2 (4), +3 (5+) | Reroll 2g, 4 XP for 4g `[unverified]` | [Metabot](https://metabot.gg/en/TFT/guides/tft-economy-gold-interest-streaks-explained) `[src]` |
| **Super Auto Pets** | **10 gold every turn**, no carry-over | None (spend everything) | Pet 3g, roll 1g (+1 free roll per turn), merge via duplicates; tier up on odd turns; **Freeze** keeps a shop slot | [SAP wiki](https://superautopets.wiki.gg/wiki/The_Basics) `[src]` |
| **HS Battlegrounds** | 3 gold rising +1 per turn, cap 10, no carry-over | None | Minion 3, refresh 1, sell 1; tavern upgrade cost falls by 1 each turn; triples become golden | [Icy Veins](https://www.icy-veins.com/hearthstone/hearthstone-battlegrounds-mechanics-guide) `[src]` |
| **Hearthstone** (constructed) | Mana +1 per turn, cap 10, refills | — | Single in-match resource; no shop | `[unverified: genre knowledge]` |
| **Dominion** | Treasure cards in the deck | Buying money **dilutes** the deck | Coin buys both money and actions: the classic one-resource tension | `[unverified: genre knowledge]` |
| **Res Arcana** | Essences from cards | Discard a card for 2 essence or 1 gold, which turns a card into resource | 8-card deck; short game, so commit early | [Opinionated Gamers](https://opinionatedgamers.com/2019/05/03/dale-yu-review-of-res-arcana/) `[src]` |
| **Slay the Spire** | Gold from fights | No interest | Card removal cost rises with each use (shop) | `[unverified: exact removal costs]` |

**Lessons:**
- Interest works because **it is capped**: there is a sweet spot, not infinite greed.
- SAP and Battlegrounds remove saving entirely, so tension moves to *what* you buy. **Our design keeps saving, so the interest tax on in-battle spending is the lever.**
- Res Arcana's "discard a card for resource" maps directly onto **selling** a dual card. Selling is a third use for every card (monster, spell, or gold).

### 3.2 Proposed economy (one purse)

| Rule | Value (starting tune) | Why |
|---|---|---|
| Battle reward | Normal 8, Elite 12, Boss 20 | Roughly 2–3 shop buys per normal fight |
| **Interest** | **+1 per 5 gold held *at battle end*, cap +4** | Every gold spent on a spell mid-battle also costs you interest. The tension is visible on the HUD ("−1 interest") |
| Wave-loss catch-up | +1 gold each time you lose a wave (face damage taken > dealt) | Rosewater catch-up; borrowed from TFT and SAP streaks |
| Spell cast cost | 1–4 gold | About 2–4 spells per fight if you spend everything |
| Card price | Common 3 · Uncommon 5 · Rare 8 · Mythic 12 | A clean curve; a ±1 "deal" jitter for surprise |
| Relic price | 10–16 | Long-term power versus cards |
| **Reroll** | 1, then +1 per reroll in the same shop (resets per shop) | Discourages degenerate reroll-to-win |
| **Hold** | 1 free hold slot that carries to the next shop (SAP Freeze) | Lets players plan for the next shop |
| **Sell** | Half the price, rounded down | Deck thinning + money; Res Arcana-style dual use |
| Card removal | 4, rising +2 per use | StS-style escalating thin cost |
| Fuse | Free, but needs 2 copies (★2) and then 2 more (★3) | Smaller decks than TFT, so a 3-copy requirement would be too slow |

**Tempo vs. greed checks:** at 20 gold banked you have +4 interest available. Casting a 4-gold spell drops you to 16, which is +3. The spell must be worth roughly 1 gold of interest *plus* its face cost. A health bar per run (hero HP that carries between battles, StS-style) prices that risk: greed costs HP, tempo costs gold. **Expose both on a single "Spend / Save" HUD readout.**

---

## 4. Run progression and replayability

### 4.1 Systems checklist for a commercial release

| System | Recommendation | Reference |
|---|---|---|
| **Starting heroes** | 4 at EA, 6 at 1.0. Each hero = a starting faction + a starting relic + a passive that bends one rule ("Your Back row units have Swift 1") | StS: 2 chars at EA → 3 at 1.0 → 4 later ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)) `[src]`; Backpack Battles: 4 classes at EA → 6 at 1.0 ([Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles)) `[src]` |
| **Relics / artifacts** | About 120 at 1.0, in the tiers Common / Uncommon / Rare / Boss / Shop / Event | StS: 32 common, 27 uncommon, 24 rare, 20 boss, 20 shop, 4 starter + event, roughly 150 in total ([StS wiki](https://slaythespire.wiki.gg/wiki/Relics)) `[src]` |
| **Card upgrades** | Use **★ fusion** as the upgrade path on the monster half, plus "Empower" (campfire or event) on the spell half. Two halves, two upgrade tracks | — |
| **Ascension / heat** | 10 at EA, 20 at 1.0. Mix numeric and **rule-changing** levels | StS Ascension 20, Monster Train Covenant 25 `[unverified]`; MT2 has 21 Dimensional Challenges `[src]` |
| **Unlock tree** | Unlock cards and relics into the pool by playing (per-hero XP). **Not** power meta-progression, which matches the design note's per-run scope | StS unlocks cards and relics into the pool ([slaythespire.info](https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/)) `[src: page exists]` |
| **Daily run** | A fixed seed + 2–3 Omens + leaderboard, from EA onward | MT2 ships Daily and Dimensional challenges, Endless, leaderboards ([Game Developer PR](https://www.gamedeveloper.com/press-release/monster-train-2-pulls-into-the-station-with-a-locomotive-sized-helping-of-heavenly-mayhem-today-now-available-on-pc-consoles)) `[src]` |
| **Endless / challenge modes** | At 1.0. 9 Kings added a Quest mode during EA ([GamesMarket](https://www.gamesmarket.global/9-kings-sells-over-800-000-copies/)) `[src]` | |
| **Achievements** | 50–80 at 1.0; include a "win with X faction in Y shape" achievement for each faction to teach Clusters | `[unverified count norms]` |
| **Compendium / wiki** | In-game card and keyword encyclopedia **at demo**. Despot's Game reviews complain that players need external guides ([Vaporlens](https://vaporlens.app/app/1227280/despots_game_dystopian_battle_simulator)) `[src]` | |
| **Async PvP (stretch)** | Ghost boards, as in SAP and The Bazaar. Possibly post-1.0 | The Bazaar's async mode is praised ([Vaporlens](https://vaporlens.app/app/1617400/the_bazaar.md)) `[src]` |

### 4.2 Launch content benchmarks

| Game | Launch type | Content at that launch | Notes |
|---|---|---|---|
| Slay the Spire | EA Nov 2017 | 2 characters | 1M copies by mid-2018 ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire)) `[src]` |
| Slay the Spire | 1.0 Jan 2019 | 3 characters, ~75 cards each, ~150 relics, 20 ascension | Cards per character `[src]`; relics `[src]`; ascension `[unverified]` |
| Slay the Spire 2 | EA Mar 5 2026, $24.99 | 5 characters, co-op | 3M+ in week 1; "mostly feature complete" ([Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II), [Boss Rush](https://bossrush.net/2026/04/05/slay-the-spire-2-early-access-review/)) `[src]` |
| Backpack Battles | EA Mar 2024 → 1.0 Jun 2025 | 4 → 6 classes | IGN: EA "lacked enough items to make doing multiple runs interesting" `[src]` |
| Monster Train 2 | 1.0 May 2025, $24.99 | 5 clans × 2 champions (80 start combos), Equipment + Room cards, Endless, Daily | Paid clan DLC planned ([Rogueliker](https://rogueliker.com/monster-train-2-content-roadmap/)) `[src]` |
| Balatro | 1.0 Feb 2024 | 150 Jokers | [games.gg](https://games.gg/balatro/guides/balatro-jokers-guide/) `[src: title]` |
| Super Auto Pets | F2P Sep 2021 | Turtle Pack, then 7 packs over time | Packs as monetization ([Wikipedia](https://en.wikipedia.org/wiki/Super_Auto_Pets)) `[src]` |
| 9 Kings | EA May 2025, $19.99 | 81 battles on the world map; Quest mode added later | 800k+ by Nov 2025 `[src]` |

**Rule of thumb:** **EA needs about 60% of 1.0's breadth plus all core systems; 1.0 adds depth (ascension, modes) and a "second wave" of archetypes.** The thin-content complaint (Backpack Battles EA, Despot's Game) is the most common avoidable bad review.

---

## 5. Market and comparable games (2023–2026)

| Game | Year / status | Price | Commercial signal | Praised | Criticized |
|---|---|---|---|---|---|
| **Slay the Spire 2** | EA Mar 2026 | $24.99 | 3M+ in week 1; 400k+ CCU on day 2 `[src]` | More of everything, co-op | Mixed reviews: review-bombed over balance patches; Ironclad "spread thin" `[src]` |
| **Mewgenics** | Feb 2026 | `[unverified]` | 1M in 1 week; 89 Metacritic ([Game Informer](https://gameinformer.com/2026/02/17/mewgenics-hits-1-million-copies-sold)) `[src]` | Deep turn-based tactics, huge content (~200h) | — |
| **Monster Train 2** | May 2025 | $24.99 | 500k players (incl. Game Pass) `[src]` | GI 9.25: "every run is distinct" | Weak story cutscenes `[src]` |
| **Backpack Battles** | 1.0 Jun 2025; iOS/Android Feb 2026 | ~$12.99 `[unverified]` | 640k Steam copies in month 1; ~91% positive `[src]` | Inventory puzzle, async PvP | Thin content at EA; IGN 6/10 |
| **9 Kings** | EA May 2025 | $19.99 | 800k+ by Nov 2025 `[src]` | "Extremely addictive"; distinct kings `[src]` | Late-game lag; randomness over skill; balance `[src]` |
| **The Bazaar** | 2025 | $20 + paid heroes `[src]` | — | Depth, polish, async play | **Monetization U-turns, distrust, banning critics** `[src]` |
| **Mechabellum** | 1.0 Sep 2024 | `[unverified]` | RPS favorite of 2024 `[src]` | Depth, fair business model | Balance, meta stagnation, matchmaking `[src]` |
| **StarVaders** | 2025 | `[unverified]` | — | "Next must-play deckbuilder"; card + grid blend `[src]` | — |
| **Balatro** | Feb 2024; mobile Sep 2024 | $14.99 PC `[unverified]` / $9.99 mobile `[src]` | 5M+ by Jan 2025, excluding Apple Arcade ([MobileSyrup](https://mobilesyrup.com/2025/01/21/balatro-5-million-copies-sold-update/)) `[src]` | Simple hook, huge depth | — |
| **Cobalt Core** | 2023 | `[unverified]` | — | Positional dogfight, builds on StS rather than copying it ([PC Gamer](https://www.pcgamer.com/cobalt-core-review/)) `[src]` | — |
| **Despot's Game** | 1.0 Oct 2022 | ~$8 `[src]` | — | Pixel art, roguelite + autobattler | Low replay value, needs external wiki, PvP balance `[src]` |
| **Hero's Hour** | Mar 2022 | — | OpenCritic 76 `[src]` | Faction variety, snappy pace | UI, limited map variety `[src]` |

**Patterns across reviews:**
1. **What sells:** a one-sentence hook, roughly 2-minute decisions, and visible build variety ("distinct kings / classes / clans").
2. **What reviews punish:** thin content (EA), balance complaints (every PvP-adjacent game), monetization changes, UI or performance problems with large unit counts. Our 24-cell cap avoids the late-game unit explosion that causes 9 Kings' lag.
3. **Positional + deckbuilder games get praised for "not being a StS clone"** (Cobalt Core, StarVaders, MT2's new deployment phase). That is exactly the positioning in the design notes.

### 5.1 iOS ports

| Game | iOS launch | Price | Lessons |
|---|---|---|---|
| Slay the Spire | Jun 2020 | $9.99 (less than half of other platforms) | **Small touch targets; the finger covers the card; near-unplayable on iPhone SE; no iCloud sync.** iPad works well ([TouchArcade](https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/)) `[src]` |
| Monster Train | Oct 2022 | `[unverified]` | ([Pocket Gamer](https://www.pocketgamer.com/monster-train/ios-launch-date)) `[src]` |
| Balatro | Sep 2024 | $9.99 premium + Apple Arcade "Balatro+" | Won Best Mobile at TGA 2024 `[src]` |
| Into the Breach | Jul 2022 (Netflix) | Netflix subscription | `[src]` |
| Backpack Battles | Feb 2026 | Premium, full parity | UI redesigned for touch `[src]` |
| Super Auto Pets | Feb 2022 | F2P + packs | Browser + mobile + Steam from early on `[src]` |

**Mobile design requirements, start now:** no hover-only information (long-press for detail); cells at least 44pt; dragging a card shows a ghost card *above* the finger; portrait layout (4×3 + 4×3 stacks vertically); cloud save; a premium price of about $9.99. **Design the UI for the phone at the vertical slice**, even if the browser demo comes first.

---

## 6. Concrete recommendations for THIS design

### 6.1 Battle win condition (proposal)

- Each side has **Hero HP** (enemies: 10–30; player: run HP of about 40, carried between battles).
- **Face damage:** unblocked Strike, Shoot and Pierce hit the hero (§2.4).
- **A battle ends** when a hero reaches 0, or **after wave 6 (Sudden Death)**. If both heroes survive wave 6, the side that dealt more total face damage wins and the loser takes the difference as run HP.
- **A board wipe does not end the battle** (design goal: strategic flexibility). An empty board leaves 4 open lanes, which is very dangerous but recoverable.

### 6.2 Keyword list (1.0 target, grouped)

- **Attack patterns (8):** Strike, Shoot, Pierce, Cleave, Lob, Fork, Blast, Sweep (+ Snipe, mythic only)
- **Movement (6):** Swift N, Rooted, Airdrop, Push, Pull, Shove
- **Defense (6):** Armor, Shield, Ward, Taunt, Bodyguard ("once per wave, take a hit aimed at an adjacent ally"), Thorns
- **Statuses (7):** Poison, Burn, Regen, Stun, Weak, Mark, Silence
- **Triggers (6):** Deploy, Last Gasp (on death), Wave Start, Wave End, Bond, Kill
- **Growth / persistence (3):** Grow N (+N/+N at each Wave End survived), **Persist** (stays on the board into the next battle: the design note's "special persistence"), Fuse ★
- **Auras (6 shapes):** Ahead, Behind, Beside, Around, Row, Lane

### 6.3 Factions / tribes with grid identities

Each faction owns a **shape**, a **row**, and **2–3 signature keywords**, and has a **known weakness**.

| Faction | Grid identity (shape) | Preferred row(s) | Signature keywords | Attack patterns | Weakness | Example dual card (monster half / spell half) |
|---|---|---|---|---|---|---|
| **Ironhold** (dwarves, turtles) | **The Wall:** a horizontal Front-row line | Front | Armor, Taunt, Rooted, Shieldwall (Beside Shield aura) | Strike, Cleave | Lob, Poison, slow; can't chase open lanes | *Bastion Tortoise* 2/7 Rooted, Taunt / **Raise the Wall** (2g): all Front-row allies gain 3 Shield |
| **Mirefang** (swamp, venom) | **The Net:** spread across all 4 lanes | Mid | Poison, Spread, Weak, Thorns | Shoot, Fork | Burst damage before Poison ticks; Ward | *Bog Lurker* 2/4 Fork, applies Poison 2 / **Miasma** (1g): Poison 2 to the enemy Front row |
| **Cinderforge** (fire, artillery) | **The Battery:** stacked Back-row cannons behind a screen | Back | Burn, Blast, Mark, Last Gasp: explode (damage Around) | Lob, Blast | Clumping makes it vulnerable to its own fire tactics; Snipe; the Front-row screen dies | *Ember Mortar* 3/2 Lob, applies Burn 2 / **Detonate** (3g): destroy a friendly unit; deal its attack to every enemy in its lane |
| **Galewing** (birds, flankers) | **The Gap:** keeps a lane open and exploits open lanes | Any; moves | Swift 2, Push, Shove, Backstab | Strike + Flank, Fork | Low HP; Taunt; Sweep | *Gust Harrier* 3/2 Swift 2, Backstab / **Tailwind** (1g): Shove an enemy 1 lane; it is Stunned if it collides |
| **Verdant Circle** (druids, growth) | **The Column:** a vertical lane of healers behind a tank | Lane (F-M-B) | Regen, Grow, Lane auras, Persist | Support, Shoot | Silence; Burn spreading down the lane; slow start | *Elder Sapling* 0/5 Grow 1, Lane aura: Regen 1 / **Overgrowth** (2g): a unit gains Persist |
| **Hollow Choir** (undead, tokens) | **The Swarm:** fills empty cells; turns deaths into value | Fills gaps | Last Gasp, Summon (tokens into empty adjacent cells), Sacrifice, Silence | Strike, Sweep | Blast and Sweep; Ward stops Last Gasp chains | *Grave Caller* 1/3 Last Gasp: summon two 1/1 Husks Beside / **Requiem** (2g): Silence one enemy; summon a Husk in your lane |

**Bridges (rares, two tribes):** Ironhold+Cinderforge "Siege Engine" (a screen and battery in one); Galewing+Hollow "Carrion Flock" (gaps feed Summons); Verdant+Mirefang "Rot Garden" (Poison vs. Regen inversions).

**Neutral pool** (~15% of cards): flexible fillers and answers (cleanse, Ward, basic Swift) so no run is bricked by faction draws.

### 6.4 Dual-card design rules (complements §1.3)

1. **Spell half > monster half per action**, because the spell costs gold (rule of thumb in §1.3).
2. **The two halves should be thematically linked but strategically different.** For example, the monster half is a tank and the spell half is a reposition. Avoid "big body / buff for bodies" pairs that always point the same way.
3. **Commons:** the monster half is vanilla or has 1 keyword; the spell half has a single effect.
4. **Choose the use at play time, not at purchase** (proposal): it doubles the decisions per card and fits the face-up deck. If that tests as too much, fall back to choosing at purchase, as in the design notes.
5. **Selling** is the third use (§3.1), so every card has three valuations: board, spell, gold.

### 6.5 Phased content plan

| Phase | Goal | Factions | Dual cards | Relics | Enemy encounters / bosses | Acts | Keywords + statuses | Heroes | Modes / meta |
|---|---|---|---|---|---|---|---|---|---|
| **Vertical slice** (browser) | Prove that the 2-minute wave battle is fun | 2 (Ironhold, Cinderforge) | ~24 (12 each) + 6 neutral | 8 | 8 / 1 | ½ act (6 nodes) | 6 + 3 | 1 | None. Instrument telemetry |
| **Demo** (browser + Steam Next Fest) | Wishlists; validate the hook | 3 (+ Galewing) | ~60 | 20 | 15 / 2 | 1 act + boss | 10 + 6 | 2 | Ascension 1–3, compendium, first daily-seed test |
| **Early Access** (Steam) | Revenue + community balance | 4 (+ Mirefang) | ~150 | ~60 | ~40 / 6 (2 per act) | 3 acts | 14 + 9 | 4 | Ascension 10, daily runs, unlock tree, 30 achievements, Omens |
| **1.0** (Steam → iOS) | Full launch, press | 6 (+ Verdant, Hollow) | **~260–300** | ~120 | ~70 / 9 + final boss | 3 acts + secret act | 18–20 + 11–12 | 6 | Ascension 20, endless, challenge set, 60–80 achievements, touch UI, cloud save |
| **Post-1.0** | Long tail | +1–2 factions as DLC (MT2 model) | +60/DLC | +20 | — | — | +1 keyword per faction | +1 | Async ghost PvP (stretch) |

**Calibration:** StS 1.0 had about 75 cards per character across 3 characters plus about 150 relics. Our ~280 dual cards ≈ 420 single-use designs of content, so it is competitive with that. **Do not cut relic count:** relics are the cheapest way to create run-defining variety.

### 6.6 Risk register (systems)

| Risk | Signal | Mitigation |
|---|---|---|
| Solved openers (face-up deck) | Same first 3 actions in more than 60% of winning runs | Random starting hands of 2 face-up "Reserve" cards, Omens, enemy variety |
| Tracking overload (24 cells × auras × statuses) | Playtesters ask "why did that happen?" | A full combat preview before committing, aura lines, Wave End forecast chips |
| Rich-get-richer purse | A high-gold run wins nearly every fight | Interest cap +4, loss gold, rising reroll cost |
| Turtle stalemate | Many battles reach wave 6 | Sudden Death, Lob/Poison enemies, face-damage escalation |
| Clusters make one shape dominant | One cluster shape tops win rates | Burn spread, Blast, Shove enemies, Omens like "Clusters count diagonally" |
| Monetization trust | — | Premium only; any DLC is clearly additive (avoid The Bazaar's pattern) |

---

## Sources

**Theory:** [Water Finds a Crack](https://designer-notes.com/game-developer-column-17-water-finds-a-crack) · [Design 101: Complexity vs. Depth](https://www.gamedeveloper.com/design/design-101-complexity-vs-depth) · [Criteria for Strategy Game Design](https://www.gamedeveloper.com/design/criteria-for-strategy-game-design) · [Sid Meier: Interesting Decisions (video)](https://gamedeveloper.com/design/video-sid-meier-explores-interesting-decisions-in-gameplay) · [Ten Things Every Game Needs pt.1](https://magic.wizards.com/en/news/making-magic/ten-things-every-game-needs-part-1-2011-10-24) · [pt.2](https://magic.wizards.com/en/news/making-magic/ten-things-every-game-needs-part-1-part-2-2011-12-19) · [Lenticular design explainer](https://giantbomb.com/users/4072/articles/hiding-in-plain-sight-lenticular-design-in-games) · [New World Order](https://mtg.wiki/page/New_World_Order) · [New New World Order](https://magic.wizards.com/en/articles/archive/making-magic/new-new-world-order-2013-03-29)

**Mechanics:** [Into the Breach (Wikipedia)](https://en.wikipedia.org/wiki/Into_the_Breach) · [ITB GDC postmortem listing](https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach) · [Duelyst positioning (Kotaku)](https://kotaku.com/duelysts-latest-expansion-plays-to-the-card-games-uniqu-1796949377) · [Faeria land placement](https://www.faeria.com/the-hub/guide/61-faeria-academy-chapter-2-land-placement) · [Wildfrost effects (Gameranx)](https://gameranx.com/features/id/464170/article/wildfrost-every-effect-explained-tips-tricks-guide/) · [Cobalt Core review (PC Gamer)](https://www.pcgamer.com/cobalt-core-review/) · [StarVaders review](https://rogueliker.com/starvaders-review/) · [MT2 deployment phase](https://deltiasgaming.com/?p=239890) · [Mechabellum (Wikipedia)](https://en.wikipedia.org/wiki/Mechabellum)

**Economy:** [TFT economy](https://metabot.gg/en/TFT/guides/tft-economy-gold-interest-streaks-explained) · [SAP basics](https://superautopets.wiki.gg/wiki/The_Basics) · [HS Battlegrounds mechanics](https://www.icy-veins.com/hearthstone/hearthstone-battlegrounds-mechanics-guide) · [Res Arcana review](https://opinionatedgamers.com/2019/05/03/dale-yu-review-of-res-arcana/)

**Progression / content:** [Slay the Spire (Wikipedia)](https://en.wikipedia.org/wiki/Slay_the_Spire) · [StS relics wiki](https://slaythespire.wiki.gg/wiki/Relics) · [StS unlocks](https://slaythespire.info/en/how-to-unlock-characters-cards-and-relics-spoiler-warning/) · [Balatro jokers](https://games.gg/balatro/guides/balatro-jokers-guide/) · [MT2 launch PR](https://www.gamedeveloper.com/press-release/monster-train-2-pulls-into-the-station-with-a-locomotive-sized-helping-of-heavenly-mayhem-today-now-available-on-pc-consoles) · [MT2 roadmap](https://rogueliker.com/monster-train-2-content-roadmap/) · [MT2 review (GI)](https://gameinformer.com/review/monster-train-2/engine-ingenuity)

**Market:** [Slay the Spire II (Wikipedia)](https://en.wikipedia.org/wiki/Slay_the_Spire_II) · [StS2 EA review](https://bossrush.net/2026/04/05/slay-the-spire-2-early-access-review/) · [Mewgenics 1M](https://gameinformer.com/2026/02/17/mewgenics-hits-1-million-copies-sold) · [Backpack Battles (Wikipedia)](https://en.wikipedia.org/wiki/Backpack_Battles) · [Backpack Battles mobile](https://ixbt.games/en/news/2026/02/05/indi-xit-backpack-battles-stal-dostupen-na-ios-i-android.html) · [9 Kings 800k](https://www.gamesmarket.global/9-kings-sells-over-800-000-copies/) · [9 Kings sentiment](https://vaporlens.app/app/2784470/9_kings) · [The Bazaar sentiment](https://vaporlens.app/app/1617400/the_bazaar.md) · [Mechabellum sentiment](https://vaporlens.app/app/669330/mechabellum.md) · [Despot's Game sentiment](https://vaporlens.app/app/1227280/despots_game_dystopian_battle_simulator) · [Hero's Hour (OpenCritic)](https://opencritic.com/game/12822/heros-hour) · [Balatro 5M](https://mobilesyrup.com/2025/01/21/balatro-5-million-copies-sold-update/) · [Balatro mobile](https://toucharcade.com/2024/09/05/balatro-mobile-release-date-price-download-apple-arcade/) · [StS iOS review](https://toucharcade.com/2020/06/15/slay-the-spire-ios-review-iphone-ipad-performance-icloud-megacrit-humble-games/) · [Monster Train iOS](https://www.pocketgamer.com/monster-train/ios-launch-date) · [Super Auto Pets (Wikipedia)](https://en.wikipedia.org/wiki/Super_Auto_Pets) · [Best new roguelikes (Rogueliker)](https://rogueliker.com/best-new-roguelikes)
