// Mirror of src-tauri/src/models.rs — keep field names exactly the same.

export interface SearchResult {
  entry_id: number;
  headword: string;
  pos: string | null;
  gender: string | null;
  gloss_preview: string | null;
  matched_form: string | null;
}

export interface Entry {
  id: number;
  headword: string;
  headword_normalized: string;
  pos: string | null;
  gender: string | null;
  ipa: string | null;
  senses: Sense[];
  inflections: Inflection[];
}

export interface Sense {
  id: number;
  sense_number: number;
  definition: string;
  register: string | null;
  domain: string | null;
  examples: Example[];
}

export interface Example {
  text: string;
  translation: string | null;
}

export interface Inflection {
  form: string;
  tags: string;
}

export interface UserEntry {
  entry_id: number;
  headword: string;
  pos: string | null;
  timestamp: string;
}

// The curated tag-color palette. "none" maps to the default (no color).
export type TagColor =
  | "none"
  | "rose"
  | "amber"
  | "olive"
  | "sage"
  | "teal"
  | "slate"
  | "plum";

export const TAG_COLORS: TagColor[] = [
  "none",
  "rose",
  "amber",
  "olive",
  "sage",
  "teal",
  "slate",
  "plum",
];

export interface Tag {
  name: string;
  color: string | null;
  count: number;
}

export interface Note {
  id: number;
  text: string;
  created_at: string;
}

export interface ManifestPack {
  id: string;
  name: string;
  source: string;
  target: string;
  version: string;
  size_bytes: number;
  entries: number;
  download_url: string;
  sha256: string;
  license: string | null;
  attribution: string | null;
}

export interface Manifest {
  manifest_version: number;
  updated_at: string;
  packs: ManifestPack[];
}

export interface InstalledPack {
  id: string;
  path: string;
  size_bytes: number;
}

export interface PackDownloadProgress {
  pack_id: string;
  bytes_downloaded: number;
  bytes_total: number;
  state: "downloading" | "verifying" | "installing" | "done" | "error" | "cancelled";
  message: string | null;
}

export interface UserList {
  id: number;
  name: string;
  glyph: string | null;
  color: string | null;
  count: number;
  created_at: string;
}

export interface ListEntry {
  entry_id: number;
  headword: string;
  pos: string | null;
  added_at: string;
}

export interface TaggedEntry {
  entry_id: number;
  headword: string;
  pos: string | null;
  attached_at: string;
}

// Glyphs the user can pick when creating a list. Single serif characters
// (or musical / typographic symbols) only — keeps the visual language
// consistent with the editorial aesthetic.
export const LIST_GLYPHS: string[] = [
  "★",
  "¶",
  "§",
  "†",
  "◆",
  "◇",
  "✦",
  "✧",
  "♢",
  "♦",
  "✶",
  "✱",
];

export type Theme = "paper" | "ink";
export type FontScale = "sm" | "md" | "lg";

export type Lang = "es" | "en" | "fr" | "de" | "ja";
export type SearchDirection =
  | "es-en"
  | "en-es"
  | "fr-en"
  | "en-fr"
  | "de-en"
  | "en-de"
  | "ja-en"
  | "en-ja";
