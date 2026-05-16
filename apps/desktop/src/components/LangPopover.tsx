import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LANG_LABEL,
  directionToPair,
  pairToDirection,
} from "@/lib/direction";
import type { Lang, SearchDirection } from "@/lib/types";

interface Props {
  direction: SearchDirection;
  onSetDirection: (d: SearchDirection) => void;
  availablePacks: string[];
}

// All languages the app *might* support. We compute which are actually
// usable from `availablePacks` at render time, so a language whose pack
// isn't bundled stays visible but disabled.
const ALL_LANGS: Lang[] = ["es", "en", "fr"];

// Map a non-English language to the pack that bridges it to English.
const PACK_FOR: Record<Exclude<Lang, "en">, string> = {
  es: "spanish-en",
  fr: "french-en",
};

export function LangPopover({ direction, onSetDirection, availablePacks }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const { from, to } = directionToPair(direction);
  const enabled = enabledLangs(availablePacks);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Clicking a language in either column pivots through English: when the
  // chosen side is non-EN, the opposite side becomes EN. When the chosen
  // side IS EN, we keep the opposite side if it's still valid; otherwise
  // fall back to whichever non-EN language has a pack loaded.
  const choose = (column: "from" | "to", code: Lang) => {
    if (!enabled.has(code)) return;

    let newFrom: Lang = from;
    let newTo: Lang = to;

    if (column === "from") {
      newFrom = code;
      if (code !== "en") {
        newTo = "en";
      } else {
        newTo = to !== "en" && enabled.has(to)
          ? to
          : (from !== "en" && enabled.has(from) ? from : firstNonEn(enabled));
      }
    } else {
      newTo = code;
      if (code !== "en") {
        newFrom = "en";
      } else {
        newFrom = from !== "en" && enabled.has(from)
          ? from
          : (to !== "en" && enabled.has(to) ? to : firstNonEn(enabled));
      }
    }

    onSetDirection(pairToDirection(newFrom, newTo));
    setOpen(false);
  };

  const swap = () => {
    onSetDirection(pairToDirection(to, from));
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-2 rounded-input border bg-surface px-3.5 py-1.5 text-body-sm text-ink transition-colors duration-fast",
          open ? "border-accent" : "border-border hover:border-ink/30",
        )}
      >
        <span>{LANG_LABEL[from]}</span>
        <span className="text-faint" aria-hidden>→</span>
        <span>{LANG_LABEL[to]}</span>
        <ChevronDown
          size={12}
          strokeWidth={1.5}
          className={cn(
            "ml-0.5 text-muted transition-transform duration-base ease-out",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="absolute left-1/2 top-[calc(100%+8px)] z-20 w-[380px] -translate-x-1/2 rounded-card border border-border bg-surface p-5 lex-rise">
          <div className="grid grid-cols-[1fr_32px_1fr] items-start gap-2">
            <Column
              label="From"
              selected={from}
              enabled={enabled}
              onSelect={(code) => choose("from", code)}
            />
            <div className="flex justify-center pt-8 text-muted">
              <button
                onClick={swap}
                aria-label="Swap direction"
                className="inline-flex h-8 w-8 items-center justify-center rounded-input text-muted transition-colors duration-fast hover:bg-border/40 hover:text-ink"
              >
                <ArrowLeftRight size={16} strokeWidth={1.5} />
              </button>
            </div>
            <Column
              label="To"
              selected={to}
              enabled={enabled}
              onSelect={(code) => choose("to", code)}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Column({
  label,
  selected,
  enabled,
  onSelect,
}: {
  label: string;
  selected: Lang;
  enabled: Set<Lang>;
  onSelect: (code: Lang) => void;
}) {
  return (
    <div>
      <div className="caption mb-2 text-faint">{label}</div>
      <div className="space-y-1">
        {ALL_LANGS.map((code) => {
          const isSelected = selected === code;
          const disabled = !enabled.has(code);
          return (
            <button
              key={code}
              disabled={disabled}
              onClick={() => onSelect(code)}
              className={cn(
                "block w-full rounded-[4px] px-2 py-0.5 text-left font-serif text-[15px] leading-7 transition-colors duration-fast",
                disabled && "cursor-not-allowed text-faint",
                !disabled && isSelected && "bg-highlight text-ink",
                !disabled && !isSelected && "text-ink hover:bg-border/30",
              )}
            >
              {LANG_LABEL[code]}
              {disabled ? (
                <span className="ml-2 text-faint text-[12px]">(coming soon)</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// English is enabled if any pack is loaded (it bridges everything).
// A non-EN language is enabled if its English-pivot pack is loaded.
function enabledLangs(availablePacks: string[]): Set<Lang> {
  const packs = new Set(availablePacks);
  const out = new Set<Lang>();
  for (const lang of ALL_LANGS) {
    if (lang === "en") {
      if (packs.size > 0) out.add("en");
    } else if (packs.has(PACK_FOR[lang])) {
      out.add(lang);
    }
  }
  return out;
}

function firstNonEn(enabled: Set<Lang>): Lang {
  for (const lang of ALL_LANGS) {
    if (lang !== "en" && enabled.has(lang)) return lang;
  }
  return "es";
}
