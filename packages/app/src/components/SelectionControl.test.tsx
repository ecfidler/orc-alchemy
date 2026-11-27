// The control of a builder selection (ORC-343, docs/design/character-builder.md "The control for each kind of
// selection" and "A pick that the character cannot take"). e2e/builder.spec.ts measures in a browser that a pick in a
// picker or in a list does not move the page.
import "fake-indexeddb/auto";
import { notBusy, pickFromPicker, removeToken } from "@orc-alchemy/ui/testing";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { Builder } from "./Builder.tsx";
import { pickIn, picksIn, section } from "./test-pick.ts";

beforeAll(() => loadEngine());
afterEach(cleanup);

/** The entity, from the engine's level 1 barbarian with these picks, open in the builder at the step. */
function open(step: string, picks: [path: string[], key: string][] = []) {
  const e = engine();
  const entity = picks.reduce((entity, [path, key]) => e.select(entity, path, key) as StrictEntity, e.emptyCharacter() as StrictEntity);
  useCharacter.getState().load("selection-control", entity);
  render(<Builder step={step} />);
}

const built = () => engine().evaluate(useCharacter.getState().entity!).built;
const toast = () => document.querySelector<HTMLElement>("[data-toast-status]")!;

test("a selection of 6 options has option cards that show only the name", async () => {
  open("Proficiencies");
  // The barbarian picks 2 of 6 skills.
  const skills = section("Skills: Barbarian");
  const cards = within(skills).getAllByRole("button");
  expect(cards.map((card) => card.getAttribute("aria-label") ?? card.textContent)).toEqual([
    "Animal Handling",
    "Athletics",
    "Intimidation",
    "Nature",
    "Perception",
    "Survival",
  ]);
  expect(cards.every((card) => card.hasAttribute("aria-pressed"))).toBe(true);
  fireEvent.click(within(skills).getByRole("button", { name: "Athletics" }));
  await notBusy();
  expect(within(section("Skills: Barbarian")).getByRole("button", { name: "Athletics" }).getAttribute("aria-pressed")).toBe("true");
  expect(Object.keys(built()["skill-profs"] ?? {})).toEqual(["athletics"]);
});

test("a selection of 7 options or more and one pick has a Choose button and a list; after the pick, the pick and Change", async () => {
  // A human has 9 subraces, and the engine's Custom one that does not show.
  open("Race", [[["race"], "human"]]);
  const subrace = section("Subrace");
  expect(within(subrace).queryAllByRole("button", { pressed: false })).toHaveLength(0);
  const choose = within(subrace).getByRole("button", { name: "Choose Subrace" });
  expect(choose.textContent).toBe("Choose");
  fireEvent.click(choose);
  const dialog = await screen.findByRole("dialog", { name: "Subrace" });
  const rows = [...dialog.querySelectorAll(".ui-list-row")];
  expect(rows).toHaveLength(9);
  expect(rows.map((row) => row.getAttribute("aria-label"))).not.toContain("Custom");
  // The mark of each row is "Choose", and the list of 9 has no search field.
  expect(rows[0].querySelector(".ui-list-add")?.textContent).toBe("Choose");
  expect(within(dialog).queryByRole("searchbox")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Calishite" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  // The row shows the pick as a token with no X, and Change.
  expect(picksIn(section("Subrace"))).toEqual(["Calishite"]);
  expect(within(section("Subrace")).queryByRole("button", { name: /^Remove/ })).toBeNull();
  const change = within(section("Subrace")).getByRole("button", { name: "Change Subrace" });
  expect(change.textContent).toBe("Change");
  await waitFor(() => expect(document.activeElement).toBe(change));
  // Change picks another one in its place.
  await pickIn(section("Subrace"), "Damaran");
  expect(picksIn(section("Subrace"))).toEqual(["Damaran"]);
});

test("a selection of 7 options or more and two picks has a picker with the picks as tokens", async () => {
  open("Proficiencies", [[["class", "barbarian", "skill-proficiency"], "athletics"]]);
  // emptyCharacter's barbarian is replaced by a fighter: 8 skills, 2 picks.
  const e = engine();
  useCharacter.getState().update((entity) => e.setClass(entity, 0, "fighter") as StrictEntity);
  cleanup();
  render(<Builder step="Proficiencies" />);
  const skills = section("Skills: Fighter");
  const add = within(skills).getByRole("button", { name: "Add a skill" });
  expect(add.getAttribute("aria-haspopup")).toBe("dialog");
  expect(within(skills).queryAllByRole("button", { pressed: false })).toHaveLength(0);
  await pickFromPicker(add, ["Perception", "Acrobatics"]);
  // The tokens are in the order of the options.
  expect(picksIn(section("Skills: Fighter"))).toEqual(["Acrobatics", "Perception"]);
  // The add button is right under the heading, and the tokens are under it (ORC-371).
  const firstToken = section("Skills: Fighter").querySelector(".ui-token")!;
  expect(add.compareDocumentPosition(firstToken) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(Object.keys(built()["skill-profs"] ?? {}).sort()).toEqual(["acrobatics", "perception"]);
  expect(within(section("Skills: Fighter")).getByRole("heading").textContent).toBe("Skills: Fighter,Done");
  // At the maximum the add button is disabled but keeps the focus, with the reason (ORC-370).
  const full = within(section("Skills: Fighter")).getByRole("button", { name: "Add a skill" });
  expect(full.getAttribute("aria-disabled")).toBe("true");
  expect(full.title).toBe("Remove a choice first.");
  expect(document.getElementById(full.getAttribute("aria-describedby")!)?.textContent).toBe("Remove a choice first.");
  // A click on it opens no list.
  fireEvent.click(full);
  expect(screen.queryByRole("dialog")).toBeNull();
  await removeToken(section("Skills: Fighter"), "Acrobatics");
  expect(Object.keys(built()["skill-profs"] ?? {})).toEqual(["perception"]);
  const again = within(section("Skills: Fighter")).getByRole("button", { name: "Add a skill" });
  expect(again.hasAttribute("aria-disabled")).toBe(false);
  expect(document.getElementById(again.getAttribute("aria-describedby")!)?.textContent).toBe("7 more");
});

test("an option that gives what the character has is not available: a locked row in a picker, a dimmed card with the reason", async () => {
  // Acolyte gives Insight and Religion. The half-elf picks 2 skills of 18, in a picker.
  open("Proficiencies", [
    [["race"], "half-elf"],
    [["background"], "acolyte"],
  ]);
  const halfElf = section("Skills: Half-Elf");
  // A locked option is not in the count: 18 skills, 2 from Acolyte.
  expect(within(halfElf).getByRole("button", { name: "Add a skill" }).textContent).toBe("Add a skill16 more");
  fireEvent.click(within(halfElf).getByRole("button", { name: "Add a skill" }));
  const dialog = await screen.findByRole("dialog", { name: "Skills: Half-Elf" });
  const insight = within(dialog).getByRole("button", { name: "Insight" });
  expect([insight.getAttribute("aria-disabled"), insight.querySelector(".ui-list-lock") !== null]).toEqual(["true", true]);
  expect(document.getElementById(insight.getAttribute("aria-describedby")!)?.textContent).toBe("From Acolyte");
  fireEvent.click(insight);
  fireEvent.click(within(dialog).getByRole("button", { name: "Perception" }));
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await notBusy();
  expect(picksIn(section("Skills: Half-Elf"))).toEqual(["Perception"]);

  // The barbarian's cards: Perception is the half-elf's now. Its card is disabled, with the reason below the name.
  const barbarian = section("Skills: Barbarian");
  const perception = within(barbarian).getByRole("button", { name: "Perception" });
  expect(perception.hasAttribute("disabled")).toBe(true);
  expect(perception.querySelector("[data-reason]")?.textContent).toBe("From Half-Elf");
  expect(document.getElementById(perception.getAttribute("aria-describedby")!)?.textContent).toBe("From Half-Elf");
  // The other cards keep an empty reason line, so a reason that comes moves nothing.
  expect(within(barbarian).getByRole("button", { name: "Athletics" }).querySelector("[data-reason]")?.textContent).toBe("");
});

test("an option with a prerequisite that the character does not meet shows the reason of the engine", () => {
  // A variant human with Str 8 takes a feat: Grappler needs Str 13.
  const e = engine();
  let entity = e.select(e.emptyCharacter(), ["race"], "human") as StrictEntity;
  entity = e.select(entity, ["race", "human", "variant"], "variant-human") as StrictEntity;
  entity = e.setField(entity, ["ability-scores", "standard-scores"], {
    "~:orcpub.dnd.e5.character/str": 8,
    "~:orcpub.dnd.e5.character/dex": 8,
    "~:orcpub.dnd.e5.character/con": 15,
    "~:orcpub.dnd.e5.character/int": 14,
    "~:orcpub.dnd.e5.character/wis": 13,
    "~:orcpub.dnd.e5.character/cha": 12,
  }) as StrictEntity;
  useCharacter.getState().load("selection-control", entity);
  render(<Builder step="Feats" />);
  const grappler = within(section("Feats")).getByRole("button", { name: "Grappler" });
  expect(grappler.hasAttribute("disabled")).toBe(true);
  expect(grappler.querySelector("[data-reason]")?.textContent).toBe("It needs STR 13 or higher.");
});

test("a refusal of the engine shows in the status toast, not in the page", async () => {
  open("Proficiencies");
  const skills = section("Skills: Barbarian");
  for (const skill of ["Athletics", "Intimidation", "Survival"]) {
    fireEvent.click(within(skills).getByRole("button", { name: skill }));
    await notBusy();
  }
  expect([toast().getAttribute("role"), toast().textContent]).toEqual(["status", expect.stringMatching(/no selections remain/)]);
  expect(screen.queryByRole("alert")).toBeNull();
});

test("the engine's Custom option does not show, unless the character has it", async () => {
  open("Background");
  expect(within(section("Background")).queryByRole("button", { name: "Custom" })).toBeNull();
  expect(within(section("Background")).getByRole("button", { name: "Acolyte" })).toBeTruthy();
  cleanup();
  // An imported character with the Custom background: it shows, picked, with its lists in pickers.
  open("Background", [[["background"], "custom"]]);
  // The block of the pick names it (ORC-347), and Change shows it in the list, picked.
  expect(within(section("Background")).getByRole("heading", { level: 3 }).textContent).toMatch(/^Custom/);
  fireEvent.click(within(section("Background")).getByRole("button", { name: "Change Background" }));
  expect(within(section("Background")).getByRole("button", { name: "Custom" }).hasAttribute("data-picked")).toBe(true);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Proficiencies/ }));
  expect(within(section("Skills: Custom")).getByRole("button", { name: "Add a skill" })).toBeTruthy();
});

test("the selections that a pick opens are flat sections in Choices, each with its own heading and mark", async () => {
  // A Dwarf with no subrace, as before ORC-348: its Subrace row stays, so that the player can pick Hill Dwarf.
  open("Race", [[["race"], "dwarf"]]);
  const choices = screen.getByRole("region", { name: "Choices" });
  const subrace = section("Subrace");
  // The subrace is a section of Choices in the block of the race, not a block in a block, and nothing has a rule at the left.
  expect(choices.contains(subrace)).toBe(true);
  expect(subrace.querySelector("[data-main-pick], .border")).toBeNull();
  expect(within(subrace).getByRole("heading").textContent).toBe("Subrace,1 left");
  expect(document.querySelector(".border-l")).toBeNull();
  await pickIn(subrace, "Hill Dwarf");
  // Now the Dwarf has its one subrace: it is a fact of the panel, and the block has no Choices.
  expect(screen.queryByRole("region", { name: /^Subrace/ })).toBeNull();
  expect(within(section("Race")).getAllByRole("heading")[0].textContent).toBe("Dwarf,Done");
});

test("a pick shows that its button is busy at once, and happens after the next paint (ORC-369)", async () => {
  open("Proficiencies", [[["race"], "half-elf"]]);
  // An option card: busy and not yet pressed, and the engine has no pick yet.
  const athletics = within(section("Skills: Barbarian")).getByRole("button", { name: "Athletics" });
  fireEvent.click(athletics);
  expect([athletics.getAttribute("aria-busy"), athletics.getAttribute("aria-pressed")]).toEqual(["true", "false"]);
  expect(built()["skill-profs"]?.athletics).toBeUndefined();
  // A second click while the pick is on its way picks once.
  fireEvent.click(athletics);
  await notBusy();
  expect([athletics.hasAttribute("aria-busy"), athletics.getAttribute("aria-pressed")]).toEqual([false, "true"]);
  expect(Object.keys(built()["skill-profs"] ?? {})).toEqual(["athletics"]);

  // A row of a picker: busy until the pick shows, then it leaves the list.
  fireEvent.click(within(section("Skills: Half-Elf")).getByRole("button", { name: "Add a skill" }));
  const dialog = await screen.findByRole("dialog", { name: "Skills: Half-Elf" });
  const arcana = within(dialog).getByRole("button", { name: "Arcana" });
  fireEvent.click(arcana);
  expect(arcana.getAttribute("aria-busy")).toBe("true");
  expect(
    within(dialog)
      .getAllByRole("button")
      .filter((button) => button.getAttribute("aria-busy") === "true"),
  ).toEqual([arcana]);
  await notBusy();
  expect(within(dialog).queryByRole("button", { name: "Arcana" })).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(picksIn(section("Skills: Half-Elf"))).toEqual(["Arcana"]);

  // The X of a token is busy until the token goes.
  const x = within(section("Skills: Half-Elf")).getByRole("button", { name: "Remove Arcana" });
  fireEvent.click(x);
  expect(x.getAttribute("aria-busy")).toBe("true");
  await notBusy();
  expect(picksIn(section("Skills: Half-Elf"))).toEqual([]);
});
