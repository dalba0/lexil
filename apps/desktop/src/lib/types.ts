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

export type Theme = "paper" | "ink";
export type FontScale = "sm" | "md" | "lg";

export type Lang = "es" | "en" | "fr";
export type SearchDirection = "es-en" | "en-es" | "fr-en" | "en-fr";
