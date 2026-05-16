import { useEffect, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { UserEntry } from "@/lib/types";

interface Props {
  packId: string;
  refreshKey: number;
  onOpenEntry: (entryId: number) => void;
  currentEntryId: number | null;
}

export function Sidebar({ packId, refreshKey, onOpenEntry, currentEntryId }: Props) {
  const [recents, setRecents] = useState<UserEntry[]>([]);
  const [favorites, setFavorites] = useState<UserEntry[]>([]);

  useEffect(() => {
    api.listRecents(packId).then(setRecents).catch(() => setRecents([]));
    api.listFavorites(packId).then(setFavorites).catch(() => setFavorites([]));
  }, [packId, refreshKey]);

  const groups = groupRecents(recents);

  return (
    <aside className="hidden md:flex md:w-[280px] shrink-0 flex-col border-r border-border bg-bg">
      {/* Brand mark */}
      <div className="px-6 pb-4 pt-6 font-serif text-[20px] leading-7 font-medium tracking-[-0.01em] text-ink">
        <span className="brand-dot" aria-hidden />
        Lexil
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* RECENT */}
        <SectionHeader title="Recent" count={recents.length} />
        {recents.length === 0 ? (
          <div className="px-6 pt-2 pb-1 text-[13px] leading-5 text-faint">
            No recents yet.
          </div>
        ) : (
          groups.map(([label, items]) => (
            <div key={label}>
              <div className="caption px-6 pb-1 pt-3 text-faint">{label}</div>
              {items.map((it) => (
                <Item
                  key={`r-${it.entry_id}`}
                  entry={it}
                  active={currentEntryId === it.entry_id}
                  onClick={() => onOpenEntry(it.entry_id)}
                />
              ))}
            </div>
          ))
        )}

        {/* STARRED */}
        <div className="mt-2">
          <SectionHeader title="Starred" count={favorites.length} />
        </div>
        {favorites.length === 0 ? (
          <div className="px-6 pt-2 pb-1 text-[13px] leading-5 text-faint">
            Star a word to save it.
          </div>
        ) : (
          favorites.map((it) => (
            <Item
              key={`f-${it.entry_id}`}
              entry={it}
              active={currentEntryId === it.entry_id}
              onClick={() => onOpenEntry(it.entry_id)}
            />
          ))
        )}
      </div>

      <Footer
        packId={packId}
        onClearRecents={async () => {
          await api.clearRecents(packId);
          setRecents([]);
        }}
        favoritesCount={favorites.length}
      />
    </aside>
  );
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between px-6 pt-4">
      <span className="caption text-faint">{title}</span>
      <span className="caption text-faint">{count}</span>
    </div>
  );
}

function Item({
  entry,
  active,
  onClick,
}: {
  entry: UserEntry;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "block w-full px-6 py-[2px] text-left font-serif text-[14px] leading-6 transition-colors duration-fast",
        active ? "text-ink" : "text-muted hover:text-ink",
      )}
    >
      {entry.headword}
    </button>
  );
}

function Footer({
  packId,
  onClearRecents,
  favoritesCount,
}: {
  packId: string;
  onClearRecents: () => void;
  favoritesCount: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  const exportTo = async (format: "csv" | "tsv-anki") => {
    setMenuOpen(false);
    const defaultName =
      format === "csv" ? "lexil-favorites.csv" : "lexil-favorites.tsv";
    const target = await save({
      defaultPath: defaultName,
      filters: [
        format === "csv"
          ? { name: "CSV", extensions: ["csv"] }
          : { name: "TSV (Anki)", extensions: ["tsv"] },
      ],
    });
    if (!target) return;
    await api.exportFavorites(packId, target as string, format);
  };

  return (
    <div className="border-t border-border px-6 py-4">
      <div className="flex justify-between text-body-sm text-muted">
        <div ref={ref} className="relative">
          <button
            onClick={() => setMenuOpen((o) => !o)}
            disabled={favoritesCount === 0}
            className="text-body-sm text-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            Export
          </button>
          {menuOpen ? (
            <div className="absolute bottom-full left-0 z-10 mb-2 w-[160px] rounded-card border border-border bg-surface py-1 lex-rise">
              <button
                onClick={() => exportTo("csv")}
                className="block w-full px-3 py-1.5 text-left text-body-sm text-ink hover:bg-border/40"
              >
                Export CSV
              </button>
              <button
                onClick={() => exportTo("tsv-anki")}
                className="block w-full px-3 py-1.5 text-left text-body-sm text-ink hover:bg-border/40"
              >
                Export Anki TSV
              </button>
            </div>
          ) : null}
        </div>
        <button
          onClick={onClearRecents}
          className="text-body-sm text-muted hover:text-ink"
        >
          Clear recents
        </button>
      </div>
    </div>
  );
}

// Bucket recents into Today / Yesterday / Earlier based on local calendar
// date. Empty buckets are dropped.
function groupRecents(recents: UserEntry[]): Array<[string, UserEntry[]]> {
  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;

  const today: UserEntry[] = [];
  const yesterday: UserEntry[] = [];
  const earlier: UserEntry[] = [];

  for (const r of recents) {
    const ts = Date.parse(r.timestamp);
    if (Number.isNaN(ts)) {
      earlier.push(r);
      continue;
    }
    if (ts >= startOfToday) today.push(r);
    else if (ts >= startOfYesterday) yesterday.push(r);
    else earlier.push(r);
  }

  const out: Array<[string, UserEntry[]]> = [];
  if (today.length) out.push(["Today", today]);
  if (yesterday.length) out.push(["Yesterday", yesterday]);
  if (earlier.length) out.push(["Earlier", earlier]);
  return out;
}
