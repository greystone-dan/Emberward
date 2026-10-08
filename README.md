# Emberward

A card roguelite auto-battler: carry the lantern down the drowned stair. Draft a deck in the Drift, muster it on a
4×3 grid, and watch six waves of Clash play out against the stair's drowned, bell-forged and waxen things.
Desktop browser only (mouse and keyboard, 1280×720 or larger).

**Play it:** https://greystone-dan.github.io/Emberward/ once GitHub Pages is on (the `pages` workflow builds `main`;
Pages needs the repository to be public, or a GitHub Pro account, to serve a private one).

## Hosting

The build is plain static files with relative paths, so any static host works:

- **GitHub Pages**: `.github/workflows/pages.yml` does it on every push to `main` (repository public or GitHub Pro).
- **Cloudflare Pages** (Git integration, private repositories are fine): framework preset Vite, build command
  `npm run build`, output directory `dist`, environment variable `NODE_VERSION=22`. Then add a custom domain such as
  `play.greystoneinteractive.ca` in the Pages project.
- **Anywhere else**: upload the contents of `dist/`.

## Run it yourself

```
npm ci
npm run dev          # http://localhost:5173
npm run build        # static site in dist/ (relative paths, serves from any folder)
npm run preview      # serve dist/ locally
```

Useful URL parameters on the dev server: `?seed=N` fixes the run, `?scenario=NAME` jumps to a screen
(`run-drift`, `battle-wave3`, `boss`, …), `?debug=1` hides the tutorials, `?tutorial=1` replays them.

## How to play

1. Pick a Warden. Each has a starting deck, a trait leaning and a relic.
2. The Drift: the front offers are free, further-back ones cost embers. Three copies of a card Rekindle into the
   next level (Spark → Flame → Fire) and thin the deck.
3. The map: fights, elites, the Market, the Hearth and Shrines, then the boss.
4. Battle: your whole deck is revealed. Summon units onto your three rows (Front is nearest the enemy) or cast
   their spell face; traits count across the board and neighbours sharing a trait gain Kinship. End Turn resolves
   the Clash lane by lane, Front to Back. Reduce the enemy Warden to 0 before wave 6 ends.

## Developing

- `npm run check` runs typecheck, lint and the unit tests (including the golden replays); keep it green.
- `npm run e2e` runs the Playwright flows; `npm run shoot -- <scenario>` takes screenshots into `shots/`.
- `npm run sim -- --battles 1000 --bot random --seed 1` and `npm run balance` run headless battles and runs.
- Rules: `docs/SPEC.md`; decisions: `docs/DECISIONS.md`; art: `docs/ART.md`; progress: `PROGRESS.md`; the
  checklist: `features.json`. The rules engine in `src/core` is pure and deterministic; content is data in
  `content/cards.json`.

Credits and licences: `CREDITS.md`.
