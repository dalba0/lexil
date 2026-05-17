# Adding a new language pack

Lexil's app code is language-agnostic: the schema, search, sidebar, and entry view all work without code changes. Adding a language is mostly a **data + manifest** job, with a small UI registration step.

> **As of v0.2** the app does not bundle any pack. All packs live on a GitHub Release and the app downloads them on demand. To ship a new language you:
>
> 1. Build the `.db` from a kaikki dump
> 2. Upload to the `packs-v1` GitHub release
> 3. Add an entry to `packs/manifest.json`
> 4. (Optional) Add a few UI lines so it shows up in the language switcher
>
> No app rebuild is required for existing users to discover the new pack — they just hit "Refresh" in Settings → Packs.

---

## Step-by-step: adding Italian

Use this as a template. Substitute your own language throughout.

### 1. Fetch the kaikki dump

```powershell
python pipeline/sources/fetch_kaikki.py `
    --url https://kaikki.org/dictionary/Italian/kaikki.org-dictionary-Italian.jsonl `
    --output pipeline/data/kaikki-italian.jsonl
```

Expect 200-600 MB depending on language. Cached under `pipeline/data/` and gitignored.

### 2. Write the parser

Create `pipeline/sources/kaikki_italian.py`. Most Romance and Germanic languages are thin wrappers around the Spanish extractor:

```python
"""Extract Italian entries from a kaikki.org Wiktionary dump."""
from __future__ import annotations

import argparse, sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from kaikki_spanish import parse_file  # noqa: E402


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("input", type=Path)
    p.add_argument("-o", "--output", type=Path,
                   default=Path("pipeline/build/italian.normalized.jsonl"))
    p.add_argument("--limit", type=int, default=None)
    args = p.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)

    import json
    n = 0
    with args.output.open("w", encoding="utf-8") as out:
        for entry in parse_file(args.input, args.limit):
            out.write(json.dumps(entry, ensure_ascii=False) + "\n")
            n += 1

    print(f"wrote {n} entries to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

If the language has features the Spanish extractor doesn't handle (different POS labels, unusual gender markers, etc.), override the relevant helpers — don't edit `kaikki_spanish.py`.

### 3. Register in `LANGUAGE_DEFAULTS`

Edit `pipeline/build_pack.py`, add an entry to the `LANGUAGE_DEFAULTS` dict:

```python
"it": {
    "language_name": "Italian",
    "target_language": "en",
    "source_url": "https://kaikki.org/dictionary/Italian/",
    "license": "CC-BY-SA-4.0",
    "attribution": "Italian dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0.",
},
```

### 4. Parse and build the pack

```powershell
python pipeline/sources/kaikki_italian.py pipeline/data/kaikki-italian.jsonl

python pipeline/build_pack.py `
    --input pipeline/build/italian.normalized.jsonl `
    --output packs/italian-en.db `
    --language it `
    --version 0.1.0
```

Expect 10-20 min for FTS5 indexes on a real dataset. Output is one `.db` file with everything inside.

### 5. Upload to the GitHub Release

```powershell
gh release upload packs-v1 packs/italian-en.db --clobber
```

`--clobber` overwrites if you're updating an existing pack version.

### 6. Compute SHA256 and add to manifest

```powershell
Get-FileHash packs/italian-en.db -Algorithm SHA256
```

Then edit `packs/manifest.json`:

```json
{
  "id": "italian-en",
  "name": "Italian",
  "source": "it",
  "target": "en",
  "version": "0.1.0",
  "size_bytes": 187654321,
  "entries": 425000,
  "download_url": "https://github.com/dalba0/lexil/releases/download/packs-v1/italian-en.db",
  "sha256": "ABC123...",
  "license": "CC-BY-SA-4.0",
  "attribution": "Italian dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0."
}
```

Commit and push:

```powershell
git add packs/manifest.json
git commit -m "packs: add Italian to manifest"
git push
```

That's it for distribution. Existing users will see Italian in **Settings → Packs** after they refresh.

### 7. UI registration (so it appears in the language switcher)

Three small edits in the frontend:

**`apps/desktop/src/lib/types.ts`** — add to the `Lang` and `SearchDirection` unions:

```ts
export type Lang = "es" | "en" | "fr" | "de" | "ja" | "it";
export type SearchDirection =
  | "es-en" | "en-es"
  | "fr-en" | "en-fr"
  | "de-en" | "en-de"
  | "ja-en" | "en-ja"
  | "it-en" | "en-it";
```

**`apps/desktop/src/lib/direction.ts`** — add cases in `packIdForDirection`, `sourceLangForPack`, and `LANG_LABEL`:

```ts
case "it-en":
case "en-it":
  return "italian-en";

// sourceLangForPack:
case "italian-en":
  return "it";

// LANG_LABEL:
it: "Italian",
```

**`apps/desktop/src/components/LangPopover.tsx`** — add Italian to the visible language list and `PACK_FOR`:

```ts
const PACK_FOR: Record<Exclude<Lang, "en">, string> = {
  es: "spanish-en",
  fr: "french-en",
  de: "german-en",
  ja: "japanese-en",
  it: "italian-en",
};
```

Rebuild and ship a new app version (the manifest-only changes are user-visible without an app update, but the language switcher needs the registration above to expose the pair).

---

## Conjugation rendering

The conjugation panel auto-renders if the source language is one of `es`, `fr`, `de`, `ja`. For a brand-new language family you'd need to add a config to `apps/desktop/src/components/Conjugations.tsx`.

### Token vocabulary in the inflection tags

Each pack stores forms with a space-separated tag string like `"1 ind pres s"`. The tokens are **order-independent** — the rendering code uses set-containment matching, not string-substring.

Common tokens you'll see across languages:

| Token | Means |
|---|---|
| `1` / `2` / `3` | Person |
| `s` / `p` | Number |
| `pres` / `pret` / `imperf` / `fut` / `cond` | Tense |
| `ind` / `sub` / `imp` | Mood |
| `ger` / `inf` / `part past` / `part pres` | Non-finite forms |
| `m` / `f` / `n` | Gender (nouns/adjectives) |
| `multiword-construction` | The form is a multi-word phrase (e.g. "bin gegangen") |
| `combined-form` | Pronoun-merged form (Spanish `vivámonos`) — usually filtered out |
| `formal` / `informal` | Register marker (Spanish tú vs. usted) |
| `negative` | Negative variant of a form |

Language-specific tokens to watch for:

- **German:** `subjunctive-i`, `subjunctive-ii`, `future-i`, `future-ii`, `perf`, `pluperf`, `multiword-construction`
- **Japanese:** `terminative`, `attributive`, `conjunctive`, `perfective`, `formal`, `polite`, `volitional`, `causative`, `passive`, `potential`, `hypothetical`, `imp`
- **French:** `historic` (passé simple), `multiword-construction` (used for compound tense descriptions, filtered out)

### How to add a new language's config

In `Conjugations.tsx`:

1. Decide if the language uses a person/number grid (most Indo-European) or a flat list (Japanese-style).
2. If grid: copy `ES_CONFIG` as a template. Define `persons`, then `tenses` with their `required` / `forbidden` token lists.
3. If flat: copy `JA_FORMS`. Each form has `required` / `forbidden`, and optional `preferSuffix` / `avoidSuffix` regexes to discriminate when multiple forms share the same tag.

Before going UI-deep, spelunk the actual tag distribution for the language:

```powershell
python -c "
import sqlite3
db = sqlite3.connect('packs/italian-en.db')
for tags, form in db.execute('''
    SELECT tags, form FROM inflections
    WHERE entry_id = (SELECT id FROM entries WHERE headword='parlare' AND pos='verb' LIMIT 1)
    ORDER BY tags
'''):
    print(f'{tags!r:60s} -> {form}')
"
```

Then write the config that matches what you see. The Conjugations component handles missing cells gracefully (renders `—`), so a partial config is better than no config.

---

## What the schema covers without modification

- Multiple etymologies per headword (separate `entries` rows).
- Verb conjugations, noun inflections, adjective agreement.
- Sense-level `register` (formal/vulgar/archaic) and `domain` (computing/biology/law).
- Examples with original-language and translation strings.
- Accent-insensitive forward search via FTS5 `unicode61 remove_diacritics 2`.
- Porter-stemmed reverse (English → source) search via the `senses_fts` index.

## What needs extra work

- A direct ES↔FR pack (the current model pivots every pair through English).
- Per-region usage labels (Mexican vs. Castilian Spanish, Brazilian vs. European Portuguese, etc.).
- Audio pronunciation references (kaikki has audio URLs but the parser strips them).
- Cross-references between entries ("see also").
- Right-to-left script support (Arabic, Hebrew) — would need CSS direction changes in the entry view.
