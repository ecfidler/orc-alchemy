import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "./engine.ts";
import { EngineGate } from "./EngineGate.tsx";

afterEach(cleanup);

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

// The golden characters that need no homebrew pack.
const srdGolden = readdirSync(charactersDir)
  .filter((file) => file.endsWith(".meta.json"))
  .map((file) => file.slice(0, -".meta.json".length))
  .filter((name) => readFixture(`${name}.meta.json`).orcbrew.length === 0);

beforeAll(() => loadEngine());

test("finds the SRD golden characters", () => {
  expect(srdGolden).toHaveLength(11);
});

test.each(srdGolden)("evaluate(%s).built matches expected.json", (name) => {
  const { magicItems } = readFixture(`${name}.meta.json`);
  const options = magicItems && { magicItems: engine().readServerEdn(readFileSync(join(charactersDir, "../magic-items", magicItems), "utf8")) };
  expect(engine().evaluate(readFixture(`${name}.strict.json`), options).built).toEqual(readFixture(`${name}.expected.json`));
});

// ORC-194: engine 0.4.0 (patch D8) resolves scaled uses, and reads uses and
// features from a homebrew feat. The golden loads its pack from the meta file.
// character.test.ts compares the whole built character with expected.json.
const scaledGolden = "scaled-uses-fighter-6-barbarian-1";
const scaledBuilt = () => {
  const [pack] = readFixture(`${scaledGolden}.meta.json`).orcbrew as string[];
  const parsed = engine().parseOrcbrew(readFileSync(join(charactersDir, "../orcbrew", pack!), "utf8"), { name: pack!.replace(".orcbrew", "") });
  return engine().evaluate(readFixture(`${scaledGolden}.strict.json`), { homebrew: parsed.data! }).built;
};

test(`${scaledGolden} gets a number for each scaled amount, and the feat's own uses and features`, () => {
  type Trait = { name: string; type?: string; frequency?: { amount?: unknown } };
  const traits = scaledBuilt().traits as Trait[];
  const expected = readFixture(`${scaledGolden}.expected.json`).traits as Trait[];
  const usesOf = (list: Trait[]) => list.filter((t) => t.frequency).map((t) => [t.name, t.type, t.frequency!.amount]);
  expect(usesOf(traits)).toEqual(usesOf(expected));
  for (const [, , amount] of usesOf(traits)) expect(typeof amount).toBe("number");
  // The Stormcaller feat has its own uses, and the Sea Legs feat adds its features.
  const names = traits.map((t) => t.name);
  expect(names).toEqual(expect.arrayContaining(["Stormcaller", "Sea Legs", "Steady Footing", "Rolling Gait"]));
});

test("EngineGate renders its children once the engine has loaded", async () => {
  render(<EngineGate>ready</EngineGate>);
  expect(await screen.findByText("ready")).toBeTruthy();
});
