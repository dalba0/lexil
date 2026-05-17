import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Settings, ArrowLeft, ArrowRight, Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  TooltipProvider,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { SearchInput } from "@/components/SearchInput";
import { ResultList } from "@/components/ResultList";
import { EntryView } from "@/components/EntryView";
import { EmptyState } from "@/components/EmptyState";
import { EntryListView } from "@/components/EntryListView";
import { Sidebar } from "@/components/Sidebar";
import { SettingsView } from "@/components/SettingsView";
import { LangPopover } from "@/components/LangPopover";
import { OnboardingFlow } from "@/components/OnboardingFlow";

import { useDebounced } from "@/hooks/useDebounced";
import { useTheme } from "@/hooks/useTheme";
import { useFontScale } from "@/hooks/useFontScale";
import { useShortcuts } from "@/hooks/useShortcuts";
import { useHistory } from "@/hooks/useHistory";
import { useDirection } from "@/hooks/useDirection";
import { useOnboarding } from "@/hooks/useOnboarding";

import { api } from "@/lib/api";
import {
  DEFAULT_DIRECTION,
  isReverse,
  packIdForDirection,
} from "@/lib/direction";
import type { Entry, SearchDirection, SearchResult } from "@/lib/types";

interface HistoryItem {
  packId: string;
  entryId: number;
  matchedForm: string | null;
}

export default function App() {
  const { theme, toggleTheme, setTheme } = useTheme();
  const { scale, setScale } = useFontScale();
  const { direction, setDirection } = useDirection();
  const { onboarded, finish: finishOnboarding, reset: resetOnboarding } =
    useOnboarding();

  const [availablePacks, setAvailablePacks] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounced(query, 60);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const [entry, setEntry] = useState<Entry | null>(null);
  const [entryPackId, setEntryPackId] = useState<string | null>(null);
  const [matchedForm, setMatchedForm] = useState<string | null>(null);
  const [openListId, setOpenListId] = useState<number | null>(null);
  const [openTagName, setOpenTagName] = useState<string | null>(null);
  const [attributionByPack, setAttributionByPack] = useState<
    Record<string, string>
  >({});
  const [sidebarTick, setSidebarTick] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const history = useHistory<HistoryItem>();

  const packId = packIdForDirection(direction);

  const refreshAvailablePacks = useCallback(async () => {
    try {
      const packs = await api.listPacks();
      setAvailablePacks(packs);
      if (packs.length > 0 && !packs.includes(packIdForDirection(direction))) {
        const candidates: SearchDirection[] = [
          "es-en",
          "fr-en",
          "en-es",
          "en-fr",
        ];
        const fallback =
          candidates.find((d) => packs.includes(packIdForDirection(d))) ??
          DEFAULT_DIRECTION;
        setDirection(fallback);
      }
    } catch {
      setAvailablePacks([]);
    }
  }, [direction, setDirection]);

  // On mount, ask the backend which packs actually loaded.
  useEffect(() => {
    refreshAvailablePacks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch attribution lazily per pack. Cached so we don't refetch.
  useEffect(() => {
    if (!packId || attributionByPack[packId] !== undefined) return;
    api
      .packMeta(packId)
      .then((m) => {
        setAttributionByPack((prev) => ({
          ...prev,
          [packId]: m.attribution ?? "",
        }));
      })
      .catch(() => {
        setAttributionByPack((prev) => ({ ...prev, [packId]: "" }));
      });
  }, [packId, attributionByPack]);

  // Run search whenever query OR direction (and thus packId) changes.
  useEffect(() => {
    let cancelled = false;
    const q = debouncedQuery.trim();
    if (!q) {
      setResults([]);
      setSelectedIndex(0);
      return;
    }
    const fetcher = isReverse(direction) ? api.searchReverse : api.search;
    fetcher(packId, q, 20).then((rows) => {
      if (!cancelled) {
        setResults(rows);
        setSelectedIndex(0);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, direction, packId]);

  // When the active pack changes, drop the currently-open entry if it
  // came from a different pack — entry ids aren't globally unique, so
  // leaving stale state could resolve to the wrong word.
  useEffect(() => {
    if (entryPackId && entryPackId !== packId) {
      setEntry(null);
      setEntryPackId(null);
      setMatchedForm(null);
    }
  }, [packId, entryPackId]);

  const openResult = useCallback(
    async (r: SearchResult, pushHistory = true) => {
      const detail = await api.getEntry(packId, r.entry_id);
      setEntry(detail);
      setEntryPackId(packId);
      setMatchedForm(r.matched_form);
      setOpenListId(null);
      setOpenTagName(null);
      if (pushHistory) {
        history.push({
          packId,
          entryId: r.entry_id,
          matchedForm: r.matched_form,
        });
      }
      await api.addRecent(packId, r.entry_id, r.headword, r.pos);
      setSidebarTick((n) => n + 1);
      setQuery("");
      setResults([]);
    },
    [history, packId],
  );

  const openById = useCallback(
    async (entryId: number, matched: string | null = null) => {
      const detail = await api.getEntry(packId, entryId);
      setEntry(detail);
      setEntryPackId(packId);
      setMatchedForm(matched);
      setOpenListId(null);
      setOpenTagName(null);
      history.push({ packId, entryId, matchedForm: matched });
      await api.addRecent(packId, entryId, detail.headword, detail.pos);
      setSidebarTick((n) => n + 1);
    },
    [history, packId],
  );

  const openList = useCallback((listId: number) => {
    setEntry(null);
    setEntryPackId(null);
    setMatchedForm(null);
    setOpenTagName(null);
    setOpenListId(listId);
    setQuery("");
    setResults([]);
  }, []);

  const openTag = useCallback((name: string) => {
    setEntry(null);
    setEntryPackId(null);
    setMatchedForm(null);
    setOpenListId(null);
    setOpenTagName(name);
    setQuery("");
    setResults([]);
  }, []);

  const goBack = useCallback(async () => {
    const prev = history.back();
    if (!prev) return;
    // If the history step is in a different pack, switch directions first.
    if (prev.packId !== packId) {
      const candidate: SearchDirection[] = [
        "es-en",
        "en-es",
        "fr-en",
        "en-fr",
      ];
      const dir =
        candidate.find((d) => packIdForDirection(d) === prev.packId) ??
        direction;
      setDirection(dir);
    }
    const detail = await api.getEntry(prev.packId, prev.entryId);
    setEntry(detail);
    setEntryPackId(prev.packId);
    setMatchedForm(prev.matchedForm);
  }, [history, packId, direction, setDirection]);

  const goForward = useCallback(async () => {
    const nxt = history.forward();
    if (!nxt) return;
    if (nxt.packId !== packId) {
      const candidate: SearchDirection[] = [
        "es-en",
        "en-es",
        "fr-en",
        "en-fr",
      ];
      const dir =
        candidate.find((d) => packIdForDirection(d) === nxt.packId) ??
        direction;
      setDirection(dir);
    }
    const detail = await api.getEntry(nxt.packId, nxt.entryId);
    setEntry(detail);
    setEntryPackId(nxt.packId);
    setMatchedForm(nxt.matchedForm);
  }, [history, packId, direction, setDirection]);

  const toggleCurrentFav = useCallback(async () => {
    if (!entry || !entryPackId) return;
    await api.toggleFavorite(entryPackId, entry.id, entry.headword, entry.pos);
    setSidebarTick((n) => n + 1);
  }, [entry, entryPackId]);

  useShortcuts(
    useMemo(
      () => ({
        onFocusSearch: () => {
          inputRef.current?.focus();
          inputRef.current?.select();
        },
        onToggleTheme: toggleTheme,
        onToggleFavorite: toggleCurrentFav,
        onBack: goBack,
        onForward: goForward,
        onEscape: () => {
          setQuery("");
          setResults([]);
        },
      }),
      [toggleTheme, toggleCurrentFav, goBack, goForward],
    ),
  );

  const onKeyDownSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[selectedIndex];
      if (target) openResult(target);
    }
  };

  const isSearching = query.trim().length > 0;
  const currentAttribution = attributionByPack[packId] ?? null;

  // First-run OR no-packs-installed experience: a full-screen onboarding
  // flow that requires the user to download at least one pack before they
  // can use the app.
  const noPacksInstalled = availablePacks.length === 0;
  if (!onboarded || noPacksInstalled) {
    return (
      <OnboardingFlow
        availablePacks={availablePacks}
        initialDirection={direction}
        onSetDirection={setDirection}
        initialTheme={theme}
        onSetTheme={setTheme}
        onInstalledPacksChanged={(ids) => setAvailablePacks(ids)}
        onFinish={async (firstEntry) => {
          finishOnboarding();
          await refreshAvailablePacks();
          if (firstEntry) {
            setEntry(firstEntry);
            setEntryPackId(packIdForDirection(direction));
            setMatchedForm(null);
            history.push({
              packId: packIdForDirection(direction),
              entryId: firstEntry.id,
              matchedForm: null,
            });
            try {
              await api.addRecent(
                packIdForDirection(direction),
                firstEntry.id,
                firstEntry.headword,
                firstEntry.pos,
              );
              setSidebarTick((n) => n + 1);
            } catch {
              /* ignore */
            }
          }
        }}
      />
    );
  }

  // Settings is now a full-page route. We render it INSTEAD of the main
  // shell when open so it gets the whole window.
  if (settingsOpen) {
    return (
      <SettingsView
        onClose={async () => {
          setSettingsOpen(false);
          // Pack list may have changed (install/remove) while in Settings.
          await refreshAvailablePacks();
        }}
        theme={theme}
        setTheme={setTheme}
        fontScale={scale}
        setFontScale={setScale}
        packId={packId}
        onResetOnboarding={() => {
          resetOnboarding();
          setSettingsOpen(false);
        }}
      />
    );
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-screen w-screen overflow-hidden bg-bg text-ink">
        <Sidebar
          packId={packId}
          refreshKey={sidebarTick}
          onOpenEntry={(id) => openById(id, null)}
          onOpenList={openList}
          onOpenTag={openTag}
          onGoHome={() => {
            setEntry(null);
            setEntryPackId(null);
            setMatchedForm(null);
            setOpenListId(null);
            setOpenTagName(null);
            setQuery("");
            setResults([]);
          }}
          currentEntryId={entryPackId === packId ? entry?.id ?? null : null}
          currentListId={openListId}
          currentTagName={openTagName}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          <TopBar
            canBack={history.canGoBack}
            canForward={history.canGoForward}
            onBack={goBack}
            onForward={goForward}
            onOpenSettings={() => setSettingsOpen(true)}
            theme={theme}
            onToggleTheme={toggleTheme}
            direction={direction}
            onSetDirection={setDirection}
            availablePacks={availablePacks}
          />

          <div className="border-b border-border px-8 pb-6 pt-8">
            <SearchInput
              ref={inputRef}
              value={query}
              placeholder="Search…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDownSearch}
              autoFocus
            />
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {isSearching ? (
              <ResultList
                results={results}
                selectedIndex={selectedIndex}
                onSelect={(r) => openResult(r)}
                onHover={setSelectedIndex}
                query={query}
                direction={direction}
              />
            ) : openListId !== null ? (
              <EntryListView
                kind="list"
                packId={packId}
                listId={openListId}
                onOpenEntry={(id) => openById(id, null)}
                onClose={() => setOpenListId(null)}
                onChanged={() => setSidebarTick((n) => n + 1)}
              />
            ) : openTagName !== null ? (
              <EntryListView
                kind="tag"
                packId={packId}
                tagName={openTagName}
                onOpenEntry={(id) => openById(id, null)}
                onClose={() => setOpenTagName(null)}
              />
            ) : entry && entryPackId ? (
              <EntryView
                entry={entry}
                packId={entryPackId}
                matchedForm={matchedForm}
                attribution={currentAttribution}
              />
            ) : (
              <EmptyState packId={packId} onOpen={(id) => openById(id, null)} />
            )}
          </div>
        </main>

      </div>
    </TooltipProvider>
  );
}

function TopBar({
  canBack,
  canForward,
  onBack,
  onForward,
  onOpenSettings,
  theme,
  onToggleTheme,
  direction,
  onSetDirection,
  availablePacks,
}: {
  canBack: boolean;
  canForward: boolean;
  onBack: () => void;
  onForward: () => void;
  onOpenSettings: () => void;
  theme: "paper" | "ink";
  onToggleTheme: () => void;
  direction: SearchDirection;
  onSetDirection: (d: SearchDirection) => void;
  availablePacks: string[];
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center border-b border-border px-8 py-4">
      <div className="flex gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!canBack}
              onClick={onBack}
              aria-label="Back"
            >
              <ArrowLeft size={16} strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back (Ctrl + [)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              disabled={!canForward}
              onClick={onForward}
              aria-label="Forward"
            >
              <ArrowRight size={16} strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Forward (Ctrl + ])</TooltipContent>
        </Tooltip>
      </div>

      <LangPopover
        direction={direction}
        onSetDirection={onSetDirection}
        availablePacks={availablePacks}
      />

      <div className="flex justify-end gap-1">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
            >
              {theme === "paper" ? (
                <Moon size={16} strokeWidth={1.5} />
              ) : (
                <Sun size={16} strokeWidth={1.5} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Theme (Ctrl + D)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="iconSm"
              onClick={onOpenSettings}
              aria-label="Settings"
            >
              <Settings size={16} strokeWidth={1.5} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
