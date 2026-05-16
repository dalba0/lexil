import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Note } from "@/lib/types";

interface Props {
  packId: string;
  entryId: number;
}

/**
 * The Notes section sits between Senses and Conjugations in the entry
 * view. Each note is one short italic line tied to the entry; users can
 * jot down anecdotes ("Mom uses this") or mnemonics ("don't confuse with
 * correo"). Pinned by date.
 */
export function NotesSection({ packId, entryId }: Props) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    api.listNotes(packId, entryId).then(setNotes).catch(() => setNotes([]));
  }, [packId, entryId]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setAdding(false);
      return;
    }
    await api.addNote(packId, entryId, trimmed);
    setText("");
    setAdding(false);
    const fresh = await api.listNotes(packId, entryId);
    setNotes(fresh);
  };

  const removeNote = async (id: number) => {
    await api.deleteNote(id);
    setNotes((cur) => cur.filter((n) => n.id !== id));
  };

  return (
    <section className="mt-8 border-t border-border pt-4">
      <div className="caption mb-2 flex items-baseline justify-between text-faint">
        <span>Notes</span>
        {notes.length > 0 && !adding ? (
          <button
            onClick={() => setAdding(true)}
            className="text-[12px] tracking-normal text-muted hover:text-ink transition-colors duration-fast"
            style={{ textTransform: "none", letterSpacing: 0, fontWeight: 400 }}
          >
            + Add a note
          </button>
        ) : null}
      </div>

      {notes.map((n) => (
        <div
          key={n.id}
          className="group flex items-start gap-3 py-2 font-serif text-[15px] italic leading-6 text-ink"
        >
          <span className="not-italic text-faint">¶</span>
          <span className="flex-1">{n.text}</span>
          <span className="not-italic whitespace-nowrap text-[12px] text-faint">
            {formatDate(n.created_at)}
          </span>
          <button
            onClick={() => removeNote(n.id)}
            className="bg-transparent border-0 p-0 text-faint opacity-0 transition-opacity duration-fast group-hover:opacity-100 hover:text-accent"
            aria-label="Delete note"
            style={{ cursor: "pointer", fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      ))}

      {adding || notes.length === 0 ? (
        <div className="mt-1 flex gap-3 border-t border-dashed border-border pt-2 font-serif text-[14px] italic leading-6">
          <span className="not-italic text-faint">¶</span>
          <input
            value={text}
            autoFocus={adding}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setAdding(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              if (e.key === "Escape") {
                setText("");
                setAdding(false);
              }
            }}
            onBlur={submit}
            placeholder="Add a note…"
            className="flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
            style={{ font: "inherit" }}
          />
        </div>
      ) : null}
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const now = new Date();
  if (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  ) {
    return "Today";
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
