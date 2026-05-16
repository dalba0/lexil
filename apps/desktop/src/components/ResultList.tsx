import { cn } from "@/lib/utils";
import type { SearchDirection, SearchResult } from "@/lib/types";

interface Props {
  results: SearchResult[];
  selectedIndex: number;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
  query: string;
  direction: SearchDirection;
}

export function ResultList({
  results,
  selectedIndex,
  onSelect,
  onHover,
  query,
  direction,
}: Props) {
  if (results.length === 0) {
    return query.trim() ? (
      <div className="py-10 text-center text-body-sm text-muted">No matches.</div>
    ) : null;
  }

  return (
    <ul>
      {results.map((r, i) => {
        // When the match came via the inflection table, show the inflected
        // form the user actually typed as the headword on this row, and
        // tell them which lemma it belongs to via the right-aligned badge.
        const isFormOf = Boolean(r.matched_form && r.matched_form !== r.headword);
        const displayHead = isFormOf ? r.matched_form! : r.headword;

        return (
          <li
            key={`${r.entry_id}-${r.matched_form ?? "h"}-${i}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(r);
            }}
            onMouseEnter={() => onHover(i)}
            className={cn(
              "cursor-pointer border-b border-border px-8 pt-3.5 pb-4 transition-colors duration-fast hover:bg-border/20",
              i === selectedIndex && "row-selected",
            )}
          >
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0 truncate">
                <span className="font-serif text-[20px] leading-7 font-medium text-ink tracking-[-0.005em]">
                  {displayHead}
                </span>
                {r.pos ? (
                  <span className="ml-2.5 text-[13px] italic text-faint">
                    {r.pos}
                  </span>
                ) : null}
                {r.gender ? (
                  <span className="ml-2 text-[13px] italic text-faint">
                    {r.gender}
                  </span>
                ) : null}
              </div>
              {isFormOf ? (
                <span
                  className="caption shrink-0 text-accent"
                  style={{ opacity: 0.55 }}
                >
                  form of {r.headword}
                </span>
              ) : null}
            </div>

            {r.gloss_preview ? (
              <div className="mt-0.5 truncate text-[13px] leading-5 text-muted">
                {direction === "en-es" ? (
                  <HighlightTerms text={r.gloss_preview} query={query} />
                ) : (
                  r.gloss_preview
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

// Highlights every occurrence of each typed word inside a gloss. Tokens
// shorter than 2 chars are skipped so common particles don't strobe the row.
function HighlightTerms({ text, query }: { text: string; query: string }) {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9']/g, ""))
    .filter((t) => t.length >= 2);

  if (terms.length === 0) return <>{text}</>;

  const pattern = new RegExp(
    `(${terms.map(escapeRegExp).join("|")})`,
    "gi",
  );

  const parts: Array<{ s: string; mark: boolean }> = [];
  let last = 0;
  for (const m of text.matchAll(pattern)) {
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
          <mark className="lex-mark" key={i}>
            {p.s}
          </mark>
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
