import { useEffect, useState, useCallback } from "react";
import type { Theme } from "@/lib/types";

const KEY = "lexil.theme";

function read(): Theme {
  if (typeof window === "undefined") return "paper";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "paper" || stored === "ink") return stored;
  return "paper";
}

function apply(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(read);

  useEffect(() => {
    apply(theme);
    window.localStorage.setItem(KEY, theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggleTheme = useCallback(
    () => setThemeState((t) => (t === "paper" ? "ink" : "paper")),
    [],
  );

  return { theme, setTheme, toggleTheme };
}
