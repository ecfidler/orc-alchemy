// scaledAmount follows the engine's rule (sheet.ts). This test runs it on
// each scaled amount of the scaled-uses pack with the numbers of the golden
// character, and compares the result with the engine's number in the
// golden's expected.json, so that drift in the engine is caught.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Built2014 } from "@pubdoor/dmv";
import { beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "./engine.ts";
import { scaledAmount, type Ability } from "./sheet.ts";

beforeAll(() => loadEngine());

const fixtures = join(import.meta.dirname, "../../../../fixtures");
const golden = "scaled-uses-fighter-6-barbarian-1";
type PackTrait = { "~:name": string; "~:frequency"?: { "~:amount"?: unknown } };

test(`scaledAmount gives the engine's number for each scaled amount of ${golden}`, () => {
  const built: Built2014 = JSON.parse(readFileSync(join(fixtures, "characters", `${golden}.expected.json`), "utf8"));
  const pack = engine().parseOrcbrew(readFileSync(join(fixtures, "orcbrew", "scaled-uses.orcbrew"), "utf8"), { name: "Scaled Uses" }).data!["Scaled Uses"] as Record<
    string,
    Record<string, { "~:traits"?: PackTrait[] } & PackTrait>
  >;
  const numbers = (level: number) => ({
    level,
    proficiencyBonus: built["proficiency-bonus"],
    abilityModifier: (ability: Ability) => built["ability-bonuses"][`orcpub.dnd.e5.character/${ability}`],
  });
  // A race and a feat count the character level; a subclass of the fighter counts the fighter level.
  const characterLevel = built["total-levels"];
  const fighterLevel = built.levels.fighter!["class-level"];
  expect([characterLevel, fighterLevel]).toEqual([7, 6]);
  const sources: [type: string, level: number][] = [
    ["~:orcpub.dnd.e5/races", characterLevel],
    ["~:orcpub.dnd.e5/feats", characterLevel],
    ["~:orcpub.dnd.e5/subclasses", fighterLevel],
  ];
  const ours: [string, number][] = [];
  for (const [type, level] of sources) {
    for (const item of Object.values(pack[type]!)) {
      for (const feature of [item, ...(item["~:traits"] ?? [])]) {
        const amount = feature["~:frequency"]?.["~:amount"];
        if (typeof amount === "object" && amount !== null) ours.push([feature["~:name"], scaledAmount(amount as Record<string, unknown>, numbers(level))]);
      }
    }
  }
  const engines = new Map(built.traits.map((trait) => [trait.name, trait.frequency?.amount]));
  // Tsunami is a level 7 subclass feature, so the fighter 6 does not have it.
  const compared = ours.filter(([name]) => engines.has(name));
  expect(compared.map(([name]) => name).sort()).toEqual(["Brine Ward", "Crashing Wave", "Deep Lungs", "Ebb and Flow", "Riptide", "Rolling Gait", "Salt Sense", "Stormcaller", "Undertow"]);
  expect(compared).toEqual(compared.map(([name]) => [name, engines.get(name)]));
});
