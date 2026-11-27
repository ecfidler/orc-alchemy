import { beforeAll, expect, test } from "vitest";
import { buildTemplate, loadEngine } from "./engine.ts";
import { packSpellRecord, type SpellRecord, spellLookup } from "./spell-records.ts";
import { loadSpellContent, type SpellContent } from "./spells.ts";

let srd: SpellContent;
beforeAll(async () => {
  [srd] = await Promise.all([loadSpellContent(), loadEngine()]);
});

const SPELLS = "~:orcpub.dnd.e5/spells";
/** A pack spell as a stored pack has it, in Transit-JSON. */
const packSpell = (key: string, name: string, pack: string, extra: Record<string, unknown> = {}) => ({
  "~:key": `~:${key}`,
  "~:name": name,
  "~:option-pack": pack,
  "~:level": 1,
  "~:school": "evocation",
  "~:spell-lists": { "~:wizard": true },
  ...extra,
});
/** A plugin with these spells. */
const plugin = (...spells: ReturnType<typeof packSpell>[]) => ({ [SPELLS]: Object.fromEntries(spells.map((s) => [s["~:key"], s])) });

/** The old app's kw-to-name, which the sheet uses for a spell with no record. */
const keyToName = (key: string) =>
  key
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

test("an SRD key gives its SRD record, with the record name", () => {
  const lookup = spellLookup(srd, undefined);
  expect(lookup("antipathy-sympathy")).toEqual({ record: expect.objectContaining({ name: "Antipathy/Sympathy", level: 8 }), from: "SRD" });
  expect(lookup("arcanists-magic-aura")?.record.name).toBe("Arcanist's Magic Aura");
  expect(lookup("cone-of-cold")?.record.name).toBe("Cone of Cold");
  // 48 SRD spells have a record name that is not the name from the key.
  const wrong = [...srd.keys()].filter((key) => lookup(key)!.record.name !== keyToName(key));
  expect(wrong).toHaveLength(48);
  expect(wrong).toEqual(expect.arrayContaining(["antipathy-sympathy", "arcanists-magic-aura"]));
});

test("a key with no record gives no result", () => {
  expect(spellLookup(srd, undefined)("tsunami")).toBeUndefined();
  expect(spellLookup(srd, { Reef: plugin(packSpell("zap", "Zap", "Reef")) })("tsunami")).toBeUndefined();
});

test("a pack spell gives the pack record, from that pack, with its Transit tags taken off", () => {
  const zap = packSpell("zap", "Zap Cantrip of Doom's Day", "Reef", {
    "~:level": 0,
    "~:components": { "~:verbal": true, "~:somatic": false, "~:material-component": "~~a spark" },
    "~:description": "A small bolt.",
  });
  const result = spellLookup(srd, { Reef: plugin(zap) })("zap");
  expect(result).toEqual({
    record: {
      key: "zap",
      name: "Zap Cantrip of Doom's Day",
      "option-pack": "Reef",
      level: 0,
      school: "evocation",
      "spell-lists": { wizard: true },
      components: { verbal: true, somatic: false, "material-component": "~a spark" },
      description: "A small bolt.",
    } satisfies SpellRecord,
    from: { pack: "Reef" },
  });
});

test("a pack spell with an SRD key gives the pack record", () => {
  const lookup = spellLookup(srd, { Reef: plugin(packSpell("fireball", "Fireball (Reef)", "Reef", { "~:level": 3 })) });
  expect(lookup("fireball")).toEqual({ record: expect.objectContaining({ name: "Fireball (Reef)" }), from: { pack: "Reef" } });
  // The other SRD spells stay.
  expect(lookup("alarm")?.from).toBe("SRD");
});

test("of two enabled packs with the key, the last one in the engine's order wins, as the engine's own option names", () => {
  for (const names of [
    ["Pack A", "Pack B", "Pack C"],
    ["Pack C", "Pack B", "Pack A"],
    // More than 8 packs: more keys than a small ClojureScript map holds in order.
    Array.from({ length: 12 }, (_, i) => `Pack ${String.fromCharCode(65 + i)}`),
  ]) {
    const homebrew = Object.fromEntries(names.map((pack) => [pack, plugin(packSpell("zap", `Zap ${pack}`, pack))]));
    const last = names.at(-1)!;
    expect(spellLookup(srd, homebrew)("zap")).toEqual({ record: expect.objectContaining({ name: `Zap ${last}` }), from: { pack: last } });
    expect(engineOptionNames(homebrew, "zap")).toEqual([`1 - Zap ${last}`]);
  }
});

test("an item or a pack with the old app's off flag gives no record, as the engine leaves it out", () => {
  const off = { "~:disabled?": true };
  const later = plugin(packSpell("zap", "Zap Off", "Later", off), packSpell("fireball", "Fireball Off", "Later", off));
  const lookup = spellLookup(srd, { Earlier: plugin(packSpell("zap", "Zap", "Earlier")), Later: later });
  expect(lookup("zap")).toEqual({ record: expect.objectContaining({ name: "Zap" }), from: { pack: "Earlier" } });
  expect(lookup("fireball")?.from).toBe("SRD");
  expect(spellLookup(srd, { Off: { ...plugin(packSpell("zap", "Zap", "Off")), ...off } })("zap")).toBeUndefined();
});

test("a pack item with no name is not a spell record", () => {
  expect(packSpellRecord("zap", { "~:key": "~:zap", "~:level": 1 })).toBeNull();
  expect(spellLookup(srd, { Reef: { [SPELLS]: { "~:fireball": { "~:key": "~:fireball" } } } })("fireball")?.from).toBe("SRD");
});

/** The names that the engine's template gives the options with this key. */
function engineOptionNames(homebrew: Record<string, object>, key: string): string[] {
  const names = new Set<string>();
  const seen = new WeakSet<object>();
  const walk = (node: unknown) => {
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    const { key: k, name } = node as { key?: unknown; name?: unknown };
    if (k === key && typeof name === "string") names.add(name);
    for (const value of Object.values(node)) walk(value);
  };
  walk(buildTemplate(homebrew).shape);
  return [...names];
}
