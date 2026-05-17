import { useEffect, useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { save } from "@tauri-apps/plugin-dialog";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CreateListDialog } from "@/components/CreateListDialog";
import type { Entry, Tag, UserEntry, UserList } from "@/lib/types";

interface Props {
  packId: string;
  refreshKey: number;
  onOpenEntry: (entryId: number) => void;
  onOpenList: (listId: number) => void;
  onOpenTag: (tagName: string) => void;
  onGoHome: () => void;
  currentEntryId: number | null;
  currentListId: number | null;
  currentTagName: string | null;
}

// 30-minute gap defines a "session" boundary in the Recent grouping.
const SESSION_GAP_MS = 30 * 60 * 1000;

export function Sidebar({
  packId,
  refreshKey,
  onOpenEntry,
  onOpenList,
  onOpenTag,
  onGoHome,
  currentEntryId,
  currentListId,
  currentTagName,
}: Props) {
  const [recents, setRecents] = useState<UserEntry[]>([]);
  const [favorites, setFavorites] = useState<UserEntry[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [wotd, setWotd] = useState<Entry | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const reload = async () => {
    const [r, f, l, t] = await Promise.all([
      api.listRecents(packId).catch(() => [] as UserEntry[]),
      api.listFavorites(packId).catch(() => [] as UserEntry[]),
      api.listLists(packId).catch(() => [] as UserList[]),
      api.listTags(packId).catch(() => [] as Tag[]),
    ]);
    setRecents(r);
    setFavorites(f);
    setLists(l);
    setTags(t);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, refreshKey]);

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
      {/* Brand → home */}
      <button
        onClick={onGoHome}
        className="flex w-full items-center gap-2.5 bg-transparent px-6 pb-3 pt-6 text-left font-serif text-[20px] leading-7 font-medium tracking-[-0.01em] text-ink transition-colors duration-fast hover:opacity-80"
        style={{ border: 0, cursor: "pointer" }}
        aria-label="Go to home"
      >
        <span className="brand-dot" aria-hidden style={{ transform: "none" }} />
        Lexil
      </button>

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
          <Empty>No recents yet.</Empty>
        ) : (
          sessions.map((s, i) => (
            <SessionRow
              key={`s-${i}`}
              label={s.label}
              wordCount={s.items.length}
              entries={s.items}
              onOpenEntry={onOpenEntry}
              currentEntryId={currentEntryId}
            />
          ))
        )}

        {/* Lists section — Starred is the built-in, user lists below it,
            with a + button to create new ones. */}
        <div className="mt-2">
          <SectionHeader
            title="Lists"
            count={lists.length + 1}
            right={
              <button
                onClick={() => setCreateOpen(true)}
                aria-label="New list"
                className="text-faint hover:text-ink transition-colors duration-fast"
                style={{ background: "none", border: 0, padding: 0, cursor: "pointer" }}
              >
                <Plus size={14} strokeWidth={1.5} />
              </button>
            }
          />
        </div>

        <ListRow
          glyph="★"
          name="Starred"
          color={null}
          count={favorites.length}
          active={
            currentListId === null &&
            currentTagName === null &&
            favorites.some((f) => f.entry_id === currentEntryId)
          }
          onClick={() => {
            // Starred maps to favorites; render via the home/empty handler
            // for now since it's the "default" list.
            // We open it through the tag-style view by passing -1 as listId.
            // Actually: there's no list_id for Starred, so we just expand
            // its items inline here.
          }}
          expandable
          expandedItems={favorites.slice(0, 50)}
          onItemClick={onOpenEntry}
          currentEntryId={currentEntryId}
        />

        {lists.map((l) => (
          <ListRow
            key={l.id}
            glyph={l.glyph ?? "•"}
            name={l.name}
            color={l.color}
            count={l.count}
            active={currentListId === l.id}
            onClick={() => onOpenList(l.id)}
          />
        ))}

        {/* Tags section */}
        {tags.length > 0 ? (
          <>
            <div className="mt-2">
              <SectionHeader title="Tags" count={tags.length} />
            </div>
            {tags.map((t) => (
              <TagRow
                key={t.name}
                tag={t}
                active={currentTagName === t.name}
                onClick={() => onOpenTag(t.name)}
              />
            ))}
          </>
        ) : null}
      </div>

      <Footer
        packId={packId}
        onClearRecents={async () => {
          await api.clearRecents(packId);
          setRecents([]);
        }}
        favoritesCount={favorites.length}
      />

      <CreateListDialog
        open={createOpen}
        packId={packId}
        onClose={() => setCreateOpen(false)}
        onCreated={(id) => {
          reload();
          onOpenList(id);
        }}
      />
    </aside>
  );
}

function SectionHeader({
  title,
  count,
  right,
}: {
  title: string;
  count: number;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-6 pt-4">
      <span className="caption text-faint">{title}</span>
      <div className="flex items-center gap-2">
        <span className="caption text-faint">{count}</span>
        {right}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-6 pt-2 pb-1 text-[13px] leading-5 text-faint">
      {children}
    </div>
  );
}

function SessionRow({
  label,
  wordCount,
  entries,
  onOpenEntry,
  currentEntryId,
}: {
  label: string;
  wordCount: number;
  entries: UserEntry[];
  onOpenEntry: (id: number) => void;
  currentEntryId: number | null;
}) {
  const containsCurrent = entries.some((it) => it.entry_id === currentEntryId);
  const [open, setOpen] = useState(containsCurrent);
  return (
    <>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-baseline justify-between px-6 py-1.5 text-left transition-colors duration-fast hover:bg-border/20"
      >
        <span className="font-serif text-[14px] leading-6 text-ink">{label}</span>
        <span className="text-[12px] text-faint">
          {wordCount} {wordCount === 1 ? "word" : "words"}
        </span>
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

function ListRow({
  glyph,
  name,
  color,
  count,
  active,
  onClick,
  expandable,
  expandedItems,
  onItemClick,
  currentEntryId,
}: {
  glyph: string;
  name: string;
  color: string | null;
  count: number;
  active: boolean;
  onClick?: () => void;
  expandable?: boolean;
  expandedItems?: UserEntry[];
  onItemClick?: (id: number) => void;
  currentEntryId?: number | null;
}) {
  const [expanded, setExpanded] = useState(active);
  const handle = () => {
    if (expandable) setExpanded((e) => !e);
    onClick?.();
  };
  return (
    <>
      <button
        onClick={handle}
        className={cn(
          "flex w-full items-baseline justify-between px-6 py-1 text-left transition-colors duration-fast hover:bg-border/20",
          active && "bg-border/20",
        )}
        style={{ background: undefined, border: 0, cursor: "pointer" }}
      >
        <span className="font-serif text-[14px] leading-6 text-ink">
          <span
            className="mr-2 inline-block w-3.5 text-center"
            data-color={color ?? undefined}
            style={
              color
                ? {
                    color: "var(--tc, var(--faint))",
                  }
                : { color: "var(--faint)" }
            }
          >
            {glyph}
          </span>
          {name}
        </span>
        <span className="text-[12px] text-faint">{count}</span>
      </button>
      {expandable && expanded && expandedItems
        ? expandedItems.map((it) => (
            <Item
              key={`l-${it.entry_id}`}
              entry={it}
              active={(currentEntryId ?? null) === it.entry_id}
              onClick={() => onItemClick?.(it.entry_id)}
            />
          ))
        : null}
    </>
  );
}

function TagRow({
  tag,
  active,
  onClick,
}: {
  tag: Tag;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-baseline justify-between px-6 py-1 text-left transition-colors duration-fast hover:bg-border/20",
        active && "bg-border/20",
      )}
      style={{ background: undefined, border: 0, cursor: "pointer" }}
    >
      <span className="flex items-center gap-2 font-serif text-[14px] leading-6 text-ink">
        <span className="tag-dot" data-color={tag.color ?? "none"} />
        {tag.name}
      </span>
      <span className="text-[12px] text-faint">{tag.count}</span>
    </button>
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

function groupIntoSessions(recents: UserEntry[]): Session[] {
  if (recents.length === 0) return [];
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
      sessions.push({
        label: labelFor(Date.parse(current[0].timestamp)),
        items: current,
      });
      current = [];
    }
    current.push(r);
    lastTs = ts;
  }
  if (current.length > 0) {
    sessions.push({
      label: labelFor(Date.parse(current[0].timestamp)),
      items: current,
    });
  }
  return sessions;
}

function labelFor(ts: number): string {
  if (Number.isNaN(ts)) return "Earlier";
  const now = Date.now();
  const sessionDate = new Date(ts);
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  ).getTime();
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
  return sessionDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

async function pickWordOfTheDay(packId: string): Promise<Entry | null> {
  const candidates =
    packId === "french-en"
      ? ["amanecer", "courir", "parler", "vivre", "maison", "soleil", "amitié", "rêver", "lumière", "matin"]
      : packId === "german-en"
        ? ["lieben", "leben", "haus", "sonne", "freund", "morgen", "wahrheit", "freiheit", "wasser", "musik"]
        : packId === "japanese-en"
          ? ["走る", "話す", "家", "本", "光", "時間", "世界", "命", "友達", "朝"]
          : ["amanecer", "correr", "hablar", "vivir", "casa", "sol", "amistad", "soñar", "luz", "mañana"];
  const today = new Date();
  const seed = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}-${packId}`;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const order = candidates.slice();
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
      /* try next */
    }
  }
  return null;
}

function shortGloss(s: string): string {
  return s.split(/[(;]/)[0].trim();
}
