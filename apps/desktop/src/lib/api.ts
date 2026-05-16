import { invoke } from "@tauri-apps/api/core";
import type { Entry, SearchResult, UserEntry } from "./types";

// Single-source wrappers around Tauri invoke calls. Every query takes the
// pack_id explicitly so the backend stays stateless and the frontend never
// has to worry about a drifting "active pack" on the Rust side.

export const api = {
  // Dictionary
  listPacks: () => invoke<string[]>("list_packs"),

  search: (packId: string, query: string, limit = 20) =>
    invoke<SearchResult[]>("search", { packId, query, limit }),

  searchReverse: (packId: string, query: string, limit = 20) =>
    invoke<SearchResult[]>("search_reverse", { packId, query, limit }),

  getEntry: (packId: string, id: number) =>
    invoke<Entry>("get_entry", { packId, id }),

  packMeta: (packId: string) =>
    invoke<Record<string, string>>("pack_meta", { packId }),

  // User state — recents
  addRecent: (
    packId: string,
    entryId: number,
    headword: string,
    pos: string | null,
  ) => invoke<void>("add_recent", { packId, entryId, headword, pos }),
  listRecents: (packId: string) =>
    invoke<UserEntry[]>("list_recents", { packId }),
  clearRecents: (packId: string) =>
    invoke<void>("clear_recents", { packId }),

  // User state — favorites
  toggleFavorite: (
    packId: string,
    entryId: number,
    headword: string,
    pos: string | null,
  ) => invoke<boolean>("toggle_favorite", { packId, entryId, headword, pos }),
  isFavorite: (packId: string, entryId: number) =>
    invoke<boolean>("is_favorite", { packId, entryId }),
  listFavorites: (packId: string) =>
    invoke<UserEntry[]>("list_favorites", { packId }),

  exportFavorites: (
    packId: string,
    path: string,
    format: "csv" | "tsv-anki",
  ) => invoke<number>("export_favorites", { packId, path, format }),
};
