# Shifting Dungeon

[Launch the app](https://cristofarodp.github.io/shifting-dungeon/)

Shifting Dungeon is a free, lightweight Progressive Web App (PWA) for Dungeon Masters running a Dungeons & Dragons survival and escape one-shot. Explore a magical dungeon that rearranges itself as doors open, find the treasure and escape before the dungeon collapses.

The app handles dungeon generation and bookkeeping, while the DM controls narration, combat and adjudication.

## Features

- Randomized 5×5 dungeon with wraparound navigation and shifting rooms.
- Interactive map with room icons, door states, player positions and shift indicators.
- Room and door descriptions, with separate information for the DM.
- Party management, puzzle and boss tracking, chest rewards, collected items and adventurers' notes.
- Manual shifts, room anchoring, collapse, teleportation and respawn controls.
- Automatic and manual doomsday activation with a dedicated visual theme.
- Event history, undo, local autosaving and JSON save import/export.
- Automatic light and dark appearance following device settings.
- Editable content catalogs and offline support.

## Dungeon rules

The dungeon contains 25 rooms, each 50×50 feet. The entrance remains at the center, and the treasure starts at least three room transitions away. The remaining rooms comprise 5 safe, 7 tricky and 11 dangerous rooms, randomly selected without replacement.

Opening a door discovers the adjacent room and triggers a random legal shift, if available. Rooms and their occupants move together, wrapping around the grid. The entrance, anchored rooms and rooms connected by the open door cannot shift. Shifts cannot disconnect the dungeon.

Only one door can be open at a time. Ten ordinary door pairs are locked and five are trapped, selected independently from the 46 non-entrance pairs. Unlocked trapped doors can be opened without clearing their traps; the DM resolves traps at the appropriate time. Treasure doors have additional security. Crossing an open threshold moves a character; the DM closes the door manually.

Doomsday begins upon entering the genuine treasure room, discovering all but four rooms (or fewer), or manual activation. Automatic activation during an open door takes effect after that door closes and its collapse checks finish. During subsequent eligible door closures, empty rooms may collapse permanently, provided the dungeon remains connected. The entrance and genuine treasure cannot collapse.

Chests award a key, a magical reward and an adventurer's note while undiscovered notes remain. Bosses award special rewards. Ordinary encounters and unfinished challenges reset when rooms become empty; solved puzzles, defeated bosses and collected rewards remain recorded. Fake treasure and its illusory effects are adjudicated by the DM.

## Getting started

1. Open the [web app](https://cristofarodp.github.io/shifting-dungeon/).
2. Generate a dungeon and add your player characters.
3. Select rooms on the map to inspect their contents and manage doors, encounters and player movement.
4. Resolve combat, traps and puzzles at the table, updating the app as needed.

Generating a new dungeon preserves the player list but resets dungeon progress. Saves are stored locally in the browser; export a JSON save for backups or transferring a session to another device.

The app requires no account or backend. Install it through a compatible browser to use it offline after its resources have been cached.

### Map legend

| Room color | Meaning |
|---|---|
| Light blue | Entrance or genuine treasure |
| Green | Safe |
| Amber | Tricky |
| Red | Dangerous |
| Black | Collapsed |
| Muted | Undiscovered |

Door markers are green for unlocked, yellow for locked, red for trapped and split yellow/red for both. A yellow outline and arrow indicate the latest shift.

## Development

Install a supported Node.js LTS release with npm, then clone the repository:

```sh
git clone https://github.com/cristofarodp/shifting-dungeon.git
cd shifting-dungeon/app
npm ci
npm start
```

Open [http://localhost:8080](http://localhost:8080). The development build is unminified and includes source maps. Restart the server to rebuild after editing source or content files.

To build without starting the server:

```sh
npm run build
```

To generate a minified production build:

```sh
npm run build:production
```

Both builds bundle the JavaScript dependencies and generate static files in `app/dist/`. Source files are not overwritten. The output directory and `node_modules/` are generated files and should not be committed.

The DM guide sources live in `guide/`. The deployment workflow compiles the guides with XeLaTeX and latexmk and adds the PDFs to the distribution. Local npm builds do not compile the guides.

## Publishing updates

Update the version in `app/version.json` for every release, including changes to code, content, translations, dependencies or the DM guide. Keep the asset list and any localization mappings up to date.

Pushing a change to `app/version.json` on `main` triggers the GitHub Pages deployment workflow. The workflow installs dependencies, builds the production application, compiles the DM guides and publishes `app/dist/`. It can also be triggered manually.

The service worker checks the release version on launch and downloads the complete release before switching caches. If an update fails, the previous release remains available. Saved dungeons are stored separately. For other static hosts, publish the complete distribution, including the compiled guides.

## Customization

Rooms, doors, traps, items and notes are defined in YAML files under `app/content/`. See [CONTENT.md](CONTENT.md) for catalog structure and editing instructions.

## License

Released under the [MIT License](LICENSE). Free to use, modify and redistribute under its terms.

An independent fan-made tool, not affiliated with or endorsed by Wizards of the Coast.
