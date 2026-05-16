// Inverse of the compaction in pipeline/sources/kaikki_spanish.py.
// The DB stores "1 s pres ind"; this expands tokens to long-form for display.

const TOKEN_TO_LABEL: Record<string, string> = {
  "1": "1st person",
  "2": "2nd person",
  "3": "3rd person",
  s: "singular",
  p: "plural",
  pres: "present",
  pret: "preterite",
  imperf: "imperfect",
  fut: "future",
  cond: "conditional",
  sub: "subjunctive",
  ind: "indicative",
  imp: "imperative",
  inf: "infinitive",
  part: "participle",
  ger: "gerund",
  past: "past",
  perf: "perfect",
  pluperf: "pluperfect",
  m: "masculine",
  f: "feminine",
  tu: "tú",
  vos: "vos",
  ud: "usted",
  uds: "ustedes",
  nosotros: "nosotros",
  vosotros: "vosotros",
  ellos: "ellos",
  yo: "yo",
};

export function expandTags(compact: string): string {
  return compact
    .split(" ")
    .filter(Boolean)
    .map((t) => TOKEN_TO_LABEL[t] ?? t)
    .join(" ");
}

// Spanish conjugation grid used by the detail view.
export const PERSONS: Array<{ label: string; key: string }> = [
  { label: "yo", key: "1 s" },
  { label: "tú", key: "2 s" },
  { label: "él/ella", key: "3 s" },
  { label: "nosotros", key: "1 p" },
  { label: "vosotros", key: "2 p" },
  { label: "ellos/ellas", key: "3 p" },
];

export const TENSES: Array<{ label: string; key: string; defaultOpen: boolean }> = [
  { label: "Present indicative", key: "pres ind", defaultOpen: true },
  { label: "Preterite indicative", key: "pret ind", defaultOpen: true },
  { label: "Imperfect indicative", key: "imperf ind", defaultOpen: false },
  { label: "Future indicative", key: "fut ind", defaultOpen: false },
  { label: "Conditional", key: "cond", defaultOpen: false },
  { label: "Present subjunctive", key: "pres sub", defaultOpen: false },
];

export const NONFINITE: Array<{ label: string; tag: string }> = [
  { label: "Infinitive", tag: "inf" },
  { label: "Gerund", tag: "ger" },
  { label: "Past participle", tag: "part past" },
];

export function indexInflections(rows: Array<{ form: string; tags: string }>) {
  const byTag = new Map<string, string>();
  for (const r of rows) byTag.set(r.tags, r.form);
  return byTag;
}
