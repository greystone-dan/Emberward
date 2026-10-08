# Design decisions that override the older kit docs (Daniel, 2026-10-07)

- Game is Emberward, drowned-city ember theme.
- Rekindling: 3 copies merge into the next level (Spark -> Flame -> Fire), thinning the deck.
- No fixed factions or Orders: TFT-style overlapping traits, combos and positional bonuses.
- No Procession in battle: the whole deck is fully revealed. Paid reach moves to drafting ("the Drift"): front offers free, further-back ones cost embers.
- Art: 32x32 pixel art per card, Souls-inspired but not copied; levels shown as sparks / flames / fires.
- Desktop browser and Steam only for now; ignore mobile.

SPEC.md (v2), PROMPT.md and ART.md reflect these. The research docs and the pitch page predate them.
- Battle: the whole deck is face-up, no draw. Before each battle, Muster: bring up to 10 cards (flag). Enemy deck revealed with intent markers.
- The Drift: after each fight, 6 cards, front 2 free, +1 ember per place behind, take 1 (2 after an elite) or skip for 3. Untaken cards advance 2 places per node; the front 2 wash away. Opening Drift of 8 with 3 takes.
- Traits count different cards on the grid (two copies count once, a Flame counts once). Kinship: +1/+1 per neighbour sharing a trait, max +2.

## Build decisions (Claude, 2026-10-08; flagged, awaiting Daniel)
- **Losing bonus health never kills.** Kinship, Brawler and Abyssal health are recomputed from the board. When a unit loses a neighbour (a pull, a death, a move) and its max health drops below the damage it has taken, it stays at 1 health instead of dying. Flag `bonusHpLossNeverKills`.
- **Tokens don't count for traits.** Wisps, Bats, Rubble and Bone Walls are not cards, so they never add to a trait count (Bonebound 4 makes Wisps Bonebound for tier effects only).
- **"Every unit Beside it, friend or foe"** (Brazier Golem) reads as the units Beside it on its own grid, since the enemy grid has no cell Beside it.
- **"Around the cell across"** includes the cell across itself plus its orthogonal neighbours.

## Run-loop decisions (Claude, 2026-10-08; flagged for Daniel)

- **Boss and the wave limit.** A boss battle that reaches wave 6 without a kill is decided by face damage like any other, but the boss never retreats: losing that count ends the run. (SPEC §9 only describes retreat for ordinary enemies.)
- **Elite and boss decks.** `content/cards.json` gives elites and the boss rules and health but no decks. `src/core/run/encounters.ts` composes decks from existing units (and a signature unit standing in the Back row) until phase 5 gives them their own.
- **Relic prices in the market.** 6✦ common, 9✦ uncommon, 12✦ rare (SPEC prices cards and Sigils only).
- **Selling.** Half of the card's rarity price × its level, rounded down; Snuffer refunds the full amount. A deck never sells or snuffs its last card.
- **Anchorstone.** The player picks the survivor on the reward screen; with no pick, nothing persists.
- **Scout.** Reveals the names of the next three fights, elites or boss reachable ahead on any path; revealed nodes show their enemy on the map.
- **Shrines.** "Ring it back" makes the next fight's wave-1 enemy summons arrive Stunned. "Fight him" turns the Shrine node into an elite fight (one of the three, seeded) with the elite reward. "Reach in" echoes the first card in the deck. Choir of the Sunk's "Join the song" rekindles two copies (one level), and only if the player owns a pair.
- **Trait tiers in drafting (Pilgrim 4, Kindler 3)** count distinct cards in the deck carrying the trait (Sigils count).

## Enemy decisions (Claude, 2026-10-08; flagged for Daniel)

- **Elites are units.** Each elite is an enemy unit (`e_abbot` 1/6 Support, `e_tideCaller` 2/6 Shoot, `e_brazierKnight` 3/8 Strike with Taunt) that starts on the board (Abbot and Tide-Caller in the Back row, Knight in the Front); its rule is an engine hook that stops when the unit dies, as the pitch's counters say. The Abbot's refill fills *every* empty cell (SPEC §12) with Choristers (1/1, +1 Power beside), not Wisps as the older line said.
- **Kiln Breath.** The boss's phase-2 spell is cast at Wave Start from wave 2 on while its HP is 26 or lower: Burn 3 on the player's frontmost unit (lowest row, then lane A first) and the units beside it. No embers, no action; it is a phase rule, not a card.
- **Dark lanes in wave 1.** Lane A is dark from the first wave (the announcement is the Muster screen's boss description); from then on the next lane is shown a wave ahead with a "dark next" label.
- **Greedy AI scoring.** Post-Clash state: Warden HP difference ×3, board value (Power ×1.5 + health + shield/2 − Burn − Poison, tokens at half), own embers ×0.5; a win is ±1000. Candidates: the best three cells per distinct card by the scripted lane heuristics, every cast and move, and pass; at most 24. The lookahead passes both sides, so it never models the player's replies (1-ply as SPEC says).

## Balance readings (Claude, 2026-10-08; flagged for Daniel)

- **Include win rate** is run level: runs won with the card in the final deck, over cards seen in at least 20 runs. Battle-level include win is reported too but starter cards sit in every battle, so it tracks the battle win rate.
- **First seat** is side 0 (acts first in wave 1; initiative alternates after) over seat-swapped pairings of the eight designed comps with the scripted AI on both sides, draws excluded; random mirrors are the control.
- **Median run length** is judged on runs that reach the boss, with measured animation time plus stated human decision times (in the report). A run that dies at node 3 is short by design.
- **4-tier reachable** means at least one bot deck in 1,000 runs held four cards with the trait; the pool count per trait is reported beside it.

## Balance decisions (Claude, 2026-10-08; Daniel left balance to Claude's judgement)

- **The boss plays its phases.** Battle cards carry an optional `fromWave`; the boss's Kiln Mortar and Lantern Sentry wait for wave 3 and its three Sun Furnaces for wave 5, as cards.json's phase text says. Before this the greedy AI opened with three 5/8 Furnaces and won 99% of boss fights against the bot; after it, bot win rates are Lamplighter 20%, Ferryman 43%, Bell-Keeper 84% (300 runs each, seed 21). Boss HP stays at SPEC's 40 (30 made no measurable difference once phased).
- **Enemy HP comes from flags.** `FLAGS.enemyHp` is authoritative for elites and the boss; the numbers in cards.json are the designed values and match.
- **Cracked Bell** did nothing: the board is empty when a battle starts. It now shields units summoned into the Front row during wave 1 (and persisted Front-row units), `FLAGS.crackedBellShield` 3. The Bell-Keeper's win rate hardly moves with it (89-91%): its strength is the Guardian-and-Marksman starting deck, which the pitch calls the safest first draft, so it stays the easy Warden.
- **The Lamplighter's starting deck** swaps Drift Lantern for Ember Hound (3/2 Swift, Last Gasp Burn 2): the deck had three bodies with 1 Power or less and died in the first three fights. Bot win rate 22% → 42-44% with the Candlewright aura kept.

## Rules clarifications (Claude, 2026-10-08; flagged for Daniel)

- **A dying Martyr still counts.** Trait tiers are recomputed from the board, so a Martyr's own death used to drop the
  side below Martyr 2 (or 4) before its Last Gasp fired, which made "Last Gasps also heal 2" need three Martyrs and
  "trigger twice" need five. The tier is now read just before the unit leaves the board. Golden replay `martyr-2-heal`.

## Shipping (Claude, 2026-10-08)

- **GitHub Pages hosts the demo.** `.github/workflows/pages.yml` builds `main` and deploys `dist/` to
  https://greystone-dan.github.io/Emberward/ (Vite `base: './'`, so the same build runs from any folder or domain).
  No Cloudflare credentials are in the build container, so linking or CNAME-ing the demo from greystoneinteractive.ca
  is Daniel's step.

## Elite tuning (Claude, 2026-10-08; Daniel left balance to Claude's judgement)

- **Where runs are decided.** With the bot playing, every Warden wins 91–100% of ordinary fights and 88–100% of boss
  fights, so the elites alone separate them: elite win rates were Lamplighter 17%, Ferryman 26%, Bell-Keeper 55%.
  Ten Bell-Keeper nerfs (Cracked Bell 2, Bulwark 5 HP, deck swaps, Bellforged tiers weakened or moved to 5) each moved
  its run win rate by 1–4 points, so the Bell-Keeper was left alone and the elites were tuned instead.
- **The Choir Abbot** was unbeatable for everyone (5% / 3% / 8% of elite fights): a board refilled to 12 units every
  Wave End can't be reached for face damage without Pierce or Cleave, and buffed Shamblers behind the wall do the rest.
  It now fills **two** empty cells per Wave End (lane A first, Front first; `FLAGS.abbotRefill`) and has 4 HP so the
  stated counter (kill the Abbot) is real. Bot elite win rates against it: 16% / 25% / 44%.
- **The Brazier Knight** was 3/8 and healed one per Burning unit without limit; it killed the non-Burn Ferryman 81% of
  the time. Now 2/6 and the heal is capped at two per Wave End (`FLAGS.knightHealCap`). Against it: 24% / 24% / 81%.
- **The Tide-Caller** is unchanged (43% / 60% / 88%). The greedy AI stays on elites and the boss: with the scripted AI
  on elites the bot's elite rates jump to 51–69%, and elites should feel smarter than fights.
- Elite rule texts in cards.json changed accordingly (content meaning change, logged here as CLAUDE.md asks).
