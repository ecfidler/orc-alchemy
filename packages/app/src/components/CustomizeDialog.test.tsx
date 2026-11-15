// Customize a feat for one character (ORC-134): the Customize line under the
// builder's feat cards, the feat form in a dialog, and the save that writes
// the copy into the character's custom content and selects it.
import "fake-indexeddb/auto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { characterContent } from "../engine/custom.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";

beforeAll(() => loadEngine());
afterEach(async () => {
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const FEATS = "~:orcpub.dnd.e5/feats";
const PACK = "Feat Pack";
const SKILL_EXPERT = {
  "~:key": "~:skill-expert",
  "~:name": "Skill Expert",
  "~:option-pack": PACK,
  "~:description": "You know skills.",
  "~:ability-increases": { "~#set": [] },
  "~:props": { "~:skill-tool-choice": 1 },
};
const SKILL = ["feats", "skill-expert", "skill-tool-1"];

const fighter20 = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../../../fixtures/characters/fighter-20.strict.json"), "utf8"));

/** fighter-20, who takes the SRD feat Grappler, or with `pack` the pack feat Skill Expert with Arcana for its skill. */
async function open(pack = false) {
  await useHomebrew.getState().saveItem(PACK, FEATS, SKILL_EXPERT);
  let entity = fighter20();
  if (pack) {
    const e = engine();
    const options = useHomebrew.getState().content;
    entity = e.deselect(entity, ["feats"], "grappler", options);
    entity = e.select(entity, ["feats"], "skill-expert", options);
    entity = e.select(entity, SKILL, "skill", options);
    entity = e.select(entity, [...SKILL, "skill", "skill-proficiency"], "arcana", options);
  }
  act(() => useCharacter.getState().load("customize", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Feats/ }));
  return screen.getByRole("list", { name: "Customize Feats" });
}

const evaluate = () => {
  const { entity, custom } = useCharacter.getState();
  return engine().evaluate(entity!, characterContent(useHomebrew.getState().content, custom));
};
const selectedFeats = () => evaluate().selections.find((s) => s.key === "feats")!.selected;
const skills = () => Object.keys(evaluate().built["skill-profs"] ?? {});
const field = (dialog: HTMLElement, name: string) => within(dialog).getByRole<HTMLInputElement>("textbox", { name });
const save = (dialog: HTMLElement) => within(dialog).getByRole<HTMLButtonElement>("button", { name: "Save" });
const cards = () => within(screen.getByRole("group", { name: "Feats" })).getAllByRole("button");
/** The dialog named `name`, once its form shows: the form first reads the content lists. */
async function dialogNamed(name: string) {
  const dialog = await screen.findByRole("dialog", { name });
  await within(dialog).findByRole("textbox", { name: "Name" });
  return dialog;
}
const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

test("Customize on a pack feat makes '<Name> (Custom)', selects it, and keeps the feat's choices; the original stays in the list", async () => {
  const lines = await open(true);
  expect(within(lines).getByRole("listitem")).toHaveTextContent("Skill ExpertCustomize");
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Skill Expert" }));
  const dialog = await dialogNamed("Customize Skill Expert");
  expect(field(dialog, "Name").value).toBe("Skill Expert (Custom)");
  expect(field(dialog, "Description").value).toBe("You know skills.");
  // The copy of a pack feat shows each modifier that holds a value.
  expect(within(dialog).getByRole("group", { name: "Skill or Tool Proficiency" })).toBeTruthy();
  expect(within(dialog).queryByRole("combobox", { name: "Option source (pack)" })).toBeNull();
  expect(within(dialog).queryByRole("button", { name: /delete/i })).toBeNull();
  expect(save(dialog).disabled).toBe(false);
  fireEvent.click(save(dialog));
  await closed();

  expect(selectedFeats()).toEqual(["skill-expert-custom"]);
  expect(skills()).toContain("arcana");
  const { custom } = useCharacter.getState();
  expect(custom).toEqual({
    [FEATS]: {
      "~:skill-expert-custom": {
        ...SKILL_EXPERT,
        "~:key": "~:skill-expert-custom",
        "~:name": "Skill Expert (Custom)",
        "~:option-pack": "Custom (this character)",
      },
    },
  });
  // The line now edits the copy, and the focus is on its button.
  const edit = within(lines).getByRole("button", { name: "Edit custom Skill Expert (Custom)" });
  await waitFor(() => expect(document.activeElement).toBe(edit));
  // The original is still in the list for this character, and the copy shows by its name only.
  expect(cards().map((card) => card.textContent)).toEqual(expect.arrayContaining(["Skill Expert", "Skill Expert (Custom)"]));
  // Another character, without this custom content, has the original and not the copy.
  const options = engine()
    .buildTemplate(useHomebrew.getState().content.homebrew)
    .shape.find((s) => s.key === "feats")!
    .options.map((o) => o.key);
  expect(options).toContain("skill-expert");
  expect(options).not.toContain("skill-expert-custom");
});

test("Customize on the SRD feat opens a form with its name and description", async () => {
  const lines = await open();
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Grappler" }));
  const dialog = await dialogNamed("Customize Grappler");
  expect(field(dialog, "Name").value).toBe("Grappler (Custom)");
  expect(field(dialog, "Description").value).toBe("Restrain a creature you are grappling");
  // Only the common modifiers show.
  expect(within(dialog).queryByRole("group", { name: "Skill or Tool Proficiency" })).toBeNull();
  expect(within(dialog).getByRole("button", { name: "Add a prerequisite" })).toBeTruthy();
  fireEvent.click(save(dialog));
  await closed();
  expect(selectedFeats()).toEqual(["grappler-custom"]);
  expect(cards().map((card) => card.textContent)).toEqual(expect.arrayContaining(["Grappler", "Grappler (Custom)"]));
});

test("Edit custom changes the copy, and the sheet shows the change; a new name replaces the copy", async () => {
  const lines = await open(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Skill Expert" }));
  fireEvent.click(save(await dialogNamed("Customize Skill Expert")));
  await closed();

  fireEvent.click(within(lines).getByRole("button", { name: "Edit custom Skill Expert (Custom)" }));
  const dialog = await dialogNamed("Edit custom feat");
  expect(field(dialog, "Name").value).toBe("Skill Expert (Custom)");
  fireEvent.change(field(dialog, "Name"), { target: { value: "Skill Savant" } });
  fireEvent.change(field(dialog, "Description"), { target: { value: "You know every skill." } });
  fireEvent.click(save(dialog));
  await closed();

  expect(selectedFeats()).toEqual(["skill-savant"]);
  expect(skills()).toContain("arcana");
  expect(Object.keys((useCharacter.getState().custom as Record<string, object>)[FEATS])).toEqual(["~:skill-savant"]);
  const preview = screen.getByRole("region", { name: "Preview" });
  await waitFor(() => expect(preview).toHaveTextContent("You know every skill."));
  expect(preview).toHaveTextContent("Skill Savant");
  expect(within(lines).getByRole("button", { name: "Edit custom Skill Savant" })).toBeTruthy();
  // The original stays.
  expect(cards().map((card) => card.textContent)).toEqual(expect.arrayContaining(["Skill Expert", "Skill Savant"]));
  expect(cards().map((card) => card.textContent)).not.toContain("Skill Expert (Custom)");
});

test("a name whose key another feat of the list has is a problem on Name, and Save is disabled", async () => {
  const lines = await open(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Skill Expert" }));
  const dialog = await dialogNamed("Customize Skill Expert");
  for (const name of ["Skill Expert", "grappler!"]) {
    fireEvent.change(field(dialog, "Name"), { target: { value: name } });
    expect(within(dialog).getByRole("list", { name: "Problems: Name" })).toHaveTextContent("Another feat in the list has this name");
    expect(save(dialog).disabled).toBe(true);
  }
  fireEvent.change(field(dialog, "Name"), { target: { value: "Skill Expert (Custom)" } });
  expect(within(dialog).queryByRole("list", { name: "Problems: Name" })).toBeNull();
  expect(save(dialog).disabled).toBe(false);
});

test("closing with changes asks first; Stay keeps the dialog, and Close drops the changes", async () => {
  const lines = await open(true);
  const button = within(lines).getByRole("button", { name: "Customize Skill Expert" });
  button.focus();
  fireEvent.click(button);
  let dialog = await dialogNamed("Customize Skill Expert");
  // Without changes, Cancel closes at once.
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  await closed();
  await waitFor(() => expect(document.activeElement).toBe(button));

  fireEvent.click(button);
  dialog = await dialogNamed("Customize Skill Expert");
  fireEvent.change(field(dialog, "Description"), { target: { value: "Changed." } });
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(await answerConfirmDialog("Stay")).toBe("This feat has changes that are not saved. Close anyway?");
  expect(field(dialog, "Description").value).toBe("Changed.");
  fireEvent.keyDown(dialog, { key: "Escape" });
  await answerConfirmDialog("Close");
  await closed();
  expect(selectedFeats()).toEqual(["skill-expert"]);
  expect(useCharacter.getState().custom).toBeUndefined();

  // The next open starts from the pack feat again.
  fireEvent.click(button);
  dialog = await dialogNamed("Customize Skill Expert");
  expect(field(dialog, "Description").value).toBe("You know skills.");
});
