# Adding a new language pack

Lexil's app code is language-agnostic — adding French, German, or Japanese
is a *data* job plus a couple of registration entries. As of v0.2 the app
loads every pack it finds in `apps/desktop/src-tauri/resources/` at
startup, so multiple languages coexist without code changes.

The full flow:

1. Find a kaikki.org extract for the source language.
2. Write a source-language parser that emits the same intermediate JSONL
   shape as `pipeline/sources/kaikki_spanish.py`.
3. Register the pack's metadata in `pipeline/build_pack.py`'s
   `LANGUAGE_DEFAULTS`.
4. Build the pack into `packs/<source>-<target>.db`.
5. Copy the pack into the Tauri bundle's resources and add its id to the
   Rust `KNOWN_PACKS` list (and the frontend's language list, if it's not
   already there).

## Worked example: French

### 1. Fetch

```bash
python pipeline/sources/fetch_kaikki.py \
    --url https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl \
    --output pipeline/data/kaikki-french.jsonl
```

### 2. Parse

`pipeline/sources/kaikki_french.py` ships as a thin wrapper around the
Spanish extractor — the substring category matching ("masculine nouns",
"feminine nouns") and the head-template gender args cover French without
changes. If French-specific tags surface later, override the relevant
helpers in that file rather than editing the Spanish module.

```bash
python pipeline/sources/kaikki_french.py \
    pipeline/data/kaikki-french.jsonl \
    --output pipeline/build/french.normalized.jsonl
```

### 3. Register

`pipeline/build_pack.py` already includes an entry for `fr` in
`LANGUAGE_DEFAULTS`. To add a *different* language you'd append a new
entry like:

```python
"de": {
    "language_name": "German",
    "target_language": "en",
    "source_url": "https://kaikki.org/dictionary/German/",
    "license": "CC-BY-SA-4.0",
    "attribution": "German dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0.",
},
```

### 4. Build

```bash
python pipeline/build_pack.py \
    --input pipeline/build/french.normalized.jsonl \
    --output packs/french-en.db \
    --language fr \
    --version 0.1.0
```

Expect 10–20 minutes for the FTS5 indexes on a real dataset.

### 5. Ship in the app

```bash
cp packs/french-en.db apps/desktop/src-tauri/resources/french-en.db
```

The Rust side is already prepared:

- `apps/desktop/src-tauri/src/main.rs` lists known pack ids in `KNOWN_PACKS`. Both `spanish-en` and `french-en` are registered. New languages need a new entry here.
- `apps/desktop/src-tauri/src/db.rs` keeps a `HashMap<pack_id, Connection>` and every command takes `pack_id` explicitly.

The frontend is also prepared:

- `apps/desktop/src/lib/types.ts` defines `Lang` and `SearchDirection` covering `es`, `en`, `fr`. Add a code here for new languages.
- `apps/desktop/src/lib/direction.ts` maps each direction to a `pack_id`.
- `apps/desktop/src/components/LangPopover.tsx` shows every supported language; ones whose pack isn't loaded render as "coming soon" automatically.

Rebuild the Tauri app:

```bash
cd apps/desktop
pnpm tauri:dev
```

The language popover in the top bar will now offer **Spanish ↔ English**
and **French ↔ English**. Pick a French direction; the search index, the
sidebar's recents/favorites, the attribution footer, and the settings
modal all switch to the French pack.

## What the schema covers without modification

- Multiple etymologies per headword (separate `entries` rows).
- Verb conjugations, noun inflections, adjective agreement.
- Sense-level register (`formal`, `vulgar`, `archaic`, etc.) and domain
  (`computing`, `biology`, `law`, etc.).
- Examples with original-language and translation strings.
- Accent-insensitive forward search via FTS5 `unicode61 remove_diacritics 2`.
- Porter-stemmed reverse (English → source-language) search via the
  `senses_fts` index.

## What would need additional work

- A direct ES↔FR pack (the current model uses English as the pivot for
  every pair).
- Per-region usage labels (Mexican vs. Castilian Spanish, etc.).
- Audio pronunciation references (kaikki has audio URLs but we strip them).
- Cross-references between entries ("see also").
