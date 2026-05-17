# Architecture

A quick tour of how Lexil's three halves — Python pipeline, Rust backend, React frontend — fit together. Read this if you want to contribute, fork, or understand why a particular decision was made.

## The three halves

```
┌────────────────────────────────────────────────────────────────────┐
│   PIPELINE (offline, dev-only)                                     │
│   Python 3.11+ · stdlib only                                       │
│                                                                    │
│   kaikki.org JSONL dump                                            │
│           │                                                        │
│           ▼                                                        │
│   sources/kaikki_<lang>.py  ──►  build/<lang>.normalized.jsonl     │
│           │                                                        │
│           ▼                                                        │
│   build_pack.py + schema.sql  ──►  packs/<lang>-en.db (SQLite)     │
│           │                                                        │
│           ▼                                                        │
│   Uploaded to packs-v1 GitHub Release                              │
│   Entry added to packs/manifest.json                               │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│   APP (user's machine)                                             │
│   Tauri 2 · Rust + React + TypeScript                              │
│                                                                    │
│   React UI ──► tauri.invoke() ──► Rust commands                    │
│                                                                    │
│   Network calls (rare):                                            │
│   • Fetch manifest.json on Settings → Packs                        │
│   • Download a .db when user clicks "Install" on a pack            │
│                                                                    │
│   All other reads/writes:                                          │
│   • Dictionary lookups → rusqlite over %AppData%/Lexil/packs/*.db  │
│   • User data (tags, notes, lists) → %AppData%/Lexil/user.db       │
└────────────────────────────────────────────────────────────────────┘
```

**Pipeline** is a developer's tool. It only runs on the project author's machine when a new pack is being prepared. It's the only place network calls happen at build time (to fetch the kaikki dump).

**App** is shipped to end users with **zero packs** bundled (the installer is ~30 MB). The user picks their languages on first launch; the app downloads them from GitHub Releases over HTTPS, verifies SHA256, and stores them in the OS's app-data directory.

After packs are installed, the app is fully offline — no telemetry, no analytics, no crash reporting.

## Pack distribution model

Packs live on **GitHub Releases**, used as a static CDN.

```
Manifest (always fresh)
  raw.githubusercontent.com/dalba0/lexil/main/packs/manifest.json

Pack downloads (immutable, cached forever)
  github.com/dalba0/lexil/releases/download/packs-v1/spanish-en.db
  github.com/dalba0/lexil/releases/download/packs-v1/french-en.db
  github.com/dalba0/lexil/releases/download/packs-v1/german-en.db
  github.com/dalba0/lexil/releases/download/packs-v1/japanese-en.db
```

The manifest carries `size_bytes`, `sha256`, `entries`, `version`, and `attribution` per pack. When the app downloads a pack it streams to a `.part` file, hashes as it goes, and only renames to the real filename if the hash matches the manifest.

To ship a new pack version: build the `.db`, upload to the `packs-v1` release with `gh release upload --clobber`, edit `packs/manifest.json` with the new SHA + size, push. Users see the new version on their next manifest refresh. No app update required.

## SQLite schema

Two separate SQLite files, deliberately not mixed:

### Dictionary pack (`<lang>-en.db`, immutable, shipped)

| Table | Purpose |
|---|---|
| `entries` | One row per (headword, POS) combination. `headword_normalized` is NFD-stripped + lowercased for accent-insensitive search. |
| `senses` | Numbered definitions, with `register` (formal/vulgar/etc.) and `domain` (computing/biology/etc.). |
| `examples` | Example sentences tied to a sense, optionally with translation. |
| `inflections` | Every conjugated/declined form, with a compact tag string like `"1 s pres ind"`. Each has `form_normalized` for inflection-fallback search. |
| `entries_fts` | FTS5 index over `headword` and `headword_normalized` using `unicode61 remove_diacritics 2`. |
| `senses_fts` | FTS5 index over English definitions using the `porter` stemmer (for EN → source-language reverse search). |
| `pack_meta` | Key/value metadata: language codes, source URL, license, attribution, version, entry count, build timestamp. |

Foreign keys cascade deletes. Pack files are opened **read-only**.

### User DB (`user.db`, mutable, per-user)

Lives in `%AppData%\Lexil\user.db`. Every user-data table is namespaced by `pack_id` so Spanish favorites don't leak into French favorites.

| Table | Holds |
|---|---|
| `recents` | (pack_id, entry_id, headword, pos, timestamp). Capped at 50 per pack. |
| `favorites` | (pack_id, entry_id, headword, pos, timestamp). Uncapped. |
| `tags` | (pack_id, name, color). One per unique tag string per pack. |
| `entry_tags` | (pack_id, entry_id, tag_id). Many-to-many. |
| `notes` | (id, pack_id, entry_id, text, created_at). Free-form Markdown-ish text. |
| `lists` | (id, pack_id, name, glyph, color, created_at). User-curated word lists. |
| `list_entries` | (list_id, pack_id, entry_id, headword, pos, added_at). |

Schema migrations run on every app launch via `IF NOT EXISTS` and `DROP INDEX IF EXISTS` patterns — adding a column or table never destroys user data.

## Search

The Rust `search` command (`src-tauri/src/db.rs`) runs two queries per request:

1. **FTS5 prefix match** on `entries_fts` for `headword_normalized:<q>*`. Diacritic-insensitive at the tokenizer level (`unicode61 remove_diacritics 2`).
2. **Inflection lookup**: exact match on `inflections.form_normalized`. Yields lemmas with `matched_form` set so the UI can render the "form of X" badge.

For reverse search (English → Spanish/French/German/Japanese), an additional FTS5 query hits `senses_fts` using the Porter stemmer so `run` matches definitions containing "running" or "runs".

Results are merged, deduped by `entry_id`, capped at the requested limit. On a 800k-entry Spanish pack, search returns in ~5 ms on a modern laptop.

## Conjugations rendering

This is where the most subtle logic lives. See `apps/desktop/src/components/Conjugations.tsx`.

**Why it's hard:** Wiktionary inflection tags come out of kaikki as a single space-separated string where the tokens appear in **arbitrary order**. For Spanish `vivir`'s "yo present indicative" you might see `'1 ind pres s'` or `'1 pres s'` or `'ind pres s 1'` — substring matching breaks.

**The solution:** tokenize the tag into a `Set<string>`, then match a (person, tense) cell when:

- All **required** tokens are in the set (e.g. `{pres, ind, 1, s}`), AND
- No **forbidden** tokens are in the set (e.g. `{sub, imp, cond, fut, imperf, pret, negative, vos}`).

Token-set logic is order-independent and handles every kaikki permutation.

Each of the four supported languages has its own paradigm config:

- **Spanish / French / German** share a 6-person grid (yo/nosotros/tú/vosotros/él/ellos and equivalents).
- **German** specifically: Perfekt, Plusquamperfekt, Futur I/II come through as **multi-word phrases** (`bin gegangen`, `werde gehen`) tagged `multiword-construction`. Those are real forms and rendered as-is. (French's multiword rows, by contrast, are *descriptive text* like "past historic of avoir + past participle" — filtered out.)
- **Japanese** has no person/number conjugation. It renders a flat list of named forms grouped by aspect/politeness: plain, polite, voice, imperative, conditional. Each form has a **preferred surface-suffix regex** so the picker chooses the modern variant (作りました for polite past, 作れば for modern -eba conditional, etc.) over archaic alternatives bundled in the same DB row.

Each pack also has IPA strings stored as inflection rows. They're filtered out at render time by detecting IPA-only characters (`ʁʃʒɛɔœ…`).

## Frontend organization

```
src/
├── App.tsx                   Top-level state: search ⇄ detail ⇄ list ⇄ tag, history stack
├── components/
│   ├── ui/                   shadcn primitives (button, input, popover, …)
│   ├── SearchInput.tsx       The opinionated single input
│   ├── ResultList.tsx        Result rows with POS and gloss preview
│   ├── EntryView.tsx         Detail "showpiece": header, tags, senses, notes, conjugations
│   ├── Conjugations.tsx      Token-set tag matcher + per-language paradigm tables
│   ├── Sidebar.tsx           Word of day · Sessions · Lists · Tags · Starred
│   ├── SettingsView.tsx      Full-page settings: Packs / Tags / About
│   ├── PackManager.tsx       Reusable pack install/remove/progress UI
│   ├── OnboardingFlow.tsx    First-run: Welcome → Pack picker → Theme → First word
│   ├── LangPopover.tsx       Language pair switcher in the top bar
│   ├── CreateListDialog.tsx  Modal for new lists with glyph + color picker
│   ├── EntryListView.tsx     Shared view for list-detail and tag-filtered view
│   ├── AddToListMenu.tsx     Compact popover on the entry header
│   ├── TagsRow.tsx           Colored tag chips with autocomplete
│   └── NotesSection.tsx      Markdown-lite notes per entry
├── hooks/                    useDebounced, useTheme, useFontScale, useShortcuts, useHistory
├── lib/
│   ├── api.ts                Single source of truth for `tauri.invoke()` calls
│   ├── types.ts              Mirror of Rust `models.rs`
│   ├── direction.ts          pack/lang/direction routing helpers
│   └── utils.ts              cn() class merger
└── styles/globals.css        All design tokens (CSS variables)
```

## Rust backend organization

```
src-tauri/src/
├── main.rs           Tauri entry, command registration, multi-pack init
├── db.rs             HashMap<pack_id, Connection>, search + entry fetch
├── user.rs           User DB schema, migrations, tag/note/list commands
├── pack_manager.rs   Manifest fetch, download with streaming + SHA verification
├── error.rs          AppError + AppResult shared types
└── models.rs         Serde structs sent to frontend
```

The pack manager uses `reqwest` (rustls-tls, blocking, stream features) on a background thread, emits `pack-download-progress` events to the frontend, and writes to a `.part` file that's renamed atomically only after the SHA256 matches the manifest.

## Themes

Two themes — **Paper** (warm cream) and **Ink** (low-light). Selected by `<html data-theme="paper|ink">`. Tailwind reads CSS variables via `var(--token)` so utility classes follow the active theme without re-rendering. See [DESIGN.md](DESIGN.md) for token values.

## Performance constraints

- Search must feel instant. Debounce is **60 ms**.
- FTS queries on a 800k-entry Spanish pack should return within **~5 ms** on a modern laptop.
- The pack file is **opened read-only, paged on demand** — never loaded into memory.
- App startup with all four packs installed: ~150 ms cold.

## What's explicitly off-limits

- **No telemetry.** No analytics. No crash reporting that phones home.
- **No background network calls.** The only HTTP traffic is when the user explicitly clicks "Install" or "Refresh packs" in Settings.
- **No scraped CC-BY-NC sources.** Only data licensed for commercial-friendly redistribution (Wiktionary's CC-BY-SA 4.0).
- **No accounts.** No sync. No cloud storage. Everything lives in `%AppData%\Lexil\`.

## Versioning

Three independent version axes:

- **App version** (`tauri.conf.json`, `package.json`, `Cargo.toml`) — bumped together, tagged as `v0.x.y`, triggers a CI build via `.github/workflows/release.yml`.
- **Pack version** (`pack_meta.version` inside each `.db`) — bumped when the underlying data changes (re-parse from updated Wiktionary, schema migration, etc.).
- **Manifest version** (`packs/manifest.json` → `manifest_version`) — bumped when the manifest format itself changes incompatibly. Currently 1.
