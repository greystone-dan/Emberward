# Card Roguelite Auto-Battler — Design Notes

_Source: Daniel's brainstorming notes, shared in the project chat on 2026-10-07._

## Concept
A combat-focused card-based roguelite that fuses three genre inspirations: Slay the Spire (run structure, shop/deckbuilding economy), Magic the Gathering (card design inspiration), and TFT/auto-battlers (grid-based positional combat). The explicit goal is to avoid being "a worse Slay the Spire" — the auto-battler/grid fusion is the key differentiator.

## Run Structure
- Dungeon-crawler structure, Slay the Spire-style: a map of nodes/battles, likely interspersed with shops and events, across a run.
- Progression upgrades (artifacts/trainers that boost stats, etc.) are scoped per-run rather than persistent meta-progression — chosen as the simpler starting point.

## The Grid
- Each player has a 4x3 grid; the opponent has their own 4x3 grid.
- Monster attacks and damage are positional — where a monster sits matters, and monsters attack in directions (e.g. front row vs back row logic, directional attacks).
- Adjacency matters: inspired by TFT, neighboring units can affect each other (buffs, combos) — a key source of synergy.

## Placement & Movement
- Placing a unit (via playing a card) commits it to a space — not free positioning.
- Moving/repositioning a unit afterward is valuable but costs something, unlike most auto-battlers where repositioning is free.
- Movement allowance can vary per monster — some monsters might move 2 spaces at the start of a round, others might not be able to move at all (turtles vs. flankers).
- Board/team persistence between rounds is a special mechanic or option granted by certain cards/effects, not the default behavior — keeps the choice to persist a unit meaningful rather than automatic.
- Multiple copies of the same monster can be fused/combined to level it up (auto-battler style, à la TFT).

## Economy & Shop
- **LOCKED:** One unified shop sells both monsters and cards — no separate systems. Every gold spend is a tradeoff between buying a monster or buying a card/spell.
- **LOCKED:** A single unified resource is used both to buy things in the shop AND to deploy/play cards during battle. This creates the core strategic tension: spend now to win the current fight, or save to build up your deck/board for later.
- Tentative: monsters may deploy for free by default (no resource cost), while spells and hand-based plays cost the resource.
- Deck construction starts with basic cards (e.g. basic monsters). Players need ways to both add cards to and remove cards from the deck over a run.

## Dual-Purpose Cards (key mechanic)
- Every card has BOTH a monster AND an effect baked into it.
- After acquiring a card, the player chooses how to use it: as a monster (goes to the bench/field) or as a spell/effect (goes to the effect deck).
- Creates real draft and in-game tension: every card is a choice between "body on board" and "effect in hand."

## No-Random-Draw System (key mechanic)
- Explored as a fix for classic deckbuilder randomness frustration (not drawing what you want).
- Every card in the deck sits face-up and fully visible at all times.
- On a turn, a player can either play a card directly as a monster, OR move a card to their hand.
- A card moved to hand can be paid for and cast as a spell on a following turn.
- Turns deckbuilding/hand management into a visible, plan-ahead puzzle rather than a luck-based draw system.

## Turn & Combat Structure
- Players alternate placing monsters one at a time (reactive, not simultaneous/blind).
- Combat resolves in escalating waves rather than one all-at-once resolution: place monster(s) → fight → place more monsters → fight → place monster(s) + play a spell card → fight → and so on.
- Deliberate differentiator from both Slay the Spire (no combat intervention) and TFT (single resolution per round) — more decision points within a single battle.
- Design goal: a single fight should last a couple of minutes, with room to play/fuse monsters and cast spells across multiple waves, not resolve in one quick exchange.
- Design goal: strategic flexibility — players should not be forced to play a monster every turn or auto-lose.
- Win condition for an individual battle still undecided — leaning away from instant board-wipe-equals-loss, more likely some kind of health/damage buffer (Spire-style HP) for strategic flexibility.

## Status Effects
- Strong interest in classic status effects: poison, armor/shields, healing, buffs/debuffs.
- Should interact well with the directional grid and wave-based combat (e.g. poison ticking between waves, armor absorbing hits before breaking).

## Open Questions / Undecided
- Whether monsters should come exclusively from cards vs. a separate monster pool/bench system distinct from cards.
- Exact cost for moving/repositioning a unit after placement (a card cost vs. a resource/energy cost).
- Exact balance between monsters and spells, and how the two-effects-per-card choice should be weighted/costed.
- Precise win/loss condition for a single battle.

## Next Steps
Daniel's intent is to take this further as an actual project (not just a chat) — these notes are meant to seed that follow-on work.
