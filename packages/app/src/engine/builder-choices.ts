// The lists of the homebrew forms (ORC-75), as the old builders subscribed to
// them: the races a subrace can belong to (::races/races), the classes a
// subclass can belong to (::classes/classes), the selections a class level
// can give (::selections/plugin-selections), the languages
// (::langs/languages), the weapons (::mi/custom-and-standard-weapons without
// the custom ones) and the spells (::spells/spells-for-level). Each list is
// the SRD content of the engine plus the items of the enabled packs; the
// selections come from the packs only.
import { useEffect, useMemo, useState } from "react";
import type { ContentItem } from "@pubdoor/dmv";
import { classDisplayName, itemsAt, tag, untag } from "./content.ts";

export interface Choice {
  key: string;
  name: string;
}

export interface SpellChoice extends Choice {
  level: number;
}

/** A race, with the values that a subrace shows when it has none of its own. */
export interface RaceChoice extends Choice {
  size?: string;
  speed?: number;
  darkvision?: number;
  /** The ability increases, by short key such as "con". */
  abilities: Record<string, number>;
}

export interface BuilderChoices {
  races: RaceChoice[];
  /** A pack class's name ends with its pack, as in the old class list. */
  classes: Choice[];
  /** Sorted by name. */
  selections: Choice[];
  /** Sorted by name, as the old checkboxes are. */
  languages: Choice[];
  weapons: Choice[];
  /** Sorted by name. */
  spells: SpellChoice[];
}

interface Srd {
  races: ContentItem[];
  classes: Choice[];
  languages: Choice[];
  weapons: Choice[];
  spells: SpellChoice[];
}

let loading: Promise<Srd> | undefined;

/** Loads the SRD lists once, as their own chunks. */
function loadSrd(): Promise<Srd> {
  const list = (mod: { default: unknown }) => mod.default as ContentItem[];
  const choice = ({ key, name }: ContentItem): Choice => ({ key, name });
  loading ??= Promise.all([
    import("@pubdoor/dmv/content/races.json").then(list),
    import("@pubdoor/dmv/content/classes.json").then(list),
    import("@pubdoor/dmv/content/languages.json").then(list),
    import("@pubdoor/dmv/content/weapons.json").then(list),
    import("@pubdoor/dmv/content/spells.json").then(list),
  ]).then(([races, classes, languages, weapons, spells]) => ({
    races,
    classes: classes.map(choice),
    languages: languages.map(choice),
    weapons: weapons.map(choice),
    spells: spells.map((s) => ({ key: s.key, name: s.name, level: Number(s.level) })),
  }));
  return loading;
}

const ABILITY = "orcpub.dnd.e5.character/";

/** The abilities map of a race, with its keys made short: "orcpub.dnd.e5.character/con" or "~:orcpub.dnd.e5.character/con" to "con". */
const shortAbilities = (abilities: unknown) =>
  Object.fromEntries(Object.entries((abilities ?? {}) as Record<string, number>).map(([key, value]) => [untag(key).replace(ABILITY, ""), value]));

/** The items of one content type in all the packs, as Transit-encoded records, with each item's pack. */
function itemsInPacks(homebrew: Record<string, object> | undefined, type: string): { pack: string; item: Record<string, unknown> }[] {
  return Object.entries(homebrew ?? {}).flatMap(([pack, plugin]) =>
    Object.values(itemsAt(plugin, tag(type)) ?? {}).map((item) => ({ pack, item: item as Record<string, unknown> })),
  );
}

const choiceOf = (item: Record<string, unknown>): Choice => ({ key: untag(item[tag("key")]), name: String(item[tag("name")] ?? "") });
const byName = (a: Choice, b: Choice) => a.name.localeCompare(b.name);
/** The items by key, so a pack item replaces an SRD item with the same key. */
const unique = <T extends Choice>(items: T[]) => [...new Map(items.map((item) => [item.key, item])).values()];

/** The lists for the homebrew, the enabled packs; null until the SRD lists load. */
export function useBuilderChoices(homebrew: Record<string, object> | undefined): BuilderChoices | null {
  const [srd, setSrd] = useState<Srd | null>(null);
  useEffect(() => {
    loadSrd().then(setSrd, console.error);
  }, []);
  return useMemo(() => {
    if (srd === null) return null;
    const items = (type: string) => itemsInPacks(homebrew, type);
    return {
      races: unique([
        ...srd.races.map((race) => ({
          key: race.key,
          name: race.name,
          size: race.size as string | undefined,
          speed: race.speed as number | undefined,
          darkvision: race.darkvision as number | undefined,
          abilities: shortAbilities(race.abilities),
        })),
        ...items("orcpub.dnd.e5/races").map(({ item: race }) => ({
          ...choiceOf(race),
          size: race[tag("size")] === undefined ? undefined : untag(race[tag("size")]),
          speed: race[tag("speed")] as number | undefined,
          darkvision: race[tag("darkvision")] as number | undefined,
          abilities: shortAbilities(race[tag("abilities")]),
        })),
      ]),
      classes: unique([
        ...srd.classes,
        ...items("orcpub.dnd.e5/classes").map(({ pack, item }) => {
          const { key, name } = choiceOf(item);
          return { key, name: classDisplayName(name, pack) };
        }),
      ]),
      selections: unique(items("orcpub.dnd.e5/selections").map(({ item }) => choiceOf(item))).sort(byName),
      languages: unique([...srd.languages, ...items("orcpub.dnd.e5/languages").map(({ item }) => choiceOf(item))]).sort(byName),
      weapons: srd.weapons,
      spells: unique([
        ...srd.spells,
        ...items("orcpub.dnd.e5/spells").map(({ item }) => ({ ...choiceOf(item), level: Number(item[tag("level")] ?? 0) })),
      ]).sort(byName),
    };
  }, [srd, homebrew]);
}
