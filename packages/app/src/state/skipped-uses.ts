// The skipped rows of the Review uses page (ORC-207,
// docs/design/homebrew-forms.md, "Review uses page"). A row with suggested
// uses that the user leaves unchecked at a Save is skipped: the page hides
// it until the user turns on "Show skipped". Skipped rows are state of this
// browser only, as the theme is. They are in localStorage under one key, by
// pack name, and never go into a stored pack or an .orcbrew export. A row is
// named by its id (review-uses.ts), which holds its item and its feature.
// When localStorage cannot be read or written, as in some private windows,
// the skipped rows stay in memory until the page reloads.
import { create } from "zustand";

/** The localStorage key of the skipped rows. */
export const SKIPPED_USES_KEY = "skipped-uses";

/** The ids of the skipped rows, by pack name. */
export type SkippedUses = Record<string, string[]>;

const isIds = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string");

/** The stored skipped rows. A value that is not well formed reads as none. */
function read(): SkippedUses {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(SKIPPED_USES_KEY) ?? "{}");
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string[]] => isIds(entry[1])));
  } catch {
    return {};
  }
}

function write(skipped: SkippedUses) {
  try {
    if (Object.keys(skipped).length === 0) localStorage.removeItem(SKIPPED_USES_KEY);
    else localStorage.setItem(SKIPPED_USES_KEY, JSON.stringify(skipped));
  } catch {
    // Kept in memory only.
  }
}

export const useSkippedUses = create<SkippedUses>(() => read());

// A change in another tab shows here too.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key === SKIPPED_USES_KEY || event.key === null) useSkippedUses.setState(read(), true);
  });
}

const NONE: string[] = [];

/** The ids of the pack's skipped rows. */
export const skippedOf = (skipped: SkippedUses, pack: string): string[] => skipped[pack] ?? NONE;

/** Makes the rows `skip` skipped, and the rows `keep` not skipped, in the pack. */
export function setSkipped(pack: string, skip: string[], keep: string[]) {
  const before = skippedOf(useSkippedUses.getState(), pack);
  const ids = [...new Set([...before.filter((id) => !keep.includes(id)), ...skip])];
  const { [pack]: _old, ...others } = useSkippedUses.getState();
  const next = ids.length === 0 ? others : { ...others, [pack]: ids };
  write(next);
  useSkippedUses.setState(next, true);
}

/** Forgets the skipped rows of a pack, when the pack is deleted. */
export function forgetSkipped(pack: string) {
  const { [pack]: forgotten, ...others } = useSkippedUses.getState();
  if (forgotten === undefined) return;
  write(others);
  useSkippedUses.setState(others, true);
}

/** Reads the skipped rows again from localStorage, for tests of a reload. */
export const reloadSkipped = () => useSkippedUses.setState(read(), true);
