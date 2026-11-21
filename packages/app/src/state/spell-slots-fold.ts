// The fold of the Spell slots block in the Spells panel (ORC-286,
// docs/design/spells-panel.md "Where the circles are"). The block starts
// open. When the user folds it, it stays folded on this device: the fold is
// state of this browser only, as the theme is. It is not a Preference and
// not a part of the character. When localStorage cannot be read or written,
// as in some private windows, the fold stays in memory until the page
// reloads.
import { useCallback, useSyncExternalStore } from "react";

/** The localStorage key of the fold. The value "1" is a folded block; with no value the block is open. */
export const SPELL_SLOTS_FOLDED_KEY = "spell-slots-folded";

// The fold when storage is blocked.
let unstored = false;
const listeners = new Set<() => void>();

function read(): boolean {
  try {
    return localStorage.getItem(SPELL_SLOTS_FOLDED_KEY) === "1";
  } catch {
    return unstored;
  }
}

function write(folded: boolean) {
  unstored = folded;
  try {
    if (folded) localStorage.setItem(SPELL_SLOTS_FOLDED_KEY, "1");
    else localStorage.removeItem(SPELL_SLOTS_FOLDED_KEY);
  } catch {
    // Kept in memory only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A change in another tab shows here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key === SPELL_SLOTS_FOLDED_KEY || event.key === null) listener();
  };
  addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    removeEventListener("storage", onStorage);
  };
}

/** True while the Spell slots block is folded, and the function that folds or opens it. */
export function useSpellSlotsFolded(): [folded: boolean, setFolded: (folded: boolean) => void] {
  const folded = useSyncExternalStore(subscribe, read, () => false);
  return [folded, useCallback((next: boolean) => write(next), [])];
}
