"""Generate placeholder PNG and ICO icons for the Tauri bundle.

These are stand-ins so `tauri dev` doesn't choke on missing icon paths.
Replace with real artwork before shipping by running:
    pnpm tauri icon path/to/source.png
"""
from __future__ import annotations

import struct
import sys
import zlib
from pathlib import Path

# Lexil monogram-ish: a "paper" beige background with a single "L" stroke.
# The "drawing" is just a few solid rectangles — readable in a taskbar but
# obviously a placeholder.

BG = (251, 250, 247, 255)      # #FBFAF7
INK = (26, 24, 22, 255)        # #1A1816
ACCENT = (139, 69, 19, 255)    # #8B4513


def make_rgba(size: int) -> bytes:
    """Return a `size`x`size` RGBA byte buffer drawing the placeholder mark."""
    pixels = bytearray()
    margin = size // 6
    stroke = max(2, size // 12)
    base = size - margin            # baseline y of the L
    top = margin                    # top y of the L
    left = margin                   # left x of the L
    right = left + size // 3        # right edge of the L's horizontal foot

    for y in range(size):
        row = bytearray()
        for x in range(size):
            in_vertical = (left <= x < left + stroke) and (top <= y < base)
            in_foot = (top <= y < base) and (left <= x < right) and (base - stroke <= y < base)
            in_dot = (
                (size - margin - stroke - 1) <= x < (size - margin)
                and (top - 1) <= y < (top + stroke)
            )
            if in_dot:
                color = ACCENT
            elif in_vertical or in_foot:
                color = INK
            else:
                color = BG
            row.extend(color)
        pixels.extend(row)
    return bytes(pixels)


def png_chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data))
    )


def encode_png(size: int, rgba: bytes) -> bytes:
    # PNG with filter type 0 (None) on each row.
    raw = bytearray()
    stride = size * 4
    for y in range(size):
        raw.append(0)
        raw.extend(rgba[y * stride : (y + 1) * stride])
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + png_chunk(b"IHDR", ihdr)
        + png_chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + png_chunk(b"IEND", b"")
    )


def write_png(path: Path, size: int) -> None:
    path.write_bytes(encode_png(size, make_rgba(size)))


def write_ico(path: Path, sizes: list[int]) -> None:
    """Write a Windows ICO containing PNG-encoded images at each size."""
    pngs = [(s, encode_png(s, make_rgba(s))) for s in sizes]

    header = struct.pack("<HHH", 0, 1, len(pngs))
    offset = 6 + 16 * len(pngs)
    entries = bytearray()
    data = bytearray()
    for s, png in pngs:
        w = 0 if s >= 256 else s
        h = 0 if s >= 256 else s
        entries.extend(
            struct.pack(
                "<BBBBHHII",
                w,                # width  (0 means 256)
                h,                # height (0 means 256)
                0,                # color palette
                0,                # reserved
                1,                # color planes
                32,               # bits per pixel
                len(png),         # image size
                offset,           # image offset
            )
        )
        data.extend(png)
        offset += len(png)

    path.write_bytes(bytes(header) + bytes(entries) + bytes(data))


def main() -> int:
    out = Path(__file__).parent
    write_png(out / "32x32.png", 32)
    write_png(out / "128x128.png", 128)
    write_png(out / "128x128@2x.png", 256)
    write_ico(out / "icon.ico", [32, 64, 128, 256])
    print(f"wrote 4 icon files to {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
