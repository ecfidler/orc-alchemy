import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "./engine.ts";
import { EngineGate } from "./EngineGate.tsx";

afterEach(cleanup);

const charactersDir = join(import.meta.dirname, "../../../../fixtures/characters");
const readFixture = (file: string) => JSON.parse(readFileSync(join(charactersDir, file), "utf8"));

// The golden characters that need no homebrew pack; the rest wait for M3.
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

test("EngineGate renders its children once the engine has loaded", async () => {
  render(<EngineGate>ready</EngineGate>);
  expect(await screen.findByText("ready")).toBeTruthy();
});
