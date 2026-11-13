// The preview and the sheet give the same result for the same feature
// (ORC-204). A pack race holds features of each kind of uses and each type.
// The engine evaluates the example character with it: level 5, and 16 in
// each ability. The sheet's section and bubble of each feature must be the
// preview's, as functions and as drawn.
import { cleanup, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine } from "../../engine/engine.ts";
import { toSheet } from "../../engine/sheet.ts";
import { exampleNumbers, previewFeature } from "../../engine/uses-preview.ts";
import { CharacterSheet, FEATURE_SECTION_TITLES, FEATURE_SECTIONS } from "../CharacterSheet.tsx";
import { editor, Traits, type ItemRecord } from "./fields.tsx";
import { EXAMPLE_LEVEL, EXAMPLE_SCORE } from "./uses-example.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

const LONG = "~:orcpub.dnd.e5.units/long-rest";
const FEATURES: ItemRecord[] = [
  { "~:name": "Brine Blessing", "~:type": "~:action", "~:description": "You end one disease.", "~:frequency": { "~:units": LONG, "~:amount": 3 } },
  { "~:name": "Deep Reserves", "~:description": "a pool of healing", "~:frequency": { "~:units": LONG, "~:amount": 25 } },
  { "~:name": "Salt Sense", "~:type": "~:other", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": { "~:prof-bonus": true } } },
  { "~:name": "Sea Luck", "~:type": "~:reaction", "~:frequency": { "~:units": "~:short-rest", "~:amount": { "~:ability": "~:wis", "~:min": 1 } } },
  { "~:name": "Undertow", "~:type": "~:action", "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": "~:orcpub.dnd.e5.character/int", "~:plus": -3 } } },
  { "~:name": "Tidal Reserve", "~:type": "~:b-action", "~:frequency": { "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5, "~:plus": 1 } } },
  { "~:name": "Guardian Wave", "~:type": "~:reaction", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 1 } },
  { "~:name": "Each Turn", "~:frequency": { "~:units": "~:orcpub.dnd.e5.units/turn" } },
  { "~:name": "Hold Breath", "~:description": "You can hold your breath for 1 hour." },
  // Shapes that the engine decides: two bases, no base, no unit, an ability that is not a keyword, an unknown ability.
  { "~:name": "Two Bases", "~:frequency": { "~:units": LONG, "~:amount": { "~:prof-bonus": true, "~:level": true } } },
  { "~:name": "No Base", "~:frequency": { "~:units": LONG, "~:amount": { "~:plus": 3 } } },
  { "~:name": "No Unit", "~:type": "~:action", "~:frequency": { "~:amount": 2 } },
  { "~:name": "Number Ability", "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": 3, "~:level": true, "~:min": null } } },
  { "~:name": "Unknown Ability", "~:frequency": { "~:units": LONG, "~:amount": { "~:ability": "~:luck", "~:plus": 2 } } },
];
const PACK = "Uses Preview";
const homebrew = {
  [PACK]: {
    "~:orcpub.dnd.e5/races": {
      "~:tidecaller": { "~:key": "~:tidecaller", "~:name": "Tidecaller", "~:option-pack": PACK, "~:speed": 30, "~:size": "Medium", "~:traits": FEATURES },
    },
  },
};

/** The example character: the pack race, barbarian 5, and 16 in each ability. */
function exampleCharacter() {
  const e = engine();
  const options = { homebrew };
  let character: object = e.select(e.emptyCharacter(), ["race"], "tidecaller", options);
  for (let level = 1; level < EXAMPLE_LEVEL; level++) character = e.addLevel(character, "barbarian", options);
  const scores = Object.fromEntries(["str", "dex", "con", "int", "wis", "cha"].map((a) => [`~:orcpub.dnd.e5.character/${a}`, EXAMPLE_SCORE]));
  const json = JSON.stringify(character).replace(/("~:orcpub\.entity\.strict\/key":"~:standard-scores","~:orcpub\.entity\.strict\/map-value":)\{[^}]*\}/, `$1${JSON.stringify(scores)}`);
  const entity = JSON.parse(json);
  const { built } = e.evaluate(entity, options);
  expect([built["total-levels"], built["proficiency-bonus"], ...Object.values(built.abilities)]).toEqual([5, 3, 16, 16, 16, 16, 16, 16]);
  return toSheet(built, entity);
}

test("for each feature, the sheet's section and uses are the preview's", () => {
  const sheet = exampleCharacter();
  for (const feature of FEATURES) {
    const name = feature["~:name"] as string;
    const onSheet = FEATURE_SECTIONS.flatMap((section) => sheet.features[section].filter((f) => f.name === name).map((f) => [section, f]));
    const { section, feature: inPreview } = previewFeature(feature, exampleNumbers(EXAMPLE_LEVEL, EXAMPLE_SCORE));
    expect(onSheet, name).toEqual([[section, inPreview]]);
  }
  // The cases the test is for.
  const uses = (name: string) => FEATURE_SECTIONS.flatMap((section) => sheet.features[section]).find((f) => f.name === name)!.uses;
  expect(
    ["Brine Blessing", "Deep Reserves", "Salt Sense", "Sea Luck", "Undertow", "Tidal Reserve", "Each Turn", "Hold Breath", "Two Bases", "No Base", "No Unit", "Number Ability", "Unknown Ability"].map(uses),
  ).toEqual([
    { amount: 3, recharge: "Long rest" },
    { amount: 25, recharge: "Long rest" },
    { amount: 3, recharge: "Each day" },
    { amount: 3, recharge: "Short rest" },
    undefined,
    { amount: 26, recharge: "Long rest" },
    { amount: 1, recharge: "Each turn" },
    undefined,
    { amount: 3, recharge: "Long rest" },
    { amount: 3, recharge: "Long rest" },
    { amount: 2, recharge: null },
    { amount: 5, recharge: "Long rest" },
    { amount: 2, recharge: "Long rest" },
  ]);
});

/** The element's HTML without the ids that useId makes, which differ between two renders. */
const html = (element: Element) => element.outerHTML.replace(/ (id|aria-labelledby)="[^"]*"/g, "");

function Form() {
  const [record, setRecord] = useState<ItemRecord>({ "~:traits": FEATURES });
  return <Traits edit={editor(record, setRecord)} />;
}

test("the preview draws each feature as the sheet draws it, under the same heading", () => {
  const sheet = exampleCharacter();
  render(
    <>
      <section aria-label="Sheet">
        <CharacterSheet sheet={sheet} />
      </section>
      <section aria-label="Form">
        <Form />
      </section>
    </>,
  );
  const sheetFeatures = within(screen.getByRole("group", { name: "Features & traits" }));
  FEATURES.forEach((feature, i) => {
    const name = feature["~:name"] as string;
    const box = within(screen.getByRole("group", { name: `Feature ${i + 1} preview` }));
    const heading = box.getByRole("heading", { level: 3 });
    const drawn = heading.nextElementSibling!.firstElementChild!;
    expect(drawn.textContent, name).toMatch(new RegExp(`^${name}`));
    // The same element on the sheet: the bubble or the plain feature with this name, under its heading.
    const onSheet = sheetFeatures.getAllByText(name, { selector: ".ui-use-bubble-title, b" }).map((title) => title.closest(".ui-use-bubble") ?? title.parentElement!);
    expect(onSheet, name).toHaveLength(1);
    expect(html(onSheet[0]!), name).toBe(html(drawn));
    const sheetHeading = onSheet[0]!.parentElement!.previousElementSibling!;
    expect(sheetHeading.textContent, name).toBe(heading.textContent);
    expect(Object.values(FEATURE_SECTION_TITLES)).toContain(heading.textContent);
  });
});
