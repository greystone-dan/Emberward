# Progress log

Append-only. Newest phase summary at the top; the loop log below it.

## Questions for Daniel

- (none yet)

## Phase 0: foundations — done (2026-10-07)

- `npm run check` (typecheck, lint, 13 unit tests) is green; CI runs it plus the build and a Playwright smoke test on every PR.
- All of `content/cards.json` is typed and validated: 60 cards, 17 traits, 4 Wardens, 12 relics, 9 enemy units, 8 fights, 3 elites, the boss and 5 events.
- Sprite pipeline: `npm run sprites` and `npm run sprites:sheet` render code-authored 32×32 sprites (one placeholder so far).
- features.json: 96 entries, 6 passing.

## Loop log

### 2026-10-07 · Phase 0 foundations
**Contract.** Add ESLint (core purity rules), Playwright, `npm run check`, CI; expand CLAUDE.md; create PROGRESS.md, features.json (96 entries from SPEC), docs/IDEAS.md, CREDITS.md; type all of cards.json with a schema test over all 60 cards; sprite pipeline skeleton (`npm run sprites`, `npm run sprites:sheet`); config flags for every SPEC [flag].
**Evidence.** `npm run check` green; `src/content/cards.test.ts` (8 tests over 60 cards, 17 traits, wardens, fights, elites, boss, events, relics, combos, comps); `reports/sprites-sheet.png` opened and checked (placeholder lantern reads at ×1 and ×4).
**Gotchas.** The container's Chromium is older than Playwright 1.64; `playwright.config.ts` uses `/opt/pw-browsers/chromium` when it exists.
