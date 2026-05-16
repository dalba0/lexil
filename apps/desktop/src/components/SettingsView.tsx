import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  TAG_COLORS,
  type FontScale,
  type Tag,
  type TagColor,
  type Theme,
} from "@/lib/types";
import { LANG_LABEL } from "@/lib/direction";

interface Props {
  onClose: () => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  fontScale: FontScale;
  setFontScale: (s: FontScale) => void;
  packId: string;
  availablePacks: string[];
  onResetOnboarding: () => void;
}

/**
 * Settings is a full page (not a modal) — there's too much surface for a
 * sheet now that tags, packs, data, and About all need first-class room.
 * The top bar holds a single ←Back affordance; the body scrolls.
 */
export function SettingsView({
  onClose,
  theme,
  setTheme,
  fontScale,
  setFontScale,
  packId,
  availablePacks,
  onResetOnboarding,
}: Props) {
  const [meta, setMeta] = useState<Record<string, string>>({});
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    api.packMeta(packId).then(setMeta).catch(() => setMeta({}));
    api.listTags(packId).then(setTags).catch(() => setTags([]));
  }, [packId]);

  const refreshTags = async () => {
    const fresh = await api.listTags(packId);
    setTags(fresh);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="flex h-full w-full flex-col bg-bg text-ink">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-8 py-4">
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 text-body-sm text-muted hover:text-ink transition-colors duration-fast"
        >
          <ArrowLeft size={16} strokeWidth={1.5} />
          Back
        </button>
        <div className="font-serif text-[20px] leading-7 tracking-[-0.005em] text-ink">
          Settings
        </div>
        <span className="inline-block w-16" />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[720px] px-8 py-8">
          <Section title="Appearance" subtitle="How Lexil looks and reads.">
            <Row label="Theme">
              <ToggleText
                value={theme}
                onChange={(v) => setTheme(v as Theme)}
                options={[
                  { value: "paper", label: "Paper" },
                  { value: "ink", label: "Ink" },
                ]}
              />
            </Row>
            <Row label="Font size">
              <div className="flex items-baseline gap-6">
                {(["sm", "md", "lg"] as const).map((s) => {
                  const px = s === "sm" ? 16 : s === "md" ? 22 : 28;
                  return (
                    <button
                      key={s}
                      onClick={() => setFontScale(s)}
                      style={{ fontSize: `${px}px`, lineHeight: 1 }}
                      className={cn(
                        "border-b pb-1 font-serif transition-colors duration-fast",
                        fontScale === s
                          ? "border-accent text-ink"
                          : "border-transparent text-muted hover:text-ink",
                      )}
                    >
                      A
                    </button>
                  );
                })}
              </div>
            </Row>
          </Section>

          <Section
            title="Dictionary packs"
            subtitle="The languages installed on this device. Pack files ship with Lexil; updates arrive with each release."
          >
            <div>
              {availablePacks.map((id) => {
                const isActive = id === packId;
                const label = id === "spanish-en" ? "Spanish → English"
                  : id === "french-en" ? "French → English"
                  : id;
                return (
                  <div
                    key={id}
                    className="grid grid-cols-[1fr_auto] items-center border-b border-border py-3.5 last:border-b-0"
                  >
                    <div>
                      <div className="font-serif text-[16px] leading-6 text-ink">
                        {label}
                        {isActive ? (
                          <span className="ml-2 text-[11px] font-medium uppercase tracking-wider text-accent">
                            Active
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-[12px] tracking-wider text-faint">
                        {isActive && meta.entry_count
                          ? `${Number(meta.entry_count).toLocaleString()} entries`
                          : "Installed"}
                        {isActive && meta.version ? ` · v${meta.version}` : ""}
                        {isActive && meta.built_at
                          ? ` · ${meta.built_at.slice(0, 10)}`
                          : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Section>

          <Section
            title="Tags"
            subtitle="Rename, recolor, or delete your tags."
          >
            {tags.length === 0 ? (
              <div className="text-body-sm text-faint">
                You haven't tagged any words yet. Open an entry and use{" "}
                <span className="text-muted">+ add tag</span> to start.
              </div>
            ) : (
              <div>
                {tags.map((t) => (
                  <TagAdminRow
                    key={t.name}
                    packId={packId}
                    tag={t}
                    onChanged={refreshTags}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section title="Shortcuts" subtitle="Keyboard-first navigation.">
            <ShortcutRow label="Focus search" keys="⌘ K" />
            <ShortcutRow label="Back / forward" keys="⌘ [ · ⌘ ]" />
            <ShortcutRow label="Star word" keys="⌘ S" />
            <ShortcutRow label="Toggle theme" keys="⌘ D" />
            <ShortcutRow label="Clear search" keys="Esc" />
          </Section>

          <Section title="Data" subtitle="Your recents, favorites, and notes live in a separate file in this app's data folder. Nothing leaves your machine.">
            <Row label="Re-run onboarding">
              <button
                onClick={onResetOnboarding}
                className="text-body-sm text-muted hover:text-ink transition-colors duration-fast"
              >
                Show welcome again
              </button>
            </Row>
          </Section>

          <Section title="About" subtitle="">
            <div className="flex flex-col gap-1.5 text-body-sm leading-[22px] text-muted">
              <div className="font-serif text-[28px] leading-9 tracking-[-0.01em] text-ink">
                Lexil
              </div>
              <div className="text-muted">
                An offline dictionary for readers and language learners.
              </div>
              {meta.attribution ? (
                <div className="mt-2 text-[12px] tracking-wider text-faint">
                  {meta.attribution}
                </div>
              ) : null}
              <div className="mt-3 font-serif italic text-[14px] text-ink">
                Designed and built by Albab Dewan · 2026
              </div>
              {meta.version ? (
                <div className="mt-1 text-[12px] tracking-wider text-faint">
                  {LANG_LABEL[(meta.language_code ?? "es") as "es" | "en" | "fr"] ?? meta.language_name ?? "Spanish"} pack v{meta.version}
                  {meta.built_at ? ` · ${meta.built_at.slice(0, 10)}` : ""}
                </div>
              ) : null}
              <div className="mt-3 flex gap-4 text-body-sm">
                <a
                  href="https://github.com/dalba0/lexil"
                  target="_blank"
                  rel="noreferrer"
                  className="border-b border-border pb-px text-accent no-underline"
                >
                  github.com/dalba0/lexil
                </a>
                <a
                  href="https://github.com/dalba0/lexil/releases"
                  target="_blank"
                  rel="noreferrer"
                  className="border-b border-border pb-px text-accent no-underline"
                >
                  Releases
                </a>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[200px_1fr] items-start gap-12 border-t border-border py-6 first:border-t-0 first:pt-0">
      <div>
        <div className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
          {title}
        </div>
        {subtitle ? (
          <div className="mt-1 text-[12px] leading-[18px] text-faint">
            {subtitle}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-border py-2 last:border-b-0">
      <span className="text-body-sm text-ink">{label}</span>
      <div>{children}</div>
    </div>
  );
}

function ToggleText<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <div className="flex gap-4">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "border-b pb-1 font-serif text-[14px] transition-colors duration-fast",
            value === o.value
              ? "border-accent text-ink"
              : "border-transparent text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ShortcutRow({ label, keys }: { label: string; keys: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-1.5 text-body-sm text-muted last:border-b-0">
      <span>{label}</span>
      <span className="font-mono text-[12px] text-ink">{keys}</span>
    </div>
  );
}

function TagAdminRow({
  packId,
  tag,
  onChanged,
}: {
  packId: string;
  tag: Tag;
  onChanged: () => void;
}) {
  const [editingColor, setEditingColor] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(tag.name);

  const color = (tag.color ?? "none") as TagColor;

  return (
    <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6 border-b border-border py-2.5 last:border-b-0">
      <div className="flex items-center gap-3">
        <button
          onClick={() => setEditingColor((v) => !v)}
          className="bg-transparent border-0 p-0"
          aria-label="Change color"
          style={{ cursor: "pointer" }}
        >
          <span className="tag-dot" data-color={color} />
        </button>
        {renaming ? (
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={async (e) => {
              if (e.key === "Enter") {
                if (name.trim() && name !== tag.name) {
                  await api.renameTag(packId, tag.name, name.trim());
                  onChanged();
                }
                setRenaming(false);
              }
              if (e.key === "Escape") {
                setName(tag.name);
                setRenaming(false);
              }
            }}
            onBlur={() => setRenaming(false)}
            className="bg-transparent border-b border-border font-serif text-[15px] text-ink outline-none focus:border-accent"
          />
        ) : (
          <button
            onClick={() => setRenaming(true)}
            className="bg-transparent border-0 p-0 font-serif text-[15px] text-ink"
            style={{ cursor: "pointer" }}
          >
            {tag.name}
          </button>
        )}
      </div>
      <span className="text-[12px] tabular-nums text-faint">
        {tag.count} {tag.count === 1 ? "word" : "words"}
      </span>
      <div className="flex gap-3.5 text-[12px]">
        <button
          onClick={() => setRenaming(true)}
          className="bg-transparent border-0 p-0 text-muted hover:text-ink transition-colors duration-fast"
          style={{ cursor: "pointer" }}
        >
          Rename
        </button>
        <button
          onClick={() => setEditingColor((v) => !v)}
          className="bg-transparent border-0 p-0 text-muted hover:text-ink transition-colors duration-fast"
          style={{ cursor: "pointer" }}
        >
          Color
        </button>
        <button
          onClick={async () => {
            if (
              window.confirm(
                `Delete tag "${tag.name}"? It will be removed from ${tag.count} word${tag.count === 1 ? "" : "s"}.`,
              )
            ) {
              await api.deleteTag(packId, tag.name);
              onChanged();
            }
          }}
          className="bg-transparent border-0 p-0 text-muted hover:text-accent transition-colors duration-fast"
          style={{ cursor: "pointer" }}
        >
          Delete
        </button>
      </div>
      {editingColor ? (
        <div className="col-span-3 mt-1 flex items-center gap-2 border-t border-dashed border-border pt-2">
          <span className="caption text-faint">Color</span>
          {TAG_COLORS.map((c) => (
            <button
              key={c}
              onClick={async () => {
                await api.setTagColor(packId, tag.name, c === "none" ? null : c);
                setEditingColor(false);
                onChanged();
              }}
              aria-label={c}
              className={cn("tag-swatch", color === c && "selected")}
              data-color={c}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
