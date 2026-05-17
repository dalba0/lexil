# Lexil

A calm, offline dictionary for language learners. Look up words in Spanish, French, German, or Japanese with full conjugations, examples, and your own tags and notes — no ads, no accounts, no internet required after install.

**Current version:** v0.2.1 · **Platform:** Windows (macOS / Linux planned)
**Designed and built by Albab Dewan · 2026**

---

## Install (5 seconds)

1. Go to **[the latest release](https://github.com/dalba0/lexil/releases/latest)**
2. Download **`Lexil_0.2.1_x64_en-US.msi`**
3. Double-click to install. Done.

On first launch you'll pick which languages to download — Spanish (308 MB), French (129 MB), German (200 MB), and/or Japanese (116 MB). Pick only what you need; you can add or remove packs later in Settings.

---

## What's in it

### The basics
- **Real, full dictionaries** — 800k Spanish entries, 187k German, 136k Japanese, 100k+ French. Sourced from Wiktionary (CC-BY-SA).
- **Bidirectional search** — type in either language and find the matching entries. Inflected forms resolve to lemmas (typing `corro` opens `correr`).
- **Accent-insensitive** — type `cafe`, find `café`.
- **Complete conjugations** — every tense × every person, including subjunctive, conditional, imperative, and compound tenses. Japanese forms include te-form, polite, causative, passive, potential, conditional.

### Your stuff stays yours
- **Lists** — make custom lists like "Travel words" or "Verbs to drill". Pick an icon and color.
- **Tags** — colored chips on any entry, filter the whole dictionary by tag.
- **Notes** — long-form notes per entry, kept between sessions.
- **Favorites & history** — star words, browse recent sessions grouped by time.

### Out of the way when you want it
- **Two themes** — Paper (warm cream) for reading, Ink (low-light) for night.
- **Editorial typography** — Source Serif 4 for headwords, Inter for UI, JetBrains Mono for phonetics.
- **Keyboard-first** — every action has a shortcut (table below).

### Privacy by default
- No telemetry, no analytics, no accounts.
- After install, the **only** time the app touches the internet is when you ask it to download a new language pack from GitHub. That's it.

---

## Keyboard shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl + K` | Focus the search bar |
| `Ctrl + D` | Toggle Paper / Ink theme |
| `Ctrl + S` | Star or unstar the open entry |
| `Ctrl + [` | History back |
| `Ctrl + ]` | History forward |
| `↑` / `↓` | Move through results |
| `Enter` | Open selected result |
| `Esc` | Clear the search box |

---

## Available languages

All packs are pivoted through English (no direct ES↔FR yet).

| Language | Direction | Size | Entries |
|---|---|---|---|
| Spanish | es ↔ en | 308 MB | 801,006 |
| French  | fr ↔ en | 129 MB | ~100k |
| German  | de ↔ en | 200 MB | 186,849 |
| Japanese | ja ↔ en | 116 MB | 136,344 |

Each pack lives in `%AppData%\Lexil\packs\` after install. Removing a pack from Settings deletes the file and frees the disk.

---

## Build from source

You only need to do this if you want to modify the app or build it yourself. **Most people should just install the `.msi` above.**

### One-time setup

| Tool | Why | Where |
|---|---|---|
| Node.js 22+ | Frontend tooling | https://nodejs.org |
| pnpm 11+ | Package manager | `npm install -g pnpm` |
| Rust 1.77+ | Tauri backend | https://rustup.rs |
| MSVC Build Tools | Windows linker | Comes with Visual Studio 2022 "Desktop development with C++" workload |
| Python 3.11+ | Pipeline only (optional) | https://python.org |

### Run in development

```powershell
cd apps/desktop
pnpm install
pnpm tauri:dev
```

First launch compiles Rust — expect 1-3 minutes. After that it's instant HMR.

### Build a release installer

```powershell
cd apps/desktop
pnpm tauri:build
```

Output: `apps/desktop/src-tauri/target/release/bundle/msi/Lexil_<version>_x64_en-US.msi`.

### Rebuild a language pack from kaikki

```powershell
# Fetch the dump (one-time, ~400 MB for Spanish)
python pipeline/sources/fetch_kaikki.py --url https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl --output pipeline/data/kaikki-spanish.jsonl

# Parse to normalized JSONL
python pipeline/sources/kaikki_spanish.py pipeline/data/kaikki-spanish.jsonl

# Build the SQLite pack
python pipeline/build_pack.py --input pipeline/build/spanish.normalized.jsonl --output packs/spanish-en.db --language es --version 0.1.0
```

The same flow works with `kaikki_french.py`, `kaikki_german.py`, `kaikki_japanese.py`. Expect 10-20 min for FTS5 indexes on a real dataset.

---

## Project layout

```
lexil/
├── apps/desktop/          Tauri 2 + React + TypeScript application
│   ├── src/               React frontend (components, hooks, styles)
│   └── src-tauri/         Rust backend (search, user DB, pack manager)
├── pipeline/              Python data pipeline (stdlib only)
│   ├── sources/           Per-language Wiktionary parsers
│   └── build_pack.py      JSONL → SQLite FTS5 pack
├── packs/                 Manifest + built .db files (gitignored)
│   └── manifest.json      What the app fetches to discover packs
├── docs/                  Architecture, design, contribution guides
└── .github/workflows/     CI release builds
```

---

## Documentation

- **[ARCHITECTURE.md](docs/ARCHITECTURE.md)** — how the Rust backend, React frontend, and Python pipeline fit together
- **[DESIGN.md](docs/DESIGN.md)** — design system: colors, type scale, spacing, motion
- **[ADDING_A_LANGUAGE.md](docs/ADDING_A_LANGUAGE.md)** — recipe for shipping a new language pack
- **[LICENSES.md](docs/LICENSES.md)** — attribution for the dictionary data
- **[CHANGELOG.md](CHANGELOG.md)** — what changed in each release

---

## Licensing

The **dictionary data** in each pack is adapted from English Wiktionary contributors via [kaikki.org](https://kaikki.org/), licensed [CC-BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Attribution appears in the app's Settings → About screen.

The **application code** is the project author's work; license TBD.

---

## Credits

Designed and built by **Albab Dewan** · 2026. Built with [Tauri](https://tauri.app/), [React](https://react.dev/), [SQLite FTS5](https://www.sqlite.org/fts5.html), [Tailwind](https://tailwindcss.com/), [shadcn/ui](https://ui.shadcn.com/), [Lucide](https://lucide.dev/), and dictionary data from [kaikki.org](https://kaikki.org/).
