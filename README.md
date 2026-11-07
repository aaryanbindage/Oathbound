# Oathbound project folder

## What's here

| Folder | Contents |
|---|---|
| `game-separate-files/` | The current game split into 10 JS files. Open `index.html` to play. Use this as the starting point for Electron. |
| `single-file/oathbound.html` | The same game as one file, identical to the live claude.ai version. |
| `single-file/oathbound-original.html` | The game before any of these changes. |
| `screenshots/` | `before/` and `after/` shots of the same scenes, plus the new save screens. |
| `tests/` | The save tests, the old vs new comparison, the playtime estimate and fight timings. |

Live version: https://claude.ai/artifact/8cArxcdYrVEBvKttoJpt9d

## What changed

### Graphics
The game now renders at 960x540 instead of 480x270. Game code still works in 480x270 layout units, so positions and timings did not change. The `RES` setting in `js/core.js` controls the scale.

- Sprites: smoother curves, finer outlines and light edge shading
- Environments: finer ground texture and softer scene edges
- Effects: smoother lighting, glows, particles and rain
- Scaling: nearest-neighbour at whole-number zooms, smooth scaling at other window sizes

### Saves
- Three manual slots and an autosave, with save and load screens
- Autosave on entering an area, after winning a map fight, at story milestones and when resting at camp
- Overwriting or deleting a save asks first
- A new character's first autosave moves the previous character's autosave to a free slot. If all slots are full, it is replaced.
- The old single save moves into a slot automatically
- Play time is recorded and shown on each save

### Bug fixed
Saving from the pause menu or world map did not record the party's position, so a reload could put you in the wrong place.

## Which file has what

| File | Contents | Changed |
|---|---|---|
| `core.js` | Loop support, input, font, sprites, lighting, particles, weather | Yes: graphics |
| `audio.js` | Sound effects and music | No |
| `data.js` | Skills, Orders, items, enemies | No |
| `art.js` | Tiles, characters, enemies, backdrops | Yes: graphics |
| `maps.js` | Area layouts | No |
| `battle.js` | Battle logic and drawing | Yes: smoothing |
| `story.js` | Story scripts | No |
| `field.js` | Exploration | Yes: smoothing, autosave after fights |
| `scenes.js` | Dialogue, title, menus, shop, save screen | Yes: saves, autosave on entering an area |
| `main.js` | Game state, save storage, main loop | Yes: saves |

The files must load in the order listed in `game-separate-files/index.html`.

## Moving to Electron

These files have not been run inside Electron yet.

- Point the Electron window at `game-separate-files/index.html`.
- The game already looks for `window.desktop`, using `window.desktop.quit()` for its Quit options. Your preload script needs to provide that.
- Claude account saving is skipped outside claude.ai, so saves fall back to browser storage. The save screen will say "this browser only", which should be reworded for a desktop app.
- Saving to real files in the app's data folder is the better long-term option. The `Saves` object in `js/main.js` is the only code that would need to change on the game side.

## Tests

Requires Node and Google Chrome on a Mac. Run from the `tests` folder.

```
node save-tests.js                                     # single-file build
node save-tests.js ../game-separate-files/index.html   # separate-files build
node compare-builds.js                                 # old vs new screenshots and fight timings
node playtime-estimate.js ../single-file/oathbound.html
```

`save-tests.js` and `compare-builds.js` write screenshots into `tests/`, and `compare-builds.js` also writes `results.json` there.

The save tests use a stand-in for Claude account storage, so they do not prove the real service works.

## Playtime estimate

About 45 minutes for a typical run, 30 for a rush and 60 for a thorough one. This is an estimate: fights were timed with a bot at assumed party levels, and nobody has played start to finish for it. The in-game play time on each save will now give real numbers.
