// The lists of the race and subrace forms (ORC-75), as the old builders
// subscribed to them: the races a subrace can belong to (::races/races), the
// languages (::langs/languages), the weapons (::mi/custom-and-standard-weapons
// without the custom ones) and the spells of each level
// (::spells/spells-for-level). Each list is the SRD content of the engine
// plus the items of the enabled packs.
import { useEffect, useMemo, useState } from "react";
import type { ContentItem } from "@pubdoor/dmv";
import { itemsAt, tag, untag } from "./content.ts";

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

export interface RaceChoices {
  races: RaceChoice[];
  /** Sorted by name, as the old checkboxes are. */
  languages: Choice[];
  weapons: Choice[];
  /** Sorted by name. */
  spells: SpellChoice[];
}

type Srd = Omit<RaceChoices, "races"> & { races: ContentItem[] };

let loading: Promise<Srd> | undefined;

/** Loads the SRD lists once, as their own chunks. */
function loadSrd(): Promise<Srd> {
  const list = (mod: { default: unknown }) => mod.default as ContentItem[];
  const choice = ({ key, name }: ContentItem): Choice => ({ key, name });
  loading ??= Promise.all([
    import("@pubdoor/dmv/content/races.json").then(list),
    import("@pubdoor/dmv/content/languages.json").then(list),
    import("@pubdoor/dmv/content/weapons.json").then(list),
    import("@pubdoor/dmv/content/spells.json").then(list),
  ]).then(([races, languages, weapons, spells]) => ({
    races,
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

/** The items of one content type in all the packs, as Transit-encoded records. */
function packItems(homebrew: Record<string, object> | undefined, type: string): Record<string, unknown>[] {
  return Object.values(homebrew ?? {}).flatMap((plugin) => Object.values(itemsAt(plugin, tag(type)) ?? {}) as Record<string, unknown>[]);
}

const byName = (a: Choice, b: Choice) => a.name.localeCompare(b.name);

/** The items by key, so a pack item replaces an SRD item with the same key. */
const unique = <T extends Choice>(items: T[]) => [...new Map(items.map((item) => [item.key, item])).values()];

/** The lists for the homebrew, the enabled packs; null until the SRD lists load. */
export function useRaceChoices(homebrew: Record<string, object> | undefined): RaceChoices | null {
  const [srd, setSrd] = useState<Srd | null>(null);
  useEffect(() => {
    loadSrd().then(setSrd, console.error);
  }, []);
  return useMemo(() => {
    if (srd === null) return null;
    const item = (record: Record<string, unknown>): Choice => ({ key: untag(record[tag("key")]), name: String(record[tag("name")] ?? "") });
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
        ...packItems(homebrew, "orcpub.dnd.e5/races").map((race) => ({
          ...item(race),
          size: race[tag("size")] === undefined ? undefined : untag(race[tag("size")]),
          speed: race[tag("speed")] as number | undefined,
          darkvision: race[tag("darkvision")] as number | undefined,
          abilities: shortAbilities(race[tag("abilities")]),
        })),
      ]),
      languages: unique([...srd.languages, ...packItems(homebrew, "orcpub.dnd.e5/languages").map(item)]).sort(byName),
      weapons: srd.weapons,
      spells: unique([...srd.spells, ...packItems(homebrew, "orcpub.dnd.e5/spells").map((spell) => ({ ...item(spell), level: Number(spell[tag("level")] ?? 0) }))]).sort(byName),
    };
  }, [srd, homebrew]);
}
