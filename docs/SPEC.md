# Emberward: Demo Rules Spec

Version 2 · 7 Oct 2026 (traits, the Drift and the revealed deck replace Orders and the Procession) · Owner: Daniel

This is the source of truth for the demo's rules. Card data is in `content/cards.json` (traits, positional rules, combos, wardens, relics, enemies). Decisions that changed from v1 are in `docs/DECISIONS.md`. Art direction is in `ART.md`.

Any number marked **[flag]** is a first-pass value. Implement it as a named config constant so simulations can compare alternatives. If a rule is ambiguous, pick the simplest reading, put it behind a flag, log it in `docs/DECISIONS.md`, and list it under "Questions for Daniel" in `PROGRESS.md`. Never quietly invent a rule.

---

## 1. Fiction in one paragraph

The city of Vael sank in a single night, and its dead never left. Their spirits, the **Kindled**, cling to anything that still holds light. You play a **Warden** carrying the last lantern down the drowned stairs. Kindled drift past you after every fight, and you choose which to bind to your lantern. In battle, each one fights as a body on the board or is spent as a burst of power (a spell).

**Embers ✦** are the lantern's fuel. They are also the market's currency, the price of reaching past the free cards in the Drift, and the cost of every spell. That single number is the whole economy, so light you spend to win this fight is light you won't have later.
## 2. Demo scope

- Act I only, "The Stair". It ends with the boss, "The Lamplighter Who Drowned".
- Three Wardens: the Lamplighter, the Ferryman and the Bell-Keeper. The Sexton is listed as locked and unlocks after a first win **[flag]**.
- All 60 cards in `cards.json`, all traits, and the relics.
- 8 normal fight encounters, 3 elites and 1 boss, with 3 to 5 Shrine events.
- Target run length: 15 to 25 minutes.
- Platform: desktop browser only (mouse and keyboard, landscape, minimum 1280×720). Don't build touch or mobile layouts. The Steam build (Electron) comes later, so don't paint the code into a browser-only corner.

## 3. The board

- Each side has a 4×3 grid: 4 **lanes** (A to D) by 3 **rows** (Front, Mid, Back).
- Row 0 is the Front row, nearest the enemy, for both sides. Lanes are shared, so your lane B fights their lane B.
- Adjacency is **orthogonal** (no diagonals) **[flag: diagonals]**.
- Directions, from a unit's point of view:
  - **Ahead**: the same lane, one row toward the enemy.
  - **Behind**: the same lane, one row away from the enemy.
  - **Beside**: the same row, in a neighbouring lane.
  - **Around**: all orthogonal neighbours.
- A cell holds at most one unit.

## 4. Battle flow

Your **entire deck is face-up for the whole battle**. There is no draw, no order and no hidden information. Any card you brought can be played on any action. The tension is in what you bring, what you spend, and where you place.

A battle runs for up to **6 waves [flag]**. Each wave has two parts.

1. **Action phase.** Sides alternate single actions.
   - Each side gets **2 actions**, or **3 in wave 1 [flag]**.
   - The player acts first in odd waves and the enemy acts first in even waves **[flag]**.
   - A side that passes takes no more actions this wave. The other side may still use its remaining actions.
2. **Clash.** Resolution is deterministic (see §6), followed by the end-of-wave steps.

### 4.0 Muster (before each battle)

- The player sees the enemy's **whole deck** and its first wave.
- They then choose up to **10 cards [flag: try 8, 10, unlimited]** from their deck to bring. A Flame or Fire counts as one card.
- Cards not brought take no part in the battle and are not spent.
- Choosing the 10 is the main pre-battle decision. A bigger deck means more choice at the Muster, not more power on the board.

### 4.1 Actions

- **Play a card** from your mustered cards, in any order, choosing one of its two faces:
  - **Summon** it as a Kindled into any empty cell on your grid. This is free, and its **Kindle** text triggers.
  - **Cast** its spell by paying the spell's ember cost. The spell resolves immediately. Targets come from the card text, and the player picks where the text allows.
  - A played card is spent for this battle (it returns afterwards).
  - There is **no reach cost** in battle. Reach is paid in the Drift (§5).
- **Pass.** End your part of the wave. The first side to pass each wave gains **1✦ [flag]**.

**Moving is not an action.**

- During your own action turn, any of your units may step one cell orthogonally into an empty cell.
- Each unit has **Swift N** free steps per wave. Swift 0 is the default.
- Each extra step costs **1✦ [flag]**.
- **Rooted** units never move. Spells can move units regardless of Swift.

### 4.2 Intent (the enemy telegraph)

The enemy's deck is fully revealed too. Above their grid, show:

- an **intent marker** on the card the enemy plans to play next, and the cell it is aimed at,
- their preferred lane,
- and attack arrows for the projected Clash.

The full Clash preview (all arrows and damage numbers) updates live as the player acts, as in Into the Breach.
## 5. The Drift (paid reach, in drafting)

Reach is no longer a battle mechanic. It is how you choose cards between fights.

- After every fight, a line of **6 cards [flag]** drifts past.
- The first **2 [flag]** are **free**. Each card behind them costs **1✦ more than the one ahead [flag]**: the 3rd costs 1✦, the 4th 2✦, up to 4✦ for the 6th.
- The player takes **1 card**, or **2 after an elite [flag]**. Or they may **skip the whole Drift for 3✦ [flag]**.
- Cards left behind **advance 2 places per node [flag]**, getting cheaper. The front 2 then **wash away**. New cards join the back.
- The player can see the **next node's Drift** before choosing a path on the map.
- **Opening Drift:** a line of 8 before the first fight, at normal prices. The player starts with 8✦ and gets 3 takes.
- Cards and relics that bend the Drift:
  - Pilgrim 4: the third card is free too.
  - Kindler 3: Drift reaches cost 1✦ less.
  - Long Wick relic: the first three cards are free.
  - The Ferryman's relic: the first reach after each fight is free.
  - Ferryman's Pole and other relics in `relics`.
- **Echoes:** about one Drift in three contains an **Echo**, a marked copy of a card the player owns. Weight 3× toward cards owned exactly twice **[flag]**. The Echo Shell relic guarantees one per Drift.
- **Omens:** at the start of an act, 3 traits **wax**. Their cards appear 1.5× as often in the Drift and markets. Show the Omens on the map.
- Rarity odds per slot (common / uncommon / rare): Act I 65 / 31 / 4, plus +1% rare chance for every Drift without a rare (pity).

There is no order to the deck and no Muster reordering. Slots in the player's deck are an unordered collection.
## 6. The Clash

The Clash resolves in three **beats**: Front row, then Mid, then Back.

**Within a beat**, every unit in that row on **both** sides attacks at once.

- Targets and damage are computed from the board as it stood at the start of the beat.
- All damage is applied together.
- Then deaths resolve.

### 6.1 Attack shapes (the `shape` field)

| Shape | Who it targets | Can attack from | If its lane is empty |
|---|---|---|---|
| Strike | The front-most enemy in its lane | Front row, or Mid if the cell Ahead is empty | Hits the enemy Warden |
| Shoot | The front-most enemy in its lane | Any row | Hits the enemy Warden |
| Pierce | Every enemy in its lane | Any row | Hits the enemy Warden |
| Cleave | Like Strike, plus the enemies Beside that target | Like Strike | Hits the enemy Warden |
| Lob | The back-most enemy in its lane, over blockers | Never from the Front row | Nothing |
| none (Support) | No attack | n/a | Nothing |

- Attack damage = the unit's Power (its `atk`).
- **Taunt**: Strike, Shoot and Cleave attacks into the Taunt unit's lane target it, even if it isn't front-most. Pierce and Lob ignore Taunt.

### 6.2 After the Back beat, in this order

1. Burn ticks.
2. Poison ticks.
3. **Wave End** triggers.
4. Shields expire.
5. Check the win condition.

Deaths at any point queue their **Last Gasp** triggers.

### 6.3 Deterministic ordering

Use this order everywhere: the side with initiative this wave first, then lane A→D, then Front→Back.

- Never break a tie randomly.
- Cap the trigger queue at 200. Exceeding it is an error: `ERROR TRIGGER_LOOP`.

## 7. Statuses and keywords

| Term | Rule |
|---|---|
| Shield N | Absorbs damage before health. Expires at Wave End unless an effect says otherwise. |
| Burn N | At Wave End, deals N damage. Then each orthogonal ally of the burning unit that isn't already Burning gains Burn ⌊N/2⌋. Then N drops by 1. **[flag: spread amount]** |
| Poison N | At Wave End, deals N damage that ignores Shield, then N drops by 1 (Mother of Silt stops the decay) **[flag]**. |
| Stun | The unit skips its next attack. |
| Taunt | See §6.1. "Covering both neighbouring lanes" extends it to the adjacent lanes. |
| Swift N | N free steps per wave. |
| Rooted | Can't move, except by an effect that says "even if Rooted". |
| Kindle: | Triggers when the card is summoned. |
| Last Gasp: | Triggers when the unit dies. |
| Wave Start: / Wave End: | Triggers at that point in each wave. |
| Aura (dir): | A continuous effect on the unit(s) in that direction. Recompute it from the board; never store it as a permanent change. |
| Pull | Move an enemy toward its own Front row. A pull that's blocked does nothing. |
| Persist | The unit stays on the board into the next battle, in its cell. |
| Wisp | A 1/1 Hollow token with Strike. |
| Rubble / Bone Wall | A 0/N Rooted token with no traits and no attack. |

## 8. Traits and positional bonuses

There are **no fixed factions or Orders**. Every card carries 2 to 4 **traits** (TFT-style), from `cards.json → traits`: 8 **Origins** (what it is) and 9 **Classes** (what it does).

- A trait counts the number of **different cards** on your grid that carry it. Two copies of one card count once. A Flame or Fire counts once.
- Tiers stack: Bonebound 4 keeps Bonebound 2's bonus. Tier thresholds and text are in the data.
- Recompute trait counts live, from the board, every time a unit enters or leaves. Never store trait effects as permanent changes.
- **Sigils** inscribe an extra trait on a card in the deck for the rest of the run (`cards.json → sigils`). One Sigil per card.

### 8.1 Positional rules (`cards.json → positional`)

- **Kinship:** +1/+1 for each orthogonal neighbour sharing a trait, up to +2/+2. Applies to every unit.
- Many Class bonuses have a positional rider: Front-row Guardians shield the unit behind them, Back-row Marksmen gain Power, Brawlers need a Brawler Beside them, Chanter 2 extends auras diagonally.
- Burn spreads to neighbours and Cleave hits Beside targets, so clumping for Kinship has a price.
- Lanes and Taunt: an empty lane lets face damage through on both sides.

### 8.2 Combos and comps

`cards.json → combos` (10) and `comps` (8) are designed examples for the AI opponents' decks, the balance harness and the tutorial. They are not rules. Don't hard-code them.
## 9. Winning and health

- **Health:**
  - Your Warden has **50 HP** for the whole run.
  - Enemy Wardens have **12 HP** in fights, **22** for elites and **40** for the boss.
- A Warden at 0 HP loses. Check this after each beat and at Wave End.
- If both Wardens reach 0 at the same moment, the player wins **[flag]**.
- **After wave 6**, the side that dealt more face damage this battle wins.
  - If the player loses this way, they take the difference as HP damage. The enemy retreats, and the player gets half embers and no salvage.
  - If the player wins this way, the enemy is defeated.
- Losing your whole board isn't a loss. You can rebuild in the next wave.
- The run ends when your Warden hits 0.

## 10. Card levels: Spark, Flame and Fire

Daniel's direction is that card levels read as **sparks, flames and fires**.

- **Spark**: level 1, every card as it's drafted.
- **Flame**: owning 3 Sparks of the same card **Rekindles** them into 1 Flame.
  - Stats roughly double. The keyword steps up a tier. The spell gets stronger and costs 1✦ less (never below 0).
  - Every card's Flame form is in `cards.json` under `"flame"`.
- **Fire**: 3 Flames Rekindle into 1 Fire.
  - Fire = Flame stats ×1.5 (rounded up), the spell costs 0, and it has one extra rule-bending line.
  - Generate this by formula for the demo. Six hand-written Fire lines are in `cards.json → fireExamples` and on each card as `fireLine`; write the rest in the same style **[flag: whether Fire exists in the demo]**.

How Rekindling works:

- It's offered automatically when the copy that completes a set arrives. The player may postpone it until the next Hearth or Market.
- Three cards become one, so the deck gets 2 cards shorter. That's the point: it thins the deck and makes a bigger share of your brought cards strong.
- Mid-battle fusion doesn't exist, and there's no deck cap.

## 11. Run structure and economy

### Embers

- Start a run with **8✦**.
- Battle pay: fights **5✦**, elites **8✦ plus a relic**, the boss **12✦**.
- After each battle, before the payout, gain interest: **+1✦ per 5✦ banked, capped at +4 [flag]**.
- Embers spent in battle (spells, extra moves) and in the Drift (reach) come from the same purse.

### Map

- Slay the Spire-style: a 7×15 lattice with 6 non-crossing paths. See `research/05` §3.2.
- Node types:
  - Fight
  - Elite (from row 5)
  - Market
  - Hearth: rest. Heal 30%, Snuff a card (remove it), or Temper one (+1/+1).
  - Shrine: an event.
  - Scout: reveals the next 3 enemies.
- The boss is on row 15. A Hearth comes before it.

### Getting cards

| Source | Offer |
|---|---|
| Opening Drift | A line of 8 before the first fight. Three takes. See §5. |
| Drift after a fight | A line of 6, front 2 free, +1✦ per place behind. One take, or skip for **3✦**. |
| Drift after an elite | Uncommon or better. Two takes, plus a relic or a Sigil. |
| After the boss | Three rares side by side, one free pick. |
| Market | 4 cards, one of them always an Echo, plus a relic and a Sigil. Cards cost 3/5/8✦ by rarity, Sigils 6✦ **[flag]**. Reroll costs 1✦ and rises by 1 per reroll in that visit. Hold one slot to the next visit. Sell any card for half price, rounded down. |

- Echoes and Omens: see §5.
- **Rarity odds** per slot: see §5. Acts II and III (40/44/16) come later.
- Wardens, their Origin and their starting decks (6 cards) are in `cards.json → wardens`. A starting deck is an unordered set. The first fight has 9 cards (6 plus 3 opening takes); by the end of Act I expect 12 to 14.

### Relics

There are 12, listed in `cards.json → relics`.

## 12. Enemies

Enemies use the **same card system** as the player: a fully revealed deck, embers, the same 4×3 grid and the same rules.

- Each encounter is data: an enemy Warden HP, a starting board (optional), a deck and starting embers.
- Enemy-only cards are allowed (as data). Prefix their ids with `e_`.

Act I roster: `cards.json` has `enemyUnits`, `fights` (8), `elites` (3), `boss` and `events` (5), all designed in the pitch. Guidance:

- **Fights**: themed by trait. Examples:
  - a Drowned Patrol (Drowned Binders),
  - a Bell-Tower Watch (a Bellforged wall with archers),
  - a Grave Swarm (Bonebound Wisps),
  - a Candle Procession (Waxborn burners).
- **Elites**: each breaks one rule. Examples:
  - **The Choir Abbot**: Wisps refill its empty cells.
  - **The Tide-Caller**: pulls your Front row each wave.
  - **The Brazier Knight**: immune to Burn, with Burn aura.
- **Boss: The Lamplighter Who Drowned.**
  - HP 40.
  - Each wave it snuffs one of your lanes, shown a wave in advance. Your units in a dark lane can't attack.
  - Its deck escalates over the waves (phases in `cards.json → boss`).

AI ladder (see `research/05` §1.4–1.5):

- Fights: scripted, playing cards in a scripted order with simple lane preferences.
- Elites: greedy 1-ply with Clash lookahead.
- Boss: greedy plus scripted phases.

The AI only ever calls the same `applyAction` as the player.

## 13. Explicitly out of scope for the demo

- Acts II and III.
- Ascension.
- Async PvP.
- Meta-progression beyond the Sexton unlock.
- Mobile and touch.
- Controller support.
- Localization.
