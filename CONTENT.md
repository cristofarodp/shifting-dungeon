# Creating custom content

Shifting Dungeon uses YAML catalogs to define its rooms, doors, traps, items and adventurers' notes. You can expand, replace or translate these catalogs without changing the application code.

## Catalogs

All five files are located in `app/content/`.

| File | Contents |
| --- | --- |
| `rooms.yaml` | Rooms, encounters, puzzles and treasure chambers |
| `doors.yaml` | Door appearances |
| `traps.yaml` | Door trap effects |
| `items.yaml` | Keys and magical rewards |
| `notes.yaml` | Adventurers' notes |

Each file contains a YAML list. Each entry starts with `-`, and its fields are indented consistently. Use UTF-8, spaces rather than tabs, and quote strings that could be interpreted as numbers, booleans or YAML syntax. Comments start with `#`. Use `[]` for an empty catalog where permitted.

The examples below show individual list entries to append to the corresponding file.

## IDs and compatibility

Every entry must have a unique `id` across all five catalogs. Use lowercase ASCII letters, digits and hyphens, such as `clockwork-library`.

IDs and `type` values are mechanical identifiers, not display text. Keep them unchanged when editing or translating existing entries. Never reuse a retired ID for unrelated content.

Saved dungeons reference these IDs. Reordering entries or editing their text is safe, but removing entries or changing IDs can invalidate existing saves, including references in their event history.

## Rooms

```yaml
- id: clockwork-library
  name: Clockwork Library
  type: puzzle
  appearance: Three brass books rotate above a stone lectern.
  description: |
    ### Solution

    Place the books in the order **sun, moon, star** to reveal a reward chest.
```

Required fields are `id`, `name`, `type` and `appearance`, except that illusion rooms obtain their appearance automatically from a treasure room. The optional `description` contains information reserved for the DM.

| Type | Category | Purpose |
| --- | --- | --- |
| `entrance` | Special | Starting chamber |
| `treasure` | Special | Genuine treasure chamber |
| `empty` | Safe | Exploration and atmosphere |
| `puzzle` | Safe | Puzzle with a reward chest |
| `easy_trap` | Tricky | Manageable trap with a reward chest |
| `easy_fight` | Tricky | Manageable encounter with a reward chest |
| `hard_trap` | Dangerous | Severe room trap |
| `hard_fight` | Dangerous | Difficult encounter |
| `boss_fight` | Dangerous | Boss encounter with a special reward |
| `illusion` | Dangerous | False treasure chamber |

The room catalog must contain at least one entrance, one treasure, five safe rooms, seven tricky rooms and eleven dangerous rooms. The generator selects distinct ordinary rooms from these pools. Larger catalogs increase variety without changing the dungeon size.

For illusion rooms, omit `appearance` and describe the illusion in `description`. Providing multiple treasure designs allows the illusion to look different from the genuine treasure.

## Doors

```yaml
- id: copper-leaf-door
  name: Copper Leaf Door
  appearance: A green copper door covered in overlapping embossed leaves.
```

Provide at least one door design. All three fields are required. Designs can be reused; lock and trap states are assigned independently of appearance. Avoid describing a door as inherently locked, unlocked or trapped.

## Door traps

```yaml
- id: echo-seal
  name: Echo Seal
  description: |
    When triggered, the seal emits a thunderous pulse.

    Creatures within 10 feet must make a Constitution saving throw or become deafened for one round.
```

Provide at least one trap. Each requires `id`, `name` and `description`. Do not include an `appearance` field: the visible door design comes from the door catalog.

The app tracks trap status; the DM determines triggering conditions, disarming and effects. Traps inside rooms belong in the room catalog instead.

## Items

```yaml
- id: compass-of-echoes
  name: Compass of Echoes
  type: challenge_reward
  appearance: A small silver compass with two trembling needles.
  description: Once per dungeon, the bearer may ask which adjacent rooms have been discovered.
```

All five fields are required.

| Type | Distribution |
| --- | --- |
| `key` | Random key awarded with a challenge chest |
| `challenge_reward` | Chest reward, drawn without repetition |
| `boss_reward` | Boss reward; also used when challenge rewards run out |

Provide at least one key and one boss reward. Challenge rewards are optional. Keys and boss rewards may be drawn more than once.

Describe effects, limitations and usage conditions in `description`. The DM adjudicates these effects; adding an item does not create a new automated action.

## Adventurers' notes

```yaml
- id: the-silent-threshold
  title: The Silent Threshold
  text: |
    We fled through the doorway, but the creature stopped at the threshold.
    Whatever binds these chambers seems to keep their inhabitants apart.
```

Each note requires `id`, `title` and `text`. Notes are awarded with challenge chests without repetition until the pool is exhausted. An empty list is allowed.

Use notes to reveal dungeon rules, provide hints or develop the atmosphere. Avoid hints that depend on specific rooms being selected or remaining in fixed positions.

## Formatting descriptions

DM-facing `description` fields support Markdown, including headings, emphasis, lists, inline code and tables. Use YAML literal blocks (`|`) to preserve line breaks and indentation.

```yaml
description: |
  ### Encounter

  Two guardians awaken when the chest is touched.

  - **Trigger:** touching the chest.
  - **Resolution:** defeat both guardians.

  | Check | DC |
  | --- | --- |
  | Perception | 12 |
  | Arcana | 15 |
```

Keep names, appearances and note text as plain text. Separate player-facing information from hidden solutions and mechanics. Design rooms to work independently of their neighbors, and balance encounters for your party.

## Translating content

Create translated copies of the catalogs, such as `app/content/rooms.it.yaml`. Preserve IDs, types and the set of entries; translate only human-readable fields.

Add the corresponding mappings to the `localization` array in `app/version.json`, retaining its existing settings:

```json
{
  "localization": [
    {
      "language": "it",
      "assets": {
        "content/rooms.yaml": "content/rooms.it.yaml",
        "content/notes.yaml": "content/notes.it.yaml"
      }
    }
  ]
}
```

Generic language codes such as `it` also match regional variants; `it-IT` matches that specific language. The first matching mapping for an asset wins. Unmapped assets use their original files.

## Testing and publishing

From the repository root, with Node.js and npm installed:

```sh
cd app
npm ci
npm start
```

Open <http://localhost:8080>. Restart the development server after editing content to rebuild the distribution.

Before publishing:

- Check YAML syntax, unique IDs, required fields, types and minimum catalog sizes.
- Generate several dungeons and test encounters, rewards, saving and importing.
- For translations, test changing the browser language and reopening an existing save.
- Update the release version in `app/version.json`, retaining the asset list and localization mappings.

Commit the content changes and updated manifest together. The GitHub Actions deployment workflow builds and publishes the application when the manifest changes on `main`. Content-only releases also require a new version so existing installations retrieve the updated catalogs.
