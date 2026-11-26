// Customize a background (ORC-135) for one character: the Customize line in the
// Background section, the background form in a dialog, and the line of the
// picks that a Save removes.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { CUSTOM_PACK, characterContent } from "../engine/custom.ts";
import { srdBackgroundRecord } from "../engine/custom-background.ts";
import { buildTemplate, engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { setQuantity } from "../engine/equipment.ts";
import { missingContent, remapOption, withoutOption } from "../engine/reconcile.ts";
import { ARTISAN, BACKGROUND_PACK, SAGE, TAGGED_BACKGROUNDS, withSage } from "../engine/test-backgrounds.ts";
import { fighter20 } from "../engine/test-feats.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";
import { closed, dialogNamed, evaluate, field, save } from "./test-customize-dialog.ts";
import { withSheetPanel } from "./test-sheet-panel.ts";

// A test turns on `fail` to make the load of the SRD background list fail, as offline.
const srdLoad = vi.hoisted(() => ({ fail: false }));
vi.mock("../engine/custom-background.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../engine/custom-background.ts")>();
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

// The background (ORC-135). fighter-20 has the SRD background Acolyte.

/**
 * fighter-20 on the Background step, with Acolyte, or with `pack` the pack background Sage and Smith's Tools for its
 * artisan's tool. It gives the section of the background: the block of the pick, whose header has Customize (ORC-347).
 */
async function openBackground(pack = false) {
  await useHomebrew.getState().saveItem(BACKGROUND_PACK, TAGGED_BACKGROUNDS, SAGE);
  const entity: StrictEntity = pack ? withSage() : fighter20();
  act(() => useCharacter.getState().load("customize", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Background/ }));
  return backgroundBlock();
}
const backgroundBlock = () => screen.getByRole("region", { name: "Background" });
const background = () => evaluate().selections.find((s) => s.key === "background")!.selected;
/** The names in the list of backgrounds, which Change opens. */
function backgroundNames() {
  fireEvent.click(within(backgroundBlock()).getByRole("button", { name: "Change Background" }));
  return [...backgroundBlock().querySelectorAll(".ui-list-panel-name")].map((name) => name.textContent);
}

test("Customize on a pack background makes '<Name> (Custom)', selects it by the engine's key, and the sheet shows its skills, tools, languages and equipment", async () => {
  const lines = await openBackground(true);
  expect(within(lines).getByRole("heading", { level: 3 })).toHaveTextContent(`Sage${BACKGROUND_PACK}`);
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
  const edit = within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" });
  await waitFor(() => expect(document.activeElement).toBe(edit));
  await withSheetPanel(async (sheet) => {
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
    expect(within(bubble).getByRole("img", { name: "Researcher uses spent: 0 of 1" }).querySelectorAll(".ui-slot-circle")).toHaveLength(1);
    expect(within(bubble).getByText("Long rest")).toBeTruthy();
  });
  expect(backgroundNames()).toEqual(expect.arrayContaining(["Sage", "Sage (Custom)", "Acolyte"]));
  // Another character, without this custom content, has the original and not the copy.
  const others = buildTemplate(useHomebrew.getState().content.homebrew)
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

  fireEvent.click(within(backgroundBlock()).getByRole("button", { name: "Customize Acolyte" }));
  fireEvent.click(save(await dialogNamed("Customize Acolyte")));
  await closed();
  const after = evaluate().built;
  expect(after.background).toBe("Acolyte (Custom)");
  expect(after.equipment).toEqual(before.equipment);
  expect(after.treasure).toEqual(before.treasure);
  // The save changes only the key of the background.
  expect(useCharacter.getState().entity).toEqual(remapOption(entity, ["background", "acolyte"], "acolyte-custom-"));
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
  fireEvent.click(within(backgroundBlock()).getByRole("button", { name: "Customize Sage" }));
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
  const names = backgroundNames();
  expect(names).toEqual(expect.arrayContaining(["Sage", "Loremaster"]));
  expect(names).not.toContain("Sage (Custom)");
});

// The line of removed picks follows the form (ORC-136): Sage's artisan's tool choice holds fighter-20's Smith's Tools.

const REMOVES_SMITHS = "Save removes these picks of the character: Tool Proficiency: Artisans Tools (Smith's Tools).";

test("a form edit that removes a choice with a pick under it names the pick before Save, and a name with a problem keeps the line", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  const dialog = await dialogNamed("Customize Sage");
  expect(within(dialog).queryByRole("note")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove Any artisan's tool" }));
  await waitFor(() => expect(within(dialog).getByRole("note")).toHaveTextContent(REMOVES_SMITHS));
  // A name with a problem keeps the line as it is.
  fireEvent.change(field(dialog, "Name"), { target: { value: "Sage" } });
  expect(save(dialog).disabled).toBe(true);
  expect(within(dialog).getByRole("note")).toHaveTextContent(REMOVES_SMITHS);
  fireEvent.change(field(dialog, "Name"), { target: { value: "Sage (Custom)" } });
  fireEvent.click(save(dialog));
  await closed();
  expect(evaluate().selections.some((s) => s.actualPath.join("/") === "background/sage-custom-/tool-proficiency-artisans-tools")).toBe(false);
  expect(useCharacter.getState().entity).toEqual(remapOption(withoutOption(withSage(), [...ARTISAN, "smiths-tools"]), ["background", "sage"], "sage-custom-"));
});

test("a Save that comes before the line names a removed pick only updates the line, and the next Save saves", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  const dialog = await dialogNamed("Customize Sage");
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove Any artisan's tool" }));
  expect(within(dialog).queryByRole("note")).toBeNull();
  fireEvent.click(save(dialog));
  expect(within(dialog).getByRole("note")).toHaveTextContent(REMOVES_SMITHS);
  expect(useCharacter.getState().entity).toEqual(withSage());
  fireEvent.click(save(dialog));
  await closed();
  expect(useCharacter.getState().entity).toEqual(remapOption(withoutOption(withSage(), [...ARTISAN, "smiths-tools"]), ["background", "sage"], "sage-custom-"));
});

test("Edit custom shows the line too, for an edit of the copy", async () => {
  const lines = await openBackground(true);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sage" }));
  fireEvent.click(save(await dialogNamed("Customize Sage")));
  await closed();

  fireEvent.click(within(lines).getByRole("button", { name: "Edit custom Sage (Custom)" }));
  const dialog = await dialogNamed("Edit custom background");
  expect(within(dialog).queryByRole("note")).toBeNull();
  fireEvent.click(within(dialog).getByRole("button", { name: "Remove Any artisan's tool" }));
  await waitFor(() => expect(within(dialog).getByRole("note")).toHaveTextContent(REMOVES_SMITHS));
  fireEvent.click(save(dialog));
  await closed();
  expect(Object.keys(evaluate().built["tool-profs"])).toEqual(["thieves-tools"]);
});
