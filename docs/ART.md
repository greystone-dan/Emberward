# Emberward: Art Direction (Pixel)

## The one-line brief

Lantern-lit **32×32 pixel art** of a drowned gothic city. It should be melancholy, grand and ruined. It takes inspiration from the mood of Dark Souls and Darkest Dungeon, and from the readability of Into the Breach. It must never copy any of them.

## Hard rules

1. **Every card has its own 32×32 sprite.**
   - That makes 60 player cards, plus tokens (Wisp, Bat, Rubble, Bone Wall) and enemy-only units.
   - The same sprite is used in three places: on the board, on the card face and in the deck strip.
2. **Integer scaling only.**
   - Card face: ×4 (128 px).
   - Board unit: ×2 or ×3, chosen to fit 1280×720.
   - Deck-strip chip: ×1.5 is **not** allowed. Use ×1 or ×2.
   - Use `image-rendering: pixelated` and no smoothing.
3. **One palette:** Endesga 32 (by Endesga, via Lospec; credit it). No colours outside it, in sprites or in UI chrome. The UI may use the same palette at any size.
4. **Readable silhouettes.**
   - Each sprite reads at ×1 against the dark board.
   - Use a 1-pixel dark outline (`#181425`) and one light source, from the lantern side (top-left).
   - Leave at least 2 px of padding inside the 32×32 box.
5. **Origin colour language.** There are no factions. Each of the 8 Origins owns an accent colour (the `col` field in `cards.json → traits`), and the sprite's main accent follows the card's first trait:
   - **Waxborn** `#feae34`: candles, wicks, braziers (amber, orange).
   - **Bonebound** `#c0cbdc`: skeletons, hounds, crows, wisps (bone and ash greys).
   - **Drowned** `#0099db`: eels, kelp, jellies, drowned figures (teal).
   - **Bellforged** `#e4a672`: bells, gargoyles, golems (tarnished bronze and verdigris).
   - **Beast** `#63c74d`, **Spirit** `#b55088`, **Pilgrim** `#e8b796`, **Abyssal** `#e43b44`.
   - Classes also have a colour in the data. Show them only on trait chips, not in sprites.
   - Cards with several Origins mix those ramps.
6. **Card levels read as fire.** One sprite per card; the level is shown by an effect layer around the sprite and frame, not by redrawing the creature.
   - **Spark (level 1)**: 2 to 4 drifting single-pixel embers rise past the sprite. Plain iron frame.
   - **Flame (level 2)**: a flickering 2 to 3 frame flame licks along the frame's top edge, and a warm rim-light (`#feae34`) traces the sprite's outline. Bronze frame.
   - **Fire (level 3)**: a full animated fire border (4 frames) with heat shimmer, embers spilling off the card, and a gold frame (`#fee761`).
   - On the board, use the same language in miniature: a spark mote, a flame crest or a fire aura under the unit.
7. **Animation budget.**
   - Units: 2-frame idle (breathing or flicker), 3-frame attack, and a death that's a 4-frame ember dissolve.
   - Effects: Burn (flicker), Poison (green bubble), Shield (bronze ring), Stun (stars replaced by snuffed-candle smoke).
   - Everything plays on a fixed tick (e.g. 8 fps) and is skippable for tests.

## Mood and inspiration: what to take, what never to take

- **Take** these moods:
  - Lonely, oppressive darkness broken by warm light.
  - Ruined cathedral architecture, half-submerged.
  - Quiet dread, but with hope in the lantern.
  - Rest at a **Hearth**: a lantern-shrine in a flooded chapel. It's our own motif.
- **Never take** anything recognisable from FromSoftware:
  - No coiled-sword bonfire, Estus-style flask, or "YOU DIED"-style banner.
  - No recreations of named bosses or characters, and no item names.
  - Our defeat screen reads **"The light goes out."**
- Darkest Dungeon's heavy ink style is reference only. Our art is pixel, not ink.

## UI

- **Background**: near-black teal (`#181425` to `#193c3e`). Light pools around lit cards and the lantern.
- **Fonts:**
  - Pixelify Sans for titles and UI (OFL).
  - Silkscreen for numbers on units (ATK, HP and damage pop-ups).
  - Rules text must stay readable at 1280×720. If a pixel font isn't legible at card size, use Pixelify Sans at a larger integer size rather than dropping to a non-pixel font.
- **Card layout** (vertical):
  - Name bar.
  - 128×128 art window (the sprite at ×4 on a dark vignette).
  - Kindled half: ATK and HP badges, a shape glyph (a 4×3 mini-grid as pixels) and rules text.
  - Spell half (dashed border, ember-cost gem).
  - Level frame (iron, bronze or gold).
- **Deck strip:** every card in the battle is visible. Brought cards are bright, spent cards are greyed. The enemy's next card carries an intent marker.
- **Drift:** a line of 6 cards on a river. Free cards glow amber, paid cards show small ember price badges (+1✦, +2✦…).
- **Clash preview**: pixel arrows in the side's colour (player amber, enemy teal) with damage numbers. Arrows into the top edge mean face damage.

## How sprites are made (default pipeline; Daniel may change it)

Author every sprite **as code**: a 32-line string grid per sprite, with one character per palette index, in `src/content/sprites/*.ts`. Build tools render them to a sprite atlas PNG.

Why:

- It's deterministic and diffable, and the agent can iterate on it.
- It's palette-locked by construction.
- It needs no downloads.

Hide everything behind an `ArtProvider` interface (`getSprite(id, level)`). Hand-drawn or commissioned sprites, or CC0 packs such as DCSS 32×32 recoloured to Endesga 32, can then replace individual sprites later without code changes.

Quality loop for sprites (required):

1. Render a **contact sheet** of every sprite at ×1 and ×4 on the board background (`npm run sprites:sheet`).
2. Open the PNG and look at it.
3. Fix anything that doesn't read at ×1, or that looks too similar to another card that shares a trait.
4. Each Origin must have visibly distinct silhouettes (vary the height, width and pose).

## Audio (procedural, no files)

- **SFX**: ZzFX (MIT). Wick-light for summon, ember-crackle for reach, a bronze clang for Shield, a hiss for Poison, and a soft whoomph for Rekindle (the biggest sound in the game).
- **Music**: Tone.js, one seeded ambient loop for the Stair (low strings, drip echoes, a distant bell) and a heavier boss loop.

## Credits file

Ship `CREDITS.md` listing:

- Endesga 32 palette,
- fonts (OFL, with `OFL.txt`),
- ZzFX,
- Tone.js,
- and any later CC0 or CC BY art.
