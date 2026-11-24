// Unknown weapons in a race's weapon proficiency choice (ORC-310). Old packs
// can name a weapon that the engine does not have, such as :thunder-cannon
// from the old app's UA Artificer. Engine 0.4.0 then cannot build the
// template, so each save, the builder and the next reload fail. The app takes
// such keys out of the choice when it imports a file and when it loads the
// stored packs, and logs each one. Engine 0.4.1 skips them as well.

import type { ContentItem } from "@pubdoor/dmv";
import { isMap, tag, untag } from "./content.ts";

const RACES = tag("orcpub.dnd.e5/races");
const PATH = ["profs", "weapon-proficiency-options", "options"] as const;

/** One key taken out of a choice, as a change of the import log. */
export interface UnknownWeaponChange {
  type: "removed-unknown-weapon";
  pack: string;
  "content-type": string;
  /** The race's key, without its "~:". */
  key: string;
  /** The race's name, or its key when it has none. */
  name: string;
  /** The weapon key, without its "~:". */
  weapon: string;
  description: string;
}

/** Tells whether the engine's weapon map has a key. */
export type KnownWeapon = (key: string) => boolean;

let srdKeys: Promise<Set<string>> | undefined;

/** The keys of the SRD weapons and of the SRD magic items, each weapon item once per base weapon. Loaded once. */
function loadSrdKeys(): Promise<Set<string>> {
  const keys = (mod: { default: unknown }) => (mod.default as ContentItem[]).map((item) => item.key);
  srdKeys ??= Promise.all([import("@pubdoor/dmv/content/weapons.json").then(keys), import("@pubdoor/dmv/content/magic-items.json").then(keys)]).then(
    ([weapons, magicItems]) => new Set([...weapons, ...magicItems]),
  );
  return srdKeys;
}

/**
 * The weapon keys that the engine knows: the SRD weapons, the SRD magic items,
 * and the user's own magic items by their key (customMagicItems), also with a
 * base weapon after it, as the engine names a magic weapon ("defender-longsword").
 */
export async function knownWeapons(customMagicItems: readonly string[]): Promise<KnownWeapon> {
  const srd = await loadSrdKeys();
  return (key) => srd.has(key) || customMagicItems.some((id) => key === id || key.startsWith(`${id}-`));
}

/**
 * The plugin without the unknown weapons in the weapon proficiency choice of
 * each race, and a change for each key taken out. A choice with "any" is not
 * changed, and neither is a plugin with no unknown key (the same object
 * comes back).
 */
export function withoutUnknownWeapons(pack: string, plugin: object, known: KnownWeapon): { plugin: object; changes: UnknownWeaponChange[] } {
  const races = (plugin as Record<string, unknown>)[RACES];
  if (!isMap(races)) return { plugin, changes: [] };
  const changes: UnknownWeaponChange[] = [];
  let changedRaces: Record<string, unknown> | undefined;
  for (const [key, race] of Object.entries(races)) {
    if (!isMap(race)) continue;
    const profs = race[tag(PATH[0])];
    const choice = isMap(profs) ? profs[tag(PATH[1])] : undefined;
    const options = isMap(choice) ? choice[tag(PATH[2])] : undefined;
    if (!isMap(options) || tag("any") in options) continue;
    const unknown = Object.keys(options).filter((weapon) => !known(untag(weapon)));
    if (unknown.length === 0) continue;
    const name = typeof race[tag("name")] === "string" ? (race[tag("name")] as string) : untag(key);
    for (const weapon of unknown) {
      changes.push({
        type: "removed-unknown-weapon",
        pack,
        "content-type": untag(RACES),
        key: untag(key),
        name,
        weapon: untag(weapon),
        description: `Removed the unknown weapon ${untag(weapon)} from the weapon proficiency choice of ${name}`,
      });
    }
    const kept = Object.fromEntries(Object.entries(options).filter(([weapon]) => !unknown.includes(weapon)));
    // A choice with no weapon left goes, as the engine cannot offer it.
    const { [tag(PATH[1])]: _choice, ...otherProfs } = profs as Record<string, unknown>;
    const newProfs =
      Object.keys(kept).length === 0 ? otherProfs : { ...otherProfs, [tag(PATH[1])]: { ...(choice as Record<string, unknown>), [tag(PATH[2])]: kept } };
    changedRaces ??= { ...races };
    changedRaces[key] = { ...race, [tag(PATH[0])]: newProfs };
  }
  if (changedRaces === undefined) return { plugin, changes };
  return { plugin: { ...plugin, [RACES]: changedRaces }, changes };
}

/** withoutUnknownWeapons for each pack of the homebrew. */
export function homebrewWithoutUnknownWeapons(
  homebrew: Record<string, object>,
  known: KnownWeapon,
): { homebrew: Record<string, object>; changes: UnknownWeaponChange[] } {
  const changes: UnknownWeaponChange[] = [];
  const result = Object.fromEntries(
    Object.entries(homebrew).map(([pack, plugin]) => {
      const cleaned = withoutUnknownWeapons(pack, plugin, known);
      changes.push(...cleaned.changes);
      return [pack, cleaned.plugin];
    }),
  );
  return { homebrew: changes.length === 0 ? homebrew : result, changes };
}
