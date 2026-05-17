# Changelog

All notable changes to Lexil. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] — 2026-05-17

**Conjugation rendering fix — every verb now shows a complete paradigm.**

### Fixed
- **Conjugations panel was rendering almost nothing.** The old tag matcher used exact-string lookup like `"1 s pres ind"`, but Wiktionary tag tokens come out in arbitrary order (`"1 ind pres s"`, `"ind pres s 1"`, `"1 pres s"`, etc.). Most cells silently missed. Replaced with token-set matching: tokenize the stored tag into a `Set`, match when required tokens are all present and forbidden tokens are all absent. Order-independent, catches every permutation.
- **Spanish:** all 10 tenses × 6 persons now render — present, preterite, imperfect, future, conditional, present subjunctive, both imperfect subjunctives (-ra and -se), future subjunctive, affirmative and negative imperatives.
- **French:** présent, imparfait, passé simple, futur, conditionnel, subjonctif présent + imparfait, impératif.
- **German:** Präsens, Präteritum, **Perfekt** (`bin gegangen`…), **Plusquamperfekt**, **Futur I/II**, Konjunktiv I/II, Imperativ. `wir`/`sie/Sie` cells in Präsens fall back to the infinitive when Wiktionary omits the rows (which it does for every regular verb).
- **Japanese:** brand-new panel where previously there was nothing. Renders plain present/past/negative, te-form, polite (-masu/-mashita/-masen), volitional, imperative + polite imperative, causative, passive, potential, conditional. Per-form suffix preferences pick the modern surface form (`作りました` for polite past, `作れば` for modern -eba, `作らせる` over colloquial `作らす`, etc.). Plain present falls back to the kanji headword since Wiktionary's `terminative` tag rarely carries kanji.
- **IPA pronunciations** (`paʁl`) filtered out across all languages — they were leaking through as inflection rows.

### Notes
- No pack re-download required. All forms were already in the DB; this was a pure UI fix.
- Verified across `vivir`, `parler`, `gehen`, `作る`, `食べる`, `行く`, `話す` — every cell renders the correct surface form.

[GitHub release](https://github.com/dalba0/lexil/releases/tag/v0.2.1)

---

## [0.2.0] — 2026-05-17

**Multi-language packs, on-demand downloads, lists, tags-as-filter.**

### Added
- **On-demand pack downloads.** No language is bundled with the installer (now ~30 MB instead of ~340 MB). On first launch a picker shows what's available; you choose what to install. Settings → Packs lets you add or remove packs later.
- **Pack manifest** at `packs/manifest.json`, served from `raw.githubusercontent.com`. Pack `.db` files live on the `packs-v1` GitHub Release as a static CDN.
- **SHA256 verification** on every pack download. Streams to a `.part` file, hashes as it writes, only renames on match.
- **French, German, Japanese packs** alongside Spanish — all four available to download.
- **Custom Lists** — create curated word lists like "Travel words" or "Verbs to drill" with a glyph picker (★ ¶ § † ◆ ◇ ✦ ✧ ♢ ♦ ✶ ✱) and color. Add words from any entry via the `+` icon next to the star.
- **Tags as a sidebar section** — click any tag to view every word carrying it.
- **Windows shortcut labels** — every keyboard hint now shows `Ctrl` instead of `⌘`.
- **Clickable Lexil brand mark** — top-left brand now navigates back to the home view.

### Changed
- **User DB schema** namespaced by `pack_id` everywhere (recents, favorites, tags, entry_tags, notes, lists, list_entries). Spanish favorites don't leak into French.
- **Packs directory** is now `%AppData%\Lexil\packs\` (survives uninstall instead of getting wiped when the installer overwrites the program folder).

### Fixed
- Added `From<tauri::Error>` to `AppError` so `pack_manager.rs` could use `?` on `app.path().app_data_dir()`.
- CI: bumped Node to 22, pnpm to 11, forced `x86_64-pc-windows-msvc` toolchain on Windows runners.

[GitHub release](https://github.com/dalba0/lexil/releases/tag/v0.2.0)

---

## [0.1.1] — 2026-05-16

**Onboarding, tags, notes, sessions, full-page Settings.**

### Added
- **Onboarding flow** — Welcome → Pack picker → Theme → First word — runs on first launch and never again.
- **Tag chips on entries** with a curated palette (rose, amber, olive, sage, teal, slate, plum) and autocomplete from your existing tags.
- **Notes section** below the senses on any entry. Markdown-lite, persists between sessions.
- **Recent sessions** grouped by 30-minute windows in the sidebar — see what you were looking at across yesterday morning vs. last night.
- **Full-page Settings** view (replaces the modal). Pack info, tag manager, About with credit ("Designed and built by Albab Dewan · 2026").
- **Word of the day** pinned at the top of the sidebar.

[GitHub release](https://github.com/dalba0/lexil/releases/tag/v0.1.1)

---

## [0.1.0] — 2026-05-15

**Initial Spanish-only release.**

### Added
- **Tauri 2 desktop app** for Windows. React + TypeScript + Tailwind + shadcn/ui frontend, Rust + rusqlite backend.
- **Spanish ↔ English dictionary** — 801k Spanish entries from kaikki.org / English Wiktionary, CC-BY-SA 4.0.
- **SQLite FTS5 search** with diacritic-insensitive matching (`unicode61 remove_diacritics 2`) and Porter-stemmed English reverse search.
- **Inflection fallback** — typing `corro` opens `correr` with a "form of correr" badge.
- **Conjugations grid** for verbs with present, preterite, imperfect, future, conditional, present subjunctive, imperative (initial coverage — full paradigms came in v0.2.1).
- **Paper / Ink themes** with editorial typography (Source Serif 4, Inter, JetBrains Mono).
- **Keyboard-first interaction** — `Ctrl+K` to search, `Ctrl+D` to toggle theme, `Ctrl+S` to star, `Ctrl+[`/`]` for history.
- **Sidebar with Recent + Favorites** and export to CSV/TSV (Anki-compatible).
- **No telemetry, no analytics, no network calls at runtime.**

[GitHub release](https://github.com/dalba0/lexil/releases/tag/v0.1.0)

---

[0.2.1]: https://github.com/dalba0/lexil/releases/tag/v0.2.1
[0.2.0]: https://github.com/dalba0/lexil/releases/tag/v0.2.0
[0.1.1]: https://github.com/dalba0/lexil/releases/tag/v0.1.1
[0.1.0]: https://github.com/dalba0/lexil/releases/tag/v0.1.0
