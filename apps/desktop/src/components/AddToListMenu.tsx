import { useEffect, useRef, useState } from "react";
import { Check, FolderPlus, Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { CreateListDialog } from "@/components/CreateListDialog";
import type { Entry, UserList } from "@/lib/types";

interface Props {
  packId: string;
  entry: Entry;
  onChanged?: () => void;
}

/**
 * Compact "Add to list…" trigger that hangs off the entry header.
 * Opens a popover with every user list (checked if the entry is already
 * in it) plus a "+ New list…" affordance. Clicking a list toggles
 * membership; clicking + opens the create dialog.
 */
export function AddToListMenu({ packId, entry, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [memberOf, setMemberOf] = useState<Set<number>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const reload = async () => {
    const [ls, mem] = await Promise.all([
      api.listLists(packId),
      api.listsForEntry(packId, entry.id),
    ]);
    setLists(ls);
    setMemberOf(new Set(mem));
  };

  useEffect(() => {
    if (open) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, packId, entry.id]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const toggle = async (listId: number) => {
    if (memberOf.has(listId)) {
      await api.removeFromList(listId, entry.id);
    } else {
      await api.addToList(listId, packId, entry.id, entry.headword, entry.pos);
    }
    await reload();
    onChanged?.();
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Add to list"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-input px-2.5 text-[12px] text-muted transition-colors duration-fast hover:bg-border/40 hover:text-ink",
          memberOf.size > 0 && "text-accent",
        )}
        style={{ background: undefined, border: 0, cursor: "pointer" }}
      >
        <FolderPlus size={14} strokeWidth={1.5} />
        {memberOf.size > 0 ? `In ${memberOf.size}` : "Add to list"}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-[260px] rounded-card border border-border bg-surface py-2 lex-rise shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {lists.length === 0 ? (
            <div className="px-3 py-2 text-body-sm text-faint">
              No lists yet. Create one to get started.
            </div>
          ) : (
            lists.map((l) => {
              const checked = memberOf.has(l.id);
              return (
                <button
                  key={l.id}
                  onClick={() => toggle(l.id)}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-sm text-ink transition-colors duration-fast hover:bg-bg"
                  style={{ background: undefined, border: 0, cursor: "pointer" }}
                >
                  <span
                    className="inline-block w-4 text-center font-serif text-[14px]"
                    data-color={l.color ?? undefined}
                    style={
                      l.color
                        ? { color: "var(--tc, var(--faint))" }
                        : { color: "var(--faint)" }
                    }
                  >
                    {l.glyph ?? "•"}
                  </span>
                  <span className="flex-1 truncate">{l.name}</span>
                  {checked ? (
                    <Check size={14} strokeWidth={1.5} className="text-accent" />
                  ) : null}
                </button>
              );
            })
          )}
          <div className="mt-1 border-t border-border pt-1">
            <button
              onClick={() => {
                setOpen(false);
                setCreateOpen(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-body-sm text-accent transition-colors duration-fast hover:bg-bg"
              style={{ background: undefined, border: 0, cursor: "pointer" }}
            >
              <Plus size={14} strokeWidth={1.5} />
              New list…
            </button>
          </div>
        </div>
      ) : null}

      <CreateListDialog
        open={createOpen}
        packId={packId}
        onClose={() => setCreateOpen(false)}
        onCreated={async (id) => {
          await api.addToList(id, packId, entry.id, entry.headword, entry.pos);
          await reload();
          onChanged?.();
        }}
      />
    </div>
  );
}
