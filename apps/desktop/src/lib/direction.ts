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
 * Which bundled pack handles a given direction. English is the pivot:
 * we don't ship direct ES↔FR, so all directions route through an
 * en-paired pack.
 */
export function packIdForDirection(d: SearchDirection): string {
  switch (d) {
    case "es-en":
    case "en-es":
      return "spanish-en";
    case "fr-en":
    case "en-fr":
      return "french-en";
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
};

/** Default fallback when a direction can't be resolved. */
export const DEFAULT_DIRECTION: SearchDirection = "es-en";
