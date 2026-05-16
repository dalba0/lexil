# Design

## Aesthetic

Editorial, calm, literary. The reference frame is a well-designed e-reader
crossed with Linear — a tool that a translator or a novelist would keep open
all day. Specifically **not**: bright gradients, glassmorphism, heavy
floating cards, emoji-decorated UI, generic dashboard chrome.

## Themes

Two themes — both required. Switched via `<html data-theme="paper|ink">`.

### Paper (default, light)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#FBFAF7` | Page background — warm off-white, like aged paper |
| `--surface` | `#FFFFFF` | Cards, panels, modal interiors |
| `--border` | `#E8E4DC` | All separators and outlines (1px hairline) |
| `--ink` | `#1A1816` | Primary text |
| `--muted` | `#6B6660` | Secondary text |
| `--faint` | `#9C968D` | Tertiary text, placeholders, captions |
| `--accent` | `#8B4513` | The single restrained warm brown — links, focus, selected states, caret |
| `--highlight` | `#FFF3B8` | Native selection background and example-match highlight |

### Ink (dark)

| Token | Hex | Usage |
|---|---|---|
| `--bg` | `#16161A` | |
| `--surface` | `#1E1E22` | |
| `--border` | `#2A2A30` | |
| `--ink` | `#F0EDE6` | |
| `--muted` | `#A8A39B` | |
| `--faint` | `#6B6660` | |
| `--accent` | `#D4A574` | Warm tan — *not* a saturated blue |
| `--highlight` | `#3D3520` | |

The token names are deliberately neutral (semantic, not literal) so a future
sepia or high-contrast theme can fill the same slots.

## Typography

- **UI / body:** Inter (variable font, weights 400/500/600). System fallback.
- **Headwords / display:** Source Serif 4 (variable, weights 400/600).
- **Phonetic (IPA):** JetBrains Mono.

The browser falls back gracefully when the fonts aren't installed — Inter →
system sans, Source Serif 4 → Georgia, JetBrains Mono → SF Mono / Cascadia
Code. For shipping, bundle the fonts as Tauri resources or load via local
WOFF2 in `public/`.

### Type scale

Encoded as Tailwind tokens — do not invent new sizes inline.

| Token | px | line | family | weight | Used by |
|---|---|---|---|---|---|
| `display` | 48 | 56 | serif | 400 | Detail-view headword |
| `h1` | 28 | 36 | serif | 600 | (reserved) |
| `h2` | 20 | 28 | sans | 600 | (reserved) |
| `body` | 15 | 24 | sans | 400 | Default text |
| `body-sm` | 13 | 20 | sans | 400 | Captions, meta lines |
| `caption` | 12 | 16 | sans | 500, +0.06em, UPPER | Section headers ("Conjugations") |
| `mono` | 14 | 20 | mono | 400 | IPA strings |

## Spacing

4-px base unit. Allowed spacing values: `4, 8, 12, 16, 24, 32, 48, 64`.

## Layout

- Sidebar (desktop): fixed `280px` left column.
- Detail content: centered, `max-width: 720px`.
- Borders: `1px solid var(--border)`. **Never** drop shadow on cards — use
  a hairline border instead. Modals get a subtle backdrop blur and that's
  the only "depth" effect in the app.

## Radii

| Token | px |
|---|---|
| `--radius-input` | 6 |
| `--radius-card` | 8 |
| `--radius-tag` | 4 |

Never pill (fully rounded). Tags use a 4-px radius and an outlined chip
style — not a filled pill.

## Motion

Subtle, fast, never bouncy.

| Token | Duration | Easing | Where |
|---|---|---|---|
| Entrance | 150 ms | `cubic-bezier(0.16, 1, 0.3, 1)` | Detail card mount |
| Hover | 100 ms | linear | Color transitions on buttons / list rows |

Explicit *no-list*: no spring animations, no skeleton shimmer (use a single
muted line of text instead), no page-flip effects.

## Iconography

Lucide React, stroke-width 1.5, size 16 or 20. Never decorative.

## Empty states

A single line of muted text, centered. No illustrations, no oversized icons.
The empty-search state ("Type a word to begin.") is intentionally
unmemorable — the search input is the empty state.
