import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { applyResolutions, conflictSources, conflictsToChoose, internalCopies, settledBy, type KeyConflict, type Resolution } from "./conflicts.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";
import { missingContent } from "./reconcile.ts";

beforeAll(() => loadEngine());

const orcbrewDir = join(import.meta.dirname, "../../../../fixtures/orcbrew");
const orcbrew = (file: string) => readFileSync(join(orcbrewDir, file), "utf8").replace(/^﻿/, "");

/** duplicate-external-b parsed over duplicate-external-a: four external conflicts, custom-lineage among them. */
function aThenB() {
  const a = engine().parseOrcbrew(orcbrew("duplicate-external-a.orcbrew"), { name: "duplicate-external-a" });
  const b = engine().parseOrcbrew(orcbrew("duplicate-external-b.orcbrew"), { name: "duplicate-external-b", existing: a.data! });
  return { homebrew: b.data!, conflicts: b.conflicts };
}

const all = (conflicts: KeyConflict[], choice: Resolution) => Object.fromEntries(conflicts.map((c) => [c.id, choice]));
/** The packs as an .orcbrew file, parsed again: a consistent result has no conflicts. */
const reparse = (homebrew: Record<string, object>) => engine().parseOrcbrew(engine().orcbrewToEdn(homebrew));
const item = (homebrew: Record<string, object>, pack: string, type: string, key: string) =>
  (homebrew[pack] as Record<string, Record<string, Record<string, unknown>> | undefined>)[`~:orcpub.dnd.e5/${type}`]?.[`~:${key}`];

test("duplicate-external-b over -a has the four external conflicts, custom-lineage among them", () => {
  const { conflicts } = aThenB();
  expect(conflicts.map((c) => [c.type, c["content-type"], c.key])).toEqual([
    ["external", "orcpub.dnd.e5/classes", "artificer"],
    ["external", "orcpub.dnd.e5/classes", "monster-hunter"],
    ["external", "orcpub.dnd.e5/subclasses", "artillerist"],
    ["external", "orcpub.dnd.e5/races", "custom-lineage"],
  ]);
});

describe("Rename all on duplicate-external-a then -b", () => {
  test("renames each imported key, keeps both versions, and rewrites the imported subclass's class", () => {
    const { homebrew, conflicts } = aThenB();
    const { homebrew: resolved, renames } = applyResolutions(homebrew, conflicts, all(conflicts, "rename"));

    expect(renames.map((r) => `${r.pack}: ${r.from} -> ${r.to}`)).toEqual([
      "duplicate-external-b: artificer -> artificer-duplicate-external-b",
      "duplicate-external-b: monster-hunter -> monster-hunter-duplicate-external-b",
      "duplicate-external-b: artillerist -> artillerist-duplicate-external-b",
      "duplicate-external-b: custom-lineage -> custom-lineage-duplicate-external-b",
    ]);
    expect(engine().buildTemplate(resolved).content.races).toEqual(expect.arrayContaining(["custom-lineage", "custom-lineage-duplicate-external-b"]));
    // patch D4: the renamed subclass points at its pack's renamed class.
    expect(item(resolved, "duplicate-external-b", "subclasses", "artillerist-duplicate-external-b")?.["~:class"]).toBe("~:artificer-duplicate-external-b");
    expect(item(resolved, "duplicate-external-a", "races", "custom-lineage")).toBeDefined();
    expect(reparse(resolved).conflicts).toEqual([]);
  });
});

describe("Skip all on duplicate-external-a then -b", () => {
  test("leaves the loaded items and drops the imported ones", () => {
    const { homebrew, conflicts } = aThenB();
    const { homebrew: resolved, renames } = applyResolutions(homebrew, conflicts, all(conflicts, "skip"));

    expect(renames).toEqual([]);
    for (const c of conflicts) {
      const type = c["content-type"].replace("orcpub.dnd.e5/", "");
      expect(item(resolved, "duplicate-external-b", type, c.key), c.key).toBeUndefined();
      expect(item(resolved, "duplicate-external-a", type, c.key), c.key).toBeDefined();
    }
    expect(engine().buildTemplate(resolved).content.races).toContain("custom-lineage");
    expect(reparse(resolved).conflicts).toEqual([]);
  });
});

test("Replace drops the loaded item and keeps the imported one", () => {
  const { homebrew, conflicts } = aThenB();
  const lineage = conflicts.find((c) => c.key === "custom-lineage")!;
  const choices = { ...all(conflicts, "skip"), [lineage.id]: "replace" as const };
  const { homebrew: resolved } = applyResolutions(homebrew, conflicts, choices);

  expect(item(resolved, "duplicate-external-a", "races", "custom-lineage")).toBeUndefined();
  expect(item(resolved, "duplicate-external-b", "races", "custom-lineage")?.["~:name"]).toBe("Custom Lineage (Variant)");
  expect(reparse(resolved).conflicts).toEqual([]);
});

test("a conflict with no choice, or with a choice its type does not offer, throws and names the key", () => {
  const { homebrew, conflicts } = aThenB();
  expect(() => applyResolutions(homebrew, conflicts, {})).toThrow("The conflict on artificer has no valid choice");

  const internal: KeyConflict = { id: "internal-0", type: "internal", key: "x", "content-type": "orcpub.dnd.e5/spells", "content-type-name": "spells" };
  expect(() => applyResolutions(homebrew, [internal], { "internal-0": "replace" })).toThrow("The conflict on x has no valid choice");
});

/** Two packs that share duplicate-external-a's keys, parsed over duplicate-external-a: as when a multi-pack file is loaded again. */
function xyOverA() {
  const a = engine().parseOrcbrew(orcbrew("duplicate-external-a.orcbrew"), { name: "duplicate-external-a" });
  const pack = a.data!["duplicate-external-a"];
  const { data, conflicts } = engine().parseOrcbrew(engine().orcbrewToEdn({ x: pack, y: pack }), { existing: a.data! });
  return { homebrew: data!, conflicts };
}

describe("a key with both an internal and an external conflict", () => {
  test("the internal choice settles each external conflict on a copy it renames or removes", () => {
    const { homebrew, conflicts } = xyOverA();
    const external = conflicts.filter((c) => c.type === "external");
    expect(external.length).toBeGreaterThan(0);
    for (const c of external) {
      expect(settledBy(c, conflicts, homebrew)?.type, `${c.key} from ${c["import-source"]}`).toBe(c["import-source"] === "x" ? "internal" : undefined);
    }
  });

  test("Rename all resolves it, and a settled conflict needs no choice", () => {
    const { homebrew, conflicts } = xyOverA();
    const open = conflicts.filter((c) => settledBy(c, conflicts, homebrew) === undefined);
    expect(open.length).toBeLessThan(conflicts.length);

    const { homebrew: resolved } = applyResolutions(homebrew, conflicts, all(open, "rename"));
    expect(reparse(resolved).conflicts).toEqual([]);
  });
});

/**
 * A pack of an .orcbrew file with the feat keen and the spell zap, and the
 * old app's off flag where asked. featOff can also be the flag's value as
 * EDN, such as '"yes"'.
 */
const packEdn = (name: string, { off = false, featOff = false }: { off?: boolean; featOff?: boolean | string } = {}) =>
  `"${name}" {${off ? ":disabled? true " : ""}` +
  `:orcpub.dnd.e5/feats {:keen {:key :keen :name "Keen" :option-pack "${name}" :description "From ${name}"${featOff ? ` :disabled? ${featOff === true ? "true" : featOff}` : ""}}} ` +
  `:orcpub.dnd.e5/spells {:zap {:key :zap :name "Zap" :level 1 :school "evocation" :spell-lists {:wizard true} :option-pack "${name}"}}}`;
const parsePacks = (...packs: string[]) => {
  const { data, conflicts } = engine().parseOrcbrew(`{${packs.join(" ")}}`);
  return { homebrew: data!, conflicts };
};
/** A character with one feat. */
const withFeat = (key: string) =>
  ({
    "~:orcpub.entity.strict/selections": [
      { "~:orcpub.entity.strict/key": "~:feats", "~:orcpub.entity.strict/options": [{ "~:orcpub.entity.strict/key": `~:${key}` }] },
    ],
  }) as unknown as StrictEntity;

describe("an internal conflict where a copy has the old app's off flag (ORC-131)", () => {
  test.each(["rename", "skip"] as const)("%s all keeps the keys on the pack that is on, and a character that uses its feat builds the same", (choice) => {
    const { homebrew, conflicts } = parsePacks(packEdn("A"), packEdn("B", { off: true }));
    expect(conflicts.map((c) => [c.type, c.key])).toEqual([
      ["internal", "keen"],
      ["internal", "zap"],
    ]);
    expect(missingContent(withFeat("no-such-feat"), { homebrew })).not.toEqual([]);

    const { homebrew: resolved, renames } = applyResolutions(homebrew, conflicts, all(conflicts, choice));
    expect(item(resolved, "A", "feats", "keen")).toBeDefined();
    expect(item(resolved, "A", "spells", "zap")).toBeDefined();
    expect(item(resolved, "B", "feats", "keen")).toBeUndefined();
    expect(item(resolved, "B", "spells", "zap")).toBeUndefined();
    expect(renames.map((r) => `${r.pack}: ${r.from} -> ${r.to}`)).toEqual(choice === "rename" ? ["B: keen -> keen-b", "B: zap -> zap-b"] : []);

    expect(missingContent(withFeat("keen"), { homebrew: resolved })).toEqual([]);
    expect(engine().evaluate(withFeat("keen"), { homebrew: resolved }).built).toEqual(engine().evaluate(withFeat("keen"), { homebrew }).built);
    expect(reparse(resolved).conflicts).toEqual([]);
  });

  const kept = (homebrew: Record<string, object>, conflicts: KeyConflict[]) =>
    Object.fromEntries(conflicts.map((c) => [c.key, internalCopies(c, homebrew).kept]));

  test("an item that is off in the last pack does not keep its key", () => {
    const { homebrew, conflicts } = parsePacks(packEdn("A"), packEdn("B", { featOff: true }));
    expect(kept(homebrew, conflicts)).toEqual({ keen: "A", zap: "B" });
  });

  test("if every copy is off, the last keeps the key", () => {
    const { homebrew, conflicts } = parsePacks(packEdn("A", { off: true }), packEdn("B", { off: true }));
    expect(kept(homebrew, conflicts)).toEqual({ keen: "B", zap: "B" });
  });

  // On a pack, the importer does not read such a value as a multi-pack file, so the test is on an item.
  test("a :disabled? value that is not true, such as a string, also turns an item off", () => {
    const { homebrew, conflicts } = parsePacks(packEdn("A"), packEdn("B", { featOff: '"yes"' }));
    expect(item(homebrew, "B", "feats", "keen")?.["~:disabled?"]).toBe("yes");
    expect(kept(homebrew, conflicts)).toEqual({ keen: "A", zap: "B" });
    expect(engine().evaluate(withFeat("keen"), { homebrew }).built).toEqual(
      engine().evaluate(withFeat("keen"), { homebrew: applyResolutions(homebrew, conflicts, all(conflicts, "rename")).homebrew }).built,
    );
  });

  test.each(["rename", "skip"] as const)("over a stored pack with the same keys, %s all gives the on copy the external choice", (choice) => {
    const stored = engine().parseOrcbrew(`{${packEdn("S")}}`).data!;
    const { data, conflicts } = engine().parseOrcbrew(`{${packEdn("A")} ${packEdn("B", { off: true })}}`, { existing: stored });
    const homebrew = data!;
    const about = (c: KeyConflict) => `${c.type} ${c.key} ${c["import-source"] ?? conflictSources(c).map((s) => s.source).join()}`;
    expect(conflicts.map(about).sort()).toEqual(
      ["external keen A", "external keen B", "external zap A", "external zap B", "internal keen A,B", "internal zap A,B"],
    );
    // The internal choice renames or removes B's copies, so only A's external conflicts stay open.
    const open = conflictsToChoose(conflicts, homebrew);
    expect(open.map(about).sort()).toEqual(["external keen A", "external zap A", "internal keen A,B", "internal zap A,B"]);
    for (const c of conflicts.filter((c) => c["import-source"] === "B")) expect(settledBy(c, conflicts, homebrew)?.type).toBe("internal");

    const { homebrew: resolved, renames } = applyResolutions(homebrew, conflicts, all(open, choice));
    expect(item(resolved, "S", "feats", "keen")).toBeDefined();
    expect(item(resolved, "A", "feats", "keen")).toBeUndefined();
    expect(item(resolved, "B", "feats", "keen")).toBeUndefined();
    expect(renames.map((r) => `${r.pack}: ${r.from} -> ${r.to}`).sort()).toEqual(
      choice === "rename" ? ["A: keen -> keen-a", "A: zap -> zap-a", "B: keen -> keen-b", "B: zap -> zap-b"] : [],
    );
    expect(reparse(resolved).conflicts).toEqual([]);
  });

  test("of three packs, on, on and off, the second keeps the key", () => {
    const { homebrew, conflicts } = parsePacks(packEdn("A"), packEdn("B"), packEdn("C", { off: true }));
    expect(kept(homebrew, conflicts)).toEqual({ keen: "B", zap: "B" });
    const { renames } = applyResolutions(homebrew, conflicts, all(conflicts, "rename"));
    expect(renames.map((r) => `${r.pack}: ${r.from} -> ${r.to}`)).toEqual(["A: keen -> keen-a", "C: keen -> keen-c", "A: zap -> zap-a", "C: zap -> zap-c"]);
  });
});

// The owner's real export: 29 packs and 86 internal conflicts. It is private and git-ignored, so this skips without it.
const privateExport = join(orcbrewDir, "private/all-content3.orcbrew");

describe.skipIf(!existsSync(privateExport))("the owner's real export", () => {
  test("Rename all resolves its 86 internal conflicts in one action, and the result parses with none", () => {
    const parsed = engine().parseOrcbrew(readFileSync(privateExport, "utf8"));
    expect(parsed.conflicts).toHaveLength(86);
    expect(parsed.conflicts.every((c) => c.type === "internal")).toBe(true);

    const { homebrew: resolved, renames } = applyResolutions(parsed.data!, parsed.conflicts, all(parsed.conflicts, "rename"));
    // Each conflict renames every copy but the kept one: one per conflict, two for a key in three packs, and so on.
    const copies = parsed.conflicts.reduce((n, c) => n + (c.sources?.length ?? 0) - 1, 0);
    expect(renames).toHaveLength(copies);
    // ORC-131: this pack is on, and a pack that is off repeats its keys. The off pack comes after it in the
    // conflict's sources, which the engine lists in its own map order, not always the file's.
    // No key that only those two packs share is renamed in the pack that is on.
    const onPack = "Tashas_Cauldron_of_Everything";
    const shared = parsed.conflicts.filter((c) => conflictSources(c).map((s) => s.source).join() === `${onPack},${onPack}_2`);
    expect(shared.length).toBeGreaterThan(0);
    expect(renames.filter((r) => r.pack === onPack && shared.some((c) => c.key === r.from && c["content-type"] === r.contentType))).toEqual([]);
    expect(reparse(resolved).conflicts).toEqual([]);
    expect(() => engine().buildTemplate(resolved)).not.toThrow();
  }, 120_000); // the export is 2 MB: parsing it twice takes seconds
});
