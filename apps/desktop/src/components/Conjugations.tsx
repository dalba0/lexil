import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Inflection, Lang } from "@/lib/types";

// Why this is complicated:
//
// Wiktionary inflection tables come out of kaikki with a tag *string* per
// form — but the tokens in that string appear in arbitrary order. For
// vivir's "yo present indicative" you see both '1 ind pres s' and '1 pres
// s'; for "nosotros imperfect indicative" it's '1 imperf ind p'; for
// '3rd person plural conditional' it's 'cond ind p 3'. Substring matching
// only catches accidental hits (the old code surfaced `vivamos` and almost
// nothing else).
//
// Strategy: tokenize the stored tag into a *set*, then match a cell if
// (a) every required token is present and (b) no forbidden token is
// present. The token-set view is order-independent, so all token
// permutations collapse to one canonical match.
//
// The four languages have very different paradigms, so each one defines
// its own cell config. Romance + German share a 6-person grid; Japanese
// renders as a flat list of named forms (no person inflection).

interface Props {
  inflections: Inflection[];
  lang: Lang;
  headword: string;
}

export function Conjugations({ inflections, lang, headword }: Props) {
  // Filter out IPA pronunciation strings — kaikki sometimes stores them
  // as inflection rows with no distinguishing tag, so "parle" and "paʁl"
  // appear side by side. Strip anything containing IPA-only characters.
  const filtered = inflections.filter((r) => !isIPA(r.form));
  if (lang === "ja") {
    return <JapaneseConjugations inflections={filtered} headword={headword} />;
  }
  return <PersonGridConjugations inflections={filtered} lang={lang} headword={headword} />;
}

// Characters that only appear in IPA / phonetic transcription, never
// in orthographic French/Spanish/German/Japanese. A single hit means
// the whole form is a pronunciation, not a written form.
const IPA_CHARS = /[ʁʃʒɛɔœɥɲŋəɐɑːˈˌθðɹɣχʕʔɪʊæʌɒɜɚɝɫɾɻɓɗɠʣʤʦʧβʝʟɭʈɖɳɽɸ]/;
function isIPA(s: string): boolean {
  return IPA_CHARS.test(s);
}

// ─── shared tag-matching primitives ────────────────────────────────────

function tokenize(tagStr: string): Set<string> {
  const t = new Set<string>();
  for (const part of tagStr.split(/\s+/)) {
    if (part) t.add(part.toLowerCase());
  }
  return t;
}

function matches(
  rowTokens: Set<string>,
  required: readonly string[],
  forbidden: readonly string[],
): boolean {
  for (const r of required) {
    if (!rowTokens.has(r)) return false;
  }
  for (const f of forbidden) {
    if (rowTokens.has(f)) return false;
  }
  return true;
}

/**
 * Returns deduped forms from rows whose tag-token-set matches
 * required ⊆ tokens AND tokens ∩ forbidden = ∅. Preserves insertion
 * order so the first canonical form wins.
 */
function pickForms(
  inflections: Inflection[],
  required: readonly string[],
  forbidden: readonly string[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of inflections) {
    if (!matches(tokenize(r.tags), required, forbidden)) continue;
    if (seen.has(r.form)) continue;
    seen.add(r.form);
    out.push(r.form);
  }
  return out;
}

// ─── person-grid layout (Spanish / French / German) ────────────────────

interface PersonDef {
  label: string;
  tokens: readonly string[]; // tokens identifying this person/number
}

interface TenseDef {
  label: string;
  defaultOpen: boolean;
  required: readonly string[]; // shared required tokens for the whole tense
  forbidden: readonly string[]; // shared forbidden tokens
}

interface PersonGridConfig {
  persons: readonly PersonDef[];
  tenses: readonly TenseDef[];
  nonfinite: ReadonlyArray<{ label: string; required: string[]; forbidden: string[] }>;
}

// Spanish — six-person grid, full set of indicative/subjunctive tenses,
// plus the formal/informal imperative split (we show the affirmative
// imperative; "él/ella" picks up the formal "usted" command).
//
// EXCLUDE_NOISE applies to *every* cell — these tokens identify rows we
// never want to show in the basic paradigm: combined pronoun forms
// (vivámonos, viviéndome…), accusative/dative pronoun merges,
// orthographic variants, and table-metadata rows.
const ES_EXCLUDE = [
  "combined-form",
  "accusative",
  "dative",
  "alternative",
  "obsolete",
  "inflection-template",
  "table-tags",
  "multiword-construction",
];

const ES_CONFIG: PersonGridConfig = {
  persons: [
    { label: "yo", tokens: ["1", "s"] },
    { label: "nosotros", tokens: ["1", "p"] },
    { label: "tú", tokens: ["2", "s"] },
    { label: "vosotros", tokens: ["2", "p"] },
    { label: "él / ella", tokens: ["3", "s"] },
    { label: "ellos / ellas", tokens: ["3", "p"] },
  ],
  tenses: [
    // NOTE: we intentionally do NOT forbid `informal`/`formal` here.
    // Spanish 2nd-person rows are tagged `informal` (tú/vosotros) to
    // distinguish them from usted/ustedes (which Wiktionary tags as
    // 3rd-person + `formal`). Filtering on those tokens would empty the
    // tú cell. The person-token requirements (1/2/3 + s/p) already
    // discriminate correctly.
    {
      label: "Present indicative",
      defaultOpen: true,
      required: ["pres", "ind"],
      forbidden: [...ES_EXCLUDE, "sub", "imp", "cond", "fut", "imperf", "pret", "vos", "negative"],
    },
    {
      label: "Preterite indicative",
      defaultOpen: true,
      required: ["pret", "ind"],
      forbidden: [...ES_EXCLUDE, "sub", "imp", "cond", "fut", "imperf", "vos", "negative"],
    },
    {
      label: "Imperfect indicative",
      defaultOpen: true,
      required: ["imperf", "ind"],
      forbidden: [...ES_EXCLUDE, "sub", "imp", "cond", "fut", "vos", "negative", "imperfect-se"],
    },
    {
      label: "Future indicative",
      defaultOpen: false,
      required: ["fut", "ind"],
      forbidden: [...ES_EXCLUDE, "sub", "imp", "cond", "imperf", "vos", "negative"],
    },
    {
      label: "Conditional",
      defaultOpen: false,
      required: ["cond"],
      forbidden: [...ES_EXCLUDE, "sub", "imp", "vos", "negative", "perf"],
    },
    {
      label: "Present subjunctive",
      defaultOpen: false,
      required: ["pres", "sub"],
      forbidden: [...ES_EXCLUDE, "imp", "cond", "fut", "imperf", "vos", "negative"],
    },
    {
      label: "Imperfect subjunctive (-ra)",
      defaultOpen: false,
      required: ["imperf", "sub"],
      forbidden: [...ES_EXCLUDE, "imp", "cond", "fut", "vos", "negative", "imperfect-se"],
    },
    {
      label: "Imperfect subjunctive (-se)",
      defaultOpen: false,
      required: ["imperf", "sub", "imperfect-se"],
      forbidden: [...ES_EXCLUDE, "imp", "cond", "fut", "vos", "negative"],
    },
    {
      label: "Future subjunctive",
      defaultOpen: false,
      required: ["fut", "sub"],
      forbidden: [...ES_EXCLUDE, "imp", "cond", "vos", "negative", "perf"],
    },
    {
      label: "Imperative (affirmative)",
      defaultOpen: false,
      required: ["imp"],
      forbidden: [...ES_EXCLUDE, "negative", "vos", "sub", "cond", "fut", "ind", "perf"],
    },
    {
      label: "Imperative (negative)",
      defaultOpen: false,
      required: ["imp", "negative"],
      forbidden: [...ES_EXCLUDE, "vos", "sub", "cond", "fut", "ind", "perf"],
    },
  ],
  nonfinite: [
    { label: "Infinitive", required: [], forbidden: [] }, // handled via headword
    { label: "Gerund", required: ["ger"], forbidden: [...ES_EXCLUDE] },
    { label: "Past participle", required: ["part", "past"], forbidden: [...ES_EXCLUDE, "f", "p", "m"] },
    { label: "Past participle (fem.)", required: ["part", "past", "f", "s"], forbidden: [...ES_EXCLUDE, "p"] },
    { label: "Past participle (plural)", required: ["part", "past", "m", "p"], forbidden: [...ES_EXCLUDE, "f"] },
  ],
};

// French — same person grid as Spanish (yo↔je, nosotros↔nous, etc.).
// We exclude multiword-construction rows entirely because for French
// those rows store *descriptive text* ("past historic of avoir + past
// participle") rather than the conjugated phrase.
const FR_EXCLUDE = [
  "combined-form",
  "accusative",
  "dative",
  "alternative",
  "obsolete",
  "inflection-template",
  "table-tags",
  "multiword-construction",
];

const FR_CONFIG: PersonGridConfig = {
  persons: [
    { label: "je", tokens: ["1", "s"] },
    { label: "nous", tokens: ["1", "p"] },
    { label: "tu", tokens: ["2", "s"] },
    { label: "vous", tokens: ["2", "p"] },
    { label: "il / elle", tokens: ["3", "s"] },
    { label: "ils / elles", tokens: ["3", "p"] },
  ],
  tenses: [
    {
      label: "Présent (indicative)",
      defaultOpen: true,
      required: ["pres", "ind"],
      forbidden: [...FR_EXCLUDE, "sub", "imp", "cond", "fut", "imperf", "historic", "past", "perf"],
    },
    {
      label: "Imparfait",
      defaultOpen: true,
      required: ["imperf", "ind"],
      forbidden: [...FR_EXCLUDE, "sub", "imp", "cond", "fut", "historic", "past"],
    },
    {
      label: "Passé simple",
      defaultOpen: false,
      required: ["historic", "ind", "past"],
      forbidden: [...FR_EXCLUDE, "sub", "imp", "cond", "fut", "imperf", "perf"],
    },
    {
      label: "Futur simple",
      defaultOpen: true,
      required: ["fut", "ind"],
      forbidden: [...FR_EXCLUDE, "sub", "imp", "cond", "imperf", "historic", "past"],
    },
    {
      label: "Conditionnel",
      defaultOpen: false,
      required: ["cond"],
      forbidden: [...FR_EXCLUDE, "sub", "imp", "perf", "past"],
    },
    {
      label: "Subjonctif présent",
      defaultOpen: false,
      required: ["pres", "sub"],
      forbidden: [...FR_EXCLUDE, "imp", "cond", "fut", "imperf"],
    },
    {
      label: "Subjonctif imparfait",
      defaultOpen: false,
      required: ["imperf", "sub"],
      forbidden: [...FR_EXCLUDE, "imp", "cond", "fut"],
    },
    {
      label: "Impératif",
      defaultOpen: false,
      required: ["imp"],
      forbidden: [...FR_EXCLUDE, "sub", "cond", "fut", "ind"],
    },
  ],
  nonfinite: [
    { label: "Participe présent", required: ["part", "pres"], forbidden: [...FR_EXCLUDE] },
    { label: "Participe passé", required: ["part", "past"], forbidden: [...FR_EXCLUDE] },
  ],
};

// German — same six-person grid (ich/wir/du/ihr/er-sie-es/sie-Sie). The
// compound tenses (Perfekt, Plusquamperfekt, Futur I/II) come through as
// real multi-word phrases ("bin gegangen") tagged with
// multiword-construction — those ARE valid forms and we render them.
const DE_EXCLUDE = [
  "alternative",
  "obsolete",
  "inflection-template",
  "table-tags",
  "auxiliary",
  "class",
];

const DE_CONFIG: PersonGridConfig = {
  persons: [
    { label: "ich", tokens: ["1", "s"] },
    { label: "wir", tokens: ["1", "p"] },
    { label: "du", tokens: ["2", "s"] },
    { label: "ihr", tokens: ["2", "p"] },
    { label: "er / sie / es", tokens: ["3", "s"] },
    { label: "sie / Sie", tokens: ["3", "p"] },
  ],
  tenses: [
    {
      label: "Präsens",
      defaultOpen: true,
      required: ["pres", "ind"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "pret", "fut", "perf", "pluperf", "multiword-construction"],
    },
    {
      label: "Präteritum",
      defaultOpen: true,
      required: ["pret", "ind"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "pres", "fut", "perf", "pluperf", "multiword-construction"],
    },
    {
      label: "Perfekt",
      defaultOpen: false,
      required: ["perf", "ind", "multiword-construction"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "pluperf", "fut"],
    },
    {
      label: "Plusquamperfekt",
      defaultOpen: false,
      required: ["pluperf", "ind", "multiword-construction"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "perf", "fut"],
    },
    {
      label: "Futur I",
      defaultOpen: false,
      required: ["fut", "future-i", "ind", "multiword-construction"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "future-ii"],
    },
    {
      label: "Futur II",
      defaultOpen: false,
      required: ["fut", "future-ii", "ind", "multiword-construction"],
      forbidden: [...DE_EXCLUDE, "sub", "imp", "future-i"],
    },
    {
      label: "Konjunktiv I",
      defaultOpen: false,
      required: ["sub", "subjunctive-i"],
      forbidden: [...DE_EXCLUDE, "imp", "perf", "pluperf", "fut", "multiword-construction"],
    },
    {
      label: "Konjunktiv II",
      defaultOpen: false,
      required: ["sub", "subjunctive-ii"],
      forbidden: [...DE_EXCLUDE, "imp", "perf", "pluperf", "fut", "multiword-construction"],
    },
    {
      label: "Imperativ",
      defaultOpen: false,
      required: ["imp"],
      forbidden: [...DE_EXCLUDE, "sub", "ind", "fut", "perf", "pluperf"],
    },
  ],
  nonfinite: [
    { label: "Partizip Präsens", required: ["part", "pres"], forbidden: [...DE_EXCLUDE] },
    { label: "Partizip Perfekt", required: ["part", "past"], forbidden: [...DE_EXCLUDE] },
  ],
};

function PersonGridConjugations({
  inflections,
  lang,
  headword,
}: {
  inflections: Inflection[];
  lang: Lang;
  headword: string;
}) {
  const config = lang === "fr" ? FR_CONFIG : lang === "de" ? DE_CONFIG : ES_CONFIG;

  // Pre-compute each (person, tense) cell's forms.
  const grid = config.tenses.map((t) => {
    const cells = config.persons.map((p, pIdx) => {
      const required = [...t.required, ...p.tokens];
      // Forbidden tokens never include the person's own tokens.
      const forbidden = t.forbidden.filter((f) => !p.tokens.includes(f));
      const forms = pickForms(inflections, required, forbidden);
      // German fallback: wir (1p) and sie/Sie (3p) in Präsens and
      // Konjunktiv I are identical to the infinitive for almost every
      // verb. Wiktionary's table omits them. Fill from the headword.
      if (
        forms.length === 0 &&
        lang === "de" &&
        (t.label === "Präsens" || t.label === "Konjunktiv I") &&
        (pIdx === 1 /* wir */ || pIdx === 5) /* sie/Sie */
      ) {
        return [headword];
      }
      return forms;
    });
    return { tense: t, cells };
  });

  const nonfinite = config.nonfinite
    .filter((nf) => nf.required.length > 0) // skip "Infinitive" placeholder
    .map((nf) => ({ nf, forms: pickForms(inflections, nf.required, nf.forbidden) }))
    .filter((x) => x.forms.length > 0);

  const anyTenseHasContent = grid.some((g) => g.cells.some((c) => c.length > 0));
  if (!anyTenseHasContent && nonfinite.length === 0) return null;

  return (
    <section className="mt-8">
      <h2 className="caption mb-2 text-faint">Conjugations</h2>

      {grid.map((g) => {
        const hasAny = g.cells.some((c) => c.length > 0);
        if (!hasAny) return null;
        return (
          <Tense
            key={g.tense.label}
            label={g.tense.label}
            persons={config.persons}
            cells={g.cells}
            defaultOpen={g.tense.defaultOpen}
          />
        );
      })}

      {nonfinite.length > 0 ? (
        <div className="mt-6 border-t border-border pt-4">
          <div className="caption mb-2 text-faint">Forms</div>
          <div className="grid grid-cols-[160px_1fr] gap-x-3 gap-y-1.5">
            {nonfinite.map(({ nf, forms }) => (
              <ConjRow key={nf.label} label={nf.label} value={forms.join(" · ")} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Tense({
  label,
  persons,
  cells,
  defaultOpen,
}: {
  label: string;
  persons: readonly PersonDef[];
  cells: string[][];
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
            const leftI = rowIdx * 2;
            const rightI = rowIdx * 2 + 1;
            return (
              <Fragment key={rowIdx}>
                <PersonCell label={persons[leftI].label} forms={cells[leftI]} />
                <PersonCell label={persons[rightI].label} forms={cells[rightI]} />
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function PersonCell({ label, forms }: { label: string; forms: string[] }) {
  const text = forms.length === 0 ? null : forms.join(" · ");
  return (
    <div className="grid grid-cols-[120px_1fr] items-baseline gap-3">
      <span className="caption text-faint">{label}</span>
      <span
        className={cn(
          "font-serif text-[15px] leading-6",
          text ? "text-ink" : "text-faint",
        )}
      >
        {text ?? "—"}
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

// ─── Japanese layout ───────────────────────────────────────────────────
//
// Japanese has no person/number conjugation. Forms vary by aspect,
// politeness, and mood. We render a flat list of named forms — one row
// per form category. Each category's value is the picked surface form
// (preferring modern kanji over kana, kana over romaji).

const JA_EXCLUDE = [
  "alternative",
  "inflection-template",
  "table-tags",
  "romanization",
  "canonical",
  "stem",
  "irrealis",
  "realis",
  "error-unrecognized-form",
  "archaic",
  "bungo",
  "kyūjitai",
  "kanji",
  "perf", // classical perfective markers (-eri, -tari)
  "contrastive", // archaic concessive
  "desiderative", // -tai forms are descriptive in the data, often noise
];

interface JapaneseForm {
  label: string;
  required: readonly string[];
  forbidden: readonly string[];
  group: "plain" | "polite" | "voice" | "imperative" | "conditional";
  // Preferred surface-form suffix. The picker prefers a kanji form
  // whose orthography ends in this pattern — used to distinguish e.g.
  // 作ります (polite present, ends in ます) from 作りました (polite past,
  // ends in ました), or modern 作らない (ends in ない) from archaic
  // 作らず (ends in ず).
  preferSuffix?: RegExp;
  // Anti-pattern suffix: forms ending here are de-preferred (used so
  // "Polite present" doesn't pick up the longer "Polite past" form
  // bundled under the same tag).
  avoidSuffix?: RegExp;
  // If no matching row is found, use the headword as the form. Used
  // for plain present, since the terminative tag rarely carries the
  // kanji variant.
  fallbackHeadword?: boolean;
}

// Note on tag conventions in the Japanese pack:
//   terminative       = plain present (作る; kanji often missing → headword fallback)
//   perfective        = plain past   (作った)
//   negative          = plain negative (作らない, modern; bundled with archaic 作らず)
//   conjunctive       = te-form      (作って)
//   formal            = polite present (作ります)
//   polite            = polite present + past bundled (作ります, 作りました)
//   negative polite   = polite negative bundle (作りません, 作りませんでした)
//   volitional        = -ou / -you   (作ろう)
//   imp               = plain imperative (作れ)
//   imp polite        = let's-do polite imperative (作りましょう)
//   cond hypothetical = modern -eba conditional (作れば) — `cond` alone is archaic
//   causative/passive/potential are self-explanatory.
const JA_FORMS: readonly JapaneseForm[] = [
  {
    label: "Plain present (-u)",
    required: ["terminative"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "formal"],
    group: "plain",
    fallbackHeadword: true,
  },
  {
    label: "Plain past (-ta)",
    required: ["perfective"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "formal"],
    group: "plain",
    preferSuffix: /た$|だ$/,
  },
  {
    label: "Plain negative (-nai)",
    required: ["negative"],
    forbidden: [...JA_EXCLUDE, "polite", "formal", "past", "conjunctive", "passive", "potential", "imp"],
    group: "plain",
    preferSuffix: /ない$/,
  },
  {
    label: "Te-form",
    required: ["conjunctive"],
    forbidden: [...JA_EXCLUDE, "negative"],
    group: "plain",
    preferSuffix: /て$|で$/,
  },
  {
    label: "Polite (-masu)",
    required: ["formal"],
    forbidden: [...JA_EXCLUDE, "negative", "past", "imp"],
    group: "polite",
    preferSuffix: /ます$/,
    avoidSuffix: /ました$/,
  },
  {
    label: "Polite past (-mashita)",
    required: ["polite"],
    forbidden: [...JA_EXCLUDE, "negative", "imp", "potential", "passive", "causative"],
    group: "polite",
    preferSuffix: /ました$/,
  },
  {
    label: "Polite negative (-masen)",
    required: ["negative", "polite"],
    forbidden: [...JA_EXCLUDE, "imp", "potential", "passive", "causative"],
    group: "polite",
    preferSuffix: /ません$/,
    avoidSuffix: /でした$/,
  },
  {
    label: "Volitional (-ou)",
    required: ["volitional"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "formal"],
    group: "plain",
    preferSuffix: /う$|よう$/,
  },
  {
    label: "Imperative",
    required: ["imp"],
    forbidden: [...JA_EXCLUDE, "negative", "polite"],
    group: "imperative",
  },
  {
    label: "Imperative polite (let's)",
    required: ["imp", "polite"],
    forbidden: [...JA_EXCLUDE, "negative"],
    group: "imperative",
    preferSuffix: /ましょう$/,
  },
  {
    label: "Causative (-saseru)",
    required: ["causative"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "past", "potential", "passive"],
    group: "voice",
    preferSuffix: /せる$/,
  },
  {
    label: "Passive (-rareru)",
    required: ["passive"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "past", "potential", "causative"],
    group: "voice",
    preferSuffix: /れる$/,
  },
  {
    label: "Potential (-eru)",
    required: ["potential"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "past", "passive", "causative"],
    group: "voice",
    preferSuffix: /れる$/,
  },
  {
    label: "Conditional (-eba)",
    required: ["cond", "hypothetical"],
    forbidden: [...JA_EXCLUDE, "negative", "polite", "past", "passive", "potential", "causative"],
    group: "conditional",
    preferSuffix: /ば$/,
  },
];

// Filter a list of candidate forms down to the cleanest single surface
// representation. We prefer modern Japanese kanji, then kana, then
// romaji. Forms that look like descriptive notes (start with English
// like "short form:" or "contraction:") are stripped. The trailing
// " [tsukutta]" romaji annotation is stripped to keep display clean.
const KANJI_RE = /[一-鿿㐀-䶿]/;
const KANA_RE = /[぀-ゟ゠-ヿ]/;

function isDescriptive(form: string): boolean {
  return /:\s/.test(form) || /\bof\b/.test(form) || form.includes("+");
}

function stripRomajiAnnotation(form: string): string {
  // "作って [tsukutte]" → "作って"
  return form.replace(/\s*\[[^\]]+\]\s*$/, "").trim();
}

function pickJapaneseForm(
  forms: string[],
  preferSuffix?: RegExp,
  avoidSuffix?: RegExp,
): string | null {
  const cleaned = forms
    .map(stripRomajiAnnotation)
    .filter((f) => f && !isDescriptive(f));
  if (cleaned.length === 0) return null;

  // Score each candidate: kanji > kana > romaji; preferred suffix bumps,
  // avoided suffix penalizes. Then prefer shorter forms among ties.
  const scored = cleaned.map((f) => {
    let score = 0;
    if (KANJI_RE.test(f)) score += 100;
    else if (KANA_RE.test(f)) score += 50;
    if (preferSuffix && preferSuffix.test(f)) score += 30;
    if (avoidSuffix && avoidSuffix.test(f)) score -= 50;
    return { f, score, len: f.length };
  });
  scored.sort((a, b) => b.score - a.score || a.len - b.len);
  return scored[0].f;
}

function JapaneseConjugations({
  inflections,
  headword,
}: {
  inflections: Inflection[];
  headword: string;
}) {
  const rows = JA_FORMS.map((f) => {
    const candidates = pickForms(inflections, f.required, f.forbidden);
    let value = pickJapaneseForm(candidates, f.preferSuffix, f.avoidSuffix);
    // For "plain present" the terminative tag often has only hiragana
    // and romaji (because the kanji form IS the headword and Wiktionary
    // doesn't re-emit it). Prefer the kanji headword if the picked
    // value is hiragana-only.
    if (f.fallbackHeadword && KANJI_RE.test(headword) && (!value || !KANJI_RE.test(value))) {
      value = headword;
    }
    return { def: f, value };
  }).filter((r) => r.value !== null);

  if (rows.length === 0) return null;

  // Group sections so the layout stays scannable.
  const groups: Array<{ title: string; key: JapaneseForm["group"] }> = [
    { title: "Plain forms", key: "plain" },
    { title: "Polite forms", key: "polite" },
    { title: "Imperative", key: "imperative" },
    { title: "Voice", key: "voice" },
    { title: "Conditional", key: "conditional" },
  ];

  return (
    <section className="mt-8">
      <h2 className="caption mb-2 text-faint">Conjugations</h2>
      {groups.map((g) => {
        const items = rows.filter((r) => r.def.group === g.key);
        if (items.length === 0) return null;
        return (
          <div key={g.key} className="border-t border-border py-4">
            <div className="caption mb-2 text-faint">{g.title}</div>
            <div className="grid grid-cols-[180px_1fr] gap-x-3 gap-y-1.5">
              {items.map((it) => (
                <ConjRow key={it.def.label} label={it.def.label} value={it.value!} />
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}
