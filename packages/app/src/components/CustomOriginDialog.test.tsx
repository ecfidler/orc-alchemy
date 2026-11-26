// Custom Origin (ORC-138): the fixed last row of the race list (ORC-348), the guided
// dialog, the save that replaces the character's race with the copy, and
// Edit custom origin, which opens the dialog with the earlier picks.
import "fake-indexeddb/auto";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, expect, test } from "vitest";
import { CUSTOM_PACK, characterContent, srdRaceRecord } from "../engine/custom.ts";
import { baseRace, CUSTOM_ORIGIN, CUSTOM_ORIGIN_PICKS, heldSubrace, originRecord, originSlots, withPick } from "../engine/custom-origin.ts";
import { engine, loadEngine, type StrictEntity } from "../engine/engine.ts";
import { remapOption, withoutOption } from "../engine/reconcile.ts";
import { fighter20 } from "../engine/test-feats.ts";
import { SYLVAR, TAGGED_RACES, withHillDwarf, withSylvar } from "../engine/test-races.ts";
import { useCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { Builder } from "./Builder.tsx";
import { changeOf, picksIn, section, startCustomOrigin } from "./test-pick.ts";
import { withSheetPanel } from "./test-sheet-panel.ts";

beforeAll(() => loadEngine());
afterEach(() => {
  cleanup();
  useCharacter.setState({ id: null, entity: null, custom: undefined, dirty: false });
});

/** fighter-20, a Human (Illuskan, Standard Human), on the builder's Race step. */
function openRace(entity: StrictEntity = fighter20()) {
  act(() => useCharacter.getState().load("custom-origin", entity));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Race/ }));
}

/** The section of the race: the list with a detail panel, or the block of the pick. */
const raceSection = () => section("Race");

const evaluate = () => {
  const { entity, custom } = useCharacter.getState();
  return engine().evaluate(entity!, characterContent(useHomebrew.getState().content, custom));
};
const race = () =>
  evaluate()
    .selections.filter((s) => s.actualPath[0] === "race")
    .map((s) => [s.actualPath.join("/"), s.selected]);
const save = (dialog: HTMLElement) => within(dialog).getByRole<HTMLButtonElement>("button", { name: "Save" });
const closed = () => waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
const baseSelect = (dialog: HTMLElement) => within(dialog).getByRole("combobox", { name: "Base race" });

/** Opens the dialog from the Custom Origin row of the race list, once its first control shows. */
async function openEntry() {
  startCustomOrigin(raceSection());
  const dialog = await screen.findByRole("dialog", { name: "Custom Origin" });
  await within(dialog).findByRole("combobox", { name: "Base race" });
  return dialog;
}

/** Picks the base race, and waits for its sections. */
async function chooseBase(dialog: HTMLElement, name: string) {
  await pickOption(baseSelect(dialog), name);
  await within(dialog).findByRole("group", { name: "Ability bonuses" });
}

/** Opens the list of the token named `token`, and chooses the row `row`. */
async function swap(dialog: HTMLElement, token: string, row: string, search?: string) {
  fireEvent.click(within(dialog).getByRole("button", { name: token }));
  const list = await screen.findByRole("dialog", { name: /^Replace / });
  if (search !== undefined) fireEvent.change(within(list).getByRole("searchbox", { name: "Search" }), { target: { value: search } });
  fireEvent.click(within(list).getByRole("button", { name: row }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Replace / })).toBeNull());
}

/** The skill line of the sheet (the full sheet panel) with the name, and whether it shows as proficient. */
const proficient = (sheet: HTMLElement, skill: string) => {
  const lines = within(within(sheet).getByRole("group", { name: "Skills" })).getAllByRole("listitem");
  const line = lines.find((li) => new RegExp(`\\b${skill}\\b`).test(li.textContent ?? ""))!;
  return within(line).queryByRole("img", { name: "Proficient" }) !== null;
};

/** The Half-Orc copy that the first test saves: +2 Dexterity, +1 Wisdom, Dwarvish for Orc, Stealth for Intimidation. */
async function movedHalfOrc() {
  const base = (await srdRaceRecord("half-orc"))!;
  let slots = originSlots(base);
  slots = withPick(slots, 0, "ability:dex");
  slots = withPick(slots, 1, "ability:wis");
  slots = withPick(slots, 3, "language:Dwarvish");
  slots = withPick(slots, 4, "skill:stealth");
  return originRecord(base, slots, "half-orc", "Half-Orc");
}

test("Custom Origin on the SRD Half-Orc with the bonuses moved, a language and a skill swapped: the sheet shows them, and Edit opens the earlier picks", async () => {
  openRace();
  const before = evaluate().built.abilities;
  // The row is the last of the race list. Its panel says what a custom origin is; its button opens the dialog and selects nothing.
  fireEvent.click(changeOf(raceSection()));
  fireEvent.click(within(raceSection()).getByRole("button", { name: "Custom Origin" }));
  expect(raceSection()).toHaveTextContent("A custom origin is not saved to your homebrew content.");
  const dialog = await openEntry();
  expect(race()).toEqual([
    ["race", ["human"]],
    ["race/human/subrace", ["illuskan"]],
    ["race/human/variant", ["standard-human"]],
  ]);
  expect(within(dialog).getByRole("note")).toHaveTextContent('Custom Origin follows the optional rule "Customizing Your Origin"');
  expect(save(dialog).disabled).toBe(true);
  expect(await optionNames(baseSelect(dialog))).toEqual(["Dragonborn", "Dwarf", "Elf", "Gnome", "Half-Elf", "Half-Orc", "Halfling", "Human", "Tiefling"]);

  await chooseBase(dialog, "Half-Orc");
  // Nothing differs from the race yet, so Save stays disabled. The line names the picks of the Human that Save removes.
  expect(save(dialog).disabled).toBe(true);
  expect(dialog).toHaveTextContent("Nothing differs from Half-Orc yet. Change one value to save.");
  await waitFor(() =>
    expect(within(dialog).getAllByRole("note")[1]).toHaveTextContent(
      "Save removes these picks of the character: Subrace (Illuskan), Variant (Standard Human).",
    ),
  );
  // The +2 bonus can go on each ability but Constitution, which the +1 holds.
  const plus2 = within(dialog).getByRole("combobox", { name: "+2 bonus, Half-Orc gives Strength" });
  expect(await optionNames(plus2)).toEqual(["Strength", "Dexterity", "Intelligence", "Wisdom", "Charisma"]);
  await pickOption(plus2, "Dexterity");
  await pickOption(within(dialog).getByRole("combobox", { name: "+1 bonus, Half-Orc gives Constitution" }), "Wisdom");
  expect(within(dialog).getByRole("group", { name: "Ability bonuses" })).toHaveTextContent("moved from Strength");
  await swap(dialog, "Change language Orc", "Dwarvish");
  await swap(dialog, "Change proficiency Intimidation", "Stealth");
  expect(within(dialog).getByRole("button", { name: "Change language Dwarvish, in place of Orc" })).toBeTruthy();
  expect(save(dialog).disabled).toBe(false);
  fireEvent.click(save(dialog));
  await closed();

  // The copy replaces the Human, and the Human's subrace and variant go.
  expect(race()).toEqual([["race", ["half-orc-custom-origin"]]]);
  const copy = await movedHalfOrc();
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_RACES]: { "~:half-orc-custom-origin": { ...copy, "~:key": "~:half-orc-custom-origin", "~:option-pack": CUSTOM_PACK } },
  });
  let expected = withoutOption(fighter20(), ["race", "human", "subrace", "illuskan"]);
  expected = withoutOption(expected, ["race", "human", "variant", "standard-human"]);
  expect(useCharacter.getState().entity).toEqual(remapOption(expected, ["race", "human"], "half-orc-custom-origin"));

  // The block names the copy, and its button opens the guided dialog, not the race form.
  expect(picksIn(raceSection())).toEqual(["Half-Orc (Custom Origin)"]);
  const edit = within(raceSection()).getByRole("button", { name: "Edit custom origin Half-Orc (Custom Origin)" });
  expect(edit).toHaveTextContent("Edit custom origin");
  await waitFor(() => expect(document.activeElement).toBe(edit));

  // The sheet: the Human's +1 to each ability goes; +2 Dexterity and +1 Wisdom come.
  await withSheetPanel(async (sheet) => {
    await waitFor(() => expect(sheet).toHaveTextContent("Half-Orc (Custom Origin)"));
    const after = evaluate().built.abilities;
    expect(evaluate().built["race-ability-increases"]).toEqual({ "orcpub.dnd.e5.character/dex": 2, "orcpub.dnd.e5.character/wis": 1 });
    // fighter-20's Dexterity had the Human's +1 and has +2 now; his Wisdom had +1 and has +1 now.
    expect([
      after["orcpub.dnd.e5.character/dex"] - before["orcpub.dnd.e5.character/dex"],
      after["orcpub.dnd.e5.character/wis"] - before["orcpub.dnd.e5.character/wis"],
    ]).toEqual([1, 0]);
    expect(within(sheet).getByLabelText("DEX").textContent).toBe(
      `${after["orcpub.dnd.e5.character/dex"]}+${Math.floor((after["orcpub.dnd.e5.character/dex"] - 10) / 2)}`,
    );
    expect(sheet).toHaveTextContent("Dwarvish");
    expect(sheet).not.toHaveTextContent(/\bOrc\b(?! \(Custom)/);
    expect([proficient(sheet, "Stealth"), proficient(sheet, "Intimidation")]).toEqual([true, false]);
  });
  fireEvent.click(edit);
  const again = await screen.findByRole("dialog", { name: "Custom Origin" });
  await within(again).findByRole("group", { name: "Ability bonuses" });
  expect(baseSelect(again)).toHaveTextContent("Half-Orc");
  expect(within(again).getByRole("combobox", { name: "+2 bonus, Half-Orc gives Strength" })).toHaveTextContent("Dexterity");
  expect(within(again).getByRole("combobox", { name: "+1 bonus, Half-Orc gives Constitution" })).toHaveTextContent("Wisdom");
  expect(within(again).getByRole("button", { name: "Change language Dwarvish, in place of Orc" })).toBeTruthy();
  expect(within(again).getByRole("button", { name: "Change proficiency Stealth, in place of Intimidation" })).toBeTruthy();
  expect(within(again).queryByRole("textbox", { name: "Name" })).toBeNull();
  expect(save(again).disabled).toBe(false);
});

test("Edit with a new base race resets the picks, and Save replaces the copy with one of the new name and key", async () => {
  const { custom, entity } = await (async () => {
    const item = await movedHalfOrc();
    const e = engine();
    const custom = { [TAGGED_RACES]: { "~:half-orc-custom-origin": { ...item, "~:key": "~:half-orc-custom-origin", "~:option-pack": CUSTOM_PACK } } };
    return { custom, entity: remapOption(e.select(fighter20(), ["race"], "half-orc"), ["race", "half-orc"], "half-orc-custom-origin") };
  })();
  act(() => useCharacter.getState().load("custom-origin", entity, false, custom));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Race/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit custom origin Half-Orc (Custom Origin)" }));
  const dialog = await screen.findByRole("dialog", { name: "Custom Origin" });
  await within(dialog).findByRole("group", { name: "Ability bonuses" });

  await chooseBase(dialog, "Elf");
  await waitFor(() => expect(within(dialog).getByRole("combobox", { name: "+2 bonus, Elf gives Dexterity" })).toHaveTextContent("Dexterity"));
  expect(save(dialog).disabled).toBe(true);
  expect(within(dialog).getByRole("button", { name: "Change proficiency Perception" })).toBeTruthy();
  // The Elf has one subrace, the High Elf, so the base record has its values: the +1 bonus is a slot. The dialog has no Subrace select.
  expect(within(dialog).getByRole("combobox", { name: "+1 bonus, Elf gives Intelligence" })).toHaveTextContent("Intelligence");
  expect(within(dialog).queryByRole("combobox", { name: "Subrace" })).toBeNull();
  // The character is not an Elf, so it has no cantrip pick for the copy to hold.
  expect(dialog).toHaveTextContent("The copy does not keep these choices of Elf: High Elf Cantrips Known.");
  await pickOption(within(dialog).getByRole("combobox", { name: "+2 bonus, Elf gives Dexterity" }), "Wisdom");
  fireEvent.click(save(dialog));
  await closed();

  expect(race()).toEqual([["race", ["elf-custom-origin"]]]);
  const elf = (await baseRace({ homebrew: undefined }, undefined, "elf", null))!;
  expect(heldSubrace(elf.held)).toBe("high-elf");
  const copy = originRecord(elf.record, withPick(originSlots(elf.record), 0, "ability:wis"), "elf", "Elf", elf.held);
  expect(copy[CUSTOM_ORIGIN]).toBe("~:elf");
  expect(copy[CUSTOM_ORIGIN_PICKS]).toEqual([["~:subrace", "~:high-elf"]]);
  expect(useCharacter.getState().custom).toEqual({
    [TAGGED_RACES]: { "~:elf-custom-origin": { ...copy, "~:key": "~:elf-custom-origin", "~:option-pack": CUSTOM_PACK } },
  });
  expect(useCharacter.getState().entity).toEqual(remapOption(entity, ["race", "half-orc-custom-origin"], "elf-custom-origin"));
  expect(await withSheetPanel((sheet) => proficient(sheet, "Perception"))).toBe(true);
});

test("a Hill Dwarf with a tool pick: the +1 of the subrace and the tool are slots, Save names no pick, and Edit shows the same picks (ORC-249)", async () => {
  const dwarf = engine().select(withHillDwarf(), ["race", "dwarf", "tool-proficiency"], "smiths-tools");
  openRace(dwarf);
  const before = evaluate().built;
  const dialog = await openEntry();
  await chooseBase(dialog, "Dwarf");
  // The Dwarf has one subrace, so the dialog has no Subrace select. The copy holds the subrace and the tool, so no line names a choice or a pick.
  expect(within(dialog).queryByRole("combobox", { name: "Subrace" })).toBeNull();
  expect(dialog).not.toHaveTextContent("The copy does not keep these choices");
  expect(within(dialog).getByRole("button", { name: "Change proficiency Smith's Tools" })).toBeTruthy();
  await pickOption(within(dialog).getByRole("combobox", { name: "+1 bonus, Dwarf gives Wisdom" }), "Charisma");
  await waitFor(() => expect(save(dialog).disabled).toBe(false));
  expect(within(dialog).getAllByRole("note")).toHaveLength(1);
  fireEvent.click(save(dialog));
  await closed();

  expect(race()).toEqual([["race", ["dwarf-custom-origin"]]]);
  const after = evaluate().built;
  expect(after["max-hit-points"]).toBe(before["max-hit-points"]);
  expect(Object.keys(after["tool-profs"] ?? {})).toEqual(["smiths-tools"]);
  expect(after["race-ability-increases"]).toEqual({ "orcpub.dnd.e5.character/con": 2, "orcpub.dnd.e5.character/cha": 1 });

  // Edit reads the base record from the copy: the character does not have the subrace and the tool picks now.
  fireEvent.click(screen.getByRole("button", { name: "Edit custom origin Dwarf (Custom Origin)" }));
  const again = await screen.findByRole("dialog", { name: "Custom Origin" });
  await within(again).findByRole("group", { name: "Ability bonuses" });
  expect(within(again).getByRole("combobox", { name: "+2 bonus, Dwarf gives Constitution" })).toHaveTextContent("Constitution");
  expect(within(again).getByRole("combobox", { name: "+1 bonus, Dwarf gives Wisdom" })).toHaveTextContent("Charisma");
  expect(within(again).getByRole("button", { name: "Change proficiency Smith's Tools" })).toBeTruthy();
  // The copy holds the picks of its base record, so the line names no choice in Edit too.
  expect(again).not.toHaveTextContent("The copy does not keep these choices");
  expect(save(again).disabled).toBe(false);
});

/** The names of the rows of the list of the token named `token`. */
async function rows(dialog: HTMLElement, token: string) {
  fireEvent.click(within(dialog).getByRole("button", { name: token }));
  const list = await screen.findByRole("dialog", { name: /^Replace / });
  const names = within(list)
    .getAllByRole("button")
    .filter((b) => b.classList.contains("ui-list-row"))
    .map((b) => b.getAttribute("aria-label"));
  fireEvent.keyDown(list, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Replace / })).toBeNull());
  return names;
}

// ORC-245. fighter-20 is an Acolyte with Elvish and Draconic from the Languages selection, Insight and Religion from
// the background, and Athletics and Perception from the class.
test("the lists leave out a language and a skill that the character holds from another pick, and a line says so", async () => {
  openRace();
  const dialog = await openEntry();
  await chooseBase(dialog, "Half-Orc");
  const languages = await rows(dialog, "Change language Orc");
  expect(languages).toEqual(expect.arrayContaining(["Dwarvish", "Sylvan"]));
  expect(languages).not.toContain("Elvish");
  expect(languages).not.toContain("Draconic");
  const skills = await rows(dialog, "Change proficiency Intimidation");
  expect(skills).toEqual(expect.arrayContaining(["Stealth", "Acrobatics"]));
  for (const held of ["Athletics", "Perception", "Insight", "Religion"]) expect(skills).not.toContain(held);
  expect(dialog).toHaveTextContent("The lists leave out what the character has from its class, its background and its other picks.");
});

test("Human gives a bonus to each ability, so there is nothing to move; its one language can still be swapped", async () => {
  openRace();
  const dialog = await openEntry();
  await chooseBase(dialog, "Human");
  expect(within(dialog).getByRole("group", { name: "Ability bonuses" })).toHaveTextContent(
    "Human gives a bonus to each of the six abilities. Two bonuses cannot go on one ability, so there is nothing to move.",
  );
  expect(within(dialog).queryByRole("combobox", { name: /bonus/ })).toBeNull();
  expect(within(dialog).getByRole("group", { name: "Proficiencies" })).toHaveTextContent("Human gives no skill, tool or weapon proficiency.");
  // fighter-20 is a Human: the base record has the values of his subrace and variant picks, so no line names those choices. The select has the nine subraces of the Human.
  expect(dialog).not.toHaveTextContent("The copy does not keep these choices");
  expect(within(dialog).getByRole("combobox", { name: "Subrace" })).toHaveTextContent("Illuskan");
  expect(within(dialog).queryAllByRole("note")).toHaveLength(1);
  // Without the subrace, the copy does not hold the subrace pick, so the line names it.
  await pickOption(within(dialog).getByRole("combobox", { name: "Subrace" }), "No subrace");
  await waitFor(() => expect(within(dialog).getByRole("combobox", { name: "Subrace" })).toHaveTextContent("No subrace"));
  await waitFor(() => expect(within(dialog).getAllByRole("note")[1]).toHaveTextContent("Save removes these picks of the character: Subrace (Illuskan)."));
  await swap(dialog, "Change language Common", "Dwarvish");
  expect(save(dialog).disabled).toBe(false);
});

test("Dwarf: a weapon becomes a tool from a list with search; the changed token is marked, and its X puts the weapon back", async () => {
  openRace();
  const dialog = await openEntry();
  await chooseBase(dialog, "Dwarf");
  fireEvent.click(within(dialog).getByRole("button", { name: "Change proficiency Battleaxe" }));
  const list = await screen.findByRole("dialog", { name: "Replace Battleaxe with" });
  // The list has the weapons, then the tools by kind. The Dwarf's other weapons are held by their slots, so they are not offered.
  const rows = within(list)
    .getAllByRole("button")
    .map((b) => b.getAttribute("aria-label"));
  expect(rows).toContain("Smith's Tools");
  expect(rows).toContain("Longsword");
  expect(rows).not.toContain("Handaxe");
  expect(rows).not.toContain("Battleaxe");
  fireEvent.change(within(list).getByRole("searchbox", { name: "Search" }), { target: { value: "smith" } });
  fireEvent.click(within(list).getByRole("button", { name: "Smith's Tools" }));
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /^Replace / })).toBeNull());

  const token = within(dialog).getByRole("button", { name: "Change proficiency Smith's Tools, in place of Battleaxe" });
  expect(token.closest<HTMLElement>(".ui-token")!.dataset.marked).toBe("");
  await waitFor(() => expect(document.activeElement).toBe(token));
  expect(save(dialog).disabled).toBe(false);
  fireEvent.click(within(dialog).getByRole("button", { name: "Put back Battleaxe" }));
  const back = within(dialog).getByRole("button", { name: "Change proficiency Battleaxe" });
  expect(back.closest<HTMLElement>(".ui-token")!.dataset.marked).toBeUndefined();
  expect(document.activeElement).toBe(back);
  // Nothing differs again, so Save is disabled again.
  expect(save(dialog).disabled).toBe(true);
});

test("closing with changes asks first; Close drops them and selects nothing", async () => {
  openRace();
  const dialog = await openEntry();
  await chooseBase(dialog, "Tiefling");
  fireEvent.keyDown(dialog, { key: "Escape" });
  fireEvent.click(await screen.findByRole("button", { name: "Close" }));
  await closed();
  expect(race()[0]).toEqual(["race", ["human"]]);
  expect(useCharacter.getState().custom).toBeUndefined();
});

test("Edit of a copy whose base race is not in the race list now, as when its pack is off, opens with no base race and a line that says so", async () => {
  const { "~:key": _key, "~:option-pack": _pack, ...sylvar } = SYLVAR;
  const copy = originRecord(sylvar, withPick(originSlots(sylvar), 4, "weapon:battleaxe"), "sylvar", "Sylvar");
  const custom = { [TAGGED_RACES]: { "~:sylvar-custom-origin": { ...copy, "~:key": "~:sylvar-custom-origin", "~:option-pack": CUSTOM_PACK } } };
  // The pack of Sylvar is not loaded: the character builds with the copy alone.
  const entity = remapOption(withSylvar(), ["race", "sylvar"], "sylvar-custom-origin");
  act(() => useCharacter.getState().load("custom-origin", entity, false, custom));
  render(<Builder />);
  fireEvent.click(within(screen.getByRole("navigation", { name: "Steps" })).getByRole("button", { name: /^Race/ }));
  fireEvent.click(screen.getByRole("button", { name: "Edit custom origin Sylvar (Custom Origin)" }));
  const dialog = await screen.findByRole("dialog", { name: "Custom Origin" });
  await within(dialog).findByRole("combobox", { name: "Base race" });
  expect(within(dialog).getByRole("alert")).toHaveTextContent("The base race of this copy (sylvar) is not in the race list now. Choose a base race.");
  expect(baseSelect(dialog)).toHaveTextContent("Choose a race…");
  expect(within(dialog).queryByRole("group", { name: "Ability bonuses" })).toBeNull();
  expect(save(dialog).disabled).toBe(true);
});
