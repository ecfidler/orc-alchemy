import { useCallback, useSyncExternalStore } from "react";

/**
 * A value of this browser in one `localStorage` key, for example the theme
 * or a fold that stays on the device. The value is not a part of the user's
 * data. When the storage cannot be read or written, as in some private
 * windows, the value stays in memory until the page reloads.
 */
export interface StoredValue<T> {
  /** The value: the last value that a write could not store, else the stored value. */
  read(): T;
  /** Stores the value, or keeps it in memory when the storage throws, and tells each listener. */
  write(value: T): void;
  /** Calls `listener` after each write in this tab and after each change of the key in another tab. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
}

export interface StoredValueOptions<T> {
  /** The value of a stored text; `null` when the key has no value. A text that is not well formed gives the value of a key with no value. */
  parse: (stored: string | null) => T;
  /** The text to store; `null` removes the key. */
  serialize: (value: T) => string | null;
  /** The value when the storage cannot be read. */
  fallback: T;
}

/**
 * A value in the `localStorage` key `key`. Make one for each key, at the top
 * level of a module. `parse` must give equal values for the same text: use a
 * string, a number or a boolean, because React compares two reads with
 * `Object.is`.
 */
export function storedValue<T>(key: string, { parse, serialize, fallback }: StoredValueOptions<T>): StoredValue<T> {
  // The value of a write that the storage refused. It wins over the storage until a write works.
  let unstored: { value: T } | null = null;
  const listeners = new Set<() => void>();
  const tell = () => {
    for (const listener of listeners) listener();
  };
  return {
    read() {
      if (unstored !== null) return unstored.value;
      try {
        return parse(localStorage.getItem(key));
      } catch {
        return fallback;
      }
    },
    write(value) {
      try {
        const text = serialize(value);
        if (text === null) localStorage.removeItem(key);
        else localStorage.setItem(key, text);
        unstored = null;
      } catch {
        unstored = { value };
      }
      tell();
    },
    subscribe(listener) {
      listeners.add(listener);
      const onStorage = (event: StorageEvent) => {
        if (event.key !== key && event.key !== null) return;
        // Another tab stored a value, so the storage works: it wins over a value in memory.
        unstored = null;
        listener();
      };
      addEventListener("storage", onStorage);
      return () => {
        listeners.delete(listener);
        removeEventListener("storage", onStorage);
      };
    },
  };
}

/** The value of a stored value and a setter, for a component. The server render gives `serverValue`. */
export function useStoredValue<T>(store: StoredValue<T>, serverValue: T): [T, (value: T) => void] {
  const value = useSyncExternalStore(store.subscribe, store.read, () => serverValue);
  return [value, useCallback((next: T) => store.write(next), [store])];
}
