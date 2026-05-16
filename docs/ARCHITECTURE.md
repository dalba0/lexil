# Architecture

## Two halves

Lexil is split cleanly along an offline / online boundary.

```
┌─────────────────────────────────────────────────────────────────┐
│                          PIPELINE  (offline)                    │
│   Python 3.11+ · stdlib only · run by developers                │
│                                                                 │
│   kaikki.org dump (.jsonl)                                      │
│        │                                                        │
│        ▼                                                        │
│   sources/kaikki_<lang>.py  ──►  build/<lang>.normalized.jsonl  │
│        │                                                        │
│        ▼                                                        │
│   build_pack.py  +  schema.sql  ──►  packs/<lang>-en.db         │
└─────────────────────────────────────────────────────────────────┘
                              │
                  copy to src-tauri/resources/
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       APP  (runtime, offline)                   │
│   Tauri 2 · Rust + React + TypeScript                           │
│                                                                 │
│   React frontend  ──► tauri.invoke()  ──► Rust commands         │
│        │                                       │                │
│        ▼                                       ▼                │
│   shadcn UI primitives,       rusqlite (bundled) ──► .db pack   │
│   design tokens (CSS vars)    rusqlite ──► user DB (recents,    │
│                                            favorites)           │
└─────────────────────────────────────────────────────────────────┘
```

**Pipeline** runs on a developer's machine. It is the only place the project
makes network calls — to fetch the kaikki dump. Output is a single SQLite
file with a documented, language-agnostic schema.

**App** is shipped to end users with the pack bundled as a Tauri resource.
It makes zero network calls at runtime. No telemetry, no crash reporting,
no analytics.

## Schema

The pack schema (`pipeline/schema.sql`) is identical for every language.
Per-pack identifying info goes into `pack_meta`:

| Table | Holds |
|---|---|
| `entries` | One row per headword + POS combination. Includes `headword_normalized` (accent-stripped, lowercased) and `gender` for nouns. |
| `senses` | Numbered definitions for each entry. Carries `register` (formal/vulgar/etc.) and `domain` (computing/biology/etc.). |
| `examples` | Example sentences, each tied to one sense; carries an optional translation. |
| `inflections` | Conjugated and declined forms, with a compact tag string like `"1 s pres ind"`. Each has its own `form_normalized` for inflection-fallback search. |
| `entries_fts` | FTS5 virtual table over `headword` and `headword_normalized`, with `tokenize='unicode61 remove_diacritics 2'`. |
| `pack_meta` | Key/value table: language codes, source URL, license, attribution, version, entry count, build timestamp. |

Foreign keys cascade deletes — entries clean up their senses, senses clean
up their examples. The pack is built with foreign keys ON.

## Search

The Rust `search` command (`apps/desktop/src-tauri/src/db.rs`) runs two
queries:

1. **FTS5 prefix match** on `entries_fts` using `headword_normalized:<q>*`.
   The tokenizer strips diacritics so `cafe` matches `café`.
2. **Inflection lookup**: exact match on `inflections.form_normalized`.
   Yields lemmas with `matched_form` set so the UI can render a
   "form of X" badge.

Results are merged (FTS hits first, then inflections-only), de-duplicated
by `entry_id`, and capped at the requested limit.

## User state

`apps/desktop/src-tauri/src/user.rs` opens a second SQLite file
(`lexil-user.db`) in the OS-conventional app data dir
(via `app.path().app_data_dir()`). This file holds the **recent** stack
(capped at 50) and **favorites** (uncapped). It is never mixed with the
dictionary pack.

## Frontend organization

```
src/
├── App.tsx               state machine: search ⇄ detail, history stack
├── components/
│   ├── ui/               shadcn primitives (button, input, scroll-area, …)
│   ├── SearchInput.tsx   the one opinionated input
│   ├── ResultList.tsx
│   ├── EntryView.tsx     the detail "showpiece"
│   ├── Conjugations.tsx  collapsible tense grid (verbs only)
│   ├── Sidebar.tsx       recents + favorites, with CSV/TSV export
│   └── SettingsPanel.tsx theme + font size + about
├── hooks/                useDebounced, useTheme, useFontScale, useShortcuts,
│                         useHistory
├── lib/
│   ├── api.ts            single source of truth for Tauri invocations
│   ├── types.ts          mirror of Rust models.rs
│   ├── tags.ts           inverse of the compact inflection tag scheme
│   └── utils.ts          cn() helper
└── styles/globals.css    all design tokens (CSS variables)
```

## Themes

Two themes — **Paper** (light) and **Ink** (dark). Both are sets of CSS
variables (in `globals.css`) selected by `<html data-theme="paper|ink">`.
Tailwind reads them via `var(--token)` so utility classes follow the
active theme without a re-render. See `docs/DESIGN.md` for the token
values and rationale.

## Keyboard model

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + K` | Focus search |
| `Cmd/Ctrl + D` | Toggle theme |
| `Cmd/Ctrl + S` | Star/unstar current entry |
| `Cmd/Ctrl + [` | Back through history |
| `Cmd/Ctrl + ]` | Forward through history |
| `↑` / `↓` | Move through result list |
| `Enter` | Open selected result |
| `Esc` | Clear search |

History is in-memory only (per session), modeled after a browser stack:
`push` after navigation truncates anything past the cursor.

## Performance constraints

- Search must feel instant. The debounce is **60 ms**; anything longer
  feels typed.
- FTS queries on a 600k-entry Spanish pack should return within ~5 ms on a
  modern laptop. If not, suspect a missing index or an unprepared statement.
- The pack is bundled as a Tauri resource; it is not loaded into memory.
  rusqlite opens the file read-only and pages on demand.

## Boundaries explicitly excluded

- No telemetry. No analytics. No crash reporting that phones home.
- The app never makes network requests; the only crate with a network
  surface (`tauri`) is configured without HTTP plugins.
- The pack is the only artifact shipped to users besides the binary;
  attribution is rendered in the About dialog and lives in
  `docs/LICENSES.md`.
