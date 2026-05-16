import { useEffect, useState, useCallback } from "react";
import type { FontScale } from "@/lib/types";

const KEY = "lexil.font-scale";

function read(): FontScale {
  if (typeof window === "undefined") return "md";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "sm" || stored === "md" || stored === "lg") return stored;
  return "md";
}

export function useFontScale() {
  const [scale, setScaleState] = useState<FontScale>(read);

  useEffect(() => {
    document.documentElement.setAttribute("data-font-scale", scale);
    window.localStorage.setItem(KEY, scale);
  }, [scale]);

  const setScale = useCallback((s: FontScale) => setScaleState(s), []);
  return { scale, setScale };
}
