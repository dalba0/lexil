import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { LIST_GLYPHS, TAG_COLORS, type TagColor } from "@/lib/types";

interface Props {
  open: boolean;
  packId: string;
  onClose: () => void;
  onCreated: (listId: number) => void;
}

/**
 * Modal to create a new user list. Pick a name, an optional serif glyph
 * (the visual identity in the sidebar), and an optional color from the
 * shared tag palette.
 */
export function CreateListDialog({ open, packId, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [glyph, setGlyph] = useState<string | null>("★");
  const [color, setColor] = useState<TagColor>("none");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setGlyph("★");
      setColor("none");
      setSaving(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const id = await api.createList(
        packId,
        trimmed,
        glyph,
        color === "none" ? null : color,
      );
      onCreated(id);
      onClose();
    } catch (e) {
      setSaving(false);
      window.alert(`Couldn't create list: ${e}`);
    }
  };

  return (
    <div
      className="lex-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lex-rise relative w-[440px] rounded-card border border-border bg-surface px-8 pb-6 pt-8 shadow-[0_24px_64px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)]"
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-input text-muted transition-colors duration-fast hover:text-ink"
          aria-label="Close"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        <h2 className="font-serif text-[28px] leading-9 tracking-[-0.01em] text-ink">
          New list
        </h2>
        <p className="mt-1 text-body-sm text-muted">
          Group words however you like — by book, by topic, by exam prep.
        </p>

        <div className="mt-6">
          <div className="caption mb-2 text-faint">Name</div>
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder='e.g. "Cien años de soledad"'
            className="w-full border-b border-border bg-transparent pb-1.5 font-serif text-[18px] text-ink outline-none placeholder:text-faint focus:border-accent"
          />
        </div>

        <div className="mt-6">
          <div className="caption mb-2 text-faint">Glyph</div>
          <div className="flex flex-wrap gap-2">
            {LIST_GLYPHS.map((g) => (
              <button
                key={g}
                onClick={() => setGlyph(g)}
                className={cn(
                  "h-9 w-9 rounded-input border font-serif text-[18px] leading-none transition-colors duration-fast",
                  glyph === g
                    ? "border-accent text-ink"
                    : "border-border text-muted hover:text-ink",
                )}
              >
                {g}
              </button>
            ))}
            <button
              onClick={() => setGlyph(null)}
              className={cn(
                "h-9 rounded-input border px-3 text-[12px] transition-colors duration-fast",
                glyph === null
                  ? "border-accent text-ink"
                  : "border-border text-muted hover:text-ink",
              )}
            >
              None
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="caption mb-2 text-faint">Color</div>
          <div className="flex gap-2">
            {TAG_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setColor(c)}
                aria-label={c}
                className={cn("tag-swatch", color === c && "selected")}
                data-color={c}
              />
            ))}
          </div>
        </div>

        <div className="mt-8 flex justify-between border-t border-border pt-4">
          <button
            onClick={onClose}
            className="text-body-sm text-muted hover:text-ink transition-colors duration-fast"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim() || saving}
            className={cn(
              "text-body-sm font-medium transition-colors duration-fast",
              !name.trim() || saving
                ? "cursor-not-allowed text-faint"
                : "text-accent hover:opacity-80",
            )}
          >
            {saving ? "Creating…" : "Create list"}
          </button>
        </div>
      </div>
    </div>
  );
}
