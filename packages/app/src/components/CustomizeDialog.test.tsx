// Customize a feat (ORC-134) or a background (ORC-135) for one character:
// the Customize line under the builder's option cards, the type's form in a
// dialog, and the save that writes the copy into the character's custom
// content and selects it.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { CUSTOM_PACK, characterContent, srdBackgroundRecord } from "../engine/custom.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { setQuantity } from "../engine/equipment.ts";
import { missingContent } from "../engine/reconcile.ts";
import { BACKGROUND_PACK, SAGE, TAGGED_BACKGROUNDS, withSage } from "../engine/test-backgrounds.ts";
import { FEAT_PACK, fighter20, SKILL, SKILL_EXPERT } from "../engine/test-feats.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";

// A test turns on `fail` to make the load of the SRD background list fail, as offline.
const srdLoad = vi.hoisted(() => ({ fail: false }));
vi.mock("../engine/custom.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../engine/custom.ts")>();
  return {
    ...actual,
    srdBackgroundRecord: (key: string) => (srdLoad.fail ? Promise.reject(new Error("Failed to fetch")) : actual.srdBackgroundRecord(key)),
  };
});

beforeAll(() => loadEngine());
afterEach(async () => {
  srdLoad.fail = false;
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
  for (const { id } of useHomebrew.getState().packs) await useHomebrew.getState().remove(id);
});

const FEATS = "~:orcpub.dnd.e5/feats";

/** fighter-20, who takes the SRD feat Grappler, or with `pack` the pack feat Skill Expert with Arcana for its skill. */
async function open(pack = false) {
  await useHomebrew.getState().saveItem(FEAT_PACK, FEATS, SKILL_EXPERT);
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
        "~:option-pack": CUSTOM_PACK,
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

test("a copy that the character no longer selects does not block its name: Customize on the original again replaces it", async () => {
  const lines = await open(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Skill Expert" }));
  fireEvent.click(save(await dialogNamed("Customize Skill Expert")));
  await closed();
  // The user drops the copy and picks the original again, before autosave prunes the copy.
  act(() =>
    useCharacter.getState().update((entity) => {
      const e = engine();
      const options = characterContent(useHomebrew.getState().content, useCharacter.getState().custom);
      return e.select(e.deselect(entity, ["feats"], "skill-expert-custom", options), ["feats"], "skill-expert", options);
    }),
  );
  expect(selectedFeats()).toEqual(["skill-expert"]);
  expect(cards().map((card) => card.textContent)).toContain("Skill Expert (Custom)");

  fireEvent.click(within(lines).getByRole("button", { name: "Customize Skill Expert" }));
  const dialog = await dialogNamed("Customize Skill Expert");
  fireEvent.change(field(dialog, "Description"), { target: { value: "A new copy." } });
  expect(within(dialog).queryByRole("list", { name: "Problems: Name" })).toBeNull();
  expect(save(dialog).disabled).toBe(false);
  fireEvent.click(save(dialog));
  await closed();
  expect(selectedFeats()).toEqual(["skill-expert-custom"]);
  expect(useCharacter.getState().custom).toEqual({
    [FEATS]: {
      "~:skill-expert-custom": {
        ...SKILL_EXPERT,
        "~:key": "~:skill-expert-custom",
        "~:name": "Skill Expert (Custom)",
        "~:description": "A new copy.",
        "~:option-pack": CUSTOM_PACK,
      },
    },
  });
});

// The background (ORC-135). fighter-20 has the SRD background Acolyte.

/** fighter-20 on the Background step, with Acolyte, or with `pack` the pack background Sage and Smith's Tools for its artisan's tool. */
async function openBackground(pack = false) {
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, SAGE);
  const entity: StrictEntity = pack ? withSage() : fighter20();
  act(() => useCharacter.getState().load("customize", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Background/ }));
  return screen.getByRole("list", { name: "Customize Background" });
}
const background = () => evaluate().selections.find((s) => s.key === "background")!.selected;
const backgroundCards = () => within(within(screen.getByRole("region", { name: "Builder" })).getByRole("group", { name: "Background" })).getAllByRole("button");
const preview = () => screen.getByRole("region", { name: "Preview" });

test("Customize on a pack background makes '<Name> (Custom)', selects it by the engine's key, and the sheet shows its skills, tools, languages and equipment", async () => {
  const lines = await openBackground(true);
  expect(within(lines).getByRole("listitem")).toHaveTextContent("SageCustomize");
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  const dialog = await dialogNamed("Customize Sage");
  expect(field(dialog, "Name").value).toBe("Sage (Custom)");
  expect(field(dialog, "Description").value).toBe(SAGE["~:help"]);
  // The five groups of the background form show, with no "+ Add a modifier".
  for (const legend of ["Skill proficiencies", "Languages", "Tool proficiencies", "Starting equipment", "Features"])
    expect(within(dialog).getByRole("group", { name: legend })).toBeTruthy();
  expect(within(dialog).queryByRole("button", { name: "Add a modifier" })).toBeNull();
  expect(within(dialog).queryByRole("combobox", { name: "Option source (pack)" })).toBeNull();
  expect(save(dialog).disabled).toBe(false);
  fireEvent.click(save(dialog));
  await closed();

  // The engine keys a background by the key of its name, with its dashes.
  expect(background()).toEqual(["sage-custom-"]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_BACKGROUNDS]: { "~:sage-custom-": { ...SAGE, "~:key": "~:sage-custom-", "~:name": "Sage (Custom)", "~:option-pack": CUSTOM_PACK } },
  });
  // The artisan's tool chosen under Sage stays under the copy.
  expect(evaluate().selections.find((s) => s.actualPath.join("/") === "background/sage-custom-/tool-proficiency-artisans-tools")!.selected).toEqual([
    "smiths-tools",
  ]);
  const sheet = preview();
  await waitFor(() => expect(sheet).toHaveTextContent("Sage (Custom)"));
  for (const text of [
    "+7 Arcana",
    "+7 History",
    "Smiths Tools (+6), Thieves Tools (+6)",
    "Common, Draconic, Elvish",
    "Ink (equipped)",
    "Ink Pen (equipped)",
    "Researcher",
  ])
    expect(sheet).toHaveTextContent(text);
  // The feature keeps its uses: one use, back on a long rest.
  const bubble = within(within(sheet).getByRole("group", { name: "Features & traits" })).getByRole("group", { name: "Researcher" });
  expect(within(bubble).getAllByRole("button", { name: /^Use / })).toHaveLength(1);
  expect(within(bubble).getByText("Long rest")).toBeTruthy();
  const edit = within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" });
  await waitFor(() => expect(document.activeElement).toBe(edit));
  expect(backgroundCards().map((card) => card.textContent)).toEqual(expect.arrayContaining(["Sage", "Sage (Custom)", "Acolyte"]));
  // Another character, without this custom content, has the original and not the copy.
  const others = engine()
    .buildTemplate(useHomebrew.getState().content.homebrew)
    .shape.find((s) => s.key === "background")!
    .options.map((o) => o.key);
  expect(others).toContain("sage");
  expect(others).not.toContain("sage-custom-");
});

test("Edit custom that changes only the description keeps the stored entity as it is", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  fireEvent.click(save(await dialogNamed("Customize Sage")));
  await closed();
  const entity = useCharacter.getState().entity;

  fireEvent.click(within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" }));
  const dialog = await dialogNamed("Edit custom background");
  fireEvent.change(field(dialog, "Description"), { target: { value: "Changed." } });
  fireEvent.click(save(dialog));
  await closed();
  expect(useCharacter.getState().entity).toEqual(entity);
  expect((useCharacter.getState().custom as Record<string, Record<string, Record<string, unknown>>>)[TAGGED_BACKGROUNDS]["~:sage-custom-"]["~:help"]).toBe(
    "Changed.",
  );
});

test("Customize on the SRD background opens a form with its name and description, from the engine's content list", async () => {
  const lines = await openBackground();
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Acolyte" }));
  const dialog = await dialogNamed("Customize Acolyte");
  expect(field(dialog, "Name").value).toBe("Acolyte (Custom)");
  expect(field(dialog, "Description").value).toBe("Your life has been devoted to serving a god or gods.");
  expect(within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Feature 1 name" }).value).toBe("Shelter the Faithful");
  fireEvent.click(save(dialog));
  await closed();
  expect(background()).toEqual(["acolyte-custom-"]);
  const record = await srdBackgroundRecord("acolyte");
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_BACKGROUNDS]: { "~:acolyte-custom-": { ...record, "~:key": "~:acolyte-custom-", "~:name": "Acolyte (Custom)", "~:option-pack": CUSTOM_PACK } },
  });
  // The copy has the holy symbol choice of the engine's template, so fighter-20's Amulet stays; nothing is left unresolved.
  const { entity, custom } = useCharacter.getState();
  expect(missingContent(entity!, characterContent(useHomebrew.getState().content, custom))).toEqual([]);
  expect(
    evaluate()
      .selections.filter((s) => s.actualPath[0] === "background")
      .map((s) => s.actualPath.join("/")),
  ).toEqual(["background", "background/acolyte-custom-/starting-equipment-prayer-book-wheel", "background/acolyte-custom-/starting-equipment-holy-symbol"]);
});

test("Customize with no edits keeps an inventory that the user changed, with each item once", async () => {
  const e = engine();
  // The user added two lamps, and changed the incense of the background to 7.
  let entity = e.addInventoryItem(fighter20(), "equipment", "lamp");
  entity = setQuantity(e, entity, "equipment", "lamp", 2);
  entity = setQuantity(e, entity, "equipment", "incense", 7);
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, SAGE);
  act(() => useCharacter.getState().load("customize", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Background/ }));
  const before = evaluate().built;
  expect(before.equipment?.incense["orcpub.dnd.e5.character.equipment/quantity"]).toBe(7);

  fireEvent.click(within(screen.getByRole("list", { name: "Customize Background" })).getByRole("button", { name: "Customize Acolyte" }));
  fireEvent.click(save(await dialogNamed("Customize Acolyte")));
  await closed();
  const after = evaluate().built;
  expect(after.background).toBe("Acolyte (Custom)");
  expect(after.equipment).toEqual(before.equipment);
  expect(after.treasure).toEqual(before.treasure);
  const equipment = (useCharacter.getState().entity as Record<string, Record<string, unknown>[]>)["~:orcpub.entity.strict/selections"].find(
    (sel) => sel["~:orcpub.entity.strict/key"] === "~:equipment",
  )!["~:orcpub.entity.strict/options"] as Record<string, string>[];
  const keys = equipment.map((o) => o["~:orcpub.entity.strict/key"]);
  expect(new Set(keys).size).toBe(keys.length);
});

test("when the SRD list does not load, Customize shows the error under the line and opens no dialog", async () => {
  const lines = await openBackground();
  srdLoad.fail = true;
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Acolyte" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Could not open Acolyte to customize: Failed to fetch");
  expect(screen.queryByRole("dialog")).toBeNull();
  // The next try clears the error.
  srdLoad.fail = false;
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Acolyte" }));
  await dialogNamed("Customize Acolyte");
  expect(screen.queryByText(/Could not open/)).toBeNull();
});

test("Customize on a pack background whose stored key is not the key of its name opens the pack values and saves the copy", async () => {
  const odd = { ...SAGE, "~:key": "~:old-sage" };
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, odd);
  // The engine keys the background by its name, sage.
  const e = engine();
  const options = useHomebrew.getState().content;
  act(() => useCharacter.getState().load("customize", e.select(fighter20(), ["background"], "sage", options)));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Background/ }));
  fireEvent.click(within(screen.getByRole("list", { name: "Customize Background" })).getByRole("button", { name: "Customize Sage" }));
  const dialog = await dialogNamed("Customize Sage");
  expect(field(dialog, "Description").value).toBe(SAGE["~:help"]);
  expect(within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Feature 1 name" }).value).toBe("Researcher");
  // The form has no key, so it shows no key warning.
  expect(within(dialog).queryByRole("note")).toBeNull();
  fireEvent.click(save(dialog));
  await closed();
  expect(background()).toEqual(["sage-custom-"]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_BACKGROUNDS]: { "~:sage-custom-": { ...SAGE, "~:key": "~:sage-custom-", "~:name": "Sage (Custom)", "~:option-pack": CUSTOM_PACK } },
  });
  expect(evaluate().built["skill-profs"]?.arcana).toEqual({ "Sage (Custom)": true });
});

test("a rename back to the original's name, or to another background's, is a problem on Name, and Save is disabled", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  let dialog = await dialogNamed("Customize Sage");
  for (const name of ["Sage", "acolyte"]) {
    fireEvent.change(field(dialog, "Name"), { target: { value: name } });
    expect(within(dialog).getByRole("list", { name: "Problems: Name" })).toHaveTextContent("Another background in the list has this name");
    expect(save(dialog).disabled).toBe(true);
  }
  fireEvent.change(field(dialog, "Name"), { target: { value: "Sage (Custom)" } });
  expect(within(dialog).queryByRole("list", { name: "Problems: Name" })).toBeNull();
  fireEvent.click(save(dialog));
  await closed();

  // The copy's own name is not a problem in Edit custom; the original's name is.
  fireEvent.click(within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" }));
  dialog = await dialogNamed("Edit custom background");
  expect(within(dialog).queryByRole("list", { name: "Problems: Name" })).toBeNull();
  fireEvent.change(field(dialog, "Name"), { target: { value: "Sage" } });
  expect(within(dialog).getByRole("list", { name: "Problems: Name" })).toHaveTextContent(
    "Another background in the list has this name, or one with the same key (sage). Choose another name.",
  );
  expect(save(dialog).disabled).toBe(true);
  // The close question names the background.
  fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
  expect(await answerConfirmDialog("Close")).toBe("This background has changes that are not saved. Close anyway?");
  await closed();
  expect(background()).toEqual(["sage-custom-"]);
});

test("Edit custom of a background copy: new gold gives the copy's starting equipment, and a new name replaces the copy", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  fireEvent.click(save(await dialogNamed("Customize Sage")));
  await closed();

  fireEvent.click(within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" }));
  const dialog = await dialogNamed("Edit custom background");
  fireEvent.change(field(dialog, "Name"), { target: { value: "Loremaster" } });
  const gold = within(dialog).getByRole("textbox", { name: "Gold" });
  fireEvent.change(gold, { target: { value: "25" } });
  fireEvent.blur(gold);
  fireEvent.click(save(dialog));
  await closed();

  expect(background()).toEqual(["loremaster"]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_BACKGROUNDS]: {
      "~:loremaster": { ...SAGE, "~:key": "~:loremaster", "~:name": "Loremaster", "~:treasure": { "~:gp": 25 }, "~:option-pack": CUSTOM_PACK },
    },
  });
  expect(evaluate().built.treasure?.gp["orcpub.dnd.e5.character.equipment/quantity"]).toBe(25);
  expect(evaluate().selections.find((s) => s.actualPath.join("/") === "background/loremaster/tool-proficiency-artisans-tools")!.selected).toEqual([
    "smiths-tools",
  ]);
  expect(within(lines).getByRole("button", { name: "Edit custom Loremaster" })).toBeTruthy();
  expect(backgroundCards().map((card) => card.textContent)).toEqual(expect.arrayContaining(["Sage", "Loremaster"]));
  expect(backgroundCards().map((card) => card.textContent)).not.toContain("Sage (Custom)");
});
