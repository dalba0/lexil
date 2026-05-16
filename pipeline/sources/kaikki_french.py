"""Extract French entries from a kaikki.org Wiktionary dump.

Input: a .jsonl or .jsonl.gz file from
       https://kaikki.org/dictionary/French/kaikki.org-dictionary-French.jsonl
       (the "French entries from English Wiktionary" extract).
Output: a normalized JSONL file at pipeline/build/french.normalized.jsonl
        in the same shape produced by kaikki_spanish.py, ready to be
        loaded into the schema by build_pack.py.

The extraction logic is shared with the Spanish extractor — the substring
category matching ("masculine nouns", "feminine nouns") and head_templates
gender args already cover French (fr-noun uses both "1" positional and
"g=" keyword args, both of which we check). If French-specific tags or
gotchas emerge later, override the relevant helpers in
kaikki_spanish.py's module here.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Reuse the language-agnostic extractor from kaikki_spanish. We invoke its
# parse_file() directly rather than re-implementing.
_HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(_HERE))
from kaikki_spanish import parse_file  # noqa: E402


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("input", type=Path, help="kaikki French .jsonl or .jsonl.gz")
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("pipeline/build/french.normalized.jsonl"),
        help="output JSONL path",
    )
    p.add_argument("--limit", type=int, default=None, help="stop after N entries")
    p.add_argument(
        "--preview", type=int, default=0,
        help="also print the first N entries to stdout for inspection",
    )
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
