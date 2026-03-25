/** Lightweight localStorage persistence helpers for Zustand stores. */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function loadArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function save(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/** Subscribe to a Zustand store and auto-save a slice on change (debounced). */
export function autoSave<S>(
  store: { subscribe: (listener: (state: S, prev: S) => void) => () => void },
  key: string,
  selector: (state: S) => unknown,
  debounceMs = 500,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  store.subscribe((state, prev) => {
    if (selector(state) !== selector(prev)) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => save(key, selector(state)), debounceMs);
    }
  });
}
