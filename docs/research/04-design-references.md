# 04 — Design References: Rogue-lite × Card Game × Auto-Battler

_Research compiled 2026-10-07 for the browser hybrid described in `/mnt/project-files/design/design-notes.md` (4x3 positional grid, dual-purpose monster/spell cards, face-up no-random-draw deck, alternating placement with escalating waves, one unified gold resource, TFT-style fusion, status effects)._

**Legend for numbers:** **[V]** = verified this session against a wiki or primary source (URL given). **[A]** = approximate or from memory/community knowledge. Check these before relying on them. Values change with patches, so read every number as an example of scale, not a spec.

---

## TL;DR

- **Closest existing references for this design:** Inscryption (lanes, a damage "scale" instead of a board wipe), Monster Train (positional floors, defending a pyre HP), Wildfrost (rows and counters, a team rather than a deck), Into the Breach (telegraphed intents on a small grid), Mechabellum (alternating, reactive deployment with one resource for everything), Res Arcana and MTG MDFCs (dual-use cards), Dicey Dungeons (randomness shown before you act).
- **Answers to the open questions (details in §6):**
  - **Battle win condition:** each side has an HP buffer, and *breach damage* is dealt at the end of each wave. Battles have a hard cap of 5 waves, and an enemy enrage ends stalls.
  - **Move cost:** every monster has a `Move` stat (0–2) of free steps per placement phase. Each extra step costs 1 gold. Moving does not use up your placement action.
  - **Monster/spell weighting:** each face of a card gets about 85–90% of a single-purpose card's power budget (the MDFC rule). Monster faces cost no gold but use the turn's placement action. Spell faces cost gold and take two steps: commit the card to hand, then cast it on a later turn.
- **Balance approach:** the StS approach of watching pick rate and win rate per card, a headless JS combat simulator from the first day, and a stat-point power budget. Keep rare combos strong but hard to assemble.
- **MVP budget:** one act of about 15 nodes, **36 dual cards** (72 faces), 3 families plus neutrals, 4 statuses, 12 artifacts, about 12 enemy encounters (8 normal, 3 elite, 1 boss), 5 events. Target run length is 30–45 minutes.

---

## 1. Core loops: what works and what carries over

### 1.1 The genre anchors

| Game | Core loop | Why it works | Carries over to this design? |
|---|---|---|---|
| **Slay the Spire** | Choose a path on a branching map. Fight with a 3-energy hand drawn from the deck. After each fight, pick 1 of 3 cards (or skip). Shops, rests, relics, 3 acts, boss. | Visible enemy **intents** make every turn a puzzle. Skipping cards means deck *quality* beats deck size. The map lets you choose your risk (elites mean relics). | **Yes:** map structure, intent telegraphs, 1-of-3 rewards with a skip, paid card removal. **No:** random draw (replaced by face-up deck). |
| **Slay the Spire 2** (EA Mar 2026) | Same loop, plus 2 variants per act, 4-player co-op, Timeline/Epoch meta unlocks. | Shows that alternate acts and meta unlocks extend replay value. Mega Crit says EA exists for balancing. [Wikipedia](https://en.wikipedia.org/wiki/Slay_the_Spire_II) | Alternate act variants are cheap replay value after the MVP. |
| **Balatro** | Play poker hands to reach a score target. 3 blinds per ante, 8 antes. Shop for Jokers (passive modifiers) between blinds. | Multiplicative **chips × mult** produces huge late-game numbers. Jokers are a "Rube Goldberg machine you set up and watch go" (LocalThunk). Familiar poker theme as onboarding. | **Yes:** passive modifiers (artifacts) that change rules, multiplicative scaling in a small number of slots, interest economy. |
| **Super Auto Pets** | 10 gold per turn, buy 3-gold pets, a 5-slot line, auto battle against an async ghost, 10 wins before lives run out. | Tiny decision space per turn. Deterministic, readable fights (front pet against front pet). Freeze, merge, sell. | **Yes:** merging copies (+stats/XP), freezing shop slots, tier unlocks on a turn schedule, async ghosts if PvP comes later. |
| **Teamfight Tactics** | Shared pool, shop odds scale with level, interest on banked gold, streaks, 3 copies combine into ★2. | Economy decisions (level, roll, or save) are the game. Trait thresholds (2/4/6) give tribe breakpoints. | **Yes:** fusion of 3 copies, interest cap, trait breakpoints, adjacency (hexes) as synergy. |
| **Hearthstone Battlegrounds** | 3→10 gold ramp, tavern tiers, 7-slot board, triples become golden plus a Discover. | Damage = tavern tier + surviving minion tiers, so a loss stings in proportion to how badly you lost. | **Yes:** scaled breach damage based on survivors. Triple reward = fused unit plus a choice. |
| **Backpack Battles** | Shop, then arrange items in a grid bag, then async 10–20 s fight. 10 wins before 5 losses, up to 18 rounds. | Spatial puzzle: adjacency and shape matter (a Pan hits harder next to food). Recipes combine adjacent items. [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles) | **Yes:** adjacency as the main synergy source. Combining by placement. |
| **The Bazaar** | Days of 6 "hours": vendors/events, 1 PvE, 1 PvP. Items with cooldowns on a fixed board. | Spatial board plus a timing engine. Variety of vendors gives a sense of route choice. [Mobalytics](https://mobalytics.gg/the-bazaar/guides/day-guide) | Partly: cooldown/timer readability, a day-like cadence. |
| **Monster Train** | Defend the Pyre on 3 floors. Place units per floor. Enemies climb the floors. Clan pairs. | **Positional deckbuilder.** Units *are* cards, and where you put them matters. The Pyre is an HP buffer. "Multiple floors and the importance of positioning" was core from the prototype. [Q&A](https://www.digitallydownloaded.net/2020/02/developer-q-a-monster-train-a-deckbuilding-roguelike-with-a-hellish-theme.html) | **Yes, closest analogue.** Positional placement, persistent units within a battle, HP buffer, wave escalation. |
| **Inscryption** | 4 lanes. Creatures attack straight ahead. Unblocked damage tips a scale, and a lead of 5 wins. | The win condition is a **tug-of-war**, not a board wipe. Sacrifice costs. Icon-only cards for legibility. [GameDev](https://www.gamedeveloper.com/design/how-game-jam-sacrifices-became-inscryption) | **Yes:** "unblocked lane = direct damage" maps directly onto the 4x3 grid columns. |
| **Dicey Dungeons** | Roll dice, then slot them into equipment. | "You get the RNG up front, and you get to decide how to make the best of it." Cavanagh found random cards plus random dice was too chaotic and moved to static equipment. [GameDev](https://www.gamedeveloper.com/disciplines/road-to-the-igf-cavanagh-houston-dobbe-s-i-dicey-dungeons-i-) | **Yes, philosophically.** It backs the face-up deck: show randomness before the decision. |
| **Luck be a Landlord** | Slot-machine deckbuilder. Rent rises on a schedule. Add or remove symbols. | Escalating fixed targets (like Balatro antes). Adjacency between symbols drives combos. | Adjacency synergy, removal as a key decision, escalating thresholds. |

### 1.2 Grid and positional card games (references for the 4x3 grid)

| Game | Positional mechanic | Lesson for this design |
|---|---|---|
| **Into the Breach** | 8x8 grid. Enemies **telegraph** exact attacks a turn ahead. Perfect information. | Show each enemy's attack direction and target cells before the wave resolves, so moving is a puzzle and not a guess. [GDC Vault](https://gdcvault.com/play/1025772/-Into-the-Breach-Design) |
| **Duelyst** | 9x5 grid, general unit as win condition, tactics plus CCG. Over 250k daily matches. [GDC](https://gdcvault.com/play/1024581/9-Takeaways-from-Duelyst-From) | Free movement on a large grid made card text heavy. Small grids keep it readable. |
| **Faeria** | Hex board you build with land cards. | Terrain as a resource. Possible future: "terrain" cells on the 4x3 grid. |
| **Marvel Snap** | 3 lanes (locations), 6 turns, 12-card deck, simultaneous reveal. | Short fixed length (about 3–4 min). Cap waves for the same reason. Brode: "Simplify – even if your team hates you." On-screen text about 11 words per card. [mobilegamer](https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/), [GameDev](https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns) |
| **Cobalt Core** | Ship moves left/right. Enemy intents show which columns get hit. | **Movement as the main defence** against telegraphed column attacks. Close to the `Move` stat idea. [PC Gamer](https://www.pcgamer.com/cobalt-core-review/) |
| **Wildfrost** | 2 rows × 3 per side, counter timers, leader unit. | The idea of rows plus a "team, not a deck" came from Monster Train. Define terms exactly ("what is a *hit*"). Runs kept short (30–60 min) so losses don't sting. [MCV](https://mcvuk.com/?p=224506) |
| **Mechabellum** | Alternating rounds: each player deploys and upgrades after seeing the opponent's last board. **One resource** for new units and upgrades. Damage = surviving units. | Strongest reference for "reactive placement + one purse + survivors deal damage". [GamingOnLinux](https://gamingonlinux.com/2023/05/mechabellum-is-an-auto-battling-supreme-commander-im-completely-hooked) |
| **Despot's Game** | Roguelike auto-battler, units placed on a grid, items, a maze of rooms. | Proof that a roguelike map plus grid auto-battle works single-player. [Review](https://www.superjumpmagazine.com/despots-game-review/) |

### 1.3 Dual-use card references (for "every card is a monster AND a spell")

| Reference | Mechanic | Lesson |
|---|---|---|
| **MTG MDFCs** (Zendikar Rising+) | Two faces: spell or land. Choose when cast. | Each face is deliberately **weaker or taxed** compared with a single-faced card, and the flexibility pays for the gap. [Draftsim](https://draftsim.com/mdfc-mtg/) |
| **MTG Adventure cards** (Eldraine) [A] | Cast the cheap spell first, then the creature later from exile. | The "spell now, body later" sequence is the most loved version. Consider "cast spell face, then the card returns as a monster next battle" as an artifact effect. |
| **Res Arcana** | Each card is played for its effect *or* discarded for resources. Only 8-card decks. | Tiny face-up decks create a planning puzzle with no dead draws. Close cousin of the face-up deck. [Opinionated Gamers](https://opinionatedgamers.com/2019/05/03/dale-yu-review-of-res-arcana/) |
| **Race for the Galaxy / Dominion** [A] | Cards are also currency (RftG). Cards have a fixed use (Dominion). | When everything is multi-use, the hard part is *opportunity cost*. Give each face a clear role so the choice is legible. |
| **Hearthstone Battlegrounds Spells / Discover** [A] | Taverns sell minions and spells for the same gold. | A shared shop for bodies and effects already works in a popular game. |

---

## 2. Concrete numbers

### 2.1 Slay the Spire (base game)
| Item | Value | Src |
|---|---|---|
| Floors per act | 17 (15 map rows + boss + boss chest). 3 acts, plus a 3-floor Act 4 | [V] [wiki](https://slaythespire.wiki.gg/wiki/Map_Generation) |
| Map width | up to 6 nodes per row. Each room has 1–3 paths in and 1–3 out | [V] same |
| Fixed rows | F1 = easy monster, F9 = treasure, F15 = rest, F16 = boss | [V] same |
| Random node weights | Monster 53%, Unknown (?) 22%, Rest 12%, Elite 8%, Merchant 5% | [V] same |
| Elite constraint | No elites/rests in the first 5 rows; no rest on row 14; no consecutive elite/shop/rest along a path [A] | [A] [kosgames](https://kosgames.com/slay-the-spire-map-generation-guide-26769/) |
| Ascension 1 | Elites about +60% more frequent | [V] wiki |
| Card reward rarity (normal / elite) | Common 60/50, Uncommon 37/40, Rare 3/10; boss = 100% rare | [V] [fandom](https://slay-the-spire.fandom.com/wiki/Card_Rewards) |
| Rarity pity | Offset starts at −5%, +1% per common rolled, resets on a rare, cap +40% | [V] same |
| Cards per reward | Choose 1 of 3 or skip | [V] same |
| Starting gold | 99 | [V] [wiki](https://slaythespire.wiki.gg/wiki/Gold) |
| Gold per fight | Normal 10–20, Elite 25–35, Boss 95–105 | [V] same |
| Shop | 5 class cards (2 Atk, 2 Skill, 1 Power; one at 50% off), 2 colorless, 3 relics, 3 potions | [V] [wiki](https://slaythespire.wiki.gg/wiki/Merchant) |
| Shop prices | Common 45–55, Uncommon 68–83, Rare 135–165. Relics 143–158 / 238–263 / 285–315. | [V] same |
| Card removal | 75 gold, +25 each time used | [V] same |
| Starting deck / HP | Ironclad 10 cards (5 Strike, 4 Defend, Bash), 80 HP. Silent 12 cards, 70 HP. Defect 75, Watcher 72. | [A] |
| Energy / hand | 3 energy, draw 5 | [A] |
| Rest site | Heal 30% max HP, or upgrade a card | [A] |
| Typical final deck | ~25–35 cards [A] | [A] |
| Ascension | 20 levels, each adds a modifier | [V] GDC summary |

**Takeaways for this design:** about 15 decision rows per act, roughly 1 elite per 12 nodes, guaranteed rest before the boss, treasure at the midpoint. Pity timers keep rare drops from feeling streaky.

### 2.2 Balatro
| Item | Value | Src |
|---|---|---|
| Antes | 8 to win; 3 blinds each (Small 1×, Big 1.5×, Boss 2× base) | [V] [wiki](https://balatrowiki.org/w/Blinds_and_Antes) |
| Base chips per ante (white stake) | 300, 800, 2k, 5k, 11k, 20k, 35k, 50k (**~2.5× growth for early antes, flattening later**) | [V] same |
| Blind payout | $3 / $4 / $5 (Showdown $8) | [V] same |
| Hands / discards / Joker slots | 4 / 3 / 5 | [A] |
| Interest | $1 per $5 held, capped at $5 (needs $25) | [A] |
| Stakes (difficulty) | 8 | [A] |

**Multiplicative scoring:** score = (chips sum) × (mult sum, then ×mult effects in order). Additive sources are linear and ×mult sources compound, so late power grows exponentially. That is why targets grow about 2–2.5× per ante. **Lesson:** if the hybrid lets buffs stack multiplicatively (e.g., adjacency ×1.5 on top of ★ levels), enemy HP needs a geometric curve too. Otherwise the run is trivial by mid-act. In a 4x3 grid it's safer to keep in-battle stacking **additive** and put the multiplicative scaling in rare artifacts only.

LocalThunk on hiding score previews: "the game is more fun when you set up your Rube Goldberg machine and watch it go before knowing whether … the hand will win" ([GMTK](https://gmtk.substack.com/p/balatros-cursed-design-problem)). On balancing: "When you hang a picture… it's better to just do it by feel." Jokers were added mid-development as passive modifiers, and every Joker was rebalanced at least once ([Rogueliker](https://rogueliker.com/balatro-interview/)). **Caution:** GMTK argues that hiding information players *can* calculate pushes them to spreadsheets. The face-up design should show **all** outcomes (wave preview).

### 2.3 Super Auto Pets
| Item | Value | Src |
|---|---|---|
| Gold per turn | 10 (no carry-over) | [V] [wiki](https://superautopets.wiki.gg/wiki/The_Basics) |
| Pet / food / roll | 3 / 3 / 1 | [V] same |
| Sell value | 1 per pet level (1–3) | [V] [wiki Shop](https://superautopets.wiki.gg/wiki/Shop) |
| Team slots | 5 (max 3 on turn 1) | [V] Basics |
| Tier unlock | T1 turn 1, T2 t3, T3 t5, T4 t7, T5 t9, T6 t11 | [V] same |
| Leveling | Merge copies: Lv2 at 2 XP, Lv3 at 5 XP; +1/+1 per merged copy | [V] same |
| Shop slots | 3 pets / 1 food early, rising to about 5 pets / 2 food later | [A] |
| Lives / wins | Arena: 5 lives (Easy 7), win at 10 wins. +1 life restored on turn 3 if lost. Versus: 6 lives | [V] same |
| Stat cap | 50/50 | [V] same |
| Freeze | Any number of shop items, kept across turns | [V] Shop |

**Lesson:** fixed gold with no carry-over makes each turn a self-contained puzzle. That is the opposite of the "unified resource" here, so borrow the *freeze* and *merge* mechanics, not the economy.

### 2.4 Teamfight Tactics
| Item | Value | Src |
|---|---|---|
| Base income | ~5 gold/round | [V] [metabot](https://metabot.gg/en/TFT/guides/tft-economy-gold-interest-streaks-explained) |
| Interest | +1 per 10 banked, cap +5 at 50 | [V] same |
| Streak bonus | 2–3: +1, 4: +2, 5+: +3 (win or lose streaks) | [V] same |
| PvP win | +1 gold | [A] |
| XP / reroll | 4 gold for 4 XP; reroll 2 | [A] |
| Shop | 5 champions per roll; 3 copies → ★2, 9 → ★3 | [A] |
| Pool sizes (per champion) | 1-cost 22, 2-cost 20, 3-cost 17, 4-cost 10, 5-cost 9 | [V] [esports.gg](https://esports.gg/news/teamfight-tactics/tft-tip-tuesday-unit-pool-size-and-rerolling/) (patch-dependent) |

Shop odds by level (1/2/3/4/5-cost %, [V] same source, set-dependent):

| Lvl | 1c | 2c | 3c | 4c | 5c |
|---|---|---|---|---|---|
| 3 | 75 | 25 | 0 | 0 | 0 |
| 4 | 55 | 30 | 15 | 0 | 0 |
| 5 | 45 | 33 | 20 | 2 | 0 |
| 6 | 30 | 40 | 25 | 5 | 0 |
| 7 | 20 | 33 | 36 | 10 | 1 |
| 8 | 18 | 27 | 32 | 20 | 3 |
| 9 | 15 | 20 | 25 | 30 | 10 |
| 10 | 5 | 10 | 20 | 40 | 25 |

**Lesson:** an interest cap (+5 at 50) creates a saving goal *and* a ceiling, so "always save" stops paying off. A level-gated rarity curve is a clean template for the shop rarity per act floor.

### 2.5 Hearthstone Battlegrounds ([V] [fandom](https://hearthstone.fandom.com/wiki/Battlegrounds))
- Gold 3 on turn 1, +1 per turn to a cap of 10, no carry-over. Minion 3, sell 1, refresh 1.
- Tavern upgrade 5/7/8/11/10, each −1 per turn waited. Board 7. Hero HP 40.
- **Damage = your tavern tier + sum of tiers of your surviving minions.** Triples become golden (×2 stats) plus a Discover.
- Offer size: 3 minions at tier 1, +1 at tiers 2, 4, 6. Pool copies per tier 16/15/13/11/9/7.

### 2.6 Backpack Battles / The Bazaar / others
- **Backpack Battles:** up to 18 rounds, **10 wins before 5 losses**, async ghosts, 10–20 s fights, recipes from adjacent items [V] [Wikipedia](https://en.wikipedia.org/wiki/Backpack_Battles). Gold per round is not verified (about 12 gold early, rising, reroll ~1 [A]).
- **The Bazaar:** day = 6 hours (4 vendor/event, 1 PvE, 1 PvP). Start 15 gold, 7 income [V] [Mobalytics](https://mobalytics.gg/the-bazaar/guides/day-guide). 10-slot board, items 1/2/3 slots, 20 prestige, aim for 10 PvP wins [A].
- **Inscryption Act 1:** 4 lanes, scale tips at a 5-point lead, blood (sacrifice) and bones costs [A].
- **Marvel Snap:** 12-card deck, 6 turns, 3 locations × 4 slots, games ~3–4 min [V/A] (sources in §1.2).
- **Monster Train:** 3 playable floors plus pyre, ~8–9 battles per run, Covenant difficulty 0–25 [A].
- **Mechabellum:** survivors at the end of the round deal damage; 2 towers per side [V] (GamingOnLinux).

---

## 3. Balance methodology, applied to this design

### 3.1 Metrics-driven design (Slay the Spire, GDC 2019)
Source: Anthony Giovannetti, *"Slay the Spire: Metrics Driven Design and Balance"* — [GDC Vault](https://www.gdcvault.com/browse/gdc-19/play/1025731), [GameDev summary](https://www.gamedeveloper.com/design/learn-i-slay-the-spire-i-s-metrics-driven-approach-to-game-balancing-at-gdc-2019), [notes](https://glasp.co/youtube/7rqfbvnO_H0), [critical analysis](https://mechanicsofmagic.com/2022/05/22/critical-play-is-this-game-balanced-10/).
- An in-house metrics server logged every run. The core metrics were **pick rate** and **win rate per card/relic**, plus floor reached.
- Cards are judged **in context of how often they're found**. A busted rare is fine because finding it is a reward. A slightly undercosted *common* gets nerfed because players feel forced to pick it every time.
- Strong combos (Dead Branch + Corruption) stay in because they are **rare, hard to assemble, or must be chased deliberately**. In single-player that power is fun, not oppressive.
- Discord, a feedback bot, streamers, and weekly EA patches. Ascension 20 gives granular difficulty data.

**For the browser hybrid, from the first build:**
1. Log per run: seed, node path, every shop offer and purchase, which **face** each card was played as (monster vs spell, the core metric for dual-purpose cards), placements and moves, waves per battle, gold at each decision, and cause of death.
2. Dashboards: per card, *offered → bought %*, *monster-face % vs spell-face %*, *win rate when owned*, *win rate when bought in act 1*. If a card is used as one face 90% of the time, the other face is either dead or the card is mispriced.
3. Per encounter: average HP lost, waves to win, % of runs ended here.

### 3.2 Simulation
- Write combat as a **pure, deterministic function** `resolveWave(state, seed) → {state, events[]}` in TS/JS with no DOM. It drives the renderer through the event log (SAP and TFT style replays) and runs headless in Node for thousands of sims.
- Bots: (a) random legal, (b) greedy (maximise board power), (c) scripted archetypes ("poison", "armor turtle"). Run each card under bot (b) vs the encounter list and flag outliers more than 1.5 SD from its cost cohort.
- Telemetry tells you about *player* behaviour. Sims tell you about *ceiling and stability*. You need both.

### 3.3 Power budget / stat-point formula (starting template, tune by sim) [A, design proposal]
Give every card a **tier** T (1–3, matching Common/Uncommon/Rare) and a **budget** B(T) = 6 + 4·(T−1), so T1 = 6, T2 = 10, T3 = 14 points.

| Monster attribute | Cost (points) |
|---|---|
| +1 ATK | 1.0 |
| +1 HP | 0.5 |
| +1 Move (0→1→2) | 1.0 / 1.5 |
| Reach (hits back row / 2 cells) | 1.5 |
| Directional extra (hit diagonals / sides) | +1 per extra direction |
| Adjacency aura (+1 ATK to neighbours) | 2.0 |
| Status on hit (1 poison) | 1.0 per stack |
| Armor 1 (regenerates per wave) | 1.5 |
| Drawback (can't move, dies after 2 waves, etc.) | −1 to −3 |

| Spell attribute | Cost (points) | Notes |
|---|---|---|
| 1 damage to a cell | 1.0 | ×1.5 for a row or column, ×2.5 for the whole grid |
| 1 poison | 0.8 | Ticks every wave, so it gains value with longer battles. Re-check if the wave cap changes |
| 1 armor / heal | 0.7 | |
| +1/+1 permanent buff (this battle) | 1.5 | |
| Reposition (free move) | 1.0 | Ties into the move economy |
| Gold cost | each 1 gold paid adds 2 points to the spell budget | Spells are always paid |

**Dual-card rule (MDFC principle):** monster face ≈ **0.85·B** and spell face ≈ **0.85·B + 2·goldCost**. Either face alone is a little under-rate, and the option makes up the difference. Track the face-usage split. A healthy card sits around 40/60 to 60/40 *across the population*, though individual runs will be lopsided, and that's fine.

**Fusion:** ★2 = roughly +80% stats plus an upgraded keyword (TFT/HS-style "golden" doubles stats, but with a 4x3 board ×2 is too much). ★3 = ×2.5 plus a new effect. The spell face scales too (damage ×1.6 or extra targets).

### 3.4 Rarity scaling, tempo vs scaling
- Commons should be **tempo** (immediate stats, cheap spells). Uncommons are **synergy enablers** (adjacency, statuses). Rares are **engines or build-arounds**. StS shows rares can sit 20–40% over budget if they appear rarely and ask you to build around them.
- **Tempo vs scaling** matters a lot here. Waves are capped (§6), so scaling cards ("+1 ATK each wave") have a known ceiling. Price them on the *expected* waves they'll live (≈ cap − deploy wave). Poison and stacking buffs are scaling; armor and big bodies are tempo.
- **Engine** = repeatable value that grows (aura monsters, "whenever a neighbour is poisoned…"). **Build-around** = a card that's weak unless you commit (StS Corruption, Balatro Blueprint). For the MVP, ship **1–2 build-arounds per family**. They create the "run identity" moments.

### 3.5 Synergy and tribe design
- TFT trait breakpoints (2/4/6) map onto a 12-cell grid as **family thresholds of 2 and 4 on the board** (the board is small, so 6 is too many).
- Positional synergy has three axes: **adjacency** (orthogonal neighbours), **row** (front/back), **column** (lane). Give each family *one primary axis* so it's easy to learn. Example: a Swarm family uses adjacency, a Ranger family uses columns and back row, a Bulwark family uses the front row and armor.
- **Avoid dominant strategies:** (1) every family should need something the others offer, so combining families is better than going pure; (2) give each family a hard counter among enemy encounters (anti-poison elite, AoE vs swarm, piercing vs armor); (3) cap stacking statuses (poison ≤ 10, armor resets per wave or decays by half).

---

## 4. Meta-progression and run length

| Game | Meta pattern | Run length [A] |
|---|---|---|
| StS | Character unlocks, card unlocks per character XP, **Ascension 1–20** (one modifier each) | 45–90 min |
| StS 2 | **Timeline/Epochs**: completing runs unlocks story and content [V] | similar |
| Balatro | Deck and stake unlocks (8 stakes), Joker discovery collection | 30–60 min |
| Monster Train | Clan levels unlock cards; Covenant 0–25 | 45–60 min |
| Wildfrost | Town building unlocks; runs deliberately short (30–60 min) [V] | 30–60 min |
| SAP / Backpack Battles | Pack unlocks, ranked rating | 15–30 min |
| Inscryption | Narrative act progression | n/a |

**Recommendation:** notes say *per-run only* for now, and that's correct for the MVP. When retention matters, add in order: (1) **Ascension-style difficulty tiers** (cheap, no new content; StS proved the data value), (2) **card-pool unlocks** after first win or N runs (teaches the game gradually), (3) alternate starter decks (Balatro decks). Avoid permanent stat boosts. They break the balance you measured.

**Run length target:** a 1-act slice of 15 nodes × (2–4 min per battle + 30–60 s per shop/event) ≈ **30–45 min** for a full 3-act game, or about 12–15 min per act. For a browser game, save state after every node.

---

## 5. Pitfalls and mitigations (tailored)

| Pitfall | Seen in | Mitigation for this design |
|---|---|---|
| **Auto-combat readability**: who hit whom, why did I lose? | TFT (chaotic), SAP is good (sequential) | Resolve in a **fixed, documented order**: front row → back row, left → right (or by ATK like SAP). Animate one attack at a time at 2× speed, skippable. Write every event to an on-screen log. |
| **"I had no agency in combat"** | General auto-battler complaint | Already addressed by waves. Also show a **wave preview**: arrows for each unit's planned attack and expected damage numbers (Into the Breach / Cobalt Core intents). Players should be able to predict 90% of outcomes. |
| **Hidden but calculable info** pushes players to spreadsheets | Balatro score preview, Isaac | Face-up design means **show everything**: enemy reinforcements for next wave, damage forecast, poison ticks. |
| **Analysis paralysis** from a fully visible deck plus grid | Duelyst-scale boards, chess-likes | Keep the deck small (**8 start, cap ~16**). Alternate turns with **one placement action** each. Undo within a placement phase until you confirm. Cap waves at 5. |
| **Solved openings**: a face-up deck means the same first turn every fight | Res Arcana risk | Input randomness via **enemy composition and their placements** (Brode's input vs output randomness), varied grid "terrain"/hazard cells per encounter, starting placement varied by encounter. |
| **Unified-resource death spiral or turtling** | TFT econ, Mechabellum | (1) Monster faces cost 0 gold, so a broke player can still act and never auto-loses; (2) a **guaranteed base income** after every battle; (3) interest with a cap (+1 per 10 banked, max +3) so hoarding has a ceiling; (4) leftover gold is never lost. |
| **RNG frustration** | Shop whiffs, low-roll rewards | StS-style pity on rarity, SAP-style **freeze**, 1-of-3 card rewards with skip, and reroll cost of 1. |
| **Information overload on cards** | Duelyst, Hearthstone late sets | Brode: ~11 words per card. Icon keywords (Inscryption sigils). **Each face ≤ 1 keyword plus 1 line** in the MVP. |
| **Inconsistent status rules** | Wildfrost's lesson | Define in a glossary: *hit*, *damage*, *adjacent* (orthogonal only), *front* (row facing enemy), *tick timing* (poison at the start of each wave). |
| **Moving free makes position irrelevant; moving too costly means nobody moves** | Generic | `Move` stat gives free repositioning budgeted per unit; extra steps cost gold. Track average moves per wave. Under 0.3 means too expensive, over 2 means positioning doesn't matter. |
| **Snowballing late game** (multiplicative stacking) | Balatro, TFT 3★ | Keep adjacency and buffs additive, multiplicative effects only in rare artifacts. Geometric enemy HP curve per act. |

---

## 6. Concrete recommendations for THIS design

### 6.1 Battle structure and win condition (open question → proposal)
- **HP buffer per side.** The player has a **run-persistent Hero HP** (e.g., 50) as in StS: damage carries between battles and rest nodes heal. That makes the "spend now vs save" tension real, because a cheap win that costs HP is a choice. Each enemy encounter has a **Commander HP** (normal 10–15, elite 20–25, boss 40).
- **Breach damage** (Inscryption / Hearthstone BG / Mechabellum hybrid): when a monster's attack goes down a column and finds **no enemy monster in that column**, it hits the opposing commander for its ATK. At the end of each wave, each side also takes **1 damage per surviving enemy monster** (a small Hearthstone-BG-style chip damage so a wiped board still matters but isn't game over).
- **Wave cadence** (proposal):
  1. Placement phase: players alternate single actions (place a monster, commit a card to hand, cast a spell, or pass). Each side gets **2 actions on wave 1 and 1 action per later wave**, plus free `Move` steps.
  2. Resolve wave: deterministic, front → back, left → right.
  3. Status tick (poison, regen, armor decay).
  4. Repeat. **Cap at 5 waves.** After wave 5 the enemy *enrages* (+2 ATK per wave, like StS boss enrage timers) to end stalls. Target battle time is 2–4 min.
- Win when Commander HP ≤ 0. Lose the run when Hero HP ≤ 0. Losing all your monsters is **not** a loss. You keep acting next wave (deploying monsters is free), which matches the notes' goal of "not forced to play a monster every turn or auto-lose."
- **Board persistence between battles:** default off, as the notes say. Artifacts and cards grant "Veteran: starts the next battle on its current cell."

### 6.2 Movement cost (open question → proposal)
- Every monster has `Move` ∈ {0, 1, 2}: free orthogonal steps per placement phase. Turtles are 0, standard units 1, flankers 2.
- **Extra step = 1 gold** (uses the same purse, so the tension is consistent). Swapping two of your own units costs both their moves.
- Moving never uses up the placement action. That keeps "move vs place" from feeling punishing and leaves the cost in gold and in the unit's own budget (`Move` is priced in §3.3).
- Telegraph enemy attacks before the placement phase (arrows on target cells, Cobalt Core / Into the Breach), so moves are deliberate dodges and setups.

### 6.3 Monster vs spell weighting (open question → proposal)
- Monster face: **0 gold**, uses a placement action, about 0.85·B stat budget.
- Spell face: **two steps**. Spend an action to *commit to hand* (the card leaves the visible deck), then on a **later** action pay gold (1–3) to cast. This delay is the card's real cost, so spell faces can be ~10–20% stronger per point than monster faces of the same tier.
- Once a card is played either way, it is **used for this battle** (returns to the deck afterward). That makes the face-up deck a finite, visible resource per battle, similar to Res Arcana. With 8–12 cards and about 6–7 actions per battle, roughly half your deck is used, so choosing *what not to play* matters.
- **Choose the face at play time, not at purchase.** Fixing it at purchase reduces the system to two separate decks, while choosing at play time gives the MDFC flexibility and more decisions per battle. An artifact can let you "imprint" a card permanently as one face for a bonus.
- Shop price shows the card's tier (T1 3g, T2 5g, T3 8g [proposal]). Paid removal is 4g, +2 each time (StS 75 → +25 scaled down).

### 6.4 Unified gold economy (proposal, numbers to tune in sim)
| Item | Value |
|---|---|
| Starting gold | 6 |
| Battle reward | Normal 4–5, Elite 7–8 plus artifact, Boss 12 |
| Base income | +3 on entering each node (guarantees you can always do something) |
| Interest | +1 per 5 banked at the end of a battle, cap +3 (proposal; TFT/Balatro-style cap) |
| In-battle sinks | Spell casts 1–3, extra move 1 |
| Shop | 5 card slots + 1 artifact; reroll 1; freeze (SAP) |
| Fusion | 3 copies of the same card → ★2 at the shop for free (it also thins the deck by 2) |

### 6.5 Fusion with a face-up deck
- **Fuse permanently in the shop** (TFT): 3 copies → one ★2 card. That gives power plus deck thinning, which is ideal with a small visible deck. Optionally, if you play a copy onto an identical monster on the board, it **stacks** (+1/+1 for the battle, like a SAP merge). This adds a grid interaction without permanent changes.
- Pool: each T1 card appears up to ~6 times across the act's shops, so a ★2 is reachable if you commit (TFT pool logic, scaled down).

### 6.6 Map (1-act MVP)
StS-style, 12 rows × 3–4 lanes ≈ **15 nodes on any path**: row 1 normal fight; rows 2–11 weighted Monster 50 / Event 20 / Shop 12 / Rest 10 / Elite 8; no elites before row 4; treasure on row 6; rest on row 11; boss on row 12. Expect about 7 battles (5 normal, 1–2 elite, 1 boss) per run.

### 6.7 MVP content budget (vertical slice)
| Content | Count | Notes |
|---|---|---|
| Dual-face cards | **36** (= 72 faces) | 3 families × 10 + 6 neutral. Rarity split 18 T1 / 12 T2 / 6 T3 |
| Starter deck | 8 cards | 2 neutral basics × 3 copies + 2 off-family T1s (fusion is reachable early) |
| Families | 3 | e.g., **Swarm** (adjacency/poison), **Bulwark** (front row/armor), **Ranger** (columns/back row/reach). Thresholds at 2 and 4 on board |
| Status effects | 4 | Poison (ticks per wave), Armor (absorbs; halves each wave), Regen/Heal, Strength (+ATK) / Weak (−ATK) |
| Artifacts | 12 | 6 common (economy/move/stats), 4 elite rewards, 2 boss, including 1 multiplicative build-around |
| Enemy units | ~15 | Reused across encounters |
| Encounters | 8 normal, 3 elite, 1 boss | Each designed with a set placement script and visible next-wave reinforcements |
| Events | 5 | Remove card, transform face, gamble HP for gold, etc. |
| Grid hazards | 2 | e.g., blocked cell, poison cell (input variety for the face-up deck) |
| Tech | Deterministic `resolveWave` sim + event log + run telemetry JSON | Balancing depends on these three being in place first |

**Milestones:** (1) single hand-built battle vs one encounter with 8 cards, no shop. Prove waves plus movement are fun in 3 minutes. (2) Shop, gold, fusion. (3) Map plus 12 encounters. (4) Telemetry and sim bots, then the first balance pass on face-usage split and per-encounter HP loss.

### 6.8 Risks to watch first in playtests
1. **Is the per-turn decision readable?** Measure time per placement action. Over 20 s on average means cut options or deck size.
2. **Does the spell face ever get used?** Look at the face-usage split per card.
3. **Gold tension:** if players end battles with 0 gold and lose shops, raise base income. If they always bank, lower the interest cap.
4. **Stalls:** the share of battles that reach the wave cap. Above 15% means breach damage is too low.

---

## Sources (primary first)
- GDC 2019, Giovannetti, *Slay the Spire: Metrics Driven Design and Balance* — https://www.gdcvault.com/browse/gdc-19/play/1025731 ; summary https://www.gamedeveloper.com/design/learn-i-slay-the-spire-i-s-metrics-driven-approach-to-game-balancing-at-gdc-2019 ; notes https://glasp.co/youtube/7rqfbvnO_H0 ; analysis https://mechanicsofmagic.com/2022/05/22/critical-play-is-this-game-balanced-10/
- GDC 2019, *Into the Breach Design Postmortem* — https://gdcvault.com/play/1025772/-Into-the-Breach-Design ; https://80.lv/articles/gdc-2019-an-inside-look-at-into-the-breach
- GDC 2017, *9 Takeaways from Duelyst* — https://gdcvault.com/play/1024581/9-Takeaways-from-Duelyst-From
- StS wiki: map https://slaythespire.wiki.gg/wiki/Map_Generation ; gold https://slaythespire.wiki.gg/wiki/Gold ; merchant https://slaythespire.wiki.gg/wiki/Merchant ; rewards https://slay-the-spire.fandom.com/wiki/Card_Rewards
- StS 2 — https://en.wikipedia.org/wiki/Slay_the_Spire_II
- Balatro: GMTK https://gmtk.substack.com/p/balatros-cursed-design-problem ; LocalThunk interview https://rogueliker.com/balatro-interview/ ; blinds https://balatrowiki.org/w/Blinds_and_Antes ; dev story https://www.invenglobal.com/articles/20243/balatro-2nd-anniversary-update-localthunk-shares-development-story-confirms-version-11-progress
- SAP wiki — https://superautopets.wiki.gg/wiki/The_Basics ; https://superautopets.wiki.gg/wiki/Shop
- TFT — https://metabot.gg/en/TFT/guides/tft-economy-gold-interest-streaks-explained ; https://esports.gg/news/teamfight-tactics/tft-tip-tuesday-unit-pool-size-and-rerolling/
- Hearthstone Battlegrounds — https://hearthstone.fandom.com/wiki/Battlegrounds
- Backpack Battles — https://en.wikipedia.org/wiki/Backpack_Battles ; The Bazaar — https://mobalytics.gg/the-bazaar/guides/day-guide
- Monster Train Q&A — https://www.digitallydownloaded.net/2020/02/developer-q-a-monster-train-a-deckbuilding-roguelike-with-a-hellish-theme.html
- Wildfrost (MCV "When We Made") — https://mcvuk.com/?p=224506
- Inscryption (Mullins) — https://www.gamedeveloper.com/design/how-game-jam-sacrifices-became-inscryption
- Dicey Dungeons (Cavanagh) — https://www.gamedeveloper.com/disciplines/road-to-the-igf-cavanagh-houston-dobbe-s-i-dicey-dungeons-i-
- Marvel Snap (Brode) — https://mobilegamer.biz/second-dinners-ben-brode-reveals-marvel-snaps-recipe-for-success-literally/ ; https://www.gamedeveloper.com/game-platforms/designers-don-t-sleep-on-marvel-snap-s-simultaneous-turns
- Cobalt Core — https://www.pcgamer.com/cobalt-core-review/ ; Mechabellum — https://gamingonlinux.com/2023/05/mechabellum-is-an-auto-battling-supreme-commander-im-completely-hooked ; Despot's Game — https://www.superjumpmagazine.com/despots-game-review/
- MDFCs — https://draftsim.com/mdfc-mtg/ ; Res Arcana — https://opinionatedgamers.com/2019/05/03/dale-yu-review-of-res-arcana/

**Gaps:** no primary-source SAP dev interview was found. Backpack Battles gold-per-round and SAP shop-slot counts are not verified. The StS GDC talk's slide-level numbers (exact pick and win rate thresholds) aren't in any text summary, so watch the talk for them.
