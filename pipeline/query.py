"""CLI smoke test for a built Lexil pack.

Usage:
    python pipeline/query.py <pack.db> <word>

Prints a human-readable card with senses, examples, a verb conjugation
summary (present + preterite indicative), and pack attribution. Falls back
to an inflected-form lookup so e.g. `corro` resolves to `correr`.

This is intentionally not the app's renderer — it's just enough to verify
the pack contains what we expect end-to-end.
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from normalize import normalize


# Spanish conjugation table layout: (display label, person+number key).
# Keys match the compact tag scheme emitted by sources/kaikki_spanish.py.
_PERSONS = (
    ("yo",       "1 s"),
    ("tú",       "2 s"),
    ("él/ella",  "3 s"),
    ("nosotros", "1 p"),
    ("vosotros", "2 p"),
    ("ellos/as", "3 p"),
)

_TENSE_BLOCKS = (
    ("Present indicative",  "pres ind"),
    ("Preterite indicative", "pret ind"),
)

_NONFINITE = (
    ("infinitive", "inf"),
    ("gerund",     "ger"),
    ("participle", "part past"),
)


def find_entries(con: sqlite3.Connection, query: str) -> tuple[list[sqlite3.Row], str | None]:
    """Return (entries, matched_form_if_inflection).

    Strategy:
      1. Exact match on normalized headword → return those, matched_form=None.
      2. Else look up the form in `inflections`, return the lemma entries,
         matched_form=<original query> so the renderer can show a "form of"
         badge.
    """
    q_norm = normalize(query)

    rows = con.execute(
        "SELECT * FROM entries WHERE headword_normalized = ? ORDER BY id",
        (q_norm,),
    ).fetchall()
    if rows:
        return rows, None

    rows = con.execute(
        """SELECT e.* FROM entries e
           JOIN inflections i ON i.entry_id = e.id
           WHERE i.form_normalized = ?
           ORDER BY e.id""",
        (q_norm,),
    ).fetchall()
    return rows, (query if rows else None)


def _render_header(entry: sqlite3.Row) -> list[str]:
    badges = []
    if entry["ipa"]:
        badges.append(entry["ipa"])
    if entry["pos"]:
        badges.append(entry["pos"])
    if entry["gender"]:
        badges.append(entry["gender"])
    line = entry["headword"]
    if badges:
        line += "  " + "  ".join(badges)
    return [line, "=" * max(40, len(line))]


def _render_senses(con: sqlite3.Connection, entry_id: int) -> list[str]:
    out: list[str] = []
    senses = con.execute(
        "SELECT * FROM senses WHERE entry_id = ? ORDER BY sense_number",
        (entry_id,),
    ).fetchall()
    for s in senses:
        meta = [t for t in (s["register"], s["domain"]) if t]
        meta_str = f"  ({', '.join(meta)})" if meta else ""
        out.append(f"{s['sense_number']}. {s['definition']}{meta_str}")
        examples = con.execute(
            "SELECT * FROM examples WHERE sense_id = ?",
            (s["id"],),
        ).fetchall()
        for ex in examples:
            tail = f' — {ex["translation"]}' if ex["translation"] else ""
            out.append(f'   • "{ex["text"]}"{tail}')
        out.append("")
    return out


def _render_conjugations(con: sqlite3.Connection, entry_id: int) -> list[str]:
    rows = con.execute(
        "SELECT form, tags FROM inflections WHERE entry_id = ?",
        (entry_id,),
    ).fetchall()
    by_tag: dict[str, str] = {r["tags"]: r["form"] for r in rows}

    out: list[str] = []
    for label, tense_key in _TENSE_BLOCKS:
        block = [label]
        for i in range(3):
            sing_label, sing_key = _PERSONS[i]
            plur_label, plur_key = _PERSONS[i + 3]
            sing_form = by_tag.get(f"{sing_key} {tense_key}", "—")
            plur_form = by_tag.get(f"{plur_key} {tense_key}", "—")
            block.append(f"  {sing_label:<10}{sing_form:<14}  {plur_label:<10}{plur_form}")
        out.extend(block)
        out.append("")

    nonfinite_lines: list[str] = []
    for label, tag in _NONFINITE:
        form = by_tag.get(tag)
        if form:
            nonfinite_lines.append(f"  {label:<11}{form}")
    if nonfinite_lines:
        out.append("Non-finite")
        out.extend(nonfinite_lines)
        out.append("")
    return out


def render_entry(con: sqlite3.Connection, entry: sqlite3.Row, matched_form: str | None) -> str:
    lines = _render_header(entry)
    if matched_form and normalize(matched_form) != entry["headword_normalized"]:
        lines.append(f"(form of {entry['headword']}: {matched_form})")
    lines.append("")
    lines.extend(_render_senses(con, entry["id"]))
    if entry["pos"] == "verb":
        lines.extend(_render_conjugations(con, entry["id"]))
    return "\n".join(lines).rstrip()


def main() -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
    except (AttributeError, OSError):
        pass

    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("db", type=Path, help="pack .db built by build_pack.py")
    p.add_argument("query", help="headword or inflected form to look up")
    args = p.parse_args()

    if not args.db.exists():
        print(f"error: db not found: {args.db}", file=sys.stderr)
        return 2

    con = sqlite3.connect(args.db)
    con.row_factory = sqlite3.Row
    try:
        entries, matched_form = find_entries(con, args.query)
        if not entries:
            print(f"no entry for {args.query!r}", file=sys.stderr)
            return 1

        for i, entry in enumerate(entries):
            if i > 0:
                print("\n")
            print(render_entry(con, entry, matched_form))

        row = con.execute(
            "SELECT value FROM pack_meta WHERE key = 'attribution'"
        ).fetchone()
        if row and row["value"]:
            print(f"\n— {row['value']}")
    finally:
        con.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
