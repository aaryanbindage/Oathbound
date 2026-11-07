# Oathbound

An unofficial, non-commercial fan RPG set on Roshar, the world of Brandon Sanderson's *The Stormlight Archive*. Not for sale.

## Run it

```
npm install
npm start          # play from source
npm test           # save file tests
npm run dist       # build the Windows installer and portable exe into dist/
npm run dist:mac   # build the Mac disk image into dist/ (run this on a Mac)
```

## What's here

| Folder | Contents |
|---|---|
| `game-separate-files/` | The game, split into 10 JS files. |
| `electron/` | The desktop app: window, crash handling, and `saves.js` for save files. |
| `tests/` | Save tests, the built-app test, and the bot that plays the whole game. |
| `tools/` | Draws the app icon into `build/`. |

## Save files

Saves are ordinary files, one per slot:

| System | Folder |
|---|---|
| Windows | `%APPDATA%\Oathbound\saves` |
| macOS | `~/Library/Application Support/Oathbound/saves` |
| Linux | `~/.config/Oathbound/saves` |

In the game, Menu > System > Open save folder takes you there.

- **Files:** `autosave.json`, `slot-1.json`, `slot-2.json`, `slot-3.json`. Copy them to back up or move a game to another computer.
- **Crash safety:** each save goes to a temporary file that is flushed to disk, then renamed into place, so an interrupted save can't damage the previous one.
- **Backups:** the previous version of each save is kept as `<file>.bak`.
- **Damaged saves:** a save that can't be read is moved to `saves/damaged/` and its backup takes over. The title screen says when this happens.
- **Closing the window:** this autosaves if you are free to move. It does not autosave during a battle or cutscene, because story flags are ahead of the party's state at those moments.
- **Uninstalling:** this leaves your saves in place.
- **Older builds:** saves in browser storage move into files on first launch. Saves from the browser version of the game stay in that browser.

The app also keeps `window.json` (window size and position) and `logs/oathbound.log` in the folder above `saves`.

## Releasing

Change `version` in `package.json` and the file names in `.github/release-notes.md`, then push a tag such as `v1.0.1`. GitHub Actions builds and tests the app on Windows and on both kinds of Mac, then publishes a release with all the downloads. If any of them fail, nothing is published.

The builds aren't signed with a paid certificate, so people see a warning the first time they open the app. Removing it needs a Windows code signing certificate and an Apple Developer ID.

The Linux settings are in `package.json` but have not been built or run.

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

## Tests

```
npm test                                            # save store unit tests, then real restarts of the app
npm run bot                                         # plays the full game once per Order
node tests/test-built-app.js dist/win-unpacked/Oathbound.exe    # key presses against a built app
npx electron . --shots=ui                           # title, creation, menus, shop, withdraw, retry
npx electron . --shots=gallery                      # screenshots of every map and battle, in test-output/
```

Tests use a temporary data folder, so they never touch your real saves. The test switches do nothing in a packaged build, and the harness isn't included in it.

## Playtime estimate

About 45 minutes for a typical run, 30 for a rush and 60 for a thorough one. This is an estimate: fights were timed with a bot at assumed party levels, and nobody has played start to finish for it. The in-game play time on each save will now give real numbers.
