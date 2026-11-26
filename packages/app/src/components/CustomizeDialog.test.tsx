// Customize a feat (ORC-134), a background (ORC-135) or a race (ORC-136) for one character:
// the Customize line under the builder's option cards, the type's form in a
// dialog, and the save that writes the copy into the character's custom
// content and selects it.
// The background tests are in CustomizeDialogBackground.test.tsx.
import "fake-indexeddb/auto";
import { answerConfirmDialog } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CUSTOM_PACK, characterContent } from "../engine/custom.ts";
import { srdRaceRecord } from "../engine/custom-race.ts";
import { buildTemplate, engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { missingContent, remapOption, withoutOption } from "../engine/reconcile.ts";
import { FEAT_PACK, fighter20, SKILL, SKILL_EXPERT } from "../engine/test-feats.ts";
import { DEEP_SYLVAR, RACE_PACK, RACE_PACKS, SYLVAR, TAGGED_RACES, TAGGED_SUBRACES, withSylvar } from "../engine/test-races.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";
import { closed, dialogNamed, evaluate, field, save } from "./test-customize-dialog.ts";
import { withSheetPanel } from "./test-sheet-panel.ts";

beforeAll(() => loadEngine());
afterEach(async () => {
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

const selectedFeats = () => evaluate().selections.find((s) => s.key === "feats")!.selected;
const skills = () => Object.keys(evaluate().built["skill-profs"] ?? {});
const cards = () => within(screen.getByRole("group", { name: "Feats" })).getAllByRole("button");

test("the Feats step has one section for the feat selection, with its source and left mark in its heading, and the Customize line below its control (ORC-352)", async () => {
  const lines = await open();
  const section = screen.getByRole("region", { name: /^Feats: Fighter/ });
  // (jsdom drops the space at the end of an inline span; a browser reads "Feats: Fighter, Done".)
  expect(within(section).getByRole("heading", { level: 3 }).textContent).toBe("Feats: Fighter,Done");
  const control = within(section).getByRole("group", { name: "Feats" });
  expect(section.contains(lines)).toBe(true);
  expect(control.compareDocumentPosition(lines) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

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
  // The note is for a race, and the line of removed picks shows only when a save removes a pick.
  expect(within(dialog).queryByRole("note")).toBeNull();
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
  const options = buildTemplate(useHomebrew.getState().content.homebrew)
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
  await withSheetPanel(async (sheet) => {
    await waitFor(() => expect(sheet).toHaveTextContent("You know every skill."));
    expect(sheet).toHaveTextContent("Skill Savant");
  });
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

// The race (ORC-136). fighter-20 is a Human, of the subrace Illuskan and the variant Standard Human.

/**
 * fighter-20 on the Race step, a Human, or with `entity` another character, with the pack race Sylvar and its subrace
 * Deep Sylvar loaded. It gives the section of the race: the block of the pick, whose header has Customize (ORC-348).
 */
async function openRace(entity: StrictEntity = fighter20()) {
  await useHomebrew.getState().saveItem(RACE_PACK, TAGGED_RACES, SYLVAR);
  await useHomebrew.getState().saveItem(RACE_PACK, TAGGED_SUBRACES, DEEP_SYLVAR);
  act(() => useCharacter.getState().load("customize", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Race/ }));
  return screen.getByRole("region", { name: "Race" });
}
const race = () =>
  evaluate()
    .selections.filter((s) => s.actualPath[0] === "race")
    .map((s) => [s.actualPath.join("/"), s.selected]);
const ORIGIN_NOTE =
  'The optional rule "Customizing Your Origin" in Tasha\'s Cauldron of Everything (page 8) lets a character move the race\'s ability score increases to other abilities, and change its languages and proficiencies for others. Make those changes here. Skill, weapon and tool proficiencies are in the "+ Add a modifier" list.';

test("Customize on a pack race makes '<Name> (Custom)', selects it, and the sheet shows its ability bonuses, speed, languages and the feature with its uses", async () => {
  const lines = await openRace(withSylvar());
  expect(within(lines).getByRole("button", { name: "Customize Sylvar" })).toHaveTextContent("Customize");
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sylvar" }));
  const dialog = await dialogNamed("Customize Sylvar");
  expect(field(dialog, "Name").value).toBe("Sylvar (Custom)");
  expect(field(dialog, "Description").value).toBe(SYLVAR["~:help"]);
  // The note names the optional rule. The copy keeps each pick, so no line says that Save removes one.
  expect(within(dialog).getByRole("note")).toHaveTextContent(ORIGIN_NOTE);
  expect(within(dialog).getByRole<HTMLInputElement>("textbox", { name: "Feature 1 name" }).value).toBe("Leafstep");
  fireEvent.click(save(dialog));
  await closed();

  expect(race()).toEqual([["race", ["sylvar-custom"]]]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_RACES]: { "~:sylvar-custom": { ...SYLVAR, "~:key": "~:sylvar-custom", "~:name": "Sylvar (Custom)", "~:option-pack": CUSTOM_PACK } },
  });
  expect(useCharacter.getState().entity).toEqual(remapOption(withSylvar(), ["race", "sylvar"], "sylvar-custom"));
  const edit = within(lines).getByRole("button", { name: "Edit custom Sylvar (Custom)" });
  await waitFor(() => expect(document.activeElement).toBe(edit));
  await withSheetPanel(async (sheet) => {
    await waitFor(() => expect(sheet).toHaveTextContent("Sylvar (Custom)"));
    // +2 Wisdom and +1 Dexterity on fighter-20's scores, as before the save.
    expect(within(sheet).getByLabelText("WIS").textContent).toBe("14+2");
    expect(within(sheet).getByLabelText("DEX").textContent).toBe("17+3");
    expect(within(sheet).getByRole("group", { name: "Speed" }).textContent).toBe("35 ft.");
    expect(within(sheet).getByLabelText("Darkvision").textContent).toContain("60");
    for (const text of ["Common, Draconic, Elvish, Sylvan", "Leafstep"]) expect(sheet).toHaveTextContent(text);
    // The feature keeps its uses: one use, back on a long rest.
    const bubble = within(within(sheet).getByRole("group", { name: "Features & traits" })).getByRole("group", { name: "Leafstep" });
    expect(within(bubble).getByRole("img", { name: "Leafstep uses spent: 0 of 1" }).querySelectorAll(".ui-slot-circle")).toHaveLength(1);
    expect(within(bubble).getByText("Long rest")).toBeTruthy();
  });

  // Edit custom opens the copy with the same note.
  fireEvent.click(edit);
  const again = await dialogNamed("Edit custom race");
  expect(within(again).getByRole("note")).toHaveTextContent(ORIGIN_NOTE);
});

test("Customize on the SRD race opens a form with its name and description, and the note; no line names the subrace or the variant, which the copy holds", async () => {
  const lines = await openRace();
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Human" }));
  const dialog = await dialogNamed("Customize Human");
  expect(field(dialog, "Name").value).toBe("Human (Custom)");
  const record = (await srdRaceRecord("human"))!;
  expect(field(dialog, "Description").value).toBe(record["~:help"]);
  // Only the note of the optional rule shows: the copy holds the subrace and the variant.
  const notes = within(dialog).getAllByRole("note");
  expect(notes).toHaveLength(1);
  expect(notes[0]).toHaveTextContent(ORIGIN_NOTE);
  fireEvent.click(save(dialog));
  await closed();

  expect(race()).toEqual([["race", ["human-custom"]]]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_RACES]: { "~:human-custom": { ...record, "~:key": "~:human-custom", "~:name": "Human (Custom)", "~:option-pack": CUSTOM_PACK } },
  });
  // The save moves the pick to the copy and removes the subrace and the variant, and nothing else. The copy has the variant's +1 in each ability.
  let expected = withoutOption(fighter20(), ["race", "human", "subrace", "illuskan"]);
  expected = withoutOption(expected, ["race", "human", "variant", "standard-human"]);
  expect(useCharacter.getState().entity).toEqual(remapOption(expected, ["race", "human"], "human-custom"));
  const { entity, custom } = useCharacter.getState();
  expect(missingContent(entity!, characterContent(useHomebrew.getState().content, custom))).toEqual([]);
});

test("Customize on an SRD Dwarf with a tool pick: the copy has the tool, so no line says that Save removes a pick", async () => {
  const e = engine();
  const dwarf = e.select(e.select(fighter20(), ["race"], "dwarf"), ["race", "dwarf", "tool-proficiency"], "smiths-tools");
  const lines = await openRace(dwarf);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Dwarf" }));
  const dialog = await dialogNamed("Customize Dwarf");
  // Only the note of the optional rule shows.
  expect(within(dialog).getAllByRole("note")).toHaveLength(1);
  fireEvent.click(save(dialog));
  await closed();
  expect(race()).toEqual([["race", ["dwarf-custom"]]]);
  expect(useCharacter.getState().entity).toEqual(
    remapOption(withoutOption(dwarf, ["race", "dwarf", "tool-proficiency", "smiths-tools"]), ["race", "dwarf"], "dwarf-custom"),
  );
  expect(Object.keys(evaluate().built["tool-profs"])).toEqual(["smiths-tools"]);
});

test("Customize on a pack race with a pack subrace opens with the values of the subrace, so no line says that Save removes a pick", async () => {
  const lines = await openRace(withSylvar(true));
  expect(race()).toEqual([
    ["race", ["sylvar"]],
    ["race/sylvar/subrace", ["deep-sylvar"]],
  ]);
  fireEvent.click(within(lines).getByRole("button", { name: "Customize Sylvar" }));
  const dialog = await dialogNamed("Customize Sylvar");
  // Only the note of the optional rule shows.
  expect(within(dialog).getAllByRole("note")).toHaveLength(1);
  fireEvent.click(save(dialog));
  await closed();
  expect(race()).toEqual([["race", ["sylvar-custom"]]]);
  expect(useCharacter.getState().entity).toEqual(
    remapOption(withoutOption(withSylvar(true), ["race", "sylvar", "subrace", "deep-sylvar"]), ["race", "sylvar"], "sylvar-custom"),
  );
  expect(evaluate().built.subrace).toBeNull();
  // The copy has the +1 Intelligence of Deep Sylvar with the increases of Sylvar.
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_RACES]: {
      "~:sylvar-custom": {
        ...SYLVAR,
        "~:key": "~:sylvar-custom",
        "~:name": "Sylvar (Custom)",
        "~:option-pack": CUSTOM_PACK,
        "~:abilities": { ...SYLVAR["~:abilities"], "~:orcpub.dnd.e5.character/int": 1 },
      },
    },
  });
  expect(evaluate().built.abilities).toEqual(engine().evaluate(withSylvar(true), { homebrew: RACE_PACKS }).built.abilities);
});
