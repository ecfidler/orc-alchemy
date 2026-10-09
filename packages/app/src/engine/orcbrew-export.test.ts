import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import { CONTENT_TYPES, DEFAULT_PACK, packItems } from "./content.ts";
import { engine, loadEngine } from "./engine.ts";
import { exportOrcbrew } from "./orcbrew-export.ts";

beforeAll(() => loadEngine());

const orcbrewDir = join(import.meta.dirname, "../../../../fixtures/orcbrew");
const files = readdirSync(orcbrewDir).filter((f) => f.endsWith(".orcbrew"));
const parse = (file: string) =>
  engine().parseOrcbrew(readFileSync(join(orcbrewDir, file), "utf8").replace(/^﻿/, ""), { name: file.replace(/\.orcbrew$/, "") }).data!;

test.each(files)("%s: each pack exports, alone and in all-content, and parses back to the same data", (file) => {
  const homebrew = parse(file);
  for (const pretty of [false, true]) {
    const all = exportOrcbrew(homebrew, { pretty, anyway: true });
    if (!("text" in all)) throw new Error("no text");
    expect(all.fileName).toBe("all-content.orcbrew");
    const check = engine().validateForExport(homebrew);
    const expected = check.valid ? homebrew : check.filled;
    expect(engine().parseOrcbrew(all.text).data).toEqual(expected);

    for (const pack of Object.keys(homebrew)) {
      const one = exportOrcbrew(homebrew, { pack, pretty, anyway: true });
      if (!("text" in one)) throw new Error("no text");
      expect(one.fileName).toBe(`${pack}.orcbrew`);
      expect(engine().parseOrcbrew(one.text, { name: pack }).data).toEqual({ [pack]: expected[pack] });
    }
  }
});

test("a valid pack exports without anyway; pretty-print adds line breaks", () => {
  const homebrew = parse("warlock-test-content.orcbrew");
  const plain = exportOrcbrew(homebrew, { pack: "warlock-test-content" });
  const pretty = exportOrcbrew(homebrew, { pack: "warlock-test-content", pretty: true });
  if (!("text" in plain) || !("text" in pretty)) throw new Error("no text");
  expect(pretty.text.split("\n").length).toBeGreaterThan(plain.text.split("\n").length);
});

const BROKEN = "duplicate-external-b";
/** duplicate-external-b with one class's name removed and another's option-pack blanked: the old app would refuse it. */
function brokenPack() {
  const plugin = parse(`${BROKEN}.orcbrew`)[BROKEN] as Record<string, Record<string, Record<string, unknown>>>;
  const type = "~:orcpub.dnd.e5/classes";
  const items = plugin[type];
  const [first, second] = Object.keys(items);
  const { "~:name": _name, ...unnamed } = items[first];
  return { [BROKEN]: { ...plugin, [type]: { ...items, [first]: unnamed, [second]: { ...items[second], "~:option-pack": "" } } } };
}

test("an invalid pack gives its problems, and anyway writes a file that passes the check", () => {
  const homebrew = brokenPack();
  const refused = exportOrcbrew(homebrew, { pack: BROKEN });
  if (!("invalid" in refused)) throw new Error("expected problems");
  expect(refused.invalid).toEqual([
    {
      pack: BROKEN,
      problems: expect.arrayContaining([expect.stringMatching(/: missing name$/), expect.stringMatching(/: its option source is blank$/)]),
    },
  ]);
  expect("invalid" in exportOrcbrew(homebrew)).toBe(true);

  const anyway = exportOrcbrew(homebrew, { pack: BROKEN, anyway: true });
  if (!("text" in anyway)) throw new Error("no text");
  expect(engine().validateForExport(engine().parseOrcbrew(anyway.text, { name: BROKEN }).data!).valid).toBe(true);
});

test("packItems lists each type's items by key, and a class's name ends with its pack", () => {
  const homebrew = parse("duplicate-external-b.orcbrew");
  const plugin = homebrew["duplicate-external-b"];
  const counts = Object.fromEntries(CONTENT_TYPES.map(({ type, many }) => [many, packItems("duplicate-external-b", plugin, type).length]));
  expect(counts.classes).toBeGreaterThan(0);
  expect(packItems("duplicate-external-b", plugin, "orcpub.dnd.e5/classes")[0].name).toMatch(/ \(duplicate-external-b\)$/);
  const raw = (plugin as Record<string, Record<string, { "~:name": string }>>)["~:orcpub.dnd.e5/classes"];
  expect(packItems(DEFAULT_PACK, plugin, "orcpub.dnd.e5/classes").map((c) => c.name)).toEqual(
    Object.keys(raw).sort().map((k) => raw[k]["~:name"]),
  );
});
