import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ListEntry, TaggedEntry, UserList, Tag } from "@/lib/types";

interface CommonProps {
  packId: string;
  onOpenEntry: (entryId: number) => void;
  onClose: () => void;
}

interface ListProps extends CommonProps {
  kind: "list";
  listId: number;
  onChanged: () => void;
}

interface TagProps extends CommonProps {
  kind: "tag";
  tagName: string;
}

type Props = ListProps | TagProps;

/**
 * Shared view for "a collection of entries" — used both for user-created
 * lists and for tag-filtered results. The layout mirrors the entry view's
 * shape (display headword, caption meta, a tabular row of entries).
 */
export function EntryListView(props: Props) {
  if (props.kind === "list") return <ListBody {...props} />;
  return <TagBody {...props} />;
}

function ListBody({ packId, listId, onOpenEntry, onChanged }: ListProps) {
  const [list, setList] = useState<UserList | null>(null);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");

  const reload = async () => {
    const lists = await api.listLists(packId);
    const found = lists.find((l) => l.id === listId) ?? null;
    setList(found);
    setName(found?.name ?? "");
    const ent = await api.listListEntries(listId);
    setEntries(ent);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packId, listId]);

  if (!list) {
    return (
      <div className="mx-auto max-w-[720px] px-8 py-12 text-body-sm text-faint">
        Loading list…
      </div>
    );
  }

  const removeEntry = async (entryId: number) => {
    await api.removeFromList(listId, entryId);
    setEntries((cur) => cur.filter((e) => e.entry_id !== entryId));
    onChanged();
  };

  const deleteList = async () => {
    if (
      !window.confirm(
        `Delete the list "${list.name}"? ${list.count} word${list.count === 1 ? "" : "s"} will be unfiled (the words themselves stay in the dictionary).`,
      )
    )
      return;
    await api.deleteList(listId);
    onChanged();
  };

  return (
    <article className="lex-rise selectable mx-auto w-full max-w-[720px] px-8 pb-16 pt-12">
      <div className="caption mb-3 flex items-center gap-2 text-faint">
        {list.glyph ? (
          <span
            className="font-serif text-[16px] not-italic"
            data-color={list.color ?? undefined}
            style={list.color ? { color: "var(--tc, var(--faint))" } : undefined}
          >
            {list.glyph}
          </span>
        ) : null}
        <span>List</span>
      </div>
      {renaming ? (
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              if (name.trim() && name !== list.name) {
                await api.renameList(listId, name.trim());
                onChanged();
                await reload();
              }
              setRenaming(false);
            }
            if (e.key === "Escape") {
              setName(list.name);
              setRenaming(false);
            }
          }}
          onBlur={() => setRenaming(false)}
          className="w-full border-b border-border bg-transparent pb-1 font-serif text-[36px] leading-[44px] tracking-[-0.01em] text-ink outline-none focus:border-accent"
        />
      ) : (
        <button
          onClick={() => setRenaming(true)}
          className="bg-transparent text-left font-serif text-[36px] leading-[44px] tracking-[-0.01em] text-ink"
          style={{ border: 0, padding: 0, cursor: "text" }}
        >
          {list.name}
        </button>
      )}
      <div className="mt-2 flex items-baseline gap-2 text-body-sm text-muted">
        <span>
          {entries.length} {entries.length === 1 ? "word" : "words"}
        </span>
        <span className="text-faint">·</span>
        <span>created {formatDate(list.created_at)}</span>
      </div>

      <div className="mt-6 flex gap-6 border-t border-border pt-4 text-body-sm">
        <button
          onClick={() => setRenaming(true)}
          className="bg-transparent text-muted hover:text-ink transition-colors duration-fast"
          style={{ border: 0, padding: 0, cursor: "pointer" }}
        >
          Rename
        </button>
        <button
          onClick={deleteList}
          className="bg-transparent text-muted hover:text-accent transition-colors duration-fast"
          style={{ border: 0, padding: 0, cursor: "pointer" }}
        >
          Delete
        </button>
      </div>

      <div className="mt-8">
        {entries.length === 0 ? (
          <div className="border-t border-border py-8 text-center text-body-sm text-faint">
            No words here yet. Open a word and use "Add to list" to start.
          </div>
        ) : (
          entries.map((e) => (
            <EntryRow
              key={e.entry_id}
              headword={e.headword}
              pos={e.pos}
              when={e.added_at}
              onOpen={() => onOpenEntry(e.entry_id)}
              onRemove={() => removeEntry(e.entry_id)}
            />
          ))
        )}
      </div>
    </article>
  );
}

function TagBody({ packId, tagName, onOpenEntry }: TagProps) {
  const [entries, setEntries] = useState<TaggedEntry[]>([]);
  const [tag, setTag] = useState<Tag | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.entriesWithTag(packId, tagName).then((rows) => {
      if (!cancelled) setEntries(rows);
    });
    api.listTags(packId).then((tags) => {
      if (cancelled) return;
      setTag(tags.find((t) => t.name === tagName) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [packId, tagName]);

  return (
    <article className="lex-rise selectable mx-auto w-full max-w-[720px] px-8 pb-16 pt-12">
      <div className="caption mb-3 flex items-center gap-2 text-faint">
        <span className="tag-dot" data-color={tag?.color ?? "none"} />
        <span>Tag</span>
      </div>
      <h1 className="font-serif text-[36px] leading-[44px] tracking-[-0.01em] text-ink">
        {tagName}
      </h1>
      <div className="mt-2 text-body-sm text-muted">
        {entries.length} {entries.length === 1 ? "word" : "words"} tagged
      </div>

      <div className="mt-8">
        {entries.length === 0 ? (
          <div className="border-t border-border py-8 text-center text-body-sm text-faint">
            No words have this tag. Open a word and add it.
          </div>
        ) : (
          entries.map((e) => (
            <EntryRow
              key={e.entry_id}
              headword={e.headword}
              pos={e.pos}
              when={e.attached_at}
              onOpen={() => onOpenEntry(e.entry_id)}
            />
          ))
        )}
      </div>
    </article>
  );
}

function EntryRow({
  headword,
  pos,
  when,
  onOpen,
  onRemove,
}: {
  headword: string;
  pos: string | null;
  when: string;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group grid grid-cols-[1fr_auto] items-baseline gap-4 border-t border-border py-4 last:border-b">
      <button
        onClick={onOpen}
        className="bg-transparent text-left"
        style={{ border: 0, padding: 0, cursor: "pointer" }}
      >
        <span className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
          {headword}
        </span>
        {pos ? (
          <span className="ml-2.5 text-[12px] italic text-faint">{pos}</span>
        ) : null}
      </button>
      <div className="flex items-center gap-3 text-[12px] tracking-wider text-faint">
        <span>{formatDate(when)}</span>
        {onRemove ? (
          <button
            onClick={onRemove}
            className={cn(
              "inline-flex items-center bg-transparent text-faint opacity-0",
              "transition-opacity duration-fast group-hover:opacity-100 hover:text-accent",
            )}
            style={{ border: 0, padding: 0, cursor: "pointer" }}
            aria-label="Remove"
          >
            <Trash2 size={12} strokeWidth={1.5} />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
