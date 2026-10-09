import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, test } from "vitest";
import { applyResolutions, type KeyConflict, type Resolution } from "./conflicts.ts";
import { engine, loadEngine } from "./engine.ts";

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

test("a key with both an internal and an external conflict resolves with Rename all", () => {
  // Two packs that share duplicate-external-a's keys, loaded over duplicate-external-a: as when a multi-pack file is loaded again.
  const a = engine().parseOrcbrew(orcbrew("duplicate-external-a.orcbrew"), { name: "duplicate-external-a" });
  const pack = a.data!["duplicate-external-a"];
  const file = engine().orcbrewToEdn({ x: pack, y: pack });
  const { data, conflicts } = engine().parseOrcbrew(file, { existing: a.data! });
  expect(new Set(conflicts.map((c) => c.type))).toEqual(new Set(["internal", "external"]));

  const { homebrew: resolved } = applyResolutions(data!, conflicts, all(conflicts, "rename"));
  expect(reparse(resolved).conflicts).toEqual([]);
});

// The owner's real export: 29 packs and 86 internal conflicts. It is private and git-ignored, so this skips without it.
const privateExport = join(orcbrewDir, "private/all-content3.orcbrew");

describe.skipIf(!existsSync(privateExport))("the owner's real export", () => {
  test("Rename all resolves its 86 internal conflicts in one action, and the result parses with none", () => {
    const parsed = engine().parseOrcbrew(readFileSync(privateExport, "utf8"));
    expect(parsed.conflicts).toHaveLength(86);
    expect(parsed.conflicts.every((c) => c.type === "internal")).toBe(true);

    const { homebrew: resolved, renames } = applyResolutions(parsed.data!, parsed.conflicts, all(parsed.conflicts, "rename"));
    // Each conflict renames every copy but the last: one per conflict, two for a key in three packs, and so on.
    const copies = parsed.conflicts.reduce((n, c) => n + (c.sources?.length ?? 0) - 1, 0);
    expect(renames).toHaveLength(copies);
    expect(reparse(resolved).conflicts).toEqual([]);
    expect(() => engine().buildTemplate(resolved)).not.toThrow();
  }, 120_000); // the export is 2 MB: parsing it twice takes seconds
});
