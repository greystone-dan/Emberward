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
