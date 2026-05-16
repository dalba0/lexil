import { useEffect, useState, useCallback } from "react";

const KEY = "lexil.onboarded";

/**
 * Tracks whether the user has completed the first-run onboarding flow.
 * The flag persists in localStorage; clearing it (or `localStorage.clear()`)
 * shows onboarding on next launch.
 */
export function useOnboarding() {
  const [onboarded, setOnboarded] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(KEY, onboarded ? "true" : "false");
  }, [onboarded]);

  const finish = useCallback(() => setOnboarded(true), []);
  const reset = useCallback(() => setOnboarded(false), []);

  return { onboarded, finish, reset };
}
