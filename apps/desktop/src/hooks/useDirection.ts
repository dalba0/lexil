import { useEffect, useState, useCallback } from "react";
import type { SearchDirection } from "@/lib/types";

const KEY = "lexil.direction";

function read(): SearchDirection {
  if (typeof window === "undefined") return "es-en";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "es-en" || stored === "en-es") return stored;
  return "es-en";
}

export function useDirection() {
  const [direction, setDirectionState] = useState<SearchDirection>(read);

  useEffect(() => {
    window.localStorage.setItem(KEY, direction);
  }, [direction]);

  const setDirection = useCallback((d: SearchDirection) => setDirectionState(d), []);
  const toggleDirection = useCallback(
    () => setDirectionState((d) => (d === "es-en" ? "en-es" : "es-en")),
    [],
  );

  return { direction, setDirection, toggleDirection };
}
