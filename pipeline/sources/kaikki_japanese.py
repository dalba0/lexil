"""Extract Japanese entries from a kaikki.org Wiktionary dump.

Input: a .jsonl or .jsonl.gz from
       https://kaikki.org/dictionary/Japanese/kaikki.org-dictionary-Japanese.jsonl
Output: pipeline/build/japanese.normalized.jsonl

Uses the shared kaikki extraction logic. Japanese-specific caveats:
  - Headwords are kanji/kana/mixed (e.g., 走る, ひらがな, ある). The schema's
    headword_normalized column gets NFD/lowercase/strip-combining applied —
    for kanji/kana this is largely a no-op, so searches by exact glyph work.
  - Romaji is not extracted as a separate field; if Wiktionary attaches a
    romaji "form" with appropriate tags, it lands in the inflections table
    and is searchable via form_normalized.
  - Inflection tags include Japanese-specific labels (te-form, polite,
    causative, passive, etc.) that aren't in TAG_MAP and so pass through
    verbatim into the compact tag string. The frontend Conjugations
    component currently only knows Romance tenses, so those rows won't
    render — the data is in the DB and queryable, just not rendered.
"""
from __future__ import annotations

import argparse
import sys
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
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("pipeline/build/japanese.normalized.jsonl"),
    )
    p.add_argument("--limit", type=int, default=None)
    p.add_argument("--preview", type=int, default=0)
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
            if n < args.preview:
                print(json.dumps(entry, ensure_ascii=False, indent=2))
                print("---")
            n += 1

    print(f"wrote {n} entries to {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
