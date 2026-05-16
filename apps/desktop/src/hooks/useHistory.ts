import { useCallback, useRef, useState } from "react";

// Linear back/forward stack — like a browser history but in-memory.
// `push` after navigation truncates anything ahead of the cursor.
export function useHistory<T>() {
  const stack = useRef<T[]>([]);
  const [index, setIndex] = useState(-1);

  const push = useCallback((item: T) => {
    stack.current = [...stack.current.slice(0, index + 1), item];
    setIndex(stack.current.length - 1);
  }, [index]);

  const back = useCallback((): T | null => {
    if (index <= 0) return null;
    const next = index - 1;
    setIndex(next);
    return stack.current[next] ?? null;
  }, [index]);

  const forward = useCallback((): T | null => {
    if (index >= stack.current.length - 1) return null;
    const next = index + 1;
    setIndex(next);
    return stack.current[next] ?? null;
  }, [index]);

  const reset = useCallback(() => {
    stack.current = [];
    setIndex(-1);
  }, []);

  return {
    push,
    back,
    forward,
    reset,
    canGoBack: index > 0,
    canGoForward: index < stack.current.length - 1,
    current: index >= 0 ? stack.current[index] : null,
  };
}
