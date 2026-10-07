# 02 — Free Assets for a Rogue-lite / Card / Auto-battler Browser Game

Researched 2026-10-07. Every license below was checked against the source page or the package metadata on that date unless marked **(unverified)**.
Legend: ✅ verified · ⚠️ caveat · ❓ unverified

---

## 0. TL;DR — the fact that matters most: what the build sandbox can actually reach

I tested from this cloud sandbox (outbound HTTPS goes through an agent proxy):

| Host | Reachable by `curl` from sandbox? | Implication |
|---|---|---|
| `registry.npmjs.org` (incl. tarballs) | ✅ **yes** (proxy bypass) | **Best channel.** Icons, fonts, and sound libraries can all come from npm. |
| `raw.githubusercontent.com` | ✅ yes | Single files from public repos work (e.g. game-icons SVGs, Google Fonts OFL.txt). |
| `github.com` archive zips, `codeload.github.com`, `api.github.com` | ❌ 403 | No repo zips or API listings unless a repo is attached to the session. |
| `fonts.googleapis.com` | ✅ yes | Google Fonts CSS works (and the browser loads it at runtime anyway). |
| `kenney.nl`, `opengameart.org`, `itch.io`, `freesound.org`, `incompetech.com`, `lospec.com`, `cdnjs`, `jsdelivr`, `unpkg`, `archive.org` | ❌ blocked (403 on CONNECT) | Can't be scripted from here. The **user** has to download these, or the session's network policy has to allow them. |

**Consequence:** the "zero-human-step" starter kit (§9A) is built entirely from npm packages, raw GitHub files, and procedural generation. Pixel-art packs (Kenney, 0x72, OGA) are a strong upgrade path, but someone has to drop the zips into the repo, or the network allowlist has to change.
Note: CDN hosts like jsdelivr/cdnjs being blocked only affects the sandbox. The *shipped game*, running in a player's browser, can still load from them. Vendoring files is still the more robust choice.

---

## 1. 2D art packs

| Source | URL | License (exact) | Attribution | Scriptable fetch? | Fit |
|---|---|---|---|---|---|
| **Kenney** (all asset pages) | https://kenney.nl/assets · policy at https://kenney.nl/support | ✅ **CC0** — "All game assets on the asset pages are public domain licensed (CC0)… even in commercial projects." | Not required. Optional credit: "Kenney". **Do not use Kenney's logo.** | ⚠️ Direct zips exist (below), but URLs contain a **content hash that changes on update**. Scrape the asset page for the `*.zip` href instead of hard-coding it. Blocked from this sandbox. | High: consistent style, huge catalogue. |
| Kenney GitHub mirror (ET) | https://github.com/ETdoFresh/kenney.nl (raw: `raw.githubusercontent.com/ETdoFresh/kenney.nl/master/...`) | CC0 (mirror of Kenney) | — | ✅ raw README reachable. ❓ file layout/coverage unverified, probably old packs only. | Fallback for scripted Kenney access. |
| **0x72 16x16 DungeonTileset II** | https://0x72.itch.io/dungeontileset-ii | ✅ **CC0** — "You can use this tileset for whatever you like (CC-0). Credit is not necessary" | None | ❌ itch download needs a browser click (name-your-price $0). Blocked here. | **Excellent for units.** Animated knights, wizards, elves, goblins, orcs, demons, undead, plus chests, weapons, potions. 16×16 / 16×32. |
| **Dungeon Crawl Stone Soup 32x32 tiles** (OGA) | https://opengameart.org/content/dungeon-crawl-32x32-tiles | ✅ **CC0** — "No attribution is required." | None (courtesy credit encouraged) | ⚠️ Direct OGA file links (`opengameart.org/sites/default/files/...`). Blocked here. | **3,000+ tiles**: monsters, items, spell effects, GUI. A huge creature roster for card art. |
| **Ninja Adventure** (Pixel-Boy & AAA) | https://pixel-boy.itch.io/ninja-adventure-asset-pack | ✅ **CC0** | Not required | ❌ itch (manual) | 30+ monsters, 9 bosses, 60+ items, 100+ SFX, **37 music tracks**, UI, VFX, 2 fonts. A complete kit, but with an Asian/ninja theme. |
| Tiny Swords (Pixel Frog) | https://pixelfrog-assets.itch.io/tiny-swords | ⚠️ **Custom**: personal + commercial OK; "may not redistribute, resell, or repackage the assets, even if the files are modified." | Optional | ❌ itch | Pretty, but the no-redistribution clause makes a **public repo** risky. Avoid if the repo is public. |
| **CraftPix freebies** | https://craftpix.net/file-licenses/ | ⚠️ **Custom**: commercial OK, no attribution; **cannot redistribute source files** "in a manner that would make… art files useable to another end user"; **forbids use for AI training**. | Not required | ❌ needs login/click | Avoid for an open/public repo. Shipping inside a built game is fine; committing raw PNGs to a public repo is the grey zone. |
| Quaternius | https://quaternius.com (FAQ: /faq.html) | ✅ **CC0** | Not required | ❌ blocked here | **Mostly 3D** (.blend/FBX/glTF). Only useful if you pre-render sprites. Low priority for a 2D web game. |
| OpenGameArt (general) | https://opengameart.org | ⚠️ **Per asset**: CC0, CC-BY 3/4, CC-BY-SA, OGA-BY, GPL | Varies | Direct file URLs, blocked here | Filter the search to CC0. Avoid CC-BY-SA/GPL unless you accept share-alike. |
| itch.io free packs (general) | https://itch.io/game-assets/free | ⚠️ **Per pack.** Many are "custom: no redistribution" | Varies | ❌ manual | Read each pack's text. Only CC0/CC-BY packs are safe in a public repo. |

### Kenney packs that fit this game (all ✅ CC0, links verified)

| Pack | Page | Files | Direct zip (hash may change) | Use |
|---|---|---|---|---|
| Board Game Pack | https://kenney.nl/assets/boardgame-pack (slug is `boardgame-pack`, **not** `board-game-pack`) | 490 | `https://kenney.nl/media/pages/assets/boardgame-pack/a1656828d2-1677667644/kenney_boardgame-pack.zip` | Cards, dice, chips, pieces |
| Playing Cards Pack | https://kenney.nl/assets/playing-cards-pack | 270 | `.../playing-cards-pack/4b345a2a5a-1677495915/kenney_playing-cards-pack.zip` | Pixel card frames and backs |
| Fantasy UI Borders | https://kenney.nl/assets/fantasy-ui-borders | 140 | `.../fantasy-ui-borders/ab29cd0165-1701602367/kenney_fantasy-ui-borders.zip` | **Card borders and panels.** Ideal for card frames and relic tooltips. |
| UI Pack (v2) | https://kenney.nl/assets/ui-pack | 430 | `.../ui-pack/f651646eab-1718203990/kenney_ui-pack.zip` | Buttons, sliders, panels |
| Tiny Dungeon | https://kenney.nl/assets/tiny-dungeon | 130 | `.../tiny-dungeon/f8422efb44-1674742415/kenney_tiny-dungeon.zip` | 16×16 heroes, monsters, items |
| 1-Bit Pack | https://kenney.nl/assets/1-bit-pack | 1,078 | `.../1-bit-pack/aa867a1f37-1677578516/kenney_1-bit-pack.zip` | Huge 16×16 monochrome set: map nodes, icons, creatures |
| Game Icons | https://kenney.nl/assets/game-icons | 105 | `.../game-icons/1ebf9c14af-1677661579/kenney_game-icons.zip` | ⚠️ Mostly controller/UI glyphs, **not fantasy items**. Low fit. |

(Prefix for every "..." link: `https://kenney.nl/media/pages/assets`.) The all-in-one bundle is at https://kenney.itch.io/kenney-game-assets.

---

## 2. Card frames and templates

| Asset | URL | License | Attribution | Notes |
|---|---|---|---|---|
| **40x56 Card Frames** (Mumu) | https://opengameart.org/content/40x56-card-frames-without-the-art | ✅ **CC0** | None | Tiny pixel frames (Card.zip 7 KB). Matches a 16px pixel style. |
| **TCG Templates** (KillGorack) | https://opengameart.org/content/tcg-templates (zip: `https://opengameart.org/sites/default/files/tcg_card_templates_0.zip`, 105 MB) | ✅ **CC0** | None | 1500×2100 rendered frames with 7 zones. High-res painterly look, so it clashes with pixel art. |
| Kenney Fantasy UI Borders / Playing Cards | see §1 | ✅ CC0 | None | Best for 9-slice CSS `border-image` frames. |
| TCG Card Frame (Ravenmore) | https://opengameart.org/content/tcg-card-frame | ⚠️ **CC-BY-SA 3.0 / GPL 2/3** | Link to http://dycha.net "somewhere prominent" | PSD/XCF only, and share-alike. **Avoid.** |
| Card Deck Fronts (alleycat) | https://opengameart.org/content/card-deck-fronts | CC-BY 4.0 | Required linkback (steemplayer.com) | Poker suits only. Low fit. |
| **CSS-rendered cards (recommended)** | — | Your own code | — | Gradient frame, rarity-colored border, cost gem as a circle, art slot holding an SVG icon, and Cinzel title. Every card stays consistent and easy to theme with no external dependency. |

---

## 3. Icon sets (creatures, relics, intents, status effects)

| Set | URL | License (exact) | Attribution | Scriptable fetch | Fit |
|---|---|---|---|---|---|
| **game-icons.net** | https://game-icons.net · license: https://raw.githubusercontent.com/game-icons/icons/master/license.txt | ✅ **CC BY 3.0** (a few authors, e.g. Viscious Speed and Zeromancer, are **CC0**) | **Required.** license.txt: *"Please, include a mention 'Icons made by {author}' in your derivative work."* FAQ: for video games, make the credit "accessible from a menu". | ✅ **npm `@iconify-json/game-icons` v1.2.4** (4,134 icons, one JSON, `fill="currentColor"`) via registry. ✅ Per-file with author: `raw.githubusercontent.com/game-icons/icons/master/{author}/{name}.svg` (e.g. `lorc/dragon-head.svg` → 200). | **Best single art source** for an AI-built game: monsters, weapons, potions, relics, map nodes, playing-card glyphs. Monochrome SVG, so it's tintable. ⚠️ The Iconify JSON **drops per-icon author**. Either fetch from the raw repo path (the folder is the author) or credit the full contributor list. |
| **RPG-Awesome** | https://github.com/nagoshiashumari/Rpg-Awesome · npm `rpg-awesome` 0.2.0 | ✅ Font **SIL OFL 1.1**, CSS **MIT**, docs CC BY 3.0. "Attribution is appreciated but not required." | Keep OFL notice | ✅ npm tarball (woff/ttf/css) | ~500 fantasy glyphs (many derived from game-icons). Icon font, so no SVG manipulation. |
| **Lucide** | https://lucide.dev · npm `lucide-static` (1.52.0), `@iconify-json/lucide` | ✅ **ISC** (lucide.dev/license; npm metadata ISC) | Keep license text | ✅ npm | UI chrome only (settings, close, speed, pause). Not fantasy. |
| pixelarticons | npm `@iconify-json/pixelarticons` | ✅ MIT | Keep license | ✅ npm | Pixel-style UI icons, for a pixel theme. |
| Shikashi's Fantasy Icons | https://shikashipx.itch.io/shikashis-fantasy-icons-pack | ✅ **CC BY 4.0**. Credit "Matt Firth (shikashipx)" **and** "game-icons.net" | Required | ❌ itch manual | 284 colored 32×32 pixel items/skills. Great relic/item art for a pixel kit. |
| Emoji: Fluent Emoji Flat | npm `@iconify-json/fluent-emoji-flat` (3,145) | ✅ **MIT** | Keep license | ✅ npm | Colorful creatures (🐉🧌🐺). Vendor the SVGs; don't rely on OS emoji, which renders differently per OS. |
| Emoji: Noto | npm `@iconify-json/noto` (3,729) | ✅ **Apache-2.0** | Keep license/NOTICE | ✅ npm | Same use as Fluent. |
| Emoji: Twemoji / OpenMoji | `@iconify-json/twemoji` / `openmoji` | Twemoji **CC BY 4.0**; OpenMoji **CC BY-SA 4.0** ⚠️ | Required | ✅ npm | Prefer Fluent/Noto. OpenMoji is share-alike. |

---

## 4. Sound effects

| Source | URL | License | Attribution | Scriptable | Fit |
|---|---|---|---|---|---|
| **ZzFX** (Frank Force) | https://github.com/KilledByAPixel/ZzFX · npm `zzfx` 1.4.0 | ✅ **MIT** (README: "MIT licensed, use it anywhere") | Keep MIT notice | ✅ npm, or paste the ~1 KB function | **Top pick for an AI.** Each sound is one array of numbers in code (e.g. `zzfx(...[,,925,.04,.3,.6,1,.3,,6.27,-184,.09,.17])`). No files, and the AI can tune by parameter. |
| **jsfxr / sfxr.me** | https://sfxr.me · https://github.com/chr15m/jsfxr · npm `jsfxr` 1.4.1 | ✅ Library **Unlicense** (public domain, per sfxr.me). Generated sounds: "unrestricted commercial use". | None | ✅ npm | Preset generators (`pickupCoin`, `hitHurt`, `explosion`, `powerUp`, `blipSelect`) are well suited to procedural use. |
| ChipTone (SFB Games) | https://sfbgames.itch.io/chiptone | ✅ Output **CC0** | None | ❌ GUI tool (human) | For hand-tuning only. |
| **Kenney audio** | https://kenney.nl/assets/category:Audio | ✅ **CC0** | None | ⚠️ hashed zips, blocked here | **Casino Audio** (50 files, *card/chip/dice foley*: card slide, shuffle) `.../casino-audio/2472606a04-1721639069/kenney_casino-audio.zip`; **RPG Audio** (50) `.../rpg-audio/8e99002d76-1677590336/kenney_rpg-audio.zip`; **Impact Sounds** (130) `.../impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip`; **Interface Sounds** (100) `.../interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip`; also UI Audio, Digital Audio. |
| freesound.org | https://freesound.org · API: https://freesound.org/docs/api/ | ⚠️ **Per sound**: CC0 / CC BY / CC BY-NC. Filter to CC0. | CC BY needs credit; **avoid NC** | ⚠️ API key required. Token auth fetches **previews** (mp3/ogg). **Original downloads require OAuth2** (verified). License filter syntax `filter=license:"Creative Commons 0"` ❓ (not confirmed in the docs page I read). Blocked here. | Too much friction for an AI build. Use Kenney/ZzFX instead. |

---

## 5. Music

| Source | URL | License | Attribution | Scriptable | Fit |
|---|---|---|---|---|---|
| **Kenney Music Jingles** | https://kenney.nl/assets/music-jingles (`.../music-jingles/f37e530b9e-1677590399/kenney_music-jingles.zip`) | ✅ CC0 | None | ⚠️ blocked here | 85 short stings: victory, defeat, level-up, reward. |
| **OpenGameArt "CC0 Music" collection** | https://opengameart.org/content/cc0-music-0 | ✅ CC0 (curated collection) ⚠️ still check each track's own page | None | Direct file URLs, blocked here | Hundreds of tracks: "Battle Theme A", fantasy orchestral, menu loops, boss music. |
| Ninja Adventure | see §1 | ✅ CC0 | None | ❌ itch | 37 tracks, chiptune/adventure. |
| Kevin MacLeod / incompetech | https://incompetech.com/music/royalty-free/licenses/ | ✅ **CC BY** (free) or paid Standard License | **Required.** The site generates the credit text. Common form ❓: *"Title" Kevin MacLeod (incompetech.com) Licensed under Creative Commons: By Attribution 4.0 License http://creativecommons.org/licenses/by/4.0/* | ❌ blocked here | Huge, recognizable fantasy catalogue. Very recognizable, though, and YouTube Content-ID can misfire on it. |
| **FreePD** | https://freepd.com | ⚠️ **SITE SHUT DOWN** ("officially taken the service offline", verified 2026-10-07) | — | — | **Don't plan on it.** |
| Pixabay Music | https://pixabay.com/service/license-summary/ | ⚠️ **Custom Pixabay Content License**: no attribution; no **standalone** redistribution; no trademark use | Not required | ❌ manual | OK inside a game. Not CC0, so redistributing raw files in a public repo is a grey area. Content-ID claims ❓ (not stated in the summary). |
| **Procedural music (recommended for v1)** | Tone.js npm `tone` 15.1.22 (✅ MIT); or raw WebAudio | Your own output | None | ✅ npm | A seeded generator (scale + chord progression + arpeggio + drum pattern) gives each biome or act its own loop, adds no assets, and an AI can iterate on it. Howler.js (npm `howler` 2.2.4, ✅ MIT) can play sample files. |

---

## 6. Fonts (all ✅ SIL OFL 1.1, verified via npm `@fontsource/*` metadata and google/fonts OFL.txt)

| Font | Role | npm (Fontsource) | Google Fonts |
|---|---|---|---|
| **Cinzel** / Cinzel Decorative | Card titles, headers (classic "Slay the Spire / MTG" serif caps) | `@fontsource/cinzel`, `@fontsource/cinzel-decorative` | https://fonts.google.com/specimen/Cinzel |
| **Alegreya** / Alegreya Sans | Card rules text (readable at small sizes) | `@fontsource/alegreya`, `@fontsource/alegreya-sans` | ✓ |
| EB Garamond / Crimson Text | Alternate body / flavor text | `@fontsource/eb-garamond`, `@fontsource/crimson-text` | ✓ |
| MedievalSharp, Uncial Antiqua, Almendra, IM Fell English, Grenze Gotisch, New Rocker, Macondo | Flavor display fonts (use sparingly) | `@fontsource/<name>` (all OFL-1.1) | ✓ |
| **Pixelify Sans**, Press Start 2P, Silkscreen, VT323 | Pixel-art theme: numbers on units (ATK/HP), damage popups | `@fontsource/pixelify-sans`, `press-start-2p`, `silkscreen`, `vt323` | ✓ |

OFL obligations: you may bundle and embed the fonts. Ship `OFL.txt` alongside them. Don't sell the font by itself. Don't use the Reserved Font Name for a modified version.
❓ "Alagard" (popular pixel fantasy font) is **not** on Google Fonts/Fontsource. Its license is separate (unverified).

---

## 7. Approaches that need no image generation (strongly recommended for an AI builder)

| Technique | How | Strength |
|---|---|---|
| **SVG icon as card/unit art** | game-icons SVG path, tinted per faction/rarity, on a CSS radial-gradient "art window" with a drop-shadow glow | Consistent, crisp at any size, 4k+ subjects. *This is the backbone of the recommended kit.* |
| **CSS card rendering** | Flex layout: header (Cinzel name + cost gem), art window, type line, rules text, ATK/HP badges. Rarity = border gradient, foil = animated `conic-gradient`/`mix-blend-mode`. Nine-slice `border-image` if Kenney borders are added later. | One component makes every card; easy to animate (hover lift, draw, play). |
| **Procedural SVG** | Map nodes, paths, terrain blobs, parchment noise (`feTurbulence` + `feDisplacementMap`), relic gems (polygons + gradients) | Zero assets. Seeded, so it's deterministic per run. |
| **Programmatic pixel art** | Define 16×16 sprites as string grids (`"..##.."`) plus a palette (e.g. Lospec **Endesga 32**: `#be4a2f #d77643 #ead4aa #e4a672 #b86f50 #733e39 #3e2731 #a22633 #e43b44 #f77622 #feae34 #fee761 #63c74d #3e8948 #265c42 #193c3e #124e89 #0099db #2ce8f5 #ffffff #c0cbdc #8b9bb4 #5a6988 #3a4466 #262b44 #181425 #ff0044 #68386c #b55088 #f6757a #e8b796 #c28569`), render to canvas with `imageSmoothingEnabled=false`; mirror-symmetric random "space-invader" monster generators | Bespoke creatures with a uniform look. Palettes: https://lospec.com/palette-list (⚠️ Lospec states no license per palette. Hex color lists aren't copyrightable in practice, but credit the palette author anyway.) |
| **Emoji (vendored SVG)** | Fluent Emoji Flat / Noto via Iconify npm | Colorful prototype art. Don't use system emoji fonts (inconsistent across OSes). |
| **Procedural audio** | ZzFX / jsfxr for SFX, Tone.js for music | No audio files at all. |

---

## 8. AI image generation (brief)

- **Copyright**: US Copyright Office guidance (Part 2 report, Jan 2025 ❓ exact citation unverified) says purely AI-generated images are **not copyrightable**. You can ship them, but you can't stop others from reusing them. Human selection, arrangement, and editing can be protected.
- **Tool terms vary** ❓ (check current ToS): OpenAI assigns output rights to the user; Midjourney grants commercial rights on paid plans (with revenue-threshold rules); Stable Diffusion-family weights carry model licenses (e.g. Stability Community License with revenue caps; SDXL under OpenRAIL++ with use restrictions).
- **Store policies**: Steam requires disclosure of AI-generated content ❓ (policy since 2024; verify current wording). itch.io asks for AI tagging ❓.
- **Asset-license conflicts**: CraftPix's license **forbids using its assets to train or fine-tune AI**. Don't feed CraftPix or other restricted packs into img2img/LoRA pipelines.
- **Practical take**: this project doesn't need it. SVG icons, CSS cards, and procedural pixel art give a more consistent style, and an AI agent can iterate on them in code.

---

## 9. Recommended starter kits (pick one style; don't mix pixel and vector)

### A. "Arcane Vector" — fully scriptable from this sandbox (RECOMMENDED for v1)
| Layer | Asset | License | Fetch |
|---|---|---|---|
| Creature/relic/card art | **game-icons.net** SVGs (raw GitHub per-author paths, or `@iconify-json/game-icons`) tinted by faction | CC BY 3.0 (credit authors) | `curl https://raw.githubusercontent.com/game-icons/icons/master/lorc/dragon-head.svg`, or the npm tarball `https://registry.npmjs.org/@iconify-json/game-icons/-/game-icons-1.2.4.tgz` |
| Cards / UI frames | **Hand-written CSS** (gradients, rarity borders, gems) + procedural SVG parchment | own | — |
| UI glyphs | **Lucide** (`lucide-static`) | ISC | npm |
| Fonts | **Cinzel** (titles) + **Alegreya** (rules text) | OFL 1.1 | `@fontsource/*` or Google Fonts CSS |
| SFX | **ZzFX** (+ jsfxr presets) | MIT / Unlicense | npm, or inline |
| Music | **Tone.js procedural** loops per act; stings via ZzFX | MIT | npm |
| Palette | Dark slate background + 5 faction hues + 4 rarity colors (Common grey, Uncommon green, Rare blue, Legendary gold) | — | — |

### B. "Crypt Pixel" — upgrade path once a human drops zips into `assets/vendor/`
| Layer | Asset | License |
|---|---|---|
| Units | **0x72 DungeonTileset II** (animated) + **DCSS 32x32** creatures (downscale or use 32px everywhere ❓ choose one grid) | CC0 / CC0 |
| Items / relics | Kenney **Tiny Dungeon** / **1-Bit Pack**, or **Shikashi's Fantasy Icons** (CC BY 4.0) | CC0 / CC BY |
| Cards & panels | Kenney **Fantasy UI Borders** + **Playing Cards Pack**, or OGA **40x56 Card Frames** | CC0 |
| Font | **Pixelify Sans** (+ Silkscreen for numbers) | OFL |
| Palette | **Endesga 32** (recolor everything to it for cohesion) | — |
| SFX | Kenney **Casino Audio** (card foley) + **Impact Sounds** + **RPG Audio**; ZzFX for gaps | CC0 / MIT |
| Music | Kenney **Music Jingles** + tracks from OGA **CC0 Music** collection | CC0 |

A and B can share code. Keep art behind an `ArtProvider` interface (`getUnitArt(id)`), so v1 ships with SVG and v2 swaps in pixel sprites.

---

## 10. Licensing & attribution checklist

- [ ] Use only **CC0, CC BY, OFL, MIT, ISC, Apache-2.0, Unlicense** assets. **Reject** NC (non-commercial), ND, SA/GPL art (unless share-alike is accepted for the whole project), and "no redistribution" custom licenses (Tiny Swords, CraftPix) **if the repo is public**.
- [ ] Record each asset's source URL, author, license, and download date in `CREDITS.md` and `assets/LICENSES/`.
- [ ] **game-icons.net (CC BY 3.0)**: "Icons made by {author}" for every author actually used, plus a link to https://game-icons.net and the CC BY 3.0 license. Make it reachable from the in-game **Credits menu** (the FAQ's requirement for video games).
- [ ] Fonts: ship each font's `OFL.txt`. Icon font RPG-Awesome: OFL + MIT.
- [ ] MIT/ISC/Apache libraries (ZzFX, Tone.js, Howler, Lucide, Noto/Fluent): keep the license text (Apache: also NOTICE if present).
- [ ] CC0 (Kenney, 0x72, DCSS, Ninja Adventure, OGA CC0): no credit needed, but credit them anyway. Never use Kenney's logo.
- [ ] Kevin MacLeod or any CC BY music: exact per-track credit line, in the credits screen and the README.
- [ ] Generated content (ZzFX/jsfxr/procedural): note "procedurally generated" in credits. No license needed.
- [ ] Re-verify a license whenever a pack updates. itch "custom" licenses can change.

### `CREDITS.md` template
```markdown
# Credits

## Art
- Icons from game-icons.net by Lorc, Delapouite, (… list authors actually used …)
  License: CC BY 3.0 — https://creativecommons.org/licenses/by/3.0/
  Source: https://game-icons.net  (modified: recolored, composited)
- UI icons: Lucide — ISC License — https://lucide.dev/license
- [optional] "16x16 DungeonTileset II" by 0x72 — CC0 — https://0x72.itch.io/dungeontileset-ii
- [optional] Kenney (www.kenney.nl) — "Fantasy UI Borders", "Tiny Dungeon" — CC0

## Fonts
- Cinzel — Natanael Gama / The Cinzel Project Authors — SIL OFL 1.1 (see assets/LICENSES/OFL-Cinzel.txt)
- Alegreya — Huerta Tipográfica — SIL OFL 1.1

## Audio
- Sound effects generated with ZzFX by Frank Force — MIT — https://github.com/KilledByAPixel/ZzFX
- Music generated procedurally with Tone.js — MIT
- [optional] "Track Title" Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0 — http://creativecommons.org/licenses/by/4.0/

## Code libraries
- (name) — (license) — (url)
```

Optionally keep a machine-readable `assets/manifest.json` with entries like `{ "file": "...", "source": "...", "author": "...", "license": "CC-BY-3.0", "modified": true }`, so a build step can generate the credits screen and catch unlicensed files.

---

## Sources
- Kenney license/support: https://kenney.nl/support · pack pages listed in §1, §4, §5
- Kenney GitHub mirror: https://github.com/ETdoFresh/kenney.nl
- 0x72: https://0x72.itch.io/dungeontileset-ii
- DCSS tiles: https://opengameart.org/content/dungeon-crawl-32x32-tiles
- Card frames: https://opengameart.org/content/40x56-card-frames-without-the-art · https://opengameart.org/content/tcg-templates · https://opengameart.org/content/tcg-card-frame · https://opengameart.org/content/card-deck-fronts
- game-icons: https://game-icons.net/faq.html · https://raw.githubusercontent.com/game-icons/icons/master/license.txt
- RPG-Awesome: https://github.com/nagoshiashumari/Rpg-Awesome (README license section)
- CraftPix: https://craftpix.net/file-licenses/
- Tiny Swords: https://pixelfrog-assets.itch.io/tiny-swords · Ninja Adventure: https://pixel-boy.itch.io/ninja-adventure-asset-pack · Shikashi: https://shikashipx.itch.io/shikashis-fantasy-icons-pack
- Quaternius: https://quaternius.com/faq.html
- ZzFX: https://github.com/KilledByAPixel/ZzFX · jsfxr: https://sfxr.me, https://github.com/chr15m/jsfxr · ChipTone: https://sfbgames.itch.io/chiptone
- Freesound API: https://freesound.org/docs/api/overview.html
- incompetech: https://incompetech.com/music/royalty-free/licenses/ · FreePD (closed): https://freepd.com · Pixabay: https://pixabay.com/service/license-summary/
- OGA CC0 music: https://opengameart.org/content/cc0-music-0
- Lospec Endesga 32: https://lospec.com/palette-list/endesga-32
- Fonts: https://raw.githubusercontent.com/google/fonts/main/ofl/cinzel/OFL.txt · npm `@fontsource/*` metadata (registry.npmjs.org)
- npm metadata checked: zzfx, jsfxr, tone, howler, lucide-static, rpg-awesome, @iconify-json/{game-icons,lucide,pixelarticons,fluent-emoji-flat,noto,twemoji,openmoji}
