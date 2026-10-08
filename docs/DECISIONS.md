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
