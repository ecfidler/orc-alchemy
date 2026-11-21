// The spell lookup (ORC-280, docs/design/spells-panel.md "Spell records"): the
// record for a spell key, from the SRD spells and the enabled packs. It knows
// nothing of the sheet or the Spells panel, so other pages can use it too.
import { disabledInFile, isMap, itemsAt, tag, untag } from "./content.ts";

/**
 * A spell record: an SRD spell as `@pubdoor/dmv/content/spells.json` has it,
 * or a pack spell with its Transit tags taken off. An SRD spell has every
 * display field; a pack spell can lack any field but the key and the name.
 */
export interface SpellRecord {
  key: string;
  name: string;
  /** The importer gives 0 to a pack spell with no level. */
  level: number;
  /** Lower case, such as "evocation". The importer gives "unknown" to a pack spell with no school. */
  school: string;
  ritual?: boolean;
  "attack-roll?"?: boolean;
  "casting-time"?: string;
  range?: string;
  duration?: string;
  /** An SRD flag is true or absent; a pack flag can also be false. */
  components?: { verbal?: boolean; somatic?: boolean; material?: boolean; "material-component"?: string };
  /** Plain text with "\n" line breaks. */
  description?: string;
  summary?: string;
  /** On 8 SRD spells, "phb". */
  source?: string;
  page?: number;
  /** A pack spell only: the pack name that the spell has in its own data. */
  "option-pack"?: string;
  /** A pack spell only: class key to whether the spell is on its list. */
  "spell-lists"?: Record<string, boolean>;
}

/** Where a record is from: the SRD, or the enabled pack with that name. */
export type SpellRecordSource = "SRD" | { pack: string };

export interface SpellRecordResult {
  record: SpellRecord;
  from: SpellRecordSource;
}

/** The record for a spell key, or undefined when no record has the key, as for `tsunami`. */
export type SpellLookup = (key: string) => SpellRecordResult | undefined;

/** The name to show for a spell: the name of its record, or else the name that the caller made from its key. */
export const spellName = (lookup: SpellLookup, key: string, nameFromKey: string) => lookup(key)?.record.name ?? nameFromKey;

const SPELLS = tag("orcpub.dnd.e5/spells");

/**
 * The lookup over the SRD spells and the enabled packs, with the engine rule
 * for a key that has more than one record: a pack wins over the SRD, and the
 * last enabled pack wins over an earlier one. homebrew is the store's
 * `homebrew`, the map that the engine builds against: only the enabled packs,
 * without their disabled items, in the order the engine reads them. A pack
 * item with the old app's off flag is still in it, and the engine leaves it
 * out, so the lookup does too.
 */
export function spellLookup(srd: ReadonlyMap<string, SpellRecord>, homebrew: Record<string, object> | undefined): SpellLookup {
  const records = new Map<string, SpellRecordResult>();
  for (const [key, record] of srd) records.set(key, { record, from: "SRD" });
  for (const [pack, plugin] of Object.entries(homebrew ?? {})) {
    if (disabledInFile(plugin)) continue;
    for (const [taggedKey, item] of Object.entries(itemsAt(plugin, SPELLS) ?? {})) {
      if (disabledInFile(item)) continue;
      const record = packSpellRecord(untag(taggedKey), item);
      if (record !== null) records.set(record.key, { record, from: { pack } });
    }
  }
  return (key) => records.get(key);
}

/** A pack spell as a SpellRecord, keyed by its key in the pack; null for an item with no name, which is not a spell. */
export function packSpellRecord(key: string, item: object): SpellRecord | null {
  const plain = fromTransit(item) as Record<string, unknown>;
  if (typeof plain.name !== "string") return null;
  return {
    ...plain,
    key,
    name: plain.name,
    level: typeof plain.level === "number" ? plain.level : 0,
    school: typeof plain.school === "string" ? untag(plain.school) : "unknown",
  } as SpellRecord;
}

/** A Transit-JSON value with the "~:" tags taken off its map keys, and "~~" escapes taken off its strings. */
function fromTransit(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(fromTransit);
  if (isMap(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [untag(k), fromTransit(v)]));
  if (typeof value === "string" && value.startsWith("~~")) return value.slice(1);
  return value;
}
