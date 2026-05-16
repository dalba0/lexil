import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { packIdForDirection } from "@/lib/direction";
import type { Entry, SearchDirection, Theme } from "@/lib/types";

interface Props {
  availablePacks: string[];
  initialDirection: SearchDirection;
  onSetDirection: (d: SearchDirection) => void;
  initialTheme: Theme;
  onSetTheme: (t: Theme) => void;
  onFinish: (entry: Entry | null) => void;
}

type Step = "welcome" | "pack" | "theme" | "first";

const STEP_ORDER: Step[] = ["welcome", "pack", "theme", "first"];

const PACK_LABELS: Record<string, { from: string; to: string; dir: SearchDirection }> = {
  "spanish-en": { from: "Spanish", to: "English", dir: "es-en" },
  "french-en": { from: "French", to: "English", dir: "fr-en" },
};

/**
 * First-run onboarding. The app starts in Paper (the natural baseline);
 * the theme picker on step 3 is where the choice is made. Everything
 * else lives in Settings — no reading-level quiz, no import dialog, no
 * account creation.
 */
export function OnboardingFlow({
  availablePacks,
  initialDirection,
  onSetDirection,
  initialTheme,
  onSetTheme,
  onFinish,
}: Props) {
  const [step, setStep] = useState<Step>("welcome");
  const [chosenPack, setChosenPack] = useState<string>(
    packIdForDirection(initialDirection),
  );
  const [chosenTheme, setChosenTheme] = useState<Theme>(initialTheme);
  const [firstEntry, setFirstEntry] = useState<Entry | null>(null);

  // When entering step 4, ensure direction matches the chosen pack, then
  // fetch a featured word from that pack.
  useEffect(() => {
    if (step !== "first") return;
    const dir = PACK_LABELS[chosenPack]?.dir ?? initialDirection;
    onSetDirection(dir);
    let cancelled = false;
    fetchFirstWord(chosenPack).then((e) => {
      if (!cancelled) setFirstEntry(e);
    });
    return () => {
      cancelled = true;
    };
  }, [step, chosenPack, initialDirection, onSetDirection]);

  // Always set the theme immediately when the user picks one — the
  // background of the onboarding shell follows it.
  useEffect(() => {
    onSetTheme(chosenTheme);
  }, [chosenTheme, onSetTheme]);

  const idx = STEP_ORDER.indexOf(step);

  const next = () => {
    if (step === "first") {
      onFinish(firstEntry);
      return;
    }
    setStep(STEP_ORDER[idx + 1]);
  };

  const back = () => {
    if (idx === 0) return;
    setStep(STEP_ORDER[idx - 1]);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-bg text-ink">
      {/* Top bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-border px-7 py-5">
        <div className="flex items-center gap-2 font-serif text-[14px] text-muted">
          <span className="brand-dot" aria-hidden style={{ transform: "none" }} />
          Lexil
        </div>
        {step !== "welcome" ? <Stepper current={idx} /> : <span />}
        <span className="inline-block w-12" />
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        {step === "welcome" ? (
          <Welcome />
        ) : step === "pack" ? (
          <PackPicker
            availablePacks={availablePacks}
            chosen={chosenPack}
            onChoose={setChosenPack}
          />
        ) : step === "theme" ? (
          <ThemePicker chosen={chosenTheme} onChoose={setChosenTheme} />
        ) : (
          <FirstWord entry={firstEntry} />
        )}
      </div>

      {/* Bottom bar */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-7 py-5">
        {step !== "welcome" ? (
          <button
            onClick={back}
            className="inline-flex items-center gap-2 text-[13px] text-muted hover:text-ink transition-colors duration-fast"
          >
            <ArrowLeft size={14} strokeWidth={1.5} />
            Back
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={next}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-accent hover:opacity-80 transition-opacity duration-fast"
        >
          {step === "welcome"
            ? "Get started"
            : step === "first"
              ? "Finish"
              : "Continue"}
          <ArrowRight size={14} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
}

function Stepper({ current }: { current: number }) {
  // 3 segments for pack/theme/first (welcome is step 0 → no segment)
  return (
    <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-faint font-medium">
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "inline-block h-0.5 w-[18px] transition-colors duration-base",
            i < current
              ? "bg-accent"
              : i === current
                ? "bg-ink"
                : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

function Welcome() {
  return (
    <div className="flex flex-1 items-center justify-center px-16 py-12">
      <div className="max-w-[560px] text-center">
        <div className="caption mb-4 text-faint">Welcome to</div>
        <h1 className="font-serif text-[64px] leading-[72px] tracking-[-0.015em] text-ink">
          Lexil
        </h1>
        <p className="mt-4 text-body leading-6 text-muted">
          An offline dictionary for readers and language learners. No accounts,
          no internet, no nonsense.
        </p>
      </div>
    </div>
  );
}

function PackPicker({
  availablePacks,
  chosen,
  onChoose,
}: {
  availablePacks: string[];
  chosen: string;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] flex-1 px-8 py-16">
      <div className="caption mb-4 text-faint">Step one</div>
      <h2 className="font-serif text-[36px] leading-[44px] tracking-[-0.01em] text-ink">
        Choose a dictionary.
      </h2>
      <p className="mt-4 text-body leading-6 text-muted">
        Packs work fully offline. You can switch between them anytime from
        the language pill in the top bar.
      </p>

      <div className="mt-8 flex flex-col">
        {Object.entries(PACK_LABELS).map(([id, info]) => {
          const installed = availablePacks.includes(id);
          const selected = chosen === id;
          return (
            <button
              key={id}
              disabled={!installed}
              onClick={() => onChoose(id)}
              className={cn(
                "relative flex items-center justify-between border-t border-border py-4 text-left transition-colors duration-fast last:border-b",
                installed
                  ? selected
                    ? "before:absolute before:left-[-16px] before:top-3.5 before:bottom-3.5 before:w-0.5 before:bg-accent"
                    : "hover:bg-border/20"
                  : "cursor-not-allowed opacity-50",
              )}
            >
              <div>
                <div className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
                  {info.from} → {info.to}
                </div>
                <div className="mt-0.5 text-[12px] tracking-wider text-faint">
                  {installed ? "Bundled with the app" : "Not installed"}
                </div>
              </div>
              <div
                className={cn(
                  "text-[12px] font-medium uppercase tracking-wider",
                  selected ? "text-ink" : "text-faint",
                )}
              >
                {selected ? "Selected" : installed ? "Choose" : "Coming soon"}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-[12px] tracking-wider text-faint">
        Every pack ships with IPA, conjugation tables, and Wiktionary glosses (CC-BY-SA).
      </div>
    </div>
  );
}

function ThemePicker({
  chosen,
  onChoose,
}: {
  chosen: Theme;
  onChoose: (t: Theme) => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center px-12 py-12">
      <div className="max-w-[640px] text-center">
        <div className="caption mb-4 text-faint">
          Step two · the only choice you need to make
        </div>
        <h2 className="font-serif text-[36px] leading-[44px] tracking-[-0.01em] text-ink">
          Pick a mood.
        </h2>
        <p className="mt-4 text-body leading-6 text-muted">
          Paper for daylight, Ink for reading at night. Change it anytime
          from the top bar.
        </p>

        <div className="mt-10 flex justify-center gap-8">
          <ThemeCard theme="paper" selected={chosen === "paper"} onClick={() => onChoose("paper")} />
          <ThemeCard theme="ink" selected={chosen === "ink"} onClick={() => onChoose("ink")} />
        </div>
      </div>
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  onClick,
}: {
  theme: Theme;
  selected: boolean;
  onClick: () => void;
}) {
  // Each card forces its own theme palette via inline tokens so it can be
  // previewed regardless of the active app theme.
  const isPaper = theme === "paper";
  const style: React.CSSProperties = isPaper
    ? {
        background: "#FBFAF7",
        color: "#1A1816",
        borderColor: "#E8E4DC",
      }
    : {
        background: "#16161A",
        color: "#F0EDE6",
        borderColor: "#2A2A30",
      };
  const muted = isPaper ? "#6B6660" : "#A8A39B";
  const accent = isPaper ? "#8B4513" : "#D4A574";
  const border = isPaper ? "#E8E4DC" : "#2A2A30";
  const highlight = isPaper ? "#FFF3B8" : "#3D3520";

  return (
    <button
      onClick={onClick}
      style={style}
      className={cn(
        "relative w-[280px] cursor-pointer rounded-card border p-6 text-left transition-shadow duration-fast",
      )}
    >
      <div className="font-serif text-[28px] leading-9 tracking-[-0.01em]">
        correr
      </div>
      <div className="mt-1 font-mono text-[12px]" style={{ color: muted }}>
        /koˈreɾ/
      </div>
      <div
        className="mt-3 font-sans text-[13px] leading-5 italic"
        style={{ color: muted }}
      >
        to run; to flow.
      </div>
      <div
        className="mt-2 border-l pl-3 font-serif text-[14px] leading-[22px]"
        style={{ borderColor: border }}
      >
        El niño{" "}
        <span
          style={{
            background: highlight,
            padding: "0 2px",
            borderRadius: 2,
          }}
        >
          corre
        </span>{" "}
        por el parque.
      </div>
      <div
        className="mt-6 flex items-center justify-between border-t pt-4"
        style={{ borderColor: border }}
      >
        <span
          className="font-serif text-[18px] tracking-[-0.005em]"
          style={
            selected
              ? { borderBottom: `1px solid ${accent}`, paddingBottom: 2 }
              : undefined
          }
        >
          {isPaper ? "Paper" : "Ink"}
        </span>
        <span
          className="text-[11px] font-medium uppercase tracking-wider"
          style={{ color: selected ? accent : muted }}
        >
          {selected ? "Selected" : "Tap to choose"}
        </span>
      </div>
    </button>
  );
}

function FirstWord({ entry }: { entry: Entry | null }) {
  return (
    <div className="relative mx-auto w-full max-w-[720px] flex-1 px-8 py-12">
      <div className="caption mb-6 text-faint">Your first word</div>
      {entry ? (
        <article className="lex-rise selectable">
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
          </header>
          <ol className="mt-6">
            {entry.senses.slice(0, 3).map((s) => (
              <li
                key={s.id}
                className="grid grid-cols-[32px_1fr] gap-x-4 gap-y-2 border-t border-border py-4"
              >
                <div className="font-serif text-[20px] leading-7 text-faint">
                  {s.sense_number}
                </div>
                <div className="text-[13px] leading-5 italic text-muted">
                  {s.definition}
                </div>
                {s.examples.length > 0 ? (
                  <div className="col-start-2 mt-2 border-l border-border pl-4 font-serif text-[15px] leading-6 text-ink">
                    {s.examples[0].text}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
          <div className="caption mt-12 border-t border-border pt-4 text-faint">
            Source: Wiktionary · CC-BY-SA
          </div>
        </article>
      ) : (
        <div className="text-body-sm text-faint">Loading a word for you…</div>
      )}
    </div>
  );
}

async function fetchFirstWord(packId: string): Promise<Entry | null> {
  const featured =
    packId === "french-en"
      ? ["courir", "parler", "maison", "vivre", "aimer"]
      : ["correr", "hablar", "vivir", "amar", "soñar"];
  for (const word of featured) {
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
