# Emberward: Demo Rules Spec

Version 1 · 7 Oct 2026 · Owner: Daniel

This is the source of truth for the demo's rules. Card data is in `cards.json`. Art direction is in `ART.md`.

Any number marked **[flag]** is a first-pass value. Implement it as a named config constant so simulations can compare alternatives. If a rule is ambiguous, pick the simplest reading, put it behind a flag, log it in `docs/DECISIONS.md`, and list it under "Questions for Daniel" in `PROGRESS.md`. Never quietly invent a rule.

---

## 1. Fiction in one paragraph

The city of Vael sank in a single night, and its dead never left. Their spirits, the **Kindled**, cling to anything that still holds light. You play a **Warden** carrying the last lantern down the drowned stairs. Kindled bound to your lantern follow you in a line called the **Procession**. In battle, each one fights as a body on the board or is spent as a burst of power (a spell).

**Embers ✦** are the lantern's fuel. They are also the market's currency and the cost of every spell. That single number is the whole economy, so light you spend to win this fight is light you won't have later.

## 2. Demo scope

- Act I only, "The Stair". It ends with the boss, "The Lamplighter Who Drowned".
- Three Wardens: the Lamplighter, the Ferryman and the Bell-Keeper. The Sexton is listed as locked and unlocks after a first win **[flag]**.
- All 60 cards in `cards.json`, all four Orders, and the 12 relics.
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

A battle runs for up to **6 waves [flag]**. Each wave has two parts.

1. **Action phase.** Sides alternate single actions.
   - Each side gets **2 actions**, or **3 in wave 1 [flag]**.
   - The player acts first in odd waves and the enemy acts first in even waves **[flag]**.
   - A side that passes takes no more actions this wave. The other side may still use its remaining actions.
2. **Clash.** Resolution is deterministic (see §6), followed by the end-of-wave steps.

### 4.1 Actions

- **Play a card** from your Procession, choosing one of its two faces:
  - **Summon** it as a Kindled into any empty cell on your grid. This is free, and its **Kindle** text triggers.
  - **Cast** its spell by paying the spell's ember cost. The spell resolves immediately. Targets come from the card text, and the player picks where the text allows.
  - Either way, also pay the card's **reach cost** (§5).
  - A played card is spent for this battle.
- **Pass.** End your part of the wave. The first side to pass each wave gains **1✦ [flag]**.

**Moving is not an action.**

- During your own action turn, any of your units may step one cell orthogonally into an empty cell.
- Each unit has **Swift N** free steps per wave. Swift 0 is the default.
- Each extra step costs **1✦ [flag]**.
- **Rooted** units never move. Spells can move units regardless of Swift.

### 4.2 Telegraphing

The enemy has a face-up Procession too. Its two lit cards are its telegraph. Above their grid, show:

- the enemy's next card,
- its preferred lane,
- and attack arrows for the projected Clash.

The full Clash preview (all arrows and damage numbers) updates live as the player acts, as in Into the Breach.

## 5. The Procession (paid reach)

- Your deck is an ordered, face-up line.
- The first **2 [flag]** cards still in it are **lit**. Lit cards have no reach cost.
- Any other card can be played now, at a reach cost of **1✦ for each place it sits behind the lit cards [flag]**. The 3rd card costs 1✦, the 4th 2✦, the 5th 3✦, and so on.
- Skipped cards keep their places. Cards ahead of them leave as they're played, so they become lit.
- **Between battles:**
  - The order carries over from battle to battle.
  - New cards join the back.
  - On the **Muster** screen before each battle, the player sees the enemy's first wave and their Procession. They may make **2 free moves [flag]** (lift a card and drop it anywhere), and each further move costs **1✦ [flag]**.
- At the end of a battle, spent cards return to their slots.
- Cards and relics that bend the line:
  - Candlewright: "Light the Way".
  - Gravedigger: "Dig Up".
  - Ferry Boatman.
  - The Ferryman's first free reach.
  - The Ferryman's Pole relic.
  - The Long Wick relic.

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
| Rubble / Bone Wall | A 0/N Rooted token with no Order and no attack. |

## 8. Orders and clusters

There are four Orders: **Lamp, Hollow, Brine and Bell**. **Wanderers** are neutral and have no cluster bonus.

- A cluster bonus counts only your **largest orthogonally connected group** of that Order.
- The thresholds are 2, 3 and 5.
- A bridge card (order `"X+Y"`) counts as both Orders.
- Recompute clusters continuously.
- The bonuses are in `cards.json → orders`.

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
- The merged card takes the Procession slot of the front-most copy, so the Procession gets 2 cards shorter. That's the point: everything behind it gets cheaper to reach.
- Mid-battle fusion doesn't exist, and there's no deck cap.

## 11. Run structure and economy

### Embers

- Start a run with **8✦**.
- Battle pay: fights **5✦**, elites **8✦ plus a relic**, the boss **12✦**.
- After each battle, before the payout, gain interest: **+1✦ per 5✦ banked, capped at +4 [flag]**.
- Embers spent in battle (reach, spells, extra moves) come from the same purse.

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
| Opening draft | Before the first fight: 3 packs of 3, pick 1 from each. Pack 1 comes from the Warden's Order (bridges included). |
| Salvage after a fight | Pick 1 of 3, or skip for **3✦**. 35% of the time one slot is an **Echo** **[flag]**. |
| Elite salvage | Pick 1 of 3, all uncommon or better. Also gives a relic. |
| Boss salvage | Pick 1 of 3 rares. |
| Market | 5 cards, one of them always an Echo, plus 1 relic. Prices 3/5/8✦ by rarity **[flag]**. Reroll costs 1✦ and rises by 1 per reroll in that visit. Hold one slot to the next visit. Sell any card for half price, rounded down. |

- An **Echo** is a copy of a card you already own. Weight Echoes 3× toward cards you own exactly two of.
- **Omens**: at the start of an act, 2 Orders wax. Their cards (including bridges) appear 1.5× as often in salvage and markets. Show the Omens on the map.
- **Rarity odds** per slot (common / uncommon / rare):
  - Act I: 65 / 31 / 4.
  - Every offer without a rare adds +1% to the rare chance until a rare appears (pity).
  - Acts II and III (40/44/16) come later.
- Wardens and their starting Processions are in `cards.json → wardens`.

### Relics

There are 12, listed in `cards.json → relics`.

## 12. Enemies

Enemies use the **same card system** as the player: a face-up Procession, embers, the same 4×3 grid and the same rules.

- Each encounter is data: an enemy Warden HP, a starting board (optional), a Procession and starting embers.
- Enemy-only cards are allowed (as data). Prefix their ids with `e_`.

Act I roster: `cards.json` has `enemyUnits`, `fights` (8), `elites` (3), `boss` and `events` (5), all designed in the pitch. Guidance:

- **Fights**: themed by Order. Examples:
  - a Drowned Patrol (Brine pullers),
  - a Bell-Tower Watch (a Bell wall with archers),
  - a Grave Swarm (Hollow Wisps),
  - a Candle Procession (Lamp burners).
- **Elites**: each breaks one rule. Examples:
  - **The Choir Abbot**: Wisps refill its empty cells.
  - **The Tide-Caller**: pulls your Front row each wave.
  - **The Brazier Knight**: immune to Burn, with Burn aura.
- **Boss: The Lamplighter Who Drowned.**
  - HP 40.
  - Each wave it snuffs one of your lanes, shown a wave in advance. Your units in a dark lane can't attack.
  - Its Procession escalates over the waves.

AI ladder (see `research/05` §1.4–1.5):

- Fights: scripted, playing lit cards with simple lane preferences.
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
