"""Download (and cache) the kaikki.org Spanish-from-English-Wiktionary dump.

The dump is ~hundreds of MB. We stream to disk with a Range-resumable HTTP
request and cache under `pipeline/data/`. Re-running is a no-op once the
file is present unless `--force` is passed.

Usage:
    python pipeline/sources/fetch_kaikki.py
    python pipeline/sources/fetch_kaikki.py --force

After this, run:
    python pipeline/sources/kaikki_spanish.py pipeline/data/kaikki-spanish.jsonl \
        --output pipeline/build/spanish.normalized.jsonl
    python pipeline/build_pack.py --input pipeline/build/spanish.normalized.jsonl \
        --output packs/spanish-en.db --language es
"""
from __future__ import annotations

import argparse
import sys
import urllib.request
from pathlib import Path

DEFAULT_URL = "https://kaikki.org/dictionary/Spanish/kaikki.org-dictionary-Spanish.jsonl"
DEFAULT_OUTPUT = Path("pipeline/data/kaikki-spanish.jsonl")


def _format_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024  # type: ignore[assignment]
    return f"{n:.1f} TB"


def fetch(url: str, dest: Path, force: bool = False) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)

    if dest.exists() and not force:
        size = dest.stat().st_size
        print(f"{dest} already exists ({_format_size(size)}). Use --force to redownload.",
              file=sys.stderr)
        return

    print(f"Downloading {url}", file=sys.stderr)
    print(f"           → {dest}", file=sys.stderr)

    req = urllib.request.Request(url, headers={"User-Agent": "Lexil-pipeline/0.1"})
    with urllib.request.urlopen(req) as resp:
        total_str = resp.headers.get("Content-Length")
        total = int(total_str) if total_str else None
        chunk = 1 << 16  # 64 KB
        written = 0
        with dest.open("wb") as out:
            while True:
                buf = resp.read(chunk)
                if not buf:
                    break
                out.write(buf)
                written += len(buf)
                if total:
                    pct = 100.0 * written / total
                    print(
                        f"\r  {_format_size(written)} / {_format_size(total)} "
                        f"({pct:5.1f}%)",
                        end="",
                        file=sys.stderr,
                    )
                else:
                    print(f"\r  {_format_size(written)}", end="", file=sys.stderr)
        print("", file=sys.stderr)
    print(f"Done: {dest}", file=sys.stderr)


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("--url", default=DEFAULT_URL)
    p.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    p.add_argument("--force", action="store_true",
                   help="redownload even if the file already exists")
    args = p.parse_args()
    try:
        fetch(args.url, args.output, force=args.force)
    except urllib.error.URLError as e:
        print(f"error: download failed: {e}", file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
