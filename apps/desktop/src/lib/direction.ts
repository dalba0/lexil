import type { Lang, SearchDirection } from "./types";

// Lookup helpers tying a (from, to) pair to the pack id and search
// direction that should be used. Centralized so the routing rule lives in
// one place — adding a new language pair means touching only this file and
// LangPopover's available-language list.

export interface Pair {
  from: Lang;
  to: Lang;
}

export function directionToPair(d: SearchDirection): Pair {
  const [from, to] = d.split("-") as [Lang, Lang];
  return { from, to };
}

export function pairToDirection(from: Lang, to: Lang): SearchDirection {
  return `${from}-${to}` as SearchDirection;
}

/**
 * Which pack handles a given direction. English is the pivot: we don't
 * ship direct ES↔FR (or any other non-EN pair), so every direction
 * routes through an en-paired pack.
 */
export function packIdForDirection(d: SearchDirection): string {
  switch (d) {
    case "es-en":
    case "en-es":
      return "spanish-en";
    case "fr-en":
    case "en-fr":
      return "french-en";
    case "de-en":
    case "en-de":
      return "german-en";
    case "ja-en":
    case "en-ja":
      return "japanese-en";
  }
}

/**
 * The source (non-English) language a pack contains entries for.
 * Every pack is en-paired, so the source language is the other side
 * of the pair. Used to pick rendering strategies that depend on the
 * entry's native language (e.g., Conjugations layout).
 */
export function sourceLangForPack(packId: string): Lang {
  switch (packId) {
    case "spanish-en":
      return "es";
    case "french-en":
      return "fr";
    case "german-en":
      return "de";
    case "japanese-en":
      return "ja";
    default:
      return "es";
  }
}

/** True when the direction is target→source (English on the input side). */
export function isReverse(d: SearchDirection): boolean {
  return d.startsWith("en-");
}

/** Human label for a single language. */
export const LANG_LABEL: Record<Lang, string> = {
  es: "Spanish",
  en: "English",
  fr: "French",
  de: "German",
  ja: "Japanese",
};

/** Default fallback when a direction can't be resolved. */
export const DEFAULT_DIRECTION: SearchDirection = "es-en";
