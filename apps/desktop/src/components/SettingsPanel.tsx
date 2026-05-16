import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { FontScale, Theme } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
  packId: string;
}

export function SettingsPanel({
  open,
  onClose,
  theme,
  setTheme,
  fontScale,
  setFontScale,
  packId,
}: Props) {
  const [meta, setMeta] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) api.packMeta(packId).then(setMeta).catch(() => setMeta({}));
  }, [open, packId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="lex-backdrop fixed inset-0 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="lex-rise relative w-[560px] rounded-card border border-border bg-surface px-10 pb-8 pt-10 shadow-[0_24px_64px_rgba(0,0,0,0.18),0_2px_8px_rgba(0,0,0,0.08)]"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-input text-muted transition-colors duration-fast hover:text-ink"
        >
          <X size={16} strokeWidth={1.5} />
        </button>

        <h2 className="display-headword text-ink">Lexil</h2>
        <p className="mb-8 text-body-sm text-muted">
          An offline dictionary for readers.
        </p>

        <Row label="Theme">
          <div className="flex gap-6">
            <Swatch label="Paper" selected={theme === "paper"} onClick={() => setTheme("paper")} />
            <Swatch label="Ink" selected={theme === "ink"} onClick={() => setTheme("ink")} />
          </div>
        </Row>

        <Row label="Font size">
          <div className="flex items-baseline gap-6">
            <SizeA size={16} selected={fontScale === "sm"} onClick={() => setFontScale("sm")} />
            <SizeA size={22} selected={fontScale === "md"} onClick={() => setFontScale("md")} />
            <SizeA size={28} selected={fontScale === "lg"} onClick={() => setFontScale("lg")} />
          </div>
        </Row>

        <Row label="Shortcuts">
          <div className="flex flex-col gap-1.5">
            <Shortcut label="Focus search" keys="⌘K" />
            <Shortcut label="Back / forward" keys="⌘[   ⌘]" />
            <Shortcut label="Star word" keys="⌘S" />
            <Shortcut label="Toggle theme" keys="⌘D" />
            <Shortcut label="Clear search" keys="Esc" />
          </div>
        </Row>

        <PackInfo meta={meta} />
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-baseline gap-6 border-t border-border py-4">
      <span className="caption text-faint">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function Swatch({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "border-b pb-1 font-serif text-[15px] leading-6 transition-colors duration-fast",
        selected
          ? "border-accent text-ink"
          : "border-transparent text-muted hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

function SizeA({
  size,
  selected,
  onClick,
}: {
  size: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{ fontSize: `${size}px`, lineHeight: 1 }}
      className={cn(
        "border-b pb-1 font-serif transition-colors duration-fast",
        selected
          ? "border-accent text-ink"
          : "border-transparent text-muted hover:text-ink",
      )}
    >
      A
    </button>
  );
}

function Shortcut({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex justify-between text-[13px] leading-5 text-muted">
      <span>{label}</span>
      <span className="font-mono text-[12px] text-ink">{keys}</span>
    </div>
  );
}

function PackInfo({ meta }: { meta: Record<string, string> }) {
  if (!Object.keys(meta).length) return null;

  const languagePair = packLanguageLabel(meta);
  const entries = meta.entry_count
    ? Number(meta.entry_count).toLocaleString()
    : "—";
  const source = packSourceLabel(meta.source_url);
  const license = meta.license ?? "—";
  const version =
    meta.version + (meta.language_code ? ` (${meta.language_code}-${meta.target_language ?? ""})` : "");
  const built = (meta.built_at ?? "").slice(0, 10);

  return (
    <div className="grid grid-cols-[1fr] gap-6 border-t border-border py-4">
      <div className="caption text-faint">Dictionary pack</div>
      <div className="-mt-2 grid grid-cols-[140px_1fr] gap-y-1.5">
        <PackKey>Language</PackKey>
        <PackVal>{languagePair}</PackVal>
        <PackKey>Entries</PackKey>
        <PackVal>{entries}</PackVal>
        <PackKey>Source</PackKey>
        <PackVal>{source}</PackVal>
        <PackKey>License</PackKey>
        <PackVal>{license}</PackVal>
        <PackKey>Version</PackKey>
        <PackVal>{version}</PackVal>
        {built ? (
          <>
            <PackKey>Built</PackKey>
            <PackVal>{built}</PackVal>
          </>
        ) : null}
      </div>
    </div>
  );
}

function PackKey({ children }: { children: React.ReactNode }) {
  return (
    <span className="caption text-faint" style={{ lineHeight: "20px" }}>
      {children}
    </span>
  );
}

function PackVal({ children }: { children: React.ReactNode }) {
  return <span className="text-[13px] leading-5 text-ink">{children}</span>;
}

function packLanguageLabel(meta: Record<string, string>): string {
  const src = meta.language_name ?? meta.language_code ?? "—";
  const tgt = meta.target_language?.toUpperCase() ?? "EN";
  const tgtName = tgt === "EN" ? "English" : tgt;
  return `${capitalize(src)} → ${capitalize(tgtName)}`;
}

function packSourceLabel(url: string | undefined): string {
  if (!url) return "—";
  if (/wiktionary|kaikki/i.test(url)) return "Wiktionary";
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function capitalize(s: string): string {
  return s.length === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1);
}
