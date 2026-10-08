import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Homebrew } from "@pubdoor/dmv";
import { beforeAll, expect, test } from "vitest";
import { builderSteps, unfilled } from "./builder.ts";
import { engine, loadEngine, type StrictEntity } from "./engine.ts";

// These tests are apart from builder.test.ts because each one evaluates a
// whole character. vitest runs files in parallel, but the tests in one file
// in sequence, so in one file they set the time of the whole suite.

const fixturesDir = join(import.meta.dirname, "../../../../fixtures");

beforeAll(() => loadEngine());

const stepsOf = (entity: StrictEntity, homebrew?: Homebrew) =>
  builderSteps(engine().evaluate(entity, { homebrew }).selections, engine().buildTemplate(homebrew).shape);

test.each(Array.from({ length: 20 }, (_, i) => i + 1))("autofill with seed %i leaves nothing unfilled", (seed) => {
  const entity = engine().autofill(engine().emptyCharacter(), { seed });
  expect(unfilled(stepsOf(entity))).toEqual([]);
});

test.each([1, 2, 3, 4, 5])("autofill with a pack loaded, with seed %i, leaves nothing unfilled", (seed) => {
  // The app passes the stored packs to autofill, so a random character can take homebrew options.
  const text = readFileSync(join(fixturesDir, "orcbrew", "duplicate-external-b.orcbrew"), "utf8");
  const homebrew = engine().parseOrcbrew(text, { name: "duplicate-external-b" }).data!;
  const entity = engine().autofill(engine().emptyCharacter(), { seed, homebrew });
  const steps = stepsOf(entity, homebrew);
  expect(unfilled(steps)).toEqual([]);
});
