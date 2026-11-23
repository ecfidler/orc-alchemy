// The content format: the schema, the loader, the upgrade of a version, the
// key scheme, and the example records of docs/design/2024-content-format.md.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import examplePack from "./fixtures/example-pack.json" with { type: "json" };
import { isKey, isReference, keyFromName, parseReference } from "./keys.ts";
import { checkReferences, loadPack, type Upgrade } from "./load.ts";
import { BackgroundRecord, FeatRecord, RECORD_TYPES, SpeciesRecord, SpellRecord } from "./schema.ts";

const clone = <T>(value: T): T => structuredClone(value);
const noHooks = new Set<string>();

describe("the example records of the format doc", () => {
  // Each ```json block under "# Example records" is one record.
  const doc = readFileSync(join(import.meta.dirname, "../../../../docs/design/2024-content-format.md"), "utf8");
  const examples = doc.slice(doc.indexOf("# Example records"));
  const blocks = [...examples.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]));

  it("has four, and each one is valid for its record type", () => {
    expect(blocks).toHaveLength(4);
    const [species, background, feat, spell] = blocks;
    for (const [schema, record] of [
      [SpeciesRecord, species],
      [BackgroundRecord, background],
      [FeatRecord, feat],
      [SpellRecord, spell],
    ] as const) {
      const result = schema.safeParse(record);
      expect(result.error?.issues ?? []).toEqual([]);
    }
  });

  it("loads in the example pack with no issue, and every reference resolves", () => {
    const { pack, issues } = loadPack(examplePack, { hooks: noHooks });
    expect(issues).toEqual([]);
    expect(pack?.species.map((r) => r.key)).toEqual(["dwarf"]);
    expect(pack?.backgrounds.map((r) => r.key)).toEqual(["soldier"]);
    expect(pack?.feats.map((r) => r.key)).toEqual(["alert", "savage-attacker"]);
    expect(pack?.spells.map((r) => r.key)).toEqual(["fireball"]);
    expect(checkReferences(pack ? [pack] : [])).toEqual([]);
  });

  it("fills an empty list for each record type that the pack leaves out", () => {
    const { pack } = loadPack({ format: "alchemy-content", version: 1, rules: "2024", pack: { id: "hb-1", name: "Mine" } });
    expect(Object.keys(pack ?? {})).toEqual(["format", "version", "rules", "pack", ...RECORD_TYPES]);
    expect(pack?.monsters).toEqual([]);
  });

  it("keeps a record without effects, with its display layer", () => {
    const pack = clone(examplePack);
    delete (pack.species[0] as { effects?: unknown }).effects;
    const loaded = loadPack(pack, { hooks: noHooks }).pack;
    expect(loaded?.species[0].traits).toHaveLength(4);
    expect(loaded?.species[0].effects).toBeUndefined();
  });
});

describe("validation", () => {
  it("refuses what is not a pack", () => {
    expect(loadPack("text").issues).toEqual([{ path: [], message: "A pack is a JSON object", dropped: "pack" }]);
    expect(loadPack({ format: "orcbrew", version: 1 }).issues[0]).toMatchObject({ path: ["format"], dropped: "pack" });
    expect(loadPack({ ...examplePack, rules: "2014" }).issues[0]).toMatchObject({ path: ["rules"], dropped: "pack" });
  });

  it("gives each bad value with its path, and keeps the good records", () => {
    const pack = clone(examplePack) as Record<string, unknown> & typeof examplePack;
    (pack.feats[0] as Record<string, unknown>).category = "heroic";
    (pack.feats[0].effects?.[0] as Record<string, unknown>).value = { read: "Proficiency Bonus" };
    (pack.species[0] as Record<string, unknown>).speed = -5;
    (pack.spells[0] as Record<string, unknown>).key = "Fire Ball";
    pack.extra = [];
    const { pack: loaded, issues } = loadPack(pack, { hooks: noHooks });
    expect(issues.map((issue) => [issue.path.join("."), issue.dropped])).toEqual([
      ["extra", "none"],
      ["species.0.speed", "record"],
      ["feats.0.effects.0.value.read", "record"],
      ["feats.0.category", "record"],
      ["spells.0.key", "record"],
    ]);
    expect(issues.find((issue) => issue.path.join(".") === "spells.0.key")?.message).toBe("A key has lowercase letters, digits and hyphens only");
    // The bad records are dropped. The others load.
    expect(loaded?.species).toEqual([]);
    expect(loaded?.feats.map((r) => r.key)).toEqual(["savage-attacker"]);
    expect(loaded?.backgrounds).toHaveLength(1);
  });

  it("reports two records with one key", () => {
    const pack = clone(examplePack);
    pack.feats.push(clone(pack.feats[0]));
    expect(loadPack(pack, { hooks: noHooks }).issues).toEqual([
      { path: ["feats", 2, "key"], message: 'Two feats records have the key "alert"', dropped: "record" },
    ]);
  });

  it("names the bad field of an effect", () => {
    const pack = clone(examplePack);
    (pack.species[0].effects[3] as Record<string, unknown>).uses = { trait: "stonecunning", amount: 2, recover: [{ on: "dawn", amount: "all" }] };
    expect(loadPack(pack, { hooks: noHooks }).issues.map((issue) => issue.path.join("."))).toEqual(["species.0.effects.3.uses.recover.0.on"]);
  });
});

describe("versions", () => {
  it("refuses a pack of a newer version with a clear message", () => {
    const { pack, issues } = loadPack({ ...examplePack, version: 2 });
    expect(pack).toBeNull();
    expect(issues).toEqual([
      {
        path: ["version"],
        message: "This pack has format version 2, and this app reads version 1 or older. Update the app to load the pack.",
        dropped: "pack",
      },
    ]);
  });

  it("upgrades an older pack one version at a time", () => {
    // A test version 3: version 2 renamed "speed" to "walk", and version 3 renamed it back.
    const calls: number[] = [];
    const upgrades: Record<number, Upgrade> = {
      1: (pack) => {
        calls.push(1);
        const species = (pack.species as Record<string, unknown>[]).map(({ speed, ...rest }) => ({ ...rest, walk: speed }));
        return { ...pack, species };
      },
      2: (pack) => {
        calls.push(2);
        expect(pack.version).toBe(2);
        const species = (pack.species as Record<string, unknown>[]).map(({ walk, ...rest }) => ({ ...rest, speed: walk }));
        return { ...pack, species };
      },
    };
    const { pack, issues } = loadPack(examplePack, { version: 3, upgrades, hooks: noHooks });
    expect(calls).toEqual([1, 2]);
    expect(issues).toEqual([]);
    expect(pack?.version).toBe(3);
    expect(pack?.species[0].speed).toBe(30);
  });

  it("refuses an older pack that no upgrade covers", () => {
    expect(loadPack(examplePack, { version: 2, upgrades: {} }).issues[0].message).toBe("No upgrade from format version 1 to 2");
  });
});

describe("hooks", () => {
  const withHook = () => {
    const pack = clone(examplePack);
    (pack.feats[0].effects as unknown[]).push({ hook: "spell-points", args: { per: "level" } });
    return pack;
  };

  it("keeps the display layer of a record that names an unknown hook, and reports it", () => {
    const { pack, issues } = loadPack(withHook(), { hooks: noHooks });
    expect(issues).toEqual([
      {
        path: ["feats", 0, "effects", 1, "hook"],
        message: 'The engine has no hook "spell-points", so the record loads without its effects',
        dropped: "effects",
      },
    ]);
    expect(pack?.feats[0].traits).toHaveLength(2);
    expect(pack?.feats[0].effects).toBeUndefined();
  });

  it("keeps the effects when the engine has the hook", () => {
    const { pack, issues } = loadPack(withHook(), { hooks: new Set(["spell-points"]) });
    expect(issues).toEqual([]);
    expect(pack?.feats[0].effects).toHaveLength(2);
  });
});

describe("keys and references", () => {
  it("allows lowercase letters, digits and hyphens in a key", () => {
    expect(["fireball", "hb-7k2m9x", "level-20"].every(isKey)).toBe(true);
    expect(["Fireball", "fire_ball", "-fire", "fire--ball", "fire ball", ""].some(isKey)).toBe(false);
  });

  it("reads a reference as a pack id and a key", () => {
    expect(parseReference("srd52:fireball")).toEqual({ pack: "srd52", key: "fireball" });
    expect(parseReference("hb-7k2m9x:fireball")).toEqual({ pack: "hb-7k2m9x", key: "fireball" });
    expect(isReference("fireball")).toBe(false);
    expect(() => parseReference("srd52:")).toThrow("write it as pack:key");
  });

  it("makes a key from a name for a record with no upstream index", () => {
    expect(keyFromName("Agonizing Blast")).toBe("agonizing-blast");
    expect(keyFromName("Thieves' Tools")).toBe("thieves-tools");
    expect(keyFromName("Mask of Many Faces")).toBe("mask-of-many-faces");
    expect(keyFromName("Elven Lineage: Drow")).toBe("elven-lineage-drow");
    expect(isKey(keyFromName("Ölmänn's “Eye”"))).toBe(true);
  });

  it("checks that a reference points to a record of the right type", () => {
    const pack = clone(examplePack);
    pack.backgrounds[0].feat = "srd52:fireball";
    pack.spells[0].classes = ["srd52:sorcerer", "srd52:bard"];
    (pack.backgrounds[0].startingEquipment[0].items as { item: unknown }[])[0].item = "hb-x:spear";
    const loaded = loadPack(pack, { hooks: noHooks }).pack;
    expect(checkReferences(loaded ? [loaded] : [])).toEqual([
      {
        path: ["srd52", "backgrounds", 0, "feat"],
        message: '"srd52:fireball" is a record of spells, and this field needs a record of feats',
        dropped: "none",
      },
      {
        path: ["srd52", "backgrounds", 0, "startingEquipment", 0, "items", 0, "item"],
        message: '"hb-x:spear" refers to the pack "hb-x", which is not loaded',
        dropped: "none",
      },
      { path: ["srd52", "spells", 0, "classes", 1], message: '"srd52:bard" is not a record of classes in "srd52"', dropped: "none" },
    ]);
  });

  it("resolves a reference from a homebrew pack into the built-in pack", () => {
    const srd = loadPack(examplePack, { hooks: noHooks }).pack;
    const homebrew = loadPack(
      {
        format: "alchemy-content",
        version: 1,
        rules: "2024",
        pack: { id: "hb-7k2m9x", name: "My table" },
        backgrounds: [{ ...clone(examplePack.backgrounds[0]), key: "gladiator", name: "Gladiator", feat: "srd52:alert" }],
      },
      { hooks: noHooks },
    ).pack;
    expect(srd && homebrew && checkReferences([srd, homebrew])).toEqual([]);
  });
});
