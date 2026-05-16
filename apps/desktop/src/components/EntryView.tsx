import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { Conjugations } from "@/components/Conjugations";
import { NotesSection } from "@/components/NotesSection";
import { TagsRow } from "@/components/TagsRow";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Entry } from "@/lib/types";

interface Props {
  entry: Entry;
  packId: string;
  matchedForm: string | null;
  attribution: string | null;
}

export function EntryView({ entry, packId, matchedForm, attribution }: Props) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    api.isFavorite(packId, entry.id).then(setFavorite).catch(() => setFavorite(false));
  }, [packId, entry.id]);

  const toggleFav = async () => {
    const next = await api.toggleFavorite(packId, entry.id, entry.headword, entry.pos);
    setFavorite(next);
  };

  return (
    <article className="lex-rise selectable mx-auto w-full max-w-[720px] px-8 pb-16 pt-12">
      {/* Header row: headword · IPA · POS · star */}
      <header className="mb-2 flex items-baseline gap-4">
        <h1 className="display-headword text-ink">{entry.headword}</h1>
        {entry.ipa ? (
          <span className="font-mono text-[14px] leading-5 text-muted">
            {entry.ipa}
          </span>
        ) : null}
        {entry.pos ? (
          <span className="text-[13px] leading-5 italic text-faint">
            {entry.pos}
          </span>
        ) : null}
        {entry.gender ? (
          <span className="text-[13px] leading-5 italic text-faint">
            {entry.gender}
          </span>
        ) : null}
        <button
          onClick={toggleFav}
          aria-label={favorite ? "Remove from favorites" : "Save to favorites"}
          className={cn(
            "ml-auto inline-flex h-8 w-8 items-center justify-center rounded-input text-muted transition-colors duration-fast hover:text-ink",
            favorite && "text-accent hover:text-accent",
          )}
        >
          <Star
            size={20}
            strokeWidth={1.5}
            fill={favorite ? "currentColor" : "none"}
          />
        </button>
      </header>

      {matchedForm && matchedForm !== entry.headword ? (
        <p className="-mt-1 mb-2 text-body-sm text-muted">
          form of <span className="text-ink">{entry.headword}</span>: {matchedForm}
        </p>
      ) : null}

      {/* Tags */}
      <TagsRow packId={packId} entryId={entry.id} />

      {/* Senses */}
      <ol className="mt-6">
        {entry.senses.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[32px_1fr] gap-x-4 gap-y-2 border-t border-border py-4"
          >
            <div className="font-serif text-[20px] leading-7 text-faint">
              {s.sense_number}
            </div>
            <div className="text-[13px] leading-5 italic text-muted">
              {s.definition}
              {s.register || s.domain ? (
                <span className="ml-2 not-italic text-faint">
                  ({[s.register, s.domain].filter(Boolean).join(", ")})
                </span>
              ) : null}
            </div>
            {s.examples.length > 0 ? (
              <ul className="col-start-2 space-y-2">
                {s.examples.map((ex, i) => (
                  <li
                    key={i}
                    className="mt-2 border-l border-border pl-4 font-serif text-[15px] leading-6 text-ink"
                  >
                    <Highlight text={ex.text} target={entry.headword} />
                    {ex.translation ? (
                      <div className="mt-0.5 font-sans text-[13px] leading-5 italic text-muted">
                        {ex.translation}
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      {/* User notes */}
      <NotesSection packId={packId} entryId={entry.id} />

      {/* Conjugations (verbs only) */}
      {entry.pos === "verb" ? (
        <Conjugations inflections={entry.inflections} />
      ) : null}

      {/* Source footer */}
      {attribution ? (
        <footer className="caption mt-12 border-t border-border pt-4 text-faint">
          {compactAttribution(attribution)}
        </footer>
      ) : null}
    </article>
  );
}

// Squeezes the long attribution string down to "Source: Wiktionary ·
// CC-BY-SA" style for the footer, matching the mockup. Full attribution
// remains visible in the Settings → Dictionary pack section.
function compactAttribution(full: string): string {
  // Try to identify Wiktionary + license; otherwise show the original.
  const hasWiktionary = /Wiktionary/i.test(full);
  const licenseMatch = full.match(/CC-?BY-?SA[\s-]*\d?(\.\d)?/i);
  if (hasWiktionary && licenseMatch) {
    return `Source: Wiktionary · ${licenseMatch[0].toUpperCase().replace(/\s+/g, "-")}`;
  }
  return full;
}

// Highlights occurrences of the headword stem inside an example.
function Highlight({ text, target }: { text: string; target: string }) {
  if (!target || target.length < 3) return <>{text}</>;
  const stem = target.slice(0, Math.max(3, Math.min(target.length, 4))).toLowerCase();
  const parts: Array<{ s: string; mark: boolean }> = [];
  const re = new RegExp(`(${escapeRegExp(stem)}\\p{L}*)`, "giu");
  let last = 0;
  for (const m of text.matchAll(re)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({ s: text.slice(last, idx), mark: false });
    parts.push({ s: m[0], mark: true });
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({ s: text.slice(last), mark: false });
  return (
    <>
      {parts.map((p, i) =>
        p.mark ? (
          <mark className="lex-mark" key={i}>{p.s}</mark>
        ) : (
          <span key={i}>{p.s}</span>
        ),
      )}
    </>
  );
}

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
