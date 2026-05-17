"""Extract German entries from a kaikki.org Wiktionary dump.

Input: a .jsonl or .jsonl.gz from
       https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl
Output: pipeline/build/german.normalized.jsonl

Reuses the language-agnostic extractor from kaikki_spanish.py. The
substring category matching ("masculine nouns", "feminine nouns",
"neuter nouns") and head_templates gender args cover German without
modifications. de-noun's first positional arg holds the gender (m/f/n)
which the shared `_extract_gender` already checks.

Known German-specific things that may surface later but aren't in scope yet:
  - Compound noun decomposition (Donaudampfschiffahrtsgesellschaftskapitän)
  - Verb separable-prefix tagging
  - Cases (nominative/accusative/dative/genitive) — kaikki tags them but
    our TAG_MAP currently doesn't shorten them; they'll appear in the
    compact tag string verbatim.
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
    p.add_argument("input", type=Path, help="kaikki German .jsonl or .jsonl.gz")
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("pipeline/build/german.normalized.jsonl"),
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
