"""Extract Spanish entries from a kaikki.org Wiktionary dump.

Input: a .jsonl or .jsonl.gz file from https://kaikki.org/dictionary/Spanish/
       (the "Spanish entries from English Wiktionary" extract).
Output: a normalized JSONL file at pipeline/build/spanish.normalized.jsonl
        with one entry per line, ready to be loaded into the schema by
        build_pack.py.

Each output entry has the shape:
    {
        "headword": "correr",
        "pos": "verb",
        "gender": null,
        "ipa": "/koˈreɾ/",
        "senses": [
            {
                "sense_number": 1,
                "definition": "to run (move quickly on foot)",
                "register": null,
                "domain": null,
                "examples": [
                    {"text": "Corro todos los días.", "translation": "I run every day."}
                ]
            }
        ],
        "inflections": [
            {"form": "corro", "tags": "1 s pres ind"},
            ...
        ]
    }
"""
from __future__ import annotations

import argparse
import gzip
import json
import re
import sys
from pathlib import Path
from typing import IO, Iterable, Iterator

# --- Wiki-markup cleanup ----------------------------------------------------
# kaikki glosses sometimes leak unexpanded templates ({{...}}), wikilinks
# ([[target|label]] or [[target]]), and HTML tags. We strip these before
# the gloss reaches the user.
_WIKI_LINK = re.compile(r"\[\[(?:[^|\]]+\|)?([^\]]+)\]\]")
_WIKI_TEMPLATE = re.compile(r"\{\{[^{}]*\}\}")
_HTML_TAG = re.compile(r"<[^>]+>")
_MULTI_SPACE = re.compile(r"\s+")


def _strip_wiki(text: str) -> str:
    if not text:
        return ""
    text = _WIKI_LINK.sub(r"\1", text)
    # Templates can nest; sub until stable (cheap because they're rare).
    prev = None
    while prev != text:
        prev = text
        text = _WIKI_TEMPLATE.sub("", text)
    text = _HTML_TAG.sub("", text)
    return _MULTI_SPACE.sub(" ", text).strip()


# --- Tag compaction ---------------------------------------------------------
# Wiktionary inflection tags are verbose: ["first-person", "singular",
# "present", "indicative"]. We compact to "1 s pres ind" so the inflections
# table stays small. The app expands these back for display.
_TAG_MAP: dict[str, str] = {
    "first-person": "1",
    "second-person": "2",
    "third-person": "3",
    "singular": "s",
    "plural": "p",
    "present": "pres",
    "preterite": "pret",
    "imperfect": "imperf",
    "future": "fut",
    "conditional": "cond",
    "subjunctive": "sub",
    "indicative": "ind",
    "imperative": "imp",
    "infinitive": "inf",
    "participle": "part",
    "gerund": "ger",
    "past": "past",
    "masculine": "m",
    "feminine": "f",
    "tu-form": "tu",
    "vos-form": "vos",
    "usted-form": "ud",
    "ustedes-form": "uds",
    "vosotros-form": "vosotros",
    "nosotros-form": "nosotros",
    "ellos-form": "ellos",
    "yo-form": "yo",
    "perfect": "perf",
    "pluperfect": "pluperf",
}


def _compact_tags(tags: Iterable[str]) -> str:
    return " ".join(_TAG_MAP.get(t, t) for t in tags)


# Tag values we recognize as register markers (vs. domain or inflection tags).
_REGISTER_TAGS = frozenset({
    "formal", "informal", "vulgar", "slang", "colloquial",
    "archaic", "literary", "poetic", "dated", "obsolete", "rare",
    "humorous", "derogatory", "pejorative", "euphemistic",
})

# POS values we don't ship: not useful for a learner-facing dictionary.
_SKIP_POS = frozenset({"character", "punct", "phrase_template"})


# --- Field extractors -------------------------------------------------------
def _extract_gender(entry: dict) -> str | None:
    """Resolve grammatical gender for nouns.

    kaikki's noun entries don't list the canonical form in `forms`, so the
    most reliable signals (in order) are: category names like 'Spanish
    masculine nouns', then the es-noun head template's first positional
    argument, then any form explicitly tagged with a gender.
    """
    if entry.get("pos") != "noun":
        return None

    for cat in entry.get("categories", []):
        name = cat.get("name", "") if isinstance(cat, dict) else str(cat)
        low = name.lower()
        if "masculine and feminine" in low:
            return "mf"
        if "masculine nouns" in low:
            return "m"
        if "feminine nouns" in low:
            return "f"
        if "neuter nouns" in low:
            return "n"

    for tmpl in entry.get("head_templates", []):
        args = tmpl.get("args", {}) or {}
        g = args.get("1") or args.get("g")
        if g in {"m", "f", "n"}:
            return g
        if g in {"mf", "m-f", "m or f"}:
            return "mf"

    for form in entry.get("forms", []):
        tags = set(form.get("tags") or [])
        if "masculine" in tags and "feminine" in tags:
            return "mf"
        if "masculine" in tags:
            return "m"
        if "feminine" in tags:
            return "f"
    return None


def _extract_ipa(entry: dict) -> str | None:
    for sound in entry.get("sounds", []):
        ipa = sound.get("ipa")
        if ipa:
            return ipa
    return None


def _extract_senses(entry: dict) -> list[dict]:
    out: list[dict] = []
    for i, sense in enumerate(entry.get("senses", []), start=1):
        glosses = sense.get("glosses") or sense.get("raw_glosses") or []
        if not glosses:
            continue
        # The last gloss is the most specific in kaikki's nested format.
        definition = _strip_wiki(glosses[-1])
        if not definition:
            continue

        sense_tags = sense.get("tags", []) or []
        register = next((t for t in sense_tags if t in _REGISTER_TAGS), None)
        topics = sense.get("topics", []) or []
        domain = topics[0] if topics else None

        examples = []
        for ex in sense.get("examples", []) or []:
            text = (ex.get("text") or "").strip()
            if not text:
                continue
            translation = (ex.get("english") or "").strip() or None
            examples.append({"text": text, "translation": translation})

        out.append({
            "sense_number": i,
            "definition": definition,
            "register": register,
            "domain": domain,
            "examples": examples,
        })
    return out


def _extract_inflections(entry: dict) -> list[dict]:
    out: list[dict] = []
    word = entry.get("word")
    seen: set[tuple[str, str]] = set()
    for form in entry.get("forms", []):
        form_str = (form.get("form") or "").strip()
        if not form_str or form_str == word or form_str == "-":
            continue
        tags = form.get("tags") or []
        if not tags:
            continue
        compact = _compact_tags(tags)
        key = (form_str, compact)
        if key in seen:
            continue
        seen.add(key)
        out.append({"form": form_str, "tags": compact})
    return out


def parse_entry(entry: dict) -> dict | None:
    """Convert one raw kaikki entry to Lexil's intermediate shape.

    Returns None if the entry should be dropped (redirects, junk POS, no senses).
    """
    word = entry.get("word")
    if not word or "redirect" in entry:
        return None
    pos = entry.get("pos")
    if not pos or pos in _SKIP_POS:
        return None
    senses = _extract_senses(entry)
    if not senses:
        return None
    return {
        "headword": word,
        "pos": pos,
        "gender": _extract_gender(entry),
        "ipa": _extract_ipa(entry),
        "senses": senses,
        "inflections": _extract_inflections(entry),
    }


# --- I/O --------------------------------------------------------------------
def _open_jsonl(path: Path) -> IO[str]:
    if path.suffix == ".gz":
        return gzip.open(path, "rt", encoding="utf-8")
    return path.open("r", encoding="utf-8")


def parse_file(path: Path, limit: int | None = None) -> Iterator[dict]:
    """Stream a kaikki .jsonl(.gz) and yield parsed entries one by one."""
    yielded = 0
    with _open_jsonl(path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                raw = json.loads(line)
            except json.JSONDecodeError:
                # Corrupt lines do occur in big dumps; skip rather than fail.
                continue
            parsed = parse_entry(raw)
            if parsed is None:
                continue
            yield parsed
            yielded += 1
            if limit is not None and yielded >= limit:
                return


def main() -> int:
    # Windows consoles default to cp1252, which can't print IPA. Force UTF-8.
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("input", type=Path, help="kaikki Spanish .jsonl or .jsonl.gz")
    p.add_argument(
        "-o", "--output",
        type=Path,
        default=Path("pipeline/build/spanish.normalized.jsonl"),
        help="output JSONL path",
    )
    p.add_argument("--limit", type=int, default=None, help="stop after N entries")
    p.add_argument("--preview", type=int, default=0,
                   help="also print the first N entries to stdout for inspection")
    args = p.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 2

    args.output.parent.mkdir(parents=True, exist_ok=True)

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
