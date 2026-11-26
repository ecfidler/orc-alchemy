// The lazy loaders of the engine's SRD content lists (@pubdoor/dmv/content/*.json). Each list loads once for the app,
// as its own chunk, and all the modules that read a list share that one load, also the spells of spells.ts. A load
// that fails is not kept, so the next call tries again.

import type { ContentItem } from "@pubdoor/dmv";

// One import for each list, with its literal path, so that the bundler makes a chunk for each.
const IMPORTS = {
  armor: () => import("@pubdoor/dmv/content/armor.json"),
  backgrounds: () => import("@pubdoor/dmv/content/backgrounds.json"),
  classes: () => import("@pubdoor/dmv/content/classes.json"),
  equipment: () => import("@pubdoor/dmv/content/equipment.json"),
  languages: () => import("@pubdoor/dmv/content/languages.json"),
  "magic-items": () => import("@pubdoor/dmv/content/magic-items.json"),
  races: () => import("@pubdoor/dmv/content/races.json"),
  spells: () => import("@pubdoor/dmv/content/spells.json"),
  weapons: () => import("@pubdoor/dmv/content/weapons.json"),
} satisfies Record<string, () => Promise<{ default: unknown }>>;

/** The name of an SRD content list: its file name without ".json". */
export type SrdListName = keyof typeof IMPORTS;

const loads = new Map<SrdListName, Promise<ContentItem[]>>();

/** The SRD content list with the name. It loads once, as its own chunk; after a failed load, the next call tries again. */
export function srdList(name: SrdListName): Promise<ContentItem[]> {
  let load = loads.get(name);
  if (load === undefined) {
    load = IMPORTS[name]().then(
      (mod) => mod.default as unknown as ContentItem[],
      (error) => {
        loads.delete(name);
        throw error;
      },
    );
    loads.set(name, load);
  }
  return load;
}
