import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Inflection } from "@/lib/types";

// The tenses Lexil surfaces, in display order. Present / Preterite /
// Imperfect open by default; the rest collapse.
//
// Whether a given tense renders at all depends on the data — Wiktionary's
// inflection tables vary by verb (a defective verb won't have every
// tense). Empty tenses are dropped silently rather than padded with
// placeholders.
const TENSES = [
  { label: "Present indicative", key: "pres ind", defaultOpen: true },
  { label: "Preterite indicative", key: "pret ind", defaultOpen: true },
  { label: "Imperfect indicative", key: "imperf ind", defaultOpen: true },
  { label: "Future indicative", key: "fut ind", defaultOpen: false },
  { label: "Conditional", key: "cond", defaultOpen: false },
  { label: "Present subjunctive", key: "pres sub", defaultOpen: false },
  { label: "Imperfect subjunctive", key: "imperf sub", defaultOpen: false },
  { label: "Future subjunctive", key: "fut sub", defaultOpen: false },
  { label: "Imperative", key: "imp", defaultOpen: false },
];

// Person labels match the mockup spacing (slashes with spaces).
// Order is linear; pairing for the 2-column grid is done by index.
const PERSONS: Array<{ label: string; key: string }> = [
  { label: "yo", key: "1 s" },
  { label: "nosotros", key: "1 p" },
  { label: "tú", key: "2 s" },
  { label: "vosotros", key: "2 p" },
  { label: "él / ella", key: "3 s" },
  { label: "ellos / ellas", key: "3 p" },
];

const NONFINITE: Array<{ label: string; tag: string }> = [
  { label: "Infinitive", tag: "inf" },
  { label: "Gerund", tag: "ger" },
  { label: "Past participle", tag: "part past" },
];

interface Props {
  inflections: Inflection[];
}

export function Conjugations({ inflections }: Props) {
  const byTag = new Map<string, string>();
  for (const r of inflections) byTag.set(r.tags, r.form);

  const nonfinite = NONFINITE.filter((nf) => byTag.has(nf.tag));
  const hasAnyTense = TENSES.some((t) =>
    PERSONS.some((p) => byTag.has(`${p.key} ${t.key}`)),
  );

  if (!hasAnyTense && nonfinite.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="caption mb-2 text-faint">Conjugations</h2>

      {TENSES.map((t) => {
        const hasAny = PERSONS.some((p) =>
          byTag.has(`${p.key} ${t.key}`),
        );
        if (!hasAny) return null;
        return (
          <Tense
            key={t.key}
            label={t.label}
            tenseKey={t.key}
            byTag={byTag}
            defaultOpen={t.defaultOpen}
          />
        );
      })}

      {nonfinite.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <div className="caption mb-2 text-faint">Forms</div>
          <div className="grid grid-cols-[120px_1fr] gap-x-3 gap-y-1.5">
            {nonfinite.map((nf) => (
              <ConjRow key={nf.tag} label={nf.label} value={byTag.get(nf.tag)!} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Tense({
  label,
  tenseKey,
  byTag,
  defaultOpen,
}: {
  label: string;
  tenseKey: string;
  byTag: Map<string, string>;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border py-4">
      <button
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center justify-between text-left"
      >
        <span
          className={cn(
            "font-serif text-[15px] leading-6 transition-colors duration-fast",
            open
              ? "font-medium text-ink"
              : "font-normal text-muted group-hover:text-ink",
          )}
        >
          {label}
        </span>
        <ChevronDown
          size={14}
          strokeWidth={1.5}
          className={cn(
            "text-muted transition-transform duration-base ease-out",
            open && "rotate-180",
          )}
        />
      </button>

      {open ? (
        <div className="mt-3 grid grid-cols-2 gap-x-12 gap-y-2">
          {[0, 1, 2].map((rowIdx) => {
            const left = PERSONS[rowIdx * 2];
            const right = PERSONS[rowIdx * 2 + 1];
            return (
              <Fragment key={rowIdx}>
                <PersonCell label={left.label} form={byTag.get(`${left.key} ${tenseKey}`)} />
                <PersonCell label={right.label} form={byTag.get(`${right.key} ${tenseKey}`)} />
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PersonCell({ label, form }: { label: string; form: string | undefined }) {
  return (
    <div className="grid grid-cols-[80px_1fr] items-baseline gap-3">
      <span className="caption text-faint">{label}</span>
      <span
        className={cn(
          "font-serif text-[15px] leading-6",
          form ? "text-ink" : "text-faint",
        )}
      >
        {form ?? "—"}
      </span>
    </div>
  );
}

function ConjRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <span className="caption text-faint">{label}</span>
      <span className="font-serif text-[15px] leading-6 text-ink">{value}</span>
    </>
  );
}
