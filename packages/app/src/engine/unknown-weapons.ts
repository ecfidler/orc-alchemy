// Unknown weapons in the weapon proficiency choice of a race (ORC-310). Old
// packs can name a weapon that the engine does not have, such as
// :thunder-cannon from the UA Artificer of the old app. Engine 0.4.0 then
// cannot build the template. The app removes such keys when it imports a file
// and when it loads the stored packs, and logs each key that it removes.
// Engine 0.4.1 also skips unknown keys.

import type { ContentItem, ContentType } from "@pubdoor/dmv";
import { isMap, itemsAt, tag, untag } from "./content.ts";

const RACES_TYPE: ContentType = "orcpub.dnd.e5/races";
const RACES = tag(RACES_TYPE);
const PROFS = tag("profs");
const WEAPON_CHOICE = tag("weapon-proficiency-options");
const OPTIONS = tag("options");
const CHOOSE = tag("choose");

/** One key removed from a choice, as a change of the import log. */
export interface UnknownWeaponChange {
  type: "removed-unknown-weapon";
  pack: string;
  "content-type": ContentType;
  /** The key of the race, without its "~:". */
  key: string;
  /** The name of the race, or its key when it has no name. */
  name: string;
  /** The weapon key, without its "~:". */
  weapon: string;
  description: string;
}

/** Tells if the weapon map of the engine has a key. */
export type KnownWeapon = (key: string) => boolean;

let known: Promise<KnownWeapon> | undefined;

/**
 * The weapon keys that the engine knows when it builds the packs with no
 * custom magic items, as the build checks of the store do: the SRD weapons,
 * and the SRD magic weapons, once for each base weapon ("defender-longsword").
 * Loaded once.
 */
export function knownWeapons(): Promise<KnownWeapon> {
  const list = (mod: { default: unknown }) => mod.default as ContentItem[];
  known ??= Promise.all([import("@pubdoor/dmv/content/weapons.json").then(list), import("@pubdoor/dmv/content/magic-items.json").then(list)]).then(
    ([weapons, magicItems]) => {
      const keys = new Set([...weapons, ...magicItems.filter((item) => item["orcpub.dnd.e5.magic-items/type"] === "weapon")].map((item) => item.key));
      return (key) => keys.has(key);
    },
  );
  return known;
}

/**
 * The plugin without the unknown weapons in the weapon proficiency choice of
 * each race, and a change for each key that it removes. The choice then asks
 * for no more weapons than it has. A choice with no weapon left is removed.
 * A choice of "any" weapon does not change. When no key is unknown, the
 * same plugin object comes back.
 */
export function withoutUnknownWeapons(pack: string, plugin: object, isKnown: KnownWeapon): { plugin: object; changes: UnknownWeaponChange[] } {
  const races = itemsAt(plugin, RACES);
  if (!isMap(races)) return { plugin, changes: [] };
  const changes: UnknownWeaponChange[] = [];
  let changedRaces: Record<string, object> | undefined;
  for (const [key, race] of Object.entries(races)) {
    if (!isMap(race)) continue;
    const profs = race[PROFS];
    const choice = isMap(profs) ? profs[WEAPON_CHOICE] : undefined;
    const options = isMap(choice) ? choice[OPTIONS] : undefined;
    if (!isMap(profs) || !isMap(choice) || !isMap(options) || tag("any") in options) continue;
    const unknown = Object.keys(options).filter((weapon) => !isKnown(untag(weapon)));
    if (unknown.length === 0) continue;
    const name = typeof race[tag("name")] === "string" ? (race[tag("name")] as string) : untag(key);
    for (const weapon of unknown) {
      changes.push({
        type: "removed-unknown-weapon",
        pack,
        "content-type": RACES_TYPE,
        key: untag(key),
        name,
        weapon: untag(weapon),
        description: `Removed the unknown weapon ${untag(weapon)} from the weapon proficiency choice of ${name}`,
      });
    }
    const kept = Object.fromEntries(Object.entries(options).filter(([weapon]) => !unknown.includes(weapon)));
    const count = Object.keys(kept).length;
    const { [WEAPON_CHOICE]: _choice, ...otherProfs } = profs;
    const newChoice: Record<string, unknown> = { ...choice, [OPTIONS]: kept };
    if (typeof choice[CHOOSE] === "number") newChoice[CHOOSE] = Math.min(choice[CHOOSE], count);
    const newProfs = count === 0 ? otherProfs : { ...otherProfs, [WEAPON_CHOICE]: newChoice };
    changedRaces ??= { ...races };
    changedRaces[key] = { ...race, [PROFS]: newProfs };
  }
  if (changedRaces === undefined) return { plugin, changes };
  return { plugin: { ...plugin, [RACES]: changedRaces }, changes };
}

/** withoutUnknownWeapons for each pack of the homebrew. When no key is unknown, the same homebrew object comes back. */
export function homebrewWithoutUnknownWeapons(
  homebrew: Record<string, object>,
  isKnown: KnownWeapon,
): { homebrew: Record<string, object>; changes: UnknownWeaponChange[] } {
  const changes: UnknownWeaponChange[] = [];
  const result = Object.fromEntries(
    Object.entries(homebrew).map(([pack, plugin]) => {
      const cleaned = withoutUnknownWeapons(pack, plugin, isKnown);
      changes.push(...cleaned.changes);
      return [pack, cleaned.plugin];
    }),
  );
  return { homebrew: changes.length === 0 ? homebrew : result, changes };
}
