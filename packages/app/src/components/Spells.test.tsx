import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { preparedSpells } from "../engine/spells.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(cleanup);

const q = (ability: string) => `~:orcpub.dnd.e5.character/${ability}`;

/** A level 1 character of the class, with Int 10 and Wis 13, as stored before the Spells step. */
function caster(klass: string, levels = 1): StrictEntity {
  const e = engine();
  const scores = { str: 8, dex: 14, con: 13, int: 10, wis: 13, cha: 15 };
  let entity = e.setField(e.emptyCharacter(), ["ability-scores", "standard-scores"], Object.fromEntries(Object.entries(scores).map(([a, n]) => [q(a), n])));
  entity = e.setClass(entity, 0, klass);
  for (let n = 1; n < levels; n++) entity = e.addLevel(entity, klass);
  return entity;
}

/** Opens the entity in the builder, on the Spells step. */
function open(id: string, entity: StrictEntity) {
  useCharacter.getState().load(id, entity);
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Spells/ }));
}

const entity = () => useCharacter.getState().entity!;
const region = (name: string) => within(screen.getByRole("region", { name: new RegExp(`^${name}`) }));
const cards = (name: string) => region(name).getAllByRole("button").map((b) => b.textContent);

test("a wizard 1 picks a cantrip and spells on the cards, and prepares one spell of 1", () => {
  open("spells-wizard-1", caster("wizard"));
  const cantrips = region("Wizard Cantrips Known");
  expect(cantrips.getByRole("heading").textContent).toBe("Wizard Cantrips Known(3 to choose)");
  fireEvent.click(cantrips.getByRole("button", { name: "Acid Splash" }));
  expect(region("Wizard Cantrips Known").getByRole("button", { name: "Acid Splash" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("list", { name: "Chosen: Wizard Cantrips Known" }).textContent).toBe("Acid Splash");

  // The search narrows the cards.
  fireEvent.change(screen.getByLabelText("Search: Wizard Spells Known"), { target: { value: "alarm" } });
  expect(cards("Wizard Spells Known")).toEqual(["1 - Alarm"]);
  fireEvent.click(region("Wizard Spells Known").getByRole("button", { name: "1 - Alarm" }));
  fireEvent.change(screen.getByLabelText("Search: Wizard Spells Known"), { target: { value: "" } });
  fireEvent.click(region("Wizard Spells Known").getByRole("button", { name: "1 - Burning Hands" }));
  expect(engine().evaluate(entity()).built["spells-known"]).toMatchObject({ "0": expect.anything(), "1": expect.anything() });

  // Int 10: a wizard 1 prepares 1 spell.
  const prepared = region("Prepared spells: Wizard");
  expect(prepared.getByText("0 of 1 prepared")).toBeTruthy();
  fireEvent.click(prepared.getByLabelText("Prepared: Alarm"));
  expect(region("Prepared spells: Wizard").getByText("1 of 1 prepared")).toBeTruthy();
  expect(preparedSpells(entity())).toEqual({ Wizard: new Set(["alarm"]) });
  expect(screen.getByLabelText<HTMLInputElement>("Prepared: Alarm").checked).toBe(true);
  expect(screen.getByLabelText<HTMLInputElement>("Prepared: Burning Hands").disabled).toBe(true);
  fireEvent.click(screen.getByLabelText("Prepared: Alarm"));
  expect(preparedSpells(entity())).toEqual({ Wizard: new Set() });
  expect(screen.getByLabelText<HTMLInputElement>("Prepared: Burning Hands").disabled).toBe(false);
});

test("the level filter narrows a wizard 3's spell cards to one level", () => {
  open("spells-wizard-3", caster("wizard", 3));
  const level = screen.getByLabelText<HTMLSelectElement>("Level: Wizard Spells Known");
  // The cantrips are in their own selection, so this one has the 1st and 2nd levels.
  expect([...level.options].map((o) => o.text)).toEqual(["All levels", "1st level", "2nd level"]);
  const all = cards("Wizard Spells Known");
  expect(all.some((name) => name!.startsWith("1 - "))).toBe(true);
  fireEvent.change(level, { target: { value: "2" } });
  const second = cards("Wizard Spells Known");
  expect(second.length).toBeGreaterThan(0);
  expect(second.length).toBeLessThan(all.length);
  expect(second.every((name) => name!.startsWith("2 - "))).toBe(true);
});

test("a cleric is told it does not select known spells", () => {
  open("spells-cleric-1", caster("cleric"));
  expect(
    screen.getByText(
      "Except for cantrips, Clerics do not need to select known spells since they can prepare any spell available in their class spell lists.",
    ),
  ).toBeTruthy();
  // Wis 13: a cleric 1 prepares 2 of the spells it knows.
  expect(region("Prepared spells: Cleric").getByText("0 of 2 prepared")).toBeTruthy();
});
