"""Unicode normalization shared by the pipeline and the app's search layer.

Both `headword_normalized` (stored on every entry) and runtime query strings
must go through the same function — otherwise the index and the query won't
agree on what 'cafe' vs 'café' mean.
"""
from __future__ import annotations

import unicodedata


def normalize(s: str) -> str:
    """Lowercase, strip combining marks, NFC-recompose.

    NFD splits 'é' into 'e' + combining acute; we drop the combining mark
    and recompose so the result is a clean, accentless lowercase string.
    """
    if not s:
        return ""
    decomposed = unicodedata.normalize("NFD", s)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return unicodedata.normalize("NFC", stripped).lower().strip()


if __name__ == "__main__":
    import sys
    for arg in sys.argv[1:]:
        print(f"{arg!r} -> {normalize(arg)!r}")
