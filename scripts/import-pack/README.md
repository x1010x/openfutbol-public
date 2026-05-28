# import-pack

Reads a cloned [ZOXEXIVO/open-football-database](https://github.com/ZOXEXIVO/open-football-database)
repo and produces a single normalized `.pack.json` file for use with openfutbol.

This is Step 1 of the data-pack-import initiative. See `docs/data-pack-import.md` for the full plan.

## Usage

**1. Clone the source data**

```
git clone --depth=1 https://github.com/ZOXEXIVO/open-football-database /tmp/football-source
```

**2. Run the importer**

```
npm run import-pack -- --source /tmp/football-source --out ~/world.pack.json
```

Optional flags:

| Flag | Default | Description |
|---|---|---|
| `--name` | source dir name | Pack name stored in metadata |
| `--version` | `1.0.0` | Pack version stored in metadata |

**3. Load the pack in the app** (once Phase 3 is implemented)

## Output

The `.pack.json` is a single JSON file containing:
`meta`, `continents`, `countries`, `leagues`, `clubs`, `players`.

Source numeric IDs are preserved as `source_id` on every entity. All internal
references use UUIDs generated at import time.

## What is gitignored

Both the source clone and `*.pack.json` outputs are gitignored. Keep your pack file
locally — do not commit it. The file typically reaches 40-80 MB.

## Dependencies

No external dependencies beyond `tsx` (already in devDependencies). Uses Node built-ins only.
