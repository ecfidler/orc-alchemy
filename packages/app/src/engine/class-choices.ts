// The lists of the class and subclass forms (ORC-75), as the old builders
// subscribed to them: the classes a subclass can belong to
// (::classes/classes), the selections a level can give
// (::selections/plugin-selections), the weapons
// (::mi/custom-and-standard-weapons without the custom ones) and the spells
// (::spells/spells-for-level). Each list is the SRD content of the engine
// plus the items of the enabled packs; the selections come from packs only.
import { useEffect, useMemo, useState } from "react";
import type { ContentItem } from "@pubdoor/dmv";
import { DEFAULT_PACK, itemsAt, tag, untag } from "./content.ts";

export interface Choice {
  key: string;
  name: string;
}

export interface SpellChoice extends Choice {
  level: number;
}

export interface ClassChoices {
  /** A pack class's name ends with its pack, as in the old class list. */
  classes: Choice[];
  /** Sorted by name. */
  selections: Choice[];
  weapons: Choice[];
  /** Sorted by name. */
  spells: SpellChoice[];
}

type Srd = Omit<ClassChoices, "selections">;

let loading: Promise<Srd> | undefined;

/** Loads the SRD lists once, as their own chunks. */
function loadSrd(): Promise<Srd> {
  const list = (mod: { default: unknown }) => mod.default as ContentItem[];
  const choice = ({ key, name }: ContentItem): Choice => ({ key, name });
  loading ??= Promise.all([
    import("@pubdoor/dmv/content/classes.json").then(list),
    import("@pubdoor/dmv/content/weapons.json").then(list),
    import("@pubdoor/dmv/content/spells.json").then(list),
  ]).then(([classes, weapons, spells]) => ({
    classes: classes.map(choice),
    weapons: weapons.map(choice),
    spells: spells.map((s) => ({ key: s.key, name: s.name, level: Number(s.level) })),
  }));
  return loading;
}

/** The items of one content type in all the packs, with each item's pack. */
function packItems(homebrew: Record<string, object> | undefined, type: string): { pack: string; item: Record<string, unknown> }[] {
  return Object.entries(homebrew ?? {}).flatMap(([pack, plugin]) =>
    Object.values(itemsAt(plugin, tag(type)) ?? {}).map((item) => ({ pack, item: item as Record<string, unknown> })),
  );
}

const choiceOf = (item: Record<string, unknown>): Choice => ({ key: untag(item[tag("key")]), name: String(item[tag("name")] ?? "") });
const byName = (a: Choice, b: Choice) => a.name.localeCompare(b.name);
/** The items by key, so a pack item replaces an SRD item with the same key. */
const unique = <T extends Choice>(items: T[]) => [...new Map(items.map((item) => [item.key, item])).values()];

/** The lists for the homebrew, the enabled packs; null until the SRD lists load. */
export function useClassChoices(homebrew: Record<string, object> | undefined): ClassChoices | null {
  const [srd, setSrd] = useState<Srd | null>(null);
  useEffect(() => {
    loadSrd().then(setSrd, console.error);
  }, []);
  return useMemo(() => {
    if (srd === null) return null;
    const packClasses = packItems(homebrew, "orcpub.dnd.e5/classes").map(({ pack, item }) => {
      const { key, name } = choiceOf(item);
      return { key, name: pack === DEFAULT_PACK ? name : `${name} (${pack})` };
    });
    return {
      classes: unique([...srd.classes, ...packClasses]),
      selections: unique(packItems(homebrew, "orcpub.dnd.e5/selections").map(({ item }) => choiceOf(item))).sort(byName),
      weapons: srd.weapons,
      spells: unique([
        ...srd.spells,
        ...packItems(homebrew, "orcpub.dnd.e5/spells").map(({ item }) => ({ ...choiceOf(item), level: Number(item[tag("level")] ?? 0) })),
      ]).sort(byName),
    };
  }, [srd, homebrew]);
}
