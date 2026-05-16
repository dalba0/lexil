import { useEffect } from "react";

export interface ShortcutHandlers {
  onFocusSearch: () => void;
  onToggleTheme: () => void;
  onToggleFavorite: () => void;
  onBack: () => void;
  onForward: () => void;
  onEscape?: () => void;
}

// Cmd/Ctrl + K  → focus search
// Cmd/Ctrl + D  → toggle theme
// Cmd/Ctrl + S  → star current
// Cmd/Ctrl + [  → back
// Cmd/Ctrl + ]  → forward
// Esc           → optional clear
export function useShortcuts(h: ShortcutHandlers) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) {
        if (e.key === "Escape" && h.onEscape) {
          h.onEscape();
        }
        return;
      }
      switch (e.key.toLowerCase()) {
        case "k":
          e.preventDefault();
          h.onFocusSearch();
          break;
        case "d":
          e.preventDefault();
          h.onToggleTheme();
          break;
        case "s":
          e.preventDefault();
          h.onToggleFavorite();
          break;
        case "[":
          e.preventDefault();
          h.onBack();
          break;
        case "]":
          e.preventDefault();
          h.onForward();
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [h]);
}
