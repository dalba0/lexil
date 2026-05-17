# Licenses & Attribution

## Lexil application code

Everything under `apps/`, `pipeline/`, `docs/`, and the root configuration files is the project author's (**Albab Dewan**) own work. License TBD.

## Dictionary data

Every language pack is adapted from English Wiktionary contributors via [kaikki.org](https://kaikki.org/dictionary/rawdata.html), distributed under the same dual license:

- **License:** Dual-licensed under [Creative Commons Attribution-ShareAlike 4.0](https://creativecommons.org/licenses/by-sa/4.0/) and the [GNU Free Documentation License](https://www.gnu.org/licenses/fdl-1.3.html).
- **Upstream:** [English Wiktionary](https://en.wiktionary.org/).

The attribution string for each pack appears in the app's **Settings → About** screen, in the entry footer when reading a word, and in the manifest at `packs/manifest.json`.

### Spanish (`spanish-en.db`)

- **Source URL:** https://kaikki.org/dictionary/Spanish/
- **Attribution:** "Spanish dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0."

### French (`french-en.db`)

- **Source URL:** https://kaikki.org/dictionary/French/
- **Attribution:** "French dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0."

### German (`german-en.db`)

- **Source URL:** https://kaikki.org/dictionary/German/
- **Attribution:** "German dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0."

### Japanese (`japanese-en.db`)

- **Source URL:** https://kaikki.org/dictionary/Japanese/
- **Attribution:** "Japanese dictionary data adapted from English Wiktionary contributors, via kaikki.org. Licensed under CC-BY-SA 4.0."

## Third-party app dependencies

Lexil's runtime depends on the following packages; see their respective repositories for full license terms.

| Package | License |
|---|---|
| [Tauri 2](https://github.com/tauri-apps/tauri) | MIT / Apache-2.0 |
| [React](https://github.com/facebook/react) | MIT |
| [Vite](https://github.com/vitejs/vite) | MIT |
| [TypeScript](https://github.com/microsoft/TypeScript) | Apache-2.0 |
| [Tailwind CSS](https://github.com/tailwindlabs/tailwindcss) | MIT |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | MIT |
| [Radix UI](https://github.com/radix-ui/primitives) | MIT |
| [Lucide React](https://github.com/lucide-icons/lucide) | ISC |
| [rusqlite](https://github.com/rusqlite/rusqlite) | MIT |
| [reqwest](https://github.com/seanmonstar/reqwest) | MIT / Apache-2.0 |
| [SQLite](https://www.sqlite.org/) | Public domain |

## Fonts

Bundled or referenced fonts and their licenses:

- **Source Serif 4** — SIL Open Font License 1.1
- **Inter** — SIL Open Font License 1.1
- **JetBrains Mono** — SIL Open Font License 1.1

When the fonts aren't installed on the user's system, Lexil falls back to OS defaults (Georgia / system sans / Cascadia Code) without functional impact.
