import { invoke } from "@tauri-apps/api/core";
import type {
  Entry,
  InstalledPack,
  ListEntry,
  Manifest,
  ManifestPack,
  Note,
  SearchResult,
  Tag,
  TaggedEntry,
  UserEntry,
  UserList,
} from "./types";

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

  // Tags
  listTags: (packId: string) => invoke<Tag[]>("list_tags", { packId }),
  entryTags: (packId: string, entryId: number) =>
    invoke<Tag[]>("entry_tags", { packId, entryId }),
  addEntryTag: (
    packId: string,
    entryId: number,
    name: string,
    color: string | null,
  ) => invoke<void>("add_entry_tag", { packId, entryId, name, color }),
  removeEntryTag: (packId: string, entryId: number, name: string) =>
    invoke<void>("remove_entry_tag", { packId, entryId, name }),
  setTagColor: (packId: string, name: string, color: string | null) =>
    invoke<void>("set_tag_color", { packId, name, color }),
  renameTag: (packId: string, oldName: string, newName: string) =>
    invoke<void>("rename_tag", { packId, oldName, newName }),
  deleteTag: (packId: string, name: string) =>
    invoke<void>("delete_tag", { packId, name }),

  // Notes
  listNotes: (packId: string, entryId: number) =>
    invoke<Note[]>("list_notes", { packId, entryId }),
  addNote: (packId: string, entryId: number, text: string) =>
    invoke<number>("add_note", { packId, entryId, text }),
  deleteNote: (id: number) => invoke<void>("delete_note", { id }),

  // Pack management
  availablePacks: () => invoke<Manifest>("available_packs"),
  installedPacks: () => invoke<InstalledPack[]>("installed_packs"),
  downloadPack: (pack: ManifestPack) => invoke<void>("download_pack", { pack }),
  cancelDownload: (packId: string) =>
    invoke<void>("cancel_download", { packId }),
  removePack: (packId: string) => invoke<void>("remove_pack", { packId }),
  refreshPacks: () => invoke<InstalledPack[]>("refresh_packs"),

  // User-created lists
  listLists: (packId: string) => invoke<UserList[]>("list_lists", { packId }),
  createList: (
    packId: string,
    name: string,
    glyph: string | null,
    color: string | null,
  ) => invoke<number>("create_list", { packId, name, glyph, color }),
  renameList: (listId: number, name: string) =>
    invoke<void>("rename_list", { listId, name }),
  setListGlyph: (listId: number, glyph: string | null) =>
    invoke<void>("set_list_glyph", { listId, glyph }),
  setListColor: (listId: number, color: string | null) =>
    invoke<void>("set_list_color", { listId, color }),
  deleteList: (listId: number) => invoke<void>("delete_list", { listId }),
  listListEntries: (listId: number) =>
    invoke<ListEntry[]>("list_list_entries", { listId }),
  addToList: (
    listId: number,
    packId: string,
    entryId: number,
    headword: string,
    pos: string | null,
  ) =>
    invoke<void>("add_to_list", {
      listId,
      packId,
      entryId,
      headword,
      pos,
    }),
  removeFromList: (listId: number, entryId: number) =>
    invoke<void>("remove_from_list", { listId, entryId }),
  listsForEntry: (packId: string, entryId: number) =>
    invoke<number[]>("lists_for_entry", { packId, entryId }),

  // Tag-filtered lookup
  entriesWithTag: (packId: string, name: string) =>
    invoke<TaggedEntry[]>("entries_with_tag", { packId, name }),
};
