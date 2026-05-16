"""Build a Lexil dictionary pack (.db) from a normalized JSONL.

Reads `pipeline/build/<lang>.normalized.jsonl` (produced by `sources/<lang>.py`),
applies `pipeline/schema.sql`, populates the tables, fills `pack_meta`, rebuilds
the FTS5 index, and writes `<output>.db`.

build_pack.py is language-agnostic. Per-language metadata (display name,
source URL, license, attribution) is passed in via flags. A small built-in
defaults map carries the values we already know for languages we've added
support for.
"""
from __future__ import annotations

import argparse
import json
import sqlite3
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize import normalize

# Per-language pack_meta defaults. Override any field via CLI flags.
# When you add a new language pack, append its defaults here.
LANGUAGE_DEFAULTS: dict[str, dict[str, str]] = {
    "es": {
        "language_name": "Spanish",
        "target_language": "en",
        "source_url": "https://kaikki.org/dictionary/Spanish/",
        "license": "CC-BY-SA-4.0",
        "attribution": (
            "Spanish dictionary data adapted from English Wiktionary contributors, "
            "via kaikki.org. Licensed under CC-BY-SA 4.0."
        ),
    },
    "fr": {
        "language_name": "French",
        "target_language": "en",
        "source_url": "https://kaikki.org/dictionary/French/",
        "license": "CC-BY-SA-4.0",
        "attribution": (
            "French dictionary data adapted from English Wiktionary contributors, "
            "via kaikki.org. Licensed under CC-BY-SA 4.0."
        ),
    },
}


def _insert_entry(con: sqlite3.Connection, entry: dict) -> tuple[int, int, int, int]:
    cur = con.execute(
        "INSERT INTO entries (headword, headword_normalized, pos, gender, ipa, frequency) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (
            entry["headword"],
            normalize(entry["headword"]),
            entry.get("pos"),
            entry.get("gender"),
            entry.get("ipa"),
            entry.get("frequency"),
        ),
    )
    entry_id = cur.lastrowid

    n_senses = n_examples = 0
    for sense in entry.get("senses", []):
        cur = con.execute(
            "INSERT INTO senses (entry_id, sense_number, definition, translation_en, register, domain) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                entry_id,
                sense["sense_number"],
                sense["definition"],
                sense.get("translation_en"),
                sense.get("register"),
                sense.get("domain"),
            ),
        )
        sense_id = cur.lastrowid
        n_senses += 1

        for ex in sense.get("examples", []):
            con.execute(
                "INSERT INTO examples (sense_id, text, translation) VALUES (?, ?, ?)",
                (sense_id, ex["text"], ex.get("translation")),
            )
            n_examples += 1

    n_inflections = 0
    for infl in entry.get("inflections", []):
        con.execute(
            "INSERT INTO inflections (entry_id, form, form_normalized, tags) "
            "VALUES (?, ?, ?, ?)",
            (entry_id, infl["form"], normalize(infl["form"]), infl["tags"]),
        )
        n_inflections += 1

    return entry_id, n_senses, n_examples, n_inflections


def build(
    input_path: Path,
    output_path: Path,
    schema_path: Path,
    meta: dict[str, str],
    limit: int | None = None,
) -> dict[str, int]:
    if output_path.exists():
        output_path.unlink()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    con = sqlite3.connect(output_path)
    try:
        con.executescript(schema_path.read_text(encoding="utf-8"))
        con.execute("PRAGMA foreign_keys = ON")

        # Batch inserts under a single transaction — the implicit txn from
        # connect() is committed once at the end. For 600k entries this is
        # roughly 30x faster than autocommit.
        totals = {"entries": 0, "senses": 0, "examples": 0, "inflections": 0}
        with input_path.open("r", encoding="utf-8") as f:
            for line in f:
                if limit is not None and totals["entries"] >= limit:
                    break
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                _, ns, nx, ni = _insert_entry(con, entry)
                totals["entries"] += 1
                totals["senses"] += ns
                totals["examples"] += nx
                totals["inflections"] += ni

        meta_full = {
            **meta,
            "entry_count": str(totals["entries"]),
            "built_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }
        for k, v in meta_full.items():
            con.execute(
                "INSERT INTO pack_meta (key, value) VALUES (?, ?)",
                (k, v),
            )

        # FTS5 external-content tables need an explicit rebuild after bulk
        # load: one for the Spanish headword index, one for the English
        # definition index used by reverse lookup.
        con.execute("INSERT INTO entries_fts(entries_fts) VALUES('rebuild')")
        con.execute("INSERT INTO senses_fts(senses_fts) VALUES('rebuild')")
        con.commit()
    finally:
        con.close()

    return totals


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--input", type=Path, required=True, help="normalized JSONL")
    p.add_argument("--output", type=Path, required=True, help="output .db path")
    p.add_argument(
        "--schema",
        type=Path,
        default=Path(__file__).resolve().parent / "schema.sql",
    )
    p.add_argument("--language", required=True, help="ISO source language code, e.g. 'es'")
    p.add_argument("--language-name", help="Display name; defaults from LANGUAGE_DEFAULTS")
    p.add_argument("--target-language", help="ISO target language code, e.g. 'en'")
    p.add_argument("--version", default="0.1.0")
    p.add_argument("--source-url")
    p.add_argument("--license")
    p.add_argument("--attribution")
    p.add_argument("--limit", type=int, default=None,
                   help="cap the number of entries built (for fast iteration)")
    args = p.parse_args()

    if not args.input.exists():
        print(f"error: input not found: {args.input}", file=sys.stderr)
        return 2
    if not args.schema.exists():
        print(f"error: schema not found: {args.schema}", file=sys.stderr)
        return 2

    defaults = LANGUAGE_DEFAULTS.get(args.language, {})
    meta = {
        "language_code": args.language,
        "language_name": args.language_name or defaults.get("language_name", args.language),
        "source_language": args.language,
        "target_language": args.target_language or defaults.get("target_language", "en"),
        "version": args.version,
        "source_url": args.source_url or defaults.get("source_url", ""),
        "license": args.license or defaults.get("license", ""),
        "attribution": args.attribution or defaults.get("attribution", ""),
    }

    stats = build(args.input, args.output, args.schema, meta, limit=args.limit)

    print(f"Built {args.output}")
    print(f"  entries:     {stats['entries']:>8}")
    print(f"  senses:      {stats['senses']:>8}")
    print(f"  examples:    {stats['examples']:>8}")
    print(f"  inflections: {stats['inflections']:>8}")
    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"  size:        {size_mb:>7.2f} MB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
