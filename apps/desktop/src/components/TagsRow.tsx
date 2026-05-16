import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TAG_COLORS, type Tag, type TagColor } from "@/lib/types";

interface Props {
  packId: string;
  entryId: number;
  onChange?: () => void;
}

export function TagsRow({ packId, entryId, onChange }: Props) {
  const [tags, setTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Pull tags whenever the entry or pack changes.
  useEffect(() => {
    api.entryTags(packId, entryId).then(setTags).catch(() => setTags([]));
    api.listTags(packId).then(setAllTags).catch(() => setAllTags([]));
  }, [packId, entryId]);

  const refresh = async () => {
    const [et, lt] = await Promise.all([
      api.entryTags(packId, entryId),
      api.listTags(packId),
    ]);
    setTags(et);
    setAllTags(lt);
    onChange?.();
  };

  const addTag = async (name: string, color?: TagColor) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const existing = allTags.find(
      (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    const resolvedColor =
      color ?? (existing?.color as TagColor | undefined) ?? null;
    await api.addEntryTag(packId, entryId, trimmed, resolvedColor ?? null);
    setInput("");
    setAdding(false);
    await refresh();
  };

  const removeTag = async (name: string) => {
    await api.removeEntryTag(packId, entryId, name);
    await refresh();
  };

  const setColor = async (name: string, color: TagColor) => {
    await api.setTagColor(packId, name, color === "none" ? null : color);
    setEditing(null);
    await refresh();
  };

  // Suggestions: existing tags not already on this entry, prefix-matched
  // against what the user is typing.
  const suggestions = (() => {
    const q = input.trim().toLowerCase();
    const onEntry = new Set(tags.map((t) => t.name.toLowerCase()));
    return allTags
      .filter((t) => !onEntry.has(t.name.toLowerCase()))
      .filter((t) => q.length === 0 || t.name.toLowerCase().startsWith(q))
      .slice(0, 6);
  })();

  return (
    <div className="flex flex-wrap items-center gap-2 pb-4 pt-1">
      <span className="caption text-faint">Tags</span>
      {tags.map((t) => (
        <TagChip
          key={t.name}
          tag={t}
          editing={editing === t.name}
          onEdit={() => setEditing((cur) => (cur === t.name ? null : t.name))}
          onClose={() => setEditing(null)}
          onRemove={() => removeTag(t.name)}
          onChangeColor={(c) => setColor(t.name, c)}
        />
      ))}

      {adding ? (
        <div className="relative inline-flex">
          <input
            ref={inputRef}
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                await addTag(input);
              } else if (e.key === "Escape") {
                setAdding(false);
                setInput("");
              }
            }}
            onBlur={() => {
              // small delay so clicking a suggestion still works
              setTimeout(() => setAdding(false), 120);
            }}
            placeholder="add tag…"
            className="w-[140px] rounded-[4px] border border-dashed border-border bg-transparent px-2.5 py-1 text-[12px] text-ink outline-none placeholder:text-faint focus:border-solid focus:border-accent"
          />
          {suggestions.length > 0 ? (
            <div className="absolute left-0 top-[calc(100%+4px)] z-10 w-[180px] rounded-[6px] border border-border bg-surface py-1 lex-rise">
              {suggestions.map((t) => (
                <button
                  key={t.name}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    addTag(t.name, (t.color as TagColor | null) ?? undefined);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12px] text-ink hover:bg-bg"
                >
                  <span
                    className="tag-dot"
                    data-color={t.color ?? "none"}
                  />
                  {t.name}
                  <span className="ml-auto text-[11px] text-faint">{t.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="inline-flex items-center gap-1 rounded-[4px] border border-dashed border-border px-2.5 py-1 text-[12px] text-muted hover:border-ink/30 hover:text-ink transition-colors duration-fast"
        >
          <Plus size={12} strokeWidth={1.5} />
          add tag
        </button>
      )}
    </div>
  );
}

function TagChip({
  tag,
  editing,
  onEdit,
  onClose,
  onRemove,
  onChangeColor,
}: {
  tag: Tag;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onRemove: () => void;
  onChangeColor: (c: TagColor) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editing) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [editing, onClose]);

  const color = (tag.color ?? "none") as TagColor;

  return (
    <div ref={ref} className="relative inline-flex">
      <span
        className={cn("tag-chip", editing && "ring-1 ring-accent ring-offset-1")}
        data-color={color}
      >
        <button
          onClick={onEdit}
          className="bg-transparent border-0 p-0 m-0 font-inherit text-inherit"
          style={{ font: "inherit", color: "inherit", cursor: "pointer" }}
        >
          {tag.name}
        </button>
        <button
          className="tag-x"
          onClick={onRemove}
          aria-label={`Remove tag ${tag.name}`}
        >
          ×
        </button>
      </span>
      {editing ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-20 rounded-card border border-border bg-surface px-3 py-2.5 lex-rise shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          <div className="caption mb-2 text-faint">Color</div>
          <div className="flex gap-2">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onChangeColor(c)}
                aria-label={c}
                className={cn("tag-swatch", color === c && "selected")}
                data-color={c}
              />
            ))}
          </div>
          <div className="mt-3 flex justify-between border-t border-border pt-2 text-[12px]">
            <button
              onClick={onClose}
              className="bg-transparent border-0 p-0 text-muted hover:text-ink transition-colors duration-fast"
              style={{ cursor: "pointer" }}
            >
              Done
            </button>
            <button
              onClick={onRemove}
              className="bg-transparent border-0 p-0 text-muted hover:text-accent transition-colors duration-fast"
              style={{ cursor: "pointer" }}
            >
              Remove
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
