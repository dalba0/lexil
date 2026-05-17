import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Entry } from "@/lib/types";

interface Props {
  packId: string;
  onOpen: (entryId: number) => void;
}

// Curated list of words to surface as "Word of the moment". We pick one
// at random per app launch (and try a few others if the chosen word
// happens not to be in the active pack). Mixing Spanish and French
// candidates so the same list works for whichever pack is active —
// non-matching words are skipped.
const FEATURED = [
  // Spanish
  "correr", "hablar", "ser", "estar", "tener", "hacer", "vivir",
  "decir", "ver", "querer", "saber", "creer", "comer", "andar",
  "casa", "libro", "agua", "sol", "luz", "tiempo", "mundo", "vida",
  // French
  "courir", "parler", "être", "avoir", "vivre", "faire", "voir",
  "dire", "savoir", "pouvoir", "vouloir", "aimer", "manger",
  "maison", "livre", "eau", "soleil", "lumière", "temps", "monde", "vie",
];

export function EmptyState({ packId, onOpen }: Props) {
  const [entry, setEntry] = useState<Entry | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntry(null);
    pickFeatured(packId).then((e) => {
      if (!cancelled) setEntry(e);
    });
    return () => {
      cancelled = true;
    };
  }, [packId]);

  const glosses = entry
    ? entry.senses.slice(0, 3).map((s) => shortGloss(s.definition))
    : [];

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-8 pb-12">
      <div className="caption mb-6 text-faint">Word of the moment</div>

      {entry ? (
        <button
          onClick={() => onOpen(entry.id)}
          className="max-w-[480px] cursor-pointer rounded-card px-4 py-2 text-center transition-colors duration-fast hover:bg-border/20"
        >
          <div className="display-headword text-ink">{entry.headword}</div>
          <div className="mt-2 flex items-baseline justify-center gap-3">
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
          </div>
          {glosses.length > 0 ? (
            <div className="mt-6 font-serif text-body leading-6 text-muted">
              {glosses.map((g, i) => (
                <span key={i}>
                  {i > 0 ? (
                    <span aria-hidden className="mx-2 text-faint">—</span>
                  ) : null}
                  {g}
                </span>
              ))}
            </div>
          ) : null}
        </button>
      ) : null}

      <div className="absolute bottom-8 left-0 right-0 text-center caption text-faint">
        Type a word, or press{" "}
        <span className="font-mono normal-case tracking-normal text-muted">
          Ctrl + K
        </span>
      </div>
    </div>
  );
}

async function pickFeatured(packId: string): Promise<Entry | null> {
  const order = shuffle(FEATURED);
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

function shuffle<T>(arr: readonly T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Trim a gloss down to its first short clause for the em-dash list.
function shortGloss(s: string): string {
  return s.split(/[(;]/)[0].trim();
}
