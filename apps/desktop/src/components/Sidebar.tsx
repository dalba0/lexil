import { useEffect, useMemo, useRef, useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Entry, UserEntry } from "@/lib/types";

interface Props {
  packId: string;
  refreshKey: number;
  onOpenEntry: (entryId: number) => void;
  currentEntryId: number | null;
}

// Cap how many sessions appear in the sidebar before they spill into a
// scrollable area; the rest are still reachable via scroll.
const SESSION_GAP_MS = 30 * 60 * 1000;

export function Sidebar({ packId, refreshKey, onOpenEntry, currentEntryId }: Props) {
  const [recents, setRecents] = useState<UserEntry[]>([]);
  const [favorites, setFavorites] = useState<UserEntry[]>([]);
  const [wotd, setWotd] = useState<Entry | null>(null);

  useEffect(() => {
    api.listRecents(packId).then(setRecents).catch(() => setRecents([]));
    api.listFavorites(packId).then(setFavorites).catch(() => setFavorites([]));
  }, [packId, refreshKey]);

  // Word of the day: deterministic per-day pick so the same word sticks
  // throughout the day. Reseeds whenever the active pack changes.
  useEffect(() => {
    let cancelled = false;
    setWotd(null);
    pickWordOfTheDay(packId).then((e) => {
      if (!cancelled) setWotd(e);
    });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  const sessions = useMemo(() => groupIntoSessions(recents), [recents]);

  return (
    <aside className="hidden md:flex md:w-[280px] shrink-0 flex-col border-r border-border bg-bg">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-6 pb-3 pt-6 font-serif text-[20px] leading-7 font-medium tracking-[-0.01em] text-ink">
        <span className="brand-dot" aria-hidden style={{ transform: "none" }} />
        Lexil
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Word of the day */}
        {wotd ? (
          <button
            onClick={() => onOpenEntry(wotd.id)}
            className="mx-6 my-2 block w-[calc(100%-48px)] cursor-pointer border-y border-border py-3 text-left transition-colors duration-fast hover:bg-border/20"
          >
            <div className="caption mb-1 text-faint">Word of the day</div>
            <div className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
              {wotd.headword}
            </div>
            {wotd.senses[0]?.definition ? (
              <div className="font-sans text-[12px] leading-[18px] italic text-muted">
                {shortGloss(wotd.senses[0].definition)}
              </div>
            ) : null}
          </button>
        ) : null}

        {/* Recent · sessions */}
        <SectionHeader title="Recent · sessions" count={recents.length} />
        {sessions.length === 0 ? (
          <div className="px-6 pt-2 pb-1 text-[13px] leading-5 text-faint">
            No recents yet.
          </div>
        ) : (
          sessions.map((s, i) => (
            <SessionRow
              key={`s-${i}`}
              label={s.label}
              wordCount={s.items.length}
              active={s.items.some((it) => it.entry_id === currentEntryId)}
              entries={s.items}
              onOpenEntry={onOpenEntry}
              currentEntryId={currentEntryId}
            />
          ))
        )}

        {/* Lists (currently just one virtual "★ Starred" list backed by favorites) */}
        <div className="mt-2">
          <SectionHeader title="Lists" count={favorites.length} />
        </div>
        <ListItem
          glyph="★"
          name="Starred"
          count={favorites.length}
          active={favorites.some((f) => f.entry_id === currentEntryId)}
        >
          {favorites.slice(0, 5).map((it) => (
            <Item
              key={`f-${it.entry_id}`}
              entry={it}
              active={currentEntryId === it.entry_id}
              onClick={() => onOpenEntry(it.entry_id)}
            />
          ))}
        </ListItem>
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

function SessionRow({
  label,
  wordCount,
  active,
  entries,
  onOpenEntry,
  currentEntryId,
}: {
  label: string;
  wordCount: number;
  active: boolean;
  entries: UserEntry[];
  onOpenEntry: (id: number) => void;
  currentEntryId: number | null;
}) {
  const [open, setOpen] = useState(active);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-baseline justify-between px-6 py-1.5 text-left transition-colors duration-fast hover:bg-border/20",
          active && "text-ink",
        )}
      >
        <span className="font-serif text-[14px] leading-6 text-ink">{label}</span>
        <span className="text-[12px] text-faint">{wordCount} {wordCount === 1 ? "word" : "words"}</span>
      </button>
      {open
        ? entries.map((it) => (
            <Item
              key={`r-${it.entry_id}`}
              entry={it}
              active={currentEntryId === it.entry_id}
              onClick={() => onOpenEntry(it.entry_id)}
            />
          ))
        : null}
    </>
  );
}

function ListItem({
  glyph,
  name,
  count,
  active,
  children,
}: {
  glyph: string;
  name: string;
  count: number;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(active);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-baseline justify-between px-6 py-1 text-left transition-colors duration-fast hover:bg-border/20",
        )}
      >
        <span className="font-serif text-[14px] leading-6 text-ink">
          <span className="mr-1.5 inline-block w-3.5 text-center text-faint">{glyph}</span>
          {name}
        </span>
        <span className="text-[12px] text-faint">{count}</span>
      </button>
      {open ? <div>{children}</div> : null}
    </>
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
        "block w-full pl-12 pr-6 py-[2px] text-left font-serif text-[14px] leading-6 transition-colors duration-fast",
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

// -----------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------

interface Session {
  label: string;
  items: UserEntry[];
}

/**
 * Group consecutive recents into "reading sessions": every burst of
 * lookups within 30 minutes becomes one session. We label each session
 * by its first lookup time relative to "now":
 *   "Just now"        — within the last 30 min
 *   "This morning"    — earlier today, before noon
 *   "This afternoon"  — earlier today, after noon
 *   "Yesterday"       — yesterday
 *   "<Weekday>"       — earlier this week
 *   "<date>"          — older
 */
function groupIntoSessions(recents: UserEntry[]): Session[] {
  if (recents.length === 0) return [];

  // recents arrive newest-first from the backend. Walk forward; if the
  // gap between consecutive items exceeds SESSION_GAP_MS, start a new
  // session bucket.
  const sessions: Session[] = [];
  let current: UserEntry[] = [];
  let lastTs = Number.POSITIVE_INFINITY;

  for (const r of recents) {
    const ts = Date.parse(r.timestamp);
    if (Number.isNaN(ts)) {
      current.push(r);
      continue;
    }
    if (current.length > 0 && lastTs - ts > SESSION_GAP_MS) {
      sessions.push({ label: labelFor(Date.parse(current[0].timestamp)), items: current });
      current = [];
    }
    current.push(r);
    lastTs = ts;
  }
  if (current.length > 0) {
    sessions.push({ label: labelFor(Date.parse(current[0].timestamp)), items: current });
  }
  return sessions;
}

function labelFor(ts: number): string {
  if (Number.isNaN(ts)) return "Earlier";
  const now = Date.now();
  const sessionDate = new Date(ts);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeekAgo = startOfToday - 7 * 24 * 60 * 60 * 1000;

  if (now - ts < 30 * 60 * 1000) return "Just now";
  if (ts >= startOfToday) {
    return sessionDate.getHours() < 12 ? "This morning" : "This afternoon";
  }
  if (ts >= startOfYesterday) return "Yesterday";
  if (ts >= startOfWeekAgo) {
    return sessionDate.toLocaleDateString(undefined, { weekday: "long" });
  }
  return sessionDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Pick a stable "Word of the day" for the active pack: hash the
 * YYYY-MM-DD plus pack_id, modulo a curated list. The result is the
 * same all day, different per day, and different per pack.
 */
async function pickWordOfTheDay(packId: string): Promise<Entry | null> {
  const candidates =
    packId === "french-en"
      ? ["amanecer", "courir", "parler", "vivre", "maison", "soleil", "amitié", "rêver", "lumière", "matin"]
      : ["amanecer", "correr", "hablar", "vivir", "casa", "sol", "amistad", "soñar", "luz", "mañana"];
  const today = new Date();
  const seed = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${packId}`;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const order = candidates.slice();
  // deterministic shuffle by repeatedly sampling from the seed
  for (let i = order.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) >>> 0;
    const j = hash % (i + 1);
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const word of order) {
    try {
      const rows = await api.search(packId, word, 1);
      if (rows.length > 0) {
        return await api.getEntry(packId, rows[0].entry_id);
      }
    } catch {
      // try next
    }
  }
  return null;
}

function shortGloss(s: string): string {
  return s.split(/[(;]/)[0].trim();
}
