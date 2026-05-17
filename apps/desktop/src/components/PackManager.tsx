import { useCallback, useEffect, useMemo, useState } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { Check, Download, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  InstalledPack,
  ManifestPack,
  PackDownloadProgress,
} from "@/lib/types";

interface Props {
  /** When true, render in the compact onboarding style. */
  compact?: boolean;
  /** Fires whenever the installed-pack set changes. */
  onChange?: (installed: InstalledPack[]) => void;
}

interface RowState {
  pack: ManifestPack;
  installed: boolean;
  progress?: PackDownloadProgress;
}

/**
 * Lists every pack from the remote manifest plus what's currently
 * installed locally. Each row either:
 *   - shows Download if not installed
 *   - shows a progress bar while downloading
 *   - shows "Installed · Remove" if installed
 */
export function PackManager({ compact = false, onChange }: Props) {
  const [manifestErr, setManifestErr] = useState<string | null>(null);
  const [available, setAvailable] = useState<ManifestPack[]>([]);
  const [installed, setInstalled] = useState<InstalledPack[]>([]);
  const [progress, setProgress] = useState<Record<string, PackDownloadProgress>>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [m, ip] = await Promise.all([
        api.availablePacks(),
        api.installedPacks(),
      ]);
      setAvailable(m.packs);
      setInstalled(ip);
      setManifestErr(null);
      onChange?.(ip);
    } catch (e) {
      // Offline / manifest unreachable: still show installed packs so the
      // user isn't locked out of removing things they already have.
      try {
        const ip = await api.installedPacks();
        setInstalled(ip);
        onChange?.(ip);
      } catch {
        /* really nothing */
      }
      setManifestErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [onChange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to the Rust-emitted progress event. Each event mutates
  // the matching row's progress; terminal states ("done"/"error"/
  // "cancelled") trigger a refresh of the installed-pack list.
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;
    listen<PackDownloadProgress>("pack-download-progress", (e) => {
      const p = e.payload;
      setProgress((cur) => ({ ...cur, [p.pack_id]: p }));
      if (p.state === "done" || p.state === "error" || p.state === "cancelled") {
        // Clear the row's progress shortly after so the UI settles back
        // to its idle state instead of permanently showing the bar.
        setTimeout(() => {
          setProgress((cur) => {
            const { [p.pack_id]: _gone, ...rest } = cur;
            return rest;
          });
        }, p.state === "done" ? 600 : 2400);
        refresh();
      }
    }).then((fn) => {
      unlisten = fn;
    });
    return () => {
      unlisten?.();
    };
  }, [refresh]);

  const installedIds = useMemo(
    () => new Set(installed.map((p) => p.id)),
    [installed],
  );

  const rows: RowState[] = available.map((p) => ({
    pack: p,
    installed: installedIds.has(p.id),
    progress: progress[p.id],
  }));

  const onDownload = async (pack: ManifestPack) => {
    setProgress((cur) => ({
      ...cur,
      [pack.id]: {
        pack_id: pack.id,
        bytes_downloaded: 0,
        bytes_total: pack.size_bytes,
        state: "downloading",
        message: null,
      },
    }));
    try {
      await api.downloadPack(pack);
    } catch (e) {
      setProgress((cur) => ({
        ...cur,
        [pack.id]: {
          pack_id: pack.id,
          bytes_downloaded: 0,
          bytes_total: pack.size_bytes,
          state: "error",
          message: formatError(e),
        },
      }));
    }
  };

  const onRemove = async (pack: ManifestPack | InstalledPack) => {
    if (!window.confirm(`Remove ${pack.id}? You can reinstall it later.`)) return;
    await api.removePack(pack.id);
    await refresh();
  };

  if (loading) {
    return <div className="text-body-sm text-faint">Loading packs…</div>;
  }

  return (
    <div className={cn("flex flex-col", compact && "gap-0")}>
      {manifestErr ? (
        <div className="mb-3 rounded-input border border-border bg-surface px-3 py-2 text-[12px] text-muted">
          Couldn't reach the pack server. Showing installed packs only. (
          {manifestErr})
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="text-body-sm text-faint">
          No packs available. Check your connection and try again.
        </div>
      ) : (
        rows.map((row) => (
          <PackRow
            key={row.pack.id}
            row={row}
            compact={compact}
            onDownload={() => onDownload(row.pack)}
            onCancel={() => api.cancelDownload(row.pack.id)}
            onRemove={() => onRemove(row.pack)}
          />
        ))
      )}

      {/* Show installed packs that aren't in the manifest (e.g., older
          builds removed from the catalog) so the user can still remove
          them. */}
      {installed
        .filter((p) => !available.some((m) => m.id === p.id))
        .map((p) => (
          <OrphanRow
            key={p.id}
            pack={p}
            compact={compact}
            onRemove={() => onRemove(p)}
          />
        ))}
    </div>
  );
}

function PackRow({
  row,
  compact,
  onDownload,
  onCancel,
  onRemove,
}: {
  row: RowState;
  compact: boolean;
  onDownload: () => void;
  onCancel: () => void;
  onRemove: () => void;
}) {
  const { pack, installed, progress } = row;
  const downloading = progress && progress.state !== "done" && progress.state !== "error";
  const errored = progress?.state === "error";

  const pct =
    progress && progress.bytes_total > 0
      ? Math.min(100, (progress.bytes_downloaded / progress.bytes_total) * 100)
      : 0;

  return (
    <div
      className={cn(
        "relative flex items-center justify-between border-t border-border py-4 last:border-b",
        compact && "py-3",
      )}
    >
      <div className="min-w-0">
        <div className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
          {pack.name} → {pack.target === "en" ? "English" : pack.target}
        </div>
        <div className="mt-0.5 text-[12px] tracking-wider text-faint">
          {pack.entries > 0
            ? `${pack.entries.toLocaleString()} entries · `
            : ""}
          {formatBytes(pack.size_bytes)} · v{pack.version}
        </div>
        {downloading ? (
          <div className="mt-2">
            <div className="relative h-px w-full bg-border">
              <div
                className="absolute -top-px h-[3px] bg-accent transition-[width] duration-200"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-wider text-faint">
              {progress?.state === "verifying"
                ? "Verifying…"
                : progress?.state === "installing"
                  ? "Installing…"
                  : `Downloading · ${Math.round(pct)}%`}
            </div>
          </div>
        ) : null}
        {errored ? (
          <div className="mt-2 text-[12px] text-accent">
            {progress?.message ?? "Download failed."}
          </div>
        ) : null}
      </div>

      <div className="ml-4 shrink-0 text-right">
        {installed ? (
          <div className="flex items-center gap-4">
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-wider text-accent">
              <Check size={14} strokeWidth={1.5} />
              Installed
            </span>
            <button
              onClick={onRemove}
              className="inline-flex items-center gap-1 bg-transparent text-[12px] text-muted transition-colors duration-fast hover:text-accent"
              style={{ cursor: "pointer", border: 0, padding: 0 }}
            >
              <Trash2 size={12} strokeWidth={1.5} />
              Remove
            </button>
          </div>
        ) : downloading ? (
          <button
            onClick={onCancel}
            className="bg-transparent text-[12px] text-muted hover:text-accent transition-colors duration-fast"
            style={{ cursor: "pointer", border: 0, padding: 0 }}
          >
            Cancel
          </button>
        ) : (
          <button
            onClick={onDownload}
            className="inline-flex items-center gap-1.5 bg-transparent text-[12px] font-medium uppercase tracking-wider text-ink hover:text-accent transition-colors duration-fast"
            style={{ cursor: "pointer", border: 0, padding: 0 }}
          >
            <Download size={14} strokeWidth={1.5} />
            {errored ? "Retry" : "Install"}
          </button>
        )}
      </div>
    </div>
  );
}

function OrphanRow({
  pack,
  compact,
  onRemove,
}: {
  pack: InstalledPack;
  compact: boolean;
  onRemove: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-t border-border py-4 last:border-b",
        compact && "py-3",
      )}
    >
      <div>
        <div className="font-serif text-[18px] leading-7 tracking-[-0.005em] text-ink">
          {pack.id}
        </div>
        <div className="mt-0.5 text-[12px] tracking-wider text-faint">
          {formatBytes(pack.size_bytes)} · Not in catalog
        </div>
      </div>
      <button
        onClick={onRemove}
        className="bg-transparent text-[12px] text-muted hover:text-accent transition-colors duration-fast"
        style={{ cursor: "pointer", border: 0, padding: 0 }}
      >
        Remove
      </button>
    </div>
  );
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(0)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatError(e: unknown): string {
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}
