# Lexil

Offline-first dictionary for language learners. Fast, beautiful, no ads, no
internet. Spanish first; the architecture is language-agnostic so French,
German, Japanese, etc. can drop in without touching the app code.

## Project layout

```
lexil/
├── apps/desktop/        Tauri 2 + React + TypeScript shell
│   ├── src/             React frontend
│   └── src-tauri/       Rust backend + bundled resources
├── pipeline/            Python data pipeline (stdlib only)
│   ├── sources/         per-language parsers
│   ├── build_pack.py    JSONL → SQLite pack
│   └── query.py         CLI smoke test for a built pack
├── packs/               built .db files (gitignored)
└── docs/                ARCHITECTURE.md, DESIGN.md, ADDING_A_LANGUAGE.md, LICENSES.md
```

## What's already working

- Pipeline (Python 3.11+, stdlib only): kaikki dump → normalized JSONL → SQLite pack.
- A `packs/spanish-en.db` built from a 12-entry fixture, copied into
  `apps/desktop/src-tauri/resources/` so the app boots end-to-end.
- CLI smoke test (`pipeline/query.py`) prints a card with senses, examples,
  conjugations, attribution. Inflection fallback works (typing `corro`
  resolves to `correr`).

## Requirements

To run the desktop app you need (each is a one-time install):

- **Node.js 20+** and **pnpm 9+** — https://nodejs.org and `npm install -g pnpm`
- **Rust 1.77+** — `rustup` from https://rustup.rs
- **Platform deps:**
  - **Windows:** Microsoft C++ Build Tools (or full Visual Studio with the "Desktop development with C++" workload) plus a recent WebView2 runtime (preinstalled on Windows 11). The Rust installer will print a link if MSVC is missing.
  - **macOS:** Xcode command-line tools (`xcode-select --install`).
  - **Linux:** `webkit2gtk-4.1`, `libayatana-appindicator3`, `librsvg2`, plus build essentials. See https://v2.tauri.app/start/prerequisites/.

Python 3.11+ is only needed for the pipeline (not the app).

## Run the app (development)

```bash
cd apps/desktop
pnpm install
pnpm tauri:dev
```

The first launch compiles the Rust backend — expect 1–3 minutes. After that
HMR is fast.

You should see the **Lexil** window open with an empty search bar. Try:

| Type | Expect |
|---|---|
| `cor` | A list with `correr` at the top |
| `correr` | Verb card with three senses, conjugation grid, attribution footer |
| `corro` | Same `correr` card, with a "form of correr: corro" badge |
| `banco` | Two separate cards (bench / bank) |
| `cafe` (no accent) | `café` card |
| `casa`, `perro`, `archivo`, `joder`, `ser`, `hablar`, `bonito`, `grande` | All present in the fixture pack |

## Test it

### Pipeline (works today, no toolchain needed)

```bash
# Smoke-test the built pack
python pipeline/query.py packs/spanish-en.db correr
python pipeline/query.py packs/spanish-en.db corro     # inflection fallback
python pipeline/query.py packs/spanish-en.db banco     # multi-etymology
python pipeline/query.py packs/spanish-en.db cafe      # accent-insensitive

# Re-run the parser on the fixture
python pipeline/sources/kaikki_spanish.py \
    pipeline/tests/fixtures/kaikki_sample.jsonl \
    --output pipeline/build/spanish.normalized.jsonl \
    --preview 5

# Rebuild the pack
python pipeline/build_pack.py \
    --input pipeline/build/spanish.normalized.jsonl \
    --output packs/spanish-en.db \
    --language es \
    --version 0.1.0-fixture
```

### App keyboard shortcuts (once running)

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Focus search |
| `Ctrl/Cmd + D` | Toggle Paper/Ink theme |
| `Ctrl/Cmd + S` | Star/unstar the open entry |
| `Ctrl/Cmd + [` / `]` | History back / forward |
| `↑` / `↓` | Move through results |
| `Enter` | Open selected result |
| `Esc` | Clear search |

### Features to check

- **Search input** with serif font and accent-colored caret. Bottom hairline border.
- **Result list** appears as you type (60 ms debounce). Each row shows headword, POS, and a one-line preview.
- **Detail view** — headword in 48 px Source Serif, IPA in JetBrains Mono, POS / gender chips, numbered senses with indented examples, conjugation grid for verbs (present + preterite open by default, others collapsed), source attribution in the footer.
- **Sidebar** — Recent (auto-populates as you open entries, capped at 50) and Favorites (star button on each detail page).
- **Settings** (gear icon top right) — theme toggle, font size selector, About text with pack version + attribution.
- **Export favorites** — Download icon on the Favorites section opens a Save dialog (CSV or Anki-compatible TSV).
- **Themes** — toggle with `Cmd/Ctrl + D` or via Settings. The accent color and highlight swap, not just light/dark.

## Build a real Spanish pack (not the 12-entry fixture)

The bundled pack is a tiny hand-authored fixture so the app boots. For a
real working dictionary, fetch the kaikki dump and rebuild:

```bash
# Download (~400 MB; cached under pipeline/data/)
python pipeline/sources/fetch_kaikki.py

# Parse (streams, doesn't load into RAM)
python pipeline/sources/kaikki_spanish.py \
    pipeline/data/kaikki-spanish.jsonl \
    --output pipeline/build/spanish.normalized.jsonl

# Build the pack (also works incrementally with --limit N)
python pipeline/build_pack.py \
    --input pipeline/build/spanish.normalized.jsonl \
    --output packs/spanish-en.db \
    --language es \
    --version 0.1.0

# Drop it into the Tauri bundle
cp packs/spanish-en.db apps/desktop/src-tauri/resources/spanish-en.db
```

Then `pnpm tauri:dev` again. Expect a real pack to be 200–500 MB depending
on how much you keep.

## Build a release binary

```bash
cd apps/desktop
pnpm tauri:build
```

Output lands in `apps/desktop/src-tauri/target/release/bundle/`. The bundle
contains the dictionary `.db` as a resource — the app does not require
network access at runtime.

The placeholder icons (`apps/desktop/src-tauri/icons/`) are generated by
`apps/desktop/src-tauri/icons/generate.py`. Replace with real artwork
before shipping:

```bash
pnpm tauri icon path/to/source.png
```

## Verifying offline behavior

After building, kill your network and run the app. Everything must work.
Search, conjugations, themes, recents, favorites, export — none of them
touch the network. The only crate with a network surface (`tauri`) is
configured without HTTP plugins, and there are no analytics / telemetry /
crash-reporting hooks anywhere.

## Adding another language

See [docs/ADDING_A_LANGUAGE.md](docs/ADDING_A_LANGUAGE.md). The schema is
language-agnostic; adding French is a data job, not a code job.

## Data licensing

The Spanish data comes from [kaikki.org](https://kaikki.org/)'s extraction
of English Wiktionary. Licensed under CC-BY-SA 4.0. Attribution is
rendered in the app's About dialog (gear → About) and lives in
[docs/LICENSES.md](docs/LICENSES.md).

## Project docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the two halves fit together
- [docs/DESIGN.md](docs/DESIGN.md) — design system, tokens, type scale, motion rules
- [docs/ADDING_A_LANGUAGE.md](docs/ADDING_A_LANGUAGE.md) — recipe for a new pack
- [docs/LICENSES.md](docs/LICENSES.md) — attribution and source licensing
