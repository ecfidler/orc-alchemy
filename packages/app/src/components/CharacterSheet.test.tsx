import { readFileSync } from "node:fs";
import { join } from "node:path";
import { optionNames, pickOption } from "@orc-alchemy/ui/testing";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeAll, expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { bonusStr, type KnownSpell, ordinal, type Sheet, toSheet } from "../engine/sheet.ts";
import { loadSpellContent } from "../engine/spells.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { CharacterSheet, sourceMarks } from "./CharacterSheet.tsx";

// The Spellcasting section shows spell names only once the SRD spells are loaded.
beforeAll(() => loadSpellContent());

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  useHomebrew.setState({ homebrew: undefined });
});

const abilities = (["str", "dex", "con", "int", "wis", "cha"] as const).map((ability, i) => ({
  ability,
  score: [16, 10, 14, 8, 12, 9][i],
  modifier: [3, 0, 2, -1, 1, -1][i],
  save: [5, 0, 4, -1, 1, -1][i],
  saveProficient: ability === "str" || ability === "con",
}));

const sheet: Sheet = {
  name: "Brannor Ironfist",
  portrait: null,
  playerName: null,
  factionName: null,
  factionImage: null,
  race: "Dwarf",
  subrace: "Hill Dwarf",
  background: "Soldier",
  alignment: "Lawful Good",
  classes: [{ key: "fighter", name: "Fighter", level: 3, hitDie: 10, subclass: "Champion" }],
  totalLevel: 3,
  xp: 900,
  abilities,
  proficiencyBonus: 2,
  initiative: 0,
  passivePerception: 11,
  skills: [
    { key: "athletics", name: "Athletics", ability: "str", bonus: 5, proficient: true, expertise: false },
    { key: "history", name: "History", ability: "int", bonus: -1, proficient: false, expertise: false },
  ],
  armorClass: 19,
  wornArmorClass: 19,
  acPick: null,
  armorClassOptions: [
    { armor: { key: "chain-mail", name: "Chain Mail" }, shield: { key: "shield", name: "Shield" }, ac: 19, worn: true, shown: true },
    { armor: null, shield: null, ac: 10, worn: false, shown: false },
  ],
  maxHitPoints: 28,
  baseMaxHitPoints: 28,
  currentHitPoints: null,
  tempHitPoints: 0,
  deathSaves: { successes: 0, failures: 0 },
  exhaustion: 0,
  concentration: null,
  conditions: [],
  conditionImmune: [],
  inspiration: false,
  hitDice: [{ die: 10, total: 3, left: 3 }],
  speeds: [{ feet: 25, label: null }],
  speedCause: null,
  darkvision: 60,
  numberOfAttacks: 1,
  weaponAttacks: [
    {
      key: "longsword",
      name: "Longsword",
      attackBonus: 5,
      damageModifier: 3,
      offHandDamageModifier: null,
      proficient: true,
    },
  ],
  specialAttacks: [],
  resistances: ["poison"],
  immunities: [],
  conditionImmunities: [],
  vulnerabilities: [],
  languages: ["Common", "Dwarvish"],
  tools: [{ key: "smiths-tools", name: "Smith's Tools", bonus: 2 }],
  weaponProficiencies: [],
  armorProficiencies: [],
  spellcasting: {
    slots: [],
    pact: null,
    casters: [{ name: "Hill Dwarf", ability: "wis", saveDc: 11, attackBonus: 3, prepares: false, canPrepare: null }],
    byLevel: [
      {
        level: 0,
        spells: [{ key: "guidance", name: "Guidance", source: "Hill Dwarf", ability: "wis", alwaysPrepared: false, prepared: false, castNote: null }],
      },
    ],
    knownModes: {},
  },
  features: {
    actions: [{ name: "Second Wind", text: "Regain 1d10 + 3 hit points (1/rest)." }],
    bonusActions: [],
    reactions: [],
    traits: [],
  },
  equipment: { weapons: [], armor: [], magicItems: [], other: [], treasure: [] },
  details: {
    personalityTraits: [],
    ideals: null,
    bonds: null,
    flaws: null,
    description: null,
    age: null,
    sex: null,
    height: null,
    weight: null,
    hair: null,
    eyes: null,
    skin: null,
    notes: "Owes the guild\nHates boats",
  },
};

test("renders the key values of a sheet", () => {
  render(<CharacterSheet sheet={sheet} />);
  expect(screen.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeTruthy();
  expect(screen.getByLabelText("Class").textContent).toBe("Fighter 3 (Champion)");
  expect(screen.getByLabelText("Armor Class").textContent).toBe("19");
  expect(screen.getByLabelText("Hit Points").textContent).toBe("28 / 28");
  expect(screen.getByLabelText("Initiative").textContent).toBe("+0");
  expect(screen.getByLabelText("STR").textContent).toBe("16+3");
  expect(screen.getByLabelText("INT").textContent).toBe("8-1");
  expect(within(screen.getByText("+5 Athletics").closest("li")!).getByRole("img", { name: "Proficient" })).toBeTruthy();
  expect(within(screen.getByText("-1 History").closest("li")!).queryByRole("img")).toBeNull();
  expect(screen.getByLabelText("Tools").textContent).toBe("Smith's Tools (+2)");
  // A race with only a cantrip is one line, not boxes and a table (ORC-176).
  expect(within(screen.getByRole("group", { name: "Spellcasting" })).getByRole("listitem").textContent).toBe("Guidance (Hill Dwarf, WIS, DC 11, +3)");
  expect(screen.getByText("Second Wind")).toBeTruthy();
  expect(screen.getByText("Hates boats")).toBeTruthy();
});

test("omits empty sections", () => {
  render(<CharacterSheet sheet={{ ...sheet, name: null, spellcasting: null, darkvision: 0 }} />);
  expect(screen.getByRole("heading", { level: 1, name: "Unnamed character" })).toBeTruthy();
  expect(screen.queryByRole("group", { name: "Spellcasting" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Equipment" })).toBeNull();
  expect(screen.queryByLabelText("Darkvision")).toBeNull();
});

// The theme spec, "Not on the sheet in M8": the record keeps these, and the sheet does not show them.
test("does not show the player, XP, alignment, faction, images, appearance or personality", () => {
  render(
    <CharacterSheet
      sheet={{
        ...sheet,
        playerName: "Ana",
        factionName: "Harpers",
        portrait: "https://example.com/p.png",
        factionImage: "https://example.com/f.png",
        details: { ...sheet.details, personalityTraits: ["Brave"], ideals: "Honor", bonds: "Kin", flaws: "Pride", description: "Tall", hair: "Red" },
      }}
    />,
  );
  for (const label of ["Player", "XP", "Alignment", "Faction", "Personality Traits", "Ideals", "Bonds", "Flaws", "Description", "Hair"]) {
    expect(screen.queryByLabelText(label)).toBeNull();
  }
  for (const text of ["Ana", "900", "Lawful Good", "Harpers", "Brave", "Honor", "Kin", "Pride", "Tall", "Red"]) {
    expect(screen.queryByText(text)).toBeNull();
  }
  expect(screen.queryByRole("img", { name: /Portrait|Faction/ })).toBeNull();
});

// On-screen spot checks against the oracle's built values (ORC-48 done-when).
const fixture = (file: string) => JSON.parse(readFileSync(join(import.meta.dirname, `../../../../fixtures/characters/${file}`), "utf8"));
const expectedOf = (name: string) => fixture(`${name}.expected.json`);
const strictOf = (name: string) => fixture(`${name}.strict.json`);
/** The Spellcasting table row whose level cell has this text. */
const spellsRow = (level: string) => screen.getByRole("rowheader", { name: level }).closest("tr")!;
/** The text of each spell in that row, its source tag or mark included (a mark is read as the source in brackets). */
// A non-breaking space keeps a tag on the line of the name's last word.
const spellNames = (level: string) =>
  within(spellsRow(level))
    .queryAllByRole("listitem")
    .map((item) => item.textContent?.replace(/\u00a0/g, " "));

test.each(["fighter-20", "wizard-20"])("%s shows its expected.json values", (name) => {
  const built = expectedOf(name);
  render(<CharacterSheet sheet={toSheet(built, {})} />);

  expect(screen.getByRole("heading", { level: 1, name: built["character-name"] })).toBeTruthy();
  expect(screen.getByLabelText("Hit Points").textContent).toBe(`${built["max-hit-points"]} / ${built["max-hit-points"]}`);
  expect(screen.getByLabelText("Proficiency Bonus").textContent).toBe(bonusStr(built["proficiency-bonus"]));
  expect(screen.getByLabelText("Passive Perception").textContent).toBe(String(built["passive-perception"]));
  for (const ability of ["str", "dex", "con", "int", "wis", "cha"]) {
    const key = `orcpub.dnd.e5.character/${ability}`;
    expect(screen.getByLabelText(ability.toUpperCase()).textContent).toBe(`${built.abilities[key]}${bonusStr(built["ability-bonuses"][key])}`);
  }
  expect(screen.getByText(`${bonusStr(built["skill-bonuses"].perception)} Perception`)).toBeTruthy();
  const worn = built["armor-class-with-armor"].find(
    (o: { armor: string | null; shield: string | null }) => o.armor === built["worn-armor"] && o.shield === built["wielded-shield"],
  );
  expect(screen.getByLabelText("Armor Class").textContent).toBe(String(worn.ac));
  const acRows = within(screen.getByRole("table", { name: "Armor class options" }))
    .getAllByRole("row")
    .slice(1);
  // The AC cell keeps the width of its bold form with a hidden copy, so read the text that shows.
  expect(acRows.map((row) => Number(row.lastElementChild?.querySelector("span > span:not([aria-hidden])")?.textContent))).toEqual(
    built["armor-class-with-armor"].map((o: { ac: number }) => o.ac),
  );
});

test("one source that prepares: one row of boxes, slots once for each level, and only prepared spells", () => {
  const built = expectedOf("wizard-5");
  render(<CharacterSheet sheet={toSheet(built, strictOf("wizard-5"))} />);
  const section = screen.getByRole("group", { name: "Spellcasting" });
  expect(within(section).getByLabelText("Spell save DC").textContent).toBe("15");
  expect(within(section).getByLabelText("Spell attack").textContent).toBe("+7");
  expect(within(section).getByLabelText("Spellcasting ability").textContent).toBe("INT");
  expect(within(section).getByRole("columnheader", { name: "Prepared spells" })).toBeTruthy();
  expect(
    within(section)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Cantrips", "1st", "2nd", "3rd"]);
  for (const [level, count] of Object.entries(built["spell-slots"] as Record<string, number>)) {
    const name = `${ordinal(Number(level))}-level slots: 0 of ${count}`;
    expect(within(spellsRow(ordinal(Number(level)))).getByRole("img", { name })).toBeTruthy();
  }
  expect(within(spellsRow("Cantrips")).queryByRole("img")).toBeNull();
  // Prepared spells only, A to Z, with no source tags.
  expect(spellNames("2nd")).toEqual(["Alter Self"]);
  expect(spellNames("3rd")).toEqual([]);
  expect(spellNames("Cantrips")).toEqual(["Acid Splash", "Chill Touch", "Dancing Lights", "Fire Bolt"]);
});

test("the Slots cells show the spent slots; with onSpendSlots they change, and without it they do not (ORC-282)", () => {
  const entity = strictOf("wizard-5");
  entity["~:orcpub.entity.strict/values"]["~:orcpub.dnd.e5.spells/slots-used"] = {
    "~:orcpub.dnd.e5.spells/slots-1": { "~#set": [0, 1] },
    "~:orcpub.dnd.e5.spells/slots-3": { "~#set": [0] },
  };
  const wizard = toSheet(expectedOf("wizard-5"), entity);
  expect(wizard.spellcasting!.slots).toEqual([
    { level: 1, count: 4, spent: 2 },
    { level: 2, count: 3, spent: 0 },
    { level: 3, count: 2, spent: 1 },
  ]);
  render(<CharacterSheet sheet={wizard} preview />);
  expect(within(spellsRow("1st")).getByRole("img", { name: "1st-level slots: 2 of 4" }).querySelectorAll("[data-marked]")).toHaveLength(2);
  expect(within(spellsRow("3rd")).getByRole("img", { name: "3rd-level slots: 1 of 2" })).toBeTruthy();
  expect(screen.queryByRole("slider")).toBeNull();
  cleanup();

  const onSpendSlots = vi.fn();
  render(<CharacterSheet sheet={wizard} onSpendSlots={onSpendSlots} />);
  const first = within(spellsRow("1st")).getByRole("slider", { name: "1st-level slots" });
  expect(first.getAttribute("aria-valuetext")).toBe("2 of 4 spent");
  fireEvent.click(first.children[3]!);
  fireEvent.click(within(spellsRow("3rd")).getByRole("slider", { name: "3rd-level slots" }).children[0]!);
  fireEvent.keyDown(within(spellsRow("2nd")).getByRole("slider", { name: "2nd-level slots" }), { key: "ArrowRight" });
  expect(onSpendSlots.mock.calls).toEqual([
    [1, 3],
    [3, 0],
    [2, 1],
  ]);
  // The death saves do not change.
  expect(screen.getByRole("img", { name: "Successes: 0 of 3" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Failures: 0 of 3" })).toBeTruthy();
});

test("one source that does not prepare: the column is Known spells, and it lists every known spell", () => {
  const spell = (key: string, name: string) => ({
    key,
    name,
    source: "Hill Dwarf",
    ability: "wis" as const,
    alwaysPrepared: false,
    prepared: false,
    castNote: null,
  });
  const spellcasting = {
    ...sheet.spellcasting!,
    byLevel: [...sheet.spellcasting!.byLevel, { level: 1, spells: [spell("sleep", "Sleep"), spell("bless", "Bless")] }],
  };
  render(<CharacterSheet sheet={{ ...sheet, spellcasting }} />);
  expect(screen.getByRole("columnheader", { name: "Known spells" })).toBeTruthy();
  expect(screen.getByLabelText("Spell save DC").textContent).toBe("11");
  expect(screen.queryByRole("group", { name: "Hill Dwarf" })).toBeNull();
  expect(spellNames("1st")).toEqual(["Bless", "Sleep"]);
  // No slots: the row has no circles.
  expect(within(spellsRow("1st")).queryByRole("img")).toBeNull();
});

test("an always-prepared spell shows with the prepared spells, with no tag", () => {
  const cleric = { name: "Cleric", ability: "wis" as const, saveDc: 13, attackBonus: 5, prepares: true, canPrepare: 4 };
  const spell = (key: string, name: string, alwaysPrepared: boolean, prepared: boolean) => ({
    key,
    name,
    source: "Cleric",
    ability: "wis" as const,
    alwaysPrepared,
    prepared,
    castNote: null,
  });
  const spellcasting = {
    slots: [{ level: 1, count: 2, spent: 0 }],
    pact: null,
    casters: [cleric],
    byLevel: [
      { level: 1, spells: [spell("bless", "Bless", true, true), spell("sanctuary", "Sanctuary", false, true), spell("command", "Command", false, false)] },
    ],
    knownModes: {},
  };
  render(<CharacterSheet sheet={{ ...sheet, spellcasting }} />);
  expect(screen.getByRole("columnheader", { name: "Prepared spells" })).toBeTruthy();
  expect(spellNames("1st")).toEqual(["Bless", "Sanctuary"]);
});

/** warlock-10-drow with these stored spent slot positions of its 5th level. */
const warlockWithSpent = (...positions: number[]) => {
  const entity = strictOf("warlock-10-drow");
  entity["~:orcpub.entity.strict/values"] ??= {};
  if (positions.length > 0)
    entity["~:orcpub.entity.strict/values"]["~:orcpub.dnd.e5.spells/slots-used"] = { "~:orcpub.dnd.e5.spells/slots-5": { "~#set": positions } };
  return toSheet(expectedOf("warlock-10-drow"), entity);
};

test("warlock-10-drow: two diamonds in the 5th-level row, with no circles and no Pact row (ORC-283)", () => {
  const warlock = warlockWithSpent(1);
  expect(warlock.spellcasting!.slots).toEqual([]);
  expect(warlock.spellcasting!.pact).toEqual({ slotLevel: 5, count: 2, spent: 1 });
  render(<CharacterSheet sheet={warlock} preview />);
  expect(screen.getByRole("columnheader", { name: "Known spells" })).toBeTruthy();
  expect(within(spellsRow("1st")).queryByRole("img")).toBeNull();
  const section = screen.getByRole("group", { name: "Spellcasting" });
  expect(
    within(section)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Cantrips", "1st", "2nd", "3rd", "5th"]);
  // The 5th level has its spells, and the diamonds are its only slots.
  const fifth = spellsRow("5th");
  expect(spellNames("5th").length).toBeGreaterThan(0);
  expect(within(fifth).getAllByRole("img")).toHaveLength(1);
  const diamonds = within(fifth).getByRole("img", { name: "Pact slots, 5th level: 1 of 2" });
  expect(diamonds.getAttribute("data-shape")).toBe("diamond");
  expect(diamonds.querySelectorAll("[data-marked]")).toHaveLength(1);
  // The builder preview: the diamonds cannot change.
  expect(screen.queryByRole("slider")).toBeNull();
  fireEvent.click(diamonds.children[1]!);
  expect(within(fifth).getByRole("img", { name: "Pact slots, 5th level: 1 of 2" })).toBeTruthy();
});

test("a level with other slots and pact slots shows the circles, then the diamonds, in its row (ORC-283)", () => {
  const warlock = warlockWithSpent();
  const spellcasting = { ...warlock.spellcasting!, slots: [{ level: 5, count: 1, spent: 1 }] };
  const onSpendSlots = vi.fn();
  render(<CharacterSheet sheet={{ ...warlock, spellcasting }} onSpendSlots={onSpendSlots} />);
  const sliders = within(spellsRow("5th")).getAllByRole("slider");
  expect(sliders.map((slider) => [slider.getAttribute("aria-label"), slider.getAttribute("aria-valuetext"), slider.getAttribute("data-shape")])).toEqual([
    ["5th-level slots", "1 of 1 spent", null],
    ["Pact slots, 5th level", "0 of 2 spent", "diamond"],
  ]);
  fireEvent.click(sliders[1]!.children[0]!);
  fireEvent.click(sliders[0]!.children[0]!);
  expect(onSpendSlots.mock.calls).toEqual([
    ["pact", 1],
    [5, 0],
  ]);
});

test("a pact slot level with no spell has a row for its diamonds (ORC-283)", () => {
  const warlock = warlockWithSpent();
  const spellcasting = { ...warlock.spellcasting!, pact: { slotLevel: 4, count: 2, spent: 0 } };
  render(<CharacterSheet sheet={{ ...warlock, spellcasting }} onSpendSlots={() => {}} />);
  expect(within(spellsRow("4th")).getByRole("slider", { name: "Pact slots, 4th level" })).toBeTruthy();
});

test("with onSpendSlots the pact diamonds change, and a screen reader reads the pact slots and the state (ORC-283)", () => {
  const onSpendSlots = vi.fn();
  render(<CharacterSheet sheet={warlockWithSpent(1)} onSpendSlots={onSpendSlots} />);
  const diamonds = within(spellsRow("5th")).getByRole("slider", { name: "Pact slots, 5th level" });
  expect(diamonds.getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  expect(screen.getAllByRole("slider")).toHaveLength(1);
  fireEvent.click(diamonds.children[1]!);
  fireEvent.click(diamonds.children[0]!);
  fireEvent.keyDown(diamonds, { key: "ArrowLeft" });
  expect(onSpendSlots.mock.calls).toEqual([
    ["pact", 2],
    ["pact", 0],
    ["pact", 0],
  ]);
});

test("under 720px the diamonds are under the level name, and the row is named by the level (ORC-283)", () => {
  renderAtWidth(390, <CharacterSheet sheet={warlockWithSpent()} onSpendSlots={() => {}} />);
  fireEvent.click(screen.getByRole("tab", { name: "Spells" }));
  const cell = screen.getByRole("rowheader", { name: "5th" });
  expect(within(cell).getByRole("slider", { name: "Pact slots, 5th level" }).getAttribute("aria-valuetext")).toBe("0 of 2 spent");
  // No Slots column: the level cell and the spells cell.
  expect(cell.closest("tr")!.children).toHaveLength(2);
});

test("a character with no warlock level has no diamonds", () => {
  const wizard = toSheet(expectedOf("wizard-5"), strictOf("wizard-5"));
  expect(wizard.spellcasting!.pact).toBeNull();
  render(<CharacterSheet sheet={wizard} onSpendSlots={() => {}} />);
  expect(screen.queryByRole("slider", { name: /^Pact/ })).toBeNull();
  expect(document.querySelector('[data-shape="diamond"]')).toBeNull();
});

test("a High Elf wizard: the High Elf cantrip is one line, and the wizard's spells have no tags (ORC-176)", () => {
  render(<CharacterSheet sheet={toSheet(expectedOf("wizard-1"), strictOf("wizard-1"))} />);
  const section = screen.getByRole("group", { name: "Spellcasting" });
  expect(
    within(section)
      .getAllByLabelText("Spell save DC")
      .map((box) => box.textContent),
  ).toEqual(["13"]);
  expect(screen.queryByRole("group", { name: "High Elf" })).toBeNull();
  expect(
    within(section)
      .getByText(/^Minor Illusion/)
      .closest("li")!.textContent,
  ).toBe("Minor Illusion (High Elf, INT, DC 13, +5)");
  expect(screen.getByRole("columnheader", { name: "Prepared spells" })).toBeTruthy();
  expect(spellNames("Cantrips")).toEqual(["Acid Splash", "Chill Touch", "Dancing Lights"]);
  // The wizard's unprepared spellbook spells are not on the sheet.
  expect(spellNames("1st")).toEqual(["Alarm", "Burning Hands", "Charm Person", "Color Spray"]);
});

/** A Tiefling warlock: two sources with the same numbers, and race spells past cantrips. Warlock has more spells. */
const tieflingWarlock = (tieflingDc = 15): Sheet => {
  const spell = (key: string, name: string, source: string) => ({
    key,
    name,
    source,
    ability: "cha" as const,
    alwaysPrepared: false,
    prepared: false,
    castNote: null,
  });
  const caster = (name: string, saveDc: number) => ({ name, ability: "cha" as const, saveDc, attackBonus: saveDc - 8, prepares: false, canPrepare: null });
  return {
    ...sheet,
    classes: [{ key: "warlock", name: "Warlock", level: 3, hitDie: 8, subclass: "The Fiend" }],
    spellcasting: {
      slots: [{ level: 1, count: 2, spent: 0 }],
      pact: null,
      casters: [caster("Tiefling", tieflingDc), caster("Warlock", 15)],
      byLevel: [
        { level: 0, spells: [spell("thaumaturgy", "Thaumaturgy", "Tiefling"), spell("eldritch-blast", "Eldritch Blast", "Warlock")] },
        {
          level: 1,
          spells: [
            spell("hellish-rebuke", "Hellish Rebuke", "Tiefling"),
            spell("hex", "Hex", "Warlock"),
            spell("armor-of-agathys", "Armor of Agathys", "Warlock"),
          ],
        },
      ],
      knownModes: {},
    },
  };
};

test("sources with the same DC, attack and ability share one row of boxes, named by both", () => {
  render(<CharacterSheet sheet={tieflingWarlock()} />);
  // The label shows "Tiefling · Warlock". A screen reader reads "and" in place of the dot.
  const row = screen.getByRole("group", { name: "Tiefling and Warlock" });
  expect(within(row).getByLabelText("Spell save DC").textContent).toBe("15");
  expect(screen.getAllByLabelText("Spell save DC")).toHaveLength(1);
  expect(screen.getByRole("columnheader", { name: "Spells" })).toBeTruthy();
  // Warlock is the main source and has no mark. Tiefling has †, keyed on the row label.
  expect(spellNames("1st")).toEqual(["Armor of Agathys", "Hellish Rebuke† (Tiefling)", "Hex"]);
  expect(within(row).getByText("Tiefling † · Warlock")).toBeTruthy();
});

test("a cantrip-only source with no caster numbers is a line with its name only", () => {
  const spellcasting = { ...sheet.spellcasting!, casters: [] };
  render(<CharacterSheet sheet={{ ...sheet, spellcasting }} />);
  expect(within(screen.getByRole("group", { name: "Spellcasting" })).getByRole("listitem").textContent).toBe("Guidance (Hill Dwarf)");
});

test("sources with other numbers keep a row each", () => {
  render(<CharacterSheet sheet={tieflingWarlock(13)} />);
  expect(within(screen.getByRole("group", { name: "Tiefling" })).getByLabelText("Spell save DC").textContent).toBe("13");
  expect(within(screen.getByRole("group", { name: "Warlock" })).getByLabelText("Spell save DC").textContent).toBe("15");
});

test("layout F: header details, hit dice, empty death saves, and HP as current / max", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 20 }} />);
  expect(screen.getByLabelText("Background").textContent).toBe("Soldier");
  expect(screen.getByLabelText("Race").textContent).toBe("Dwarf (Hill Dwarf)");
  // A long value is truncated; a hover shows the whole value.
  expect(screen.getByLabelText("Race").title).toBe("Dwarf (Hill Dwarf)");
  expect(screen.getByLabelText("Hit Points").textContent).toBe("20 / 28");
  expect(screen.getByLabelText("Temporary").textContent).toBe("");
  // Without play, the Hit dice box is not a button: it shows the dice left / the dice of each die size.
  expect(screen.getByRole("group", { name: "Hit dice" }).textContent).toBe("3 / 3d10");
  expect(screen.getByRole("img", { name: "Successes: 0 of 3" })).toBeTruthy();
  expect(screen.getByRole("img", { name: "Failures: 0 of 3" })).toBeTruthy();
  expect(screen.getByLabelText("Inspiration").textContent).toBe("");
});

test("the builder preview leaves out temporary hit points and death saves", () => {
  render(<CharacterSheet sheet={{ ...sheet, currentHitPoints: 20 }} preview />);
  expect(screen.getByLabelText("Hit Points").textContent).toBe("20 / 28");
  expect(screen.queryByLabelText("Temporary")).toBeNull();
  expect(screen.queryByRole("img", { name: /^(Successes|Failures):/ })).toBeNull();
  // The preview shows the play state of the hit dice, and the box is not a button.
  expect(screen.getByRole("group", { name: "Hit dice" }).textContent).toBe("3 / 3d10");
  expect(screen.queryByRole("button", { name: /^Hit dice/ })).toBeNull();
});

test("the Gold box adds up the coins as gold pieces, and the coins leave the equipment list", () => {
  const coin = (key: string, quantity: number) => ({ key, name: key.toUpperCase(), quantity, equipped: false });
  const treasure = [coin("cp", 5), coin("sp", 14), coin("ep", 1), coin("gp", 37), coin("pp", 2), { key: "ruby", name: "Ruby", quantity: 1, equipped: false }];
  render(<CharacterSheet sheet={{ ...sheet, equipment: { ...sheet.equipment, treasure } }} />);
  // 0.05 + 1.4 + 0.5 + 37 + 20
  expect(screen.getByLabelText("Gold").textContent).toBe("58.95");
  const equipment = within(screen.getByRole("group", { name: "Equipment" }));
  expect(equipment.getByText("Ruby")).toBeTruthy();
  expect(equipment.queryByText("GP")).toBeNull();
});

const LONG_REST = "orcpub.dnd.e5.units/long-rest";
/** The uses of a sheet feature, with the unit and name of its record key. */
const usesOf = (name: string, amount: number, recharge: string | null, units: string | null, spent = 0) => ({ amount, recharge, units, name, spent });
const usesFeatures = (spent: { wind?: number; hands?: number } = {}) => ({
  ...sheet.features,
  actions: [
    { name: "Second Wind", text: "Regain hit points.", uses: usesOf("Second Wind", 2, "Short rest", "orcpub.dnd.e5.units/rest", spent.wind) },
    { name: "Lay on Hands", text: "Restore hit points.", uses: usesOf("Lay on Hands", 25, "Long rest", LONG_REST, spent.hands) },
    { name: "Sneak Attack", text: "Extra damage.", uses: usesOf("Sneak Attack", 1, "Once per turn", "orcpub.dnd.e5.units/turn") },
    { name: "Dash", text: "Move again." },
  ],
});
const bubbleOf = (name: string) => within(screen.getByRole("group", { name }));

test("a limited-use feature sits in a use bubble, with circles, a pool for more than 8 uses, or no circles each turn", () => {
  render(<CharacterSheet sheet={{ ...sheet, features: usesFeatures({ wind: 1, hands: 5 }) }} />);
  // Without play, the bubbles show the spent uses and take no clicks.
  expect(bubbleOf("Second Wind").getByRole("img", { name: "Second Wind uses spent: 1 of 2" })).toBeTruthy();
  expect(bubbleOf("Second Wind").getByText("Short rest")).toBeTruthy();
  expect(bubbleOf("Lay on Hands").getByText("20")).toBeTruthy();
  expect(bubbleOf("Lay on Hands").queryAllByRole("button")).toHaveLength(0);
  expect(bubbleOf("Sneak Attack").getByText("Once per turn")).toBeTruthy();
  expect(bubbleOf("Sneak Attack").queryByRole("img")).toBeNull();
  expect(screen.queryByRole("group", { name: "Dash" })).toBeNull();
  expect(screen.getByText("Move again.")).toBeTruthy();
});

test("with play, the circles and the pool write the spent uses with play.onUses by the unit and name (ORC-316)", () => {
  const onUses = vi.fn();
  const play = { ...playMocks(), onUses };
  render(<CharacterSheet sheet={{ ...sheet, features: usesFeatures({ wind: 1, hands: 5 }) }} play={play} />);
  const wind = bubbleOf("Second Wind").getByRole("slider", { name: "Second Wind" });
  expect(wind.getAttribute("aria-valuetext")).toBe("1 of 2 spent");
  fireEvent.keyDown(wind, { key: "ArrowRight" });
  expect(onUses).toHaveBeenLastCalledWith({ units: "orcpub.dnd.e5.units/rest", name: "Second Wind" }, 2);
  fireEvent.click(bubbleOf("Lay on Hands").getByRole("button", { name: "Spend 1 Lay on Hands" }));
  expect(onUses).toHaveBeenLastCalledWith({ units: LONG_REST, name: "Lay on Hands" }, 6);
  fireEvent.click(bubbleOf("Lay on Hands").getByRole("button", { name: "Regain 1 Lay on Hands" }));
  expect(onUses).toHaveBeenLastCalledWith({ units: LONG_REST, name: "Lay on Hands" }, 4);
  expect(bubbleOf("Lay on Hands").getByRole("button", { name: "Lay on Hands, 20 of 25 left" })).toBeTruthy();
  // Uses each turn have no circles, also with play.
  expect(bubbleOf("Sneak Attack").queryByRole("slider")).toBeNull();
});

/** The play handlers of the sheet page, as mocks. */
const playMocks = () => ({
  status: "",
  onHitPoints: vi.fn(),
  onHitDice: vi.fn(),
  onDeathSaves: vi.fn(),
  onUses: vi.fn(),
  onConditions: vi.fn(),
  onInspiration: vi.fn(),
  onAcPick: vi.fn(),
});

test("with play, the Inspiration box is a button: a click sets inspiration, and a second click removes it (ORC-324)", () => {
  const play = playMocks();
  const { rerender } = render(<CharacterSheet sheet={sheet} play={play} />);
  const box = screen.getByRole("button", { name: "Inspiration" });
  expect([box.getAttribute("aria-pressed"), box.textContent]).toEqual(["false", "Inspiration"]);
  fireEvent.click(box);
  expect(play.onInspiration).toHaveBeenLastCalledWith(true);
  rerender(<CharacterSheet sheet={{ ...sheet, inspiration: true }} play={play} />);
  // The mark is hidden from a screen reader: aria-pressed says it.
  expect([box.getAttribute("aria-pressed"), box.textContent]).toEqual(["true", "Inspiration"]);
  expect(box.querySelector('[data-inspiration-mark] svg[data-icon="check"]')?.getAttribute("aria-hidden")).toBe("true");
  fireEvent.click(box);
  expect(play.onInspiration).toHaveBeenLastCalledWith(false);
});

test("without play, the Inspiration box shows the mark and is not a button; the ability boxes are not buttons", () => {
  render(<CharacterSheet sheet={{ ...sheet, inspiration: true }} />);
  expect(screen.queryByRole("button", { name: "Inspiration" })).toBeNull();
  expect(
    within(screen.getByRole("group", { name: "Inspiration" }))
      .getByRole("img", { name: "Has inspiration" })
      .querySelector('svg[data-icon="check"]'),
  ).not.toBeNull();
  expect(screen.queryByRole("button", { name: /highlight the skills/ })).toBeNull();
  expect(screen.getByLabelText("STR").textContent).toBe("16+3");
});

/** The names of the skill lines with the ability highlight. */
const highlighted = () => [...document.querySelectorAll("li[data-highlight]")].map((line) => line.textContent);

test("with play, each ability box is a button that highlights the skills of its ability, and nothing else (ORC-324)", () => {
  render(<CharacterSheet sheet={sheet} play={playMocks()} />);
  const str = screen.getByRole("button", { name: "Strength: highlight the skills" });
  const int = screen.getByRole("button", { name: "Intelligence: highlight the skills" });
  const con = screen.getByRole("button", { name: "Constitution: highlight the skills" });
  expect(document.getElementById(str.getAttribute("aria-describedby") ?? "")?.textContent).toBe("16 +3");
  expect([str, int, con].map((box) => box.getAttribute("aria-pressed"))).toEqual(["false", "false", "false"]);
  expect(highlighted()).toEqual([]);
  // A hover shows the skills; the saving throw has no highlight.
  fireEvent.mouseEnter(str);
  expect(highlighted()).toEqual(["+5 Athletics STR"]);
  fireEvent.mouseLeave(str);
  expect(highlighted()).toEqual([]);
  // A focus that is not a keyboard focus shows nothing. jsdom does not match :focus-visible, so e2e
  // (inspiration.spec.ts) checks the keyboard focus with Tab.
  act(() => int.focus());
  expect(highlighted()).toEqual([]);
  act(() => int.blur());
  // A click keeps them; a click on another ability moves them; a second click removes them.
  fireEvent.click(str);
  fireEvent.mouseLeave(str);
  expect([highlighted(), str.getAttribute("aria-pressed")]).toEqual([["+5 Athletics STR"], "true"]);
  fireEvent.click(int);
  expect([highlighted(), str.getAttribute("aria-pressed"), int.getAttribute("aria-pressed")]).toEqual([["-1 History INT"], "false", "true"]);
  fireEvent.click(int);
  expect([highlighted(), int.getAttribute("aria-pressed")]).toEqual([[], "false"]);
  // Constitution has no skill, so it shows nothing.
  fireEvent.click(con);
  expect([highlighted(), con.getAttribute("aria-pressed")]).toEqual([[], "true"]);
  // A second click hides the skills at once, while the mouse is still on the box and the box has the focus.
  fireEvent.mouseEnter(str);
  act(() => str.focus());
  fireEvent.click(str);
  expect(highlighted()).toEqual(["+5 Athletics STR"]);
  fireEvent.click(str);
  expect([highlighted(), document.activeElement]).toEqual([[], str]);
  fireEvent.mouseLeave(str);
  expect(highlighted()).toEqual([]);
});

// ORC-203: a typed homebrew feature draws the same bubble as an engine entry. sheet.test.ts and e2e check the sections.
test("scaled-uses draws its homebrew uses as the engine's: circles, a pool above 8, and no bubble for 0 uses or fewer", () => {
  render(<CharacterSheet sheet={toSheet(expectedOf("scaled-uses-fighter-6-barbarian-1"), {})} />);
  expect(bubbleOf("Action Surge").getByRole("img", { name: "Action Surge uses spent: 0 of 1" })).toBeTruthy();
  expect(bubbleOf("Stormcaller").getByRole("img", { name: "Stormcaller uses spent: 0 of 3" })).toBeTruthy();
  expect(bubbleOf("Rolling Gait").getByRole("img").querySelectorAll(".ui-slot-circle")).toHaveLength(7);
  expect(screen.getByRole("group", { name: "Crashing Wave" }).querySelector(".ui-use-pool-count")?.textContent).toBe("30 / 30");
  expect(screen.getByRole("group", { name: "Deep Lungs" }).querySelector(".ui-use-pool-count")?.textContent).toBe("15 / 15");
  // The unit day is "Dawn".
  expect(bubbleOf("Deep Lungs").getByText("Dawn")).toBeTruthy();
  // Undertow resolves to -1 uses: a plain feature.
  expect(screen.queryByRole("group", { name: "Undertow" })).toBeNull();
  expect(screen.getByText("You pull one creature within 30 feet 10 feet toward you.")).toBeTruthy();
});

/** Renders the sheet as a phone does: the sheet is `width` pixels wide. */
function renderAtWidth(width: number, element: ReactElement) {
  vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(width);
  render(element);
}

test("under 720px the sheet is in tabs: Stats, Spells, Features and More, under the header", () => {
  renderAtWidth(390, <CharacterSheet sheet={sheet} />);
  const tabs = screen.getByRole("tablist", { name: "Sheet sections" });
  expect(
    within(tabs)
      .getAllByRole("tab")
      .map((tab) => tab.textContent),
  ).toEqual(["Stats", "Spells", "Features", "More"]);
  expect(screen.getByRole("heading", { level: 1, name: "Brannor Ironfist" })).toBeTruthy();
  expect(screen.getByLabelText("Race").textContent).toBe("Dwarf (Hill Dwarf)");

  // Stats is open first: the vitals, the attacks, then the ability column.
  let panel = screen.getByRole("tabpanel");
  expect(within(panel).getByLabelText("Armor Class").textContent).toBe("19");
  expect(within(panel).getByRole("group", { name: "Attacks" })).toBeTruthy();
  expect(within(panel).getByLabelText("STR").textContent).toBe("16+3");
  expect(within(panel).getByLabelText("Passive Perception").textContent).toBe("11");
  expect(screen.queryByText("Second Wind")).toBeNull();

  fireEvent.click(within(tabs).getByRole("tab", { name: "Spells" }));
  expect(within(screen.getByRole("tabpanel")).getByRole("group", { name: "Spellcasting" })).toBeTruthy();

  fireEvent.click(within(tabs).getByRole("tab", { name: "Features" }));
  expect(within(screen.getByRole("tabpanel")).getByText("Second Wind")).toBeTruthy();

  fireEvent.click(within(tabs).getByRole("tab", { name: "More" }));
  panel = screen.getByRole("tabpanel");
  expect(within(panel).getByRole("group", { name: "Equipment" })).toBeTruthy();
  expect(within(panel).getByLabelText("Tools").textContent).toBe("Smith's Tools (+2)");
  expect(within(panel).getByLabelText("Resistances").textContent).toBe("poison");
  expect(within(panel).getByRole("group", { name: "AC by armor" })).toBeTruthy();
  expect(within(panel).getByText("Hates boats")).toBeTruthy();
});

test("a tab with nothing in it does not show: no Spells tab for a non-caster, no Features tab without features", () => {
  renderAtWidth(390, <CharacterSheet sheet={{ ...sheet, spellcasting: null, features: { ...sheet.features, actions: [] } }} />);
  expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual(["Stats", "More"]);
});

test("at 720px and wider, and in the builder preview, the sheet has no tabs", () => {
  renderAtWidth(720, <CharacterSheet sheet={sheet} />);
  expect(screen.queryByRole("tablist")).toBeNull();
  expect(screen.getByText("Second Wind")).toBeTruthy();
  cleanup();
  renderAtWidth(390, <CharacterSheet sheet={sheet} preview />);
  expect(screen.queryByRole("tablist")).toBeNull();
});

// ORC-176: layout fixes from the level 20 audit.
test("an expertise skill has a ringed mark named Expertise, and no text tag", () => {
  const skills = sheet.skills.map((skill) => (skill.key === "athletics" ? { ...skill, expertise: true } : skill));
  render(<CharacterSheet sheet={{ ...sheet, skills }} />);
  const line = screen.getByText("+5 Athletics").closest("li")!;
  expect(within(line).getByRole("img", { name: "Expertise" })).toBeTruthy();
  expect(line.textContent).toBe("+5 Athletics STR");
});

test("the speed qualifier and the other speeds are separate small lines under the first speed", () => {
  render(
    <CharacterSheet
      sheet={{
        ...sheet,
        speeds: [
          { feet: 60, label: "unarmored" },
          { feet: 30, label: "armored" },
        ],
      }}
    />,
  );
  const speed = screen.getByRole("group", { name: "Speed" });
  expect(speed.textContent).toBe("60 ft. unarmored30 ft. armored");
  // The qualifier is not in the large number font.
  expect(within(speed).getByText("unarmored").className).toContain("text-[9.5px]");
});

test("a spell's mark is a muted superscript before the comma, and a screen reader reads the source", () => {
  render(<CharacterSheet sheet={tieflingWarlock()} />);
  const item = within(spellsRow("Cantrips")).getAllByRole("listitem")[1]!;
  expect(item.className).toBe("");
  const mark = within(item).getByText("\u2020");
  expect(mark.tagName).toBe("SUP");
  expect(mark.getAttribute("aria-hidden")).toBe("true");
  expect(mark.className).toContain("text-ink-muted");
  expect(within(item).getByText("(Tiefling)").className).toBe("sr-only");
});

const cls = (name: string, level: number) => ({ key: name.toLowerCase(), name, level, hitDie: 8, subclass: null });
const marksOf = (tableSources: string[], classes: Sheet["classes"], keyed = new Set(tableSources)) =>
  Object.fromEntries([...sourceMarks(tableSources, classes, keyed)].map(([source, mark]) => [source, mark.kind === "tag" ? "tag" : mark.symbol]));

test("the source with the most spells has no mark, the second has † and the third has ‡", () => {
  const table = ["Wizard", "Wizard", "Wizard", "Tiefling", "Cleric", "Cleric"];
  expect(marksOf(table, [cls("Wizard", 3), cls("Cleric", 3)])).toEqual({ Cleric: "\u2020", Tiefling: "\u2021" });
  // One source: no marks.
  expect(marksOf(["Wizard", "Wizard"], [cls("Wizard", 3)])).toEqual({});
});

test("a tie goes to a class over a race, then to the higher class level, then to the class taken first", () => {
  expect(marksOf(["Tiefling", "Warlock"], [cls("Warlock", 1)])).toEqual({ Tiefling: "\u2020" });
  expect(marksOf(["Cleric", "Wizard"], [cls("Cleric", 2), cls("Wizard", 3)])).toEqual({ Cleric: "\u2020" });
  expect(marksOf(["Wizard", "Cleric"], [cls("Cleric", 3), cls("Wizard", 3)])).toEqual({ Wizard: "\u2020" });
  // Two sources that are not classes: A to Z.
  expect(marksOf(["Wizard", "Wizard", "Tiefling", "Magic Initiate"], [cls("Wizard", 3)])).toEqual({ "Magic Initiate": "\u2020", Tiefling: "\u2021" });
});

test("with 4 or more sources in the table, every source but the main one has its name as a tag", () => {
  const table = ["Wizard", "Wizard", "Cleric", "Tiefling", "Magic Initiate"];
  expect(marksOf(table, [cls("Wizard", 3), cls("Cleric", 1)])).toEqual({ Cleric: "tag", Tiefling: "tag", "Magic Initiate": "tag" });
});

test("a source with no caster row label to hold the key has a tag in place of a mark", () => {
  expect(marksOf(["Wizard", "Wizard", "Tiefling"], [cls("Wizard", 3)], new Set(["Wizard"]))).toEqual({ Tiefling: "tag" });
  // The next source with a label gets †, not ‡.
  const table = ["Wizard", "Wizard", "Wizard", "Cleric", "Cleric", "Tiefling"];
  expect(marksOf(table, [cls("Wizard", 3), cls("Cleric", 1)], new Set(["Wizard", "Tiefling"]))).toEqual({ Cleric: "tag", Tiefling: "\u2020" });
});

test("three sources and a cantrip-only race: ‡ in the table and on its row, and the race line does not count", () => {
  const spell = (key: string, source: string) => ({ key, name: key, source, ability: "int" as const, alwaysPrepared: false, prepared: false, castNote: null });
  const caster = (name: string, saveDc: number) => ({ name, ability: "int" as const, saveDc, attackBonus: saveDc - 8, prepares: false, canPrepare: null });
  const spellcasting = {
    slots: [{ level: 1, count: 4, spent: 0 }],
    pact: null,
    casters: [caster("Wizard", 15), caster("Cleric", 13), caster("Tiefling", 12), caster("High Elf", 14)],
    byLevel: [
      { level: 0, spells: [spell("Mending", "High Elf")] },
      {
        level: 1,
        spells: [
          spell("Alarm", "Wizard"),
          spell("Sleep", "Wizard"),
          spell("Shield", "Wizard"),
          spell("Bless", "Cleric"),
          spell("Bane", "Cleric"),
          spell("Hellish Rebuke", "Tiefling"),
        ],
      },
    ],
    knownModes: {},
  };
  render(<CharacterSheet sheet={{ ...sheet, classes: [cls("Wizard", 5), cls("Cleric", 1)], spellcasting }} />);
  expect(spellNames("1st")).toEqual(["Alarm", "Bane\u2020 (Cleric)", "Bless\u2020 (Cleric)", "Hellish Rebuke\u2021 (Tiefling)", "Shield", "Sleep"]);
  expect(screen.getByText("Tiefling \u2021")).toBeTruthy();
  expect(screen.getByText("Cleric \u2020")).toBeTruthy();
  expect(screen.getByText("Mending").closest("li")!.textContent).toBe("Mending (High Elf, INT, DC 14, +6)");
});

test("a tag is kept on one line, and the list item itself can wrap", () => {
  const four = tieflingWarlock();
  const spell = (key: string, source: string) => ({ key, name: key, source, ability: "cha" as const, alwaysPrepared: false, prepared: false, castNote: null });
  four.spellcasting!.byLevel[1]!.spells.push(spell("Bless", "Cleric"), spell("Sleep", "Magic Initiate"));
  render(<CharacterSheet sheet={four} />);
  expect(spellNames("1st")).toEqual(["Armor of Agathys", "Bless Cleric", "Hellish Rebuke Tiefling", "Hex", "Sleep Magic Initiate"]);
  const item = within(spellsRow("1st")).getAllByRole("listitem")[2]!;
  expect(item.className).toBe("");
  expect(within(item).getByText("Tiefling").parentElement!.className).toBe("whitespace-nowrap");
  // With tags, the row label has no symbol.
  expect(screen.getByText("Tiefling · Warlock")).toBeTruthy();
});

// Spell records (ORC-280): the name of a spell comes from its record, and its cast note follows it.
/** A known spell of the Hill Dwarf, which does not prepare, with the name the app makes from its key. */
const known = (key: string, name: string, castNote: string | null = null): KnownSpell => ({
  key,
  name,
  source: "Hill Dwarf",
  ability: "wis",
  alwaysPrepared: false,
  prepared: false,
  castNote,
});
/** The Hill Dwarf sheet with these 1st-level spells. */
const withFirstLevel = (...spells: KnownSpell[]): Sheet => ({
  ...sheet,
  spellcasting: { ...sheet.spellcasting!, byLevel: [...sheet.spellcasting!.byLevel, { level: 1, spells }] },
});

test("an SRD spell shows its record name, and a spell with no record shows the name from its key, A to Z by the shown name", () => {
  render(
    <CharacterSheet
      sheet={withFirstLevel(
        known("tsunami", "Tsunami"),
        known("arcanists-magic-aura", "Arcanists Magic Aura"),
        known("antipathy-sympathy", "Antipathy Sympathy"),
        known("cone-of-cold", "Cone Of Cold"),
      )}
    />,
  );
  expect(spellNames("1st")).toEqual(["Antipathy/Sympathy", "Arcanist's Magic Aura", "Cone of Cold", "Tsunami"]);
});

test("a pack spell shows its pack name, and a pack spell with an SRD key shows the pack record", () => {
  const spell = (key: string, name: string) => ({ "~:key": `~:${key}`, "~:name": name, "~:level": 1, "~:school": "evocation" });
  useHomebrew.setState({
    homebrew: { Reef: { "~:orcpub.dnd.e5/spells": { "~:zapc": spell("zapc", "Zap Cantrip of Doom's Day"), "~:alarm": spell("alarm", "Reef Alarm") } } },
  });
  render(<CharacterSheet sheet={withFirstLevel(known("zapc", "Zapc"), known("alarm", "Alarm"), known("bless", "Bless"))} />);
  expect(spellNames("1st")).toEqual(["Bless", "Reef Alarm", "Zap Cantrip of Doom's Day"]);
});

test("a cast note is in parentheses after the name and its mark, in the table and on a cantrip line", () => {
  const warlock = tieflingWarlock();
  warlock.spellcasting!.byLevel[1]!.spells[0] = { ...warlock.spellcasting!.byLevel[1]!.spells[0]!, castNote: "once per long rest" };
  warlock.spellcasting!.byLevel[1]!.spells[1] = { ...warlock.spellcasting!.byLevel[1]!.spells[1]!, castNote: "at will" };
  render(<CharacterSheet sheet={warlock} />);
  expect(spellNames("1st")).toEqual(["Armor of Agathys", "Hellish Rebuke† (Tiefling) (once per long rest)", "Hex (at will)"]);
  cleanup();
  const line = { ...sheet.spellcasting!, byLevel: [{ level: 0, spells: [known("guidance", "Guidance", "at will"), known("light", "Light")] }] };
  render(<CharacterSheet sheet={{ ...sheet, spellcasting: line }} />);
  expect(within(screen.getByRole("group", { name: "Spellcasting" })).getByRole("listitem").textContent).toBe(
    "Guidance (at will), Light (Hill Dwarf, WIS, DC 11, +3)",
  );
});

test("warlock-10-drow shows the cast notes from built, and record names", () => {
  render(<CharacterSheet sheet={toSheet(expectedOf("warlock-10-drow"), strictOf("warlock-10-drow"))} />);
  expect(spellNames("1st")).toEqual(
    expect.arrayContaining([
      "Detect Poison and Disease (Book of Ancient Secrets Ritual)",
      "Illusory Script (Book of Ancient Secrets Ritual)",
      "Speak with Animals (at will)",
    ]),
  );
  expect(spellNames("3rd")).toContain("Slow (at will)");
  expect(spellNames("Cantrips")).toContain("Spare the Dying (uses Book of Shadows)");
});

test("a Life cleric's domain spells show with no note", async () => {
  const e = (await loadEngine(), engine());
  const entity = e.select(e.setClass(e.emptyCharacter(), 0, "cleric"), ["class", "cleric", "levels", "level-1", "divine-domain"], "life-domain");
  const built = e.evaluate(entity).built;
  // built has the qualifier "Domain" on each domain spell.
  const domain = built["spells-known"][1]!.__entries.filter(([, spell]) => spell.qualifier === "Domain").map(([[, key]]) => key);
  expect(domain.sort()).toEqual(["bless", "cure-wounds"]);
  render(<CharacterSheet sheet={toSheet(built, entity)} />);
  expect(spellNames("1st")).toEqual(["Bless", "Cure Wounds"]);
});

test("until the SRD spells load, the section shows its levels and slots and no spell names", async () => {
  // A new page load: the spell chunk is not loaded yet.
  vi.resetModules();
  const { CharacterSheet: FreshSheet } = await import("./CharacterSheet.tsx");
  render(<FreshSheet sheet={toSheet(expectedOf("wizard-1"), strictOf("wizard-1"))} />);
  const section = screen.getByRole("group", { name: "Spellcasting" });
  expect(
    within(section)
      .getAllByRole("rowheader")
      .map((cell) => cell.textContent),
  ).toEqual(["Cantrips", "1st"]);
  expect(within(spellsRow("1st")).getByRole("img", { name: "1st-level slots: 0 of 2" })).toBeTruthy();
  expect(within(section).queryAllByRole("listitem")).toEqual([]);
  expect(within(section).queryByText(/Minor Illusion|Alarm/)).toBeNull();
  // Then the names show.
  expect(await within(section).findByText("Alarm")).toBeTruthy();
  expect(spellNames("1st")).toEqual(["Alarm", "Burning Hands", "Charm Person", "Color Spray"]);
});

// The ways into the Spells panel (ORC-285).
test("with onOpenSpells, an All spells button ends the section rule, and each spell name, cantrips and a cantrip line included, opens the panel at it", () => {
  const open = vi.fn();
  render(<CharacterSheet sheet={toSheet(expectedOf("wizard-1"), strictOf("wizard-1"))} onOpenSpells={open} />);
  const section = screen.getByRole("group", { name: "Spellcasting" });
  const all = within(section).getByRole("button", { name: "All spells" });
  // The button is in the label row, after the label, and is not a part of the section's name.
  expect(all.closest(".ui-framed-box-foot")).toBe(section.lastElementChild);
  fireEvent.click(all);
  expect(open).toHaveBeenLastCalledWith();
  fireEvent.click(within(spellsRow("1st")).getByRole("button", { name: "Charm Person" }));
  expect(open).toHaveBeenLastCalledWith({ key: "charm-person", source: "Wizard" });
  fireEvent.click(within(spellsRow("Cantrips")).getByRole("button", { name: "Acid Splash" }));
  expect(open).toHaveBeenLastCalledWith({ key: "acid-splash", source: "Wizard" });
  // The High Elf cantrip line.
  fireEvent.click(within(section).getByRole("button", { name: "Minor Illusion" }));
  expect(open).toHaveBeenLastCalledWith({ key: "minor-illusion", source: "High Elf" });
  // The names keep their text and order.
  expect(spellNames("1st")).toEqual(["Alarm", "Burning Hands", "Charm Person", "Color Spray"]);
});

test("without onOpenSpells, as in the builder preview, there is no All spells button and the names are plain text", () => {
  render(<CharacterSheet sheet={toSheet(expectedOf("wizard-1"), strictOf("wizard-1"))} preview />);
  const section = screen.getByRole("group", { name: "Spellcasting" });
  expect(within(section).queryAllByRole("button")).toEqual([]);
  expect(spellNames("1st")).toEqual(["Alarm", "Burning Hands", "Charm Person", "Color Spray"]);
});

/** A sheet with the rows of fighter-20, plate and a shield worn, and the AC pick `pick` (ORC-325). */
const pickedSheet = (pick: unknown = undefined) =>
  toSheet(expectedOf("fighter-20"), pick === undefined ? {} : { "~:orcpub.entity.strict/values": { "~:orc-alchemy.play/ac-pick": pick } });
/** The rows of the table "AC by armor" as [dot, armor, tag, AC, bold], from the text that shows. */
const acTable = () =>
  within(screen.getByRole("table", { name: "Armor class options" }))
    .getAllByRole("row")
    .slice(1)
    .map((row) => {
      const [dot, armor, ac] = [...row.querySelectorAll("td")];
      const shown = (cell: Element | undefined) => cell?.querySelector("span > span:not([aria-hidden])")?.textContent;
      return [dot?.textContent, shown(armor), armor?.querySelector(".uppercase")?.textContent ?? "", shown(ac), row.className.includes("font-semibold")];
    });

test("with play, the Armor Class box is a button that opens the menu Armor class shows; a pick calls play.onAcPick (ORC-325)", async () => {
  const play = playMocks();
  render(<CharacterSheet sheet={pickedSheet()} play={play} />);
  const box = screen.getByRole("button", { name: "Armor class, 20" });
  expect([box.getAttribute("aria-haspopup"), box.textContent]).toEqual(["menu", "20Armor Class"]);
  // The box is not a group in play: the button names it.
  expect(screen.queryByRole("group", { name: "Armor Class" })).toBeNull();
  expect(await optionNames(box)).toEqual([
    "Worn armor 20",
    "Chain Mail + Shield 18",
    "Chain Mail 16",
    "Plate + Shield 20",
    "Plate 18",
    "Unarmored + Shield 15",
    "Unarmored 13",
  ]);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  // Without a pick, Worn armor is checked.
  expect(
    within(menu)
      .getByRole("menuitemradio", { name: /^Worn armor/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.keyDown(menu, { key: "Escape" });
  await pickOption(box, "Chain Mail 16");
  expect(play.onAcPick).toHaveBeenLastCalledWith({ armor: "chain-mail", shield: null });
  await pickOption(box, "Unarmored 13");
  expect(play.onAcPick).toHaveBeenLastCalledWith({ armor: null, shield: null });
  await pickOption(box, "Worn armor 20");
  expect(play.onAcPick).toHaveBeenLastCalledWith(null);
  expect(play.onAcPick).toHaveBeenCalledTimes(3);
});

test("a pick changes only the number in the box, checks its row in the menu, and marks its row in the table; the worn row keeps its tag (ORC-325)", async () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:chain-mail", "~:shield": null })} play={playMocks()} />);
  const box = screen.getByRole("button", { name: "Armor class, 16" });
  expect(box.textContent).toBe("16Armor Class");
  expect(acTable()).toEqual([
    ["", "Chain Mail + Shield", "", "18", false],
    ["E", "Chain Mail", "", "16", true],
    ["", "Plate + Shield", "worn", "20", false],
    ["", "Plate", "", "18", false],
    ["", "Unarmored + Shield", "", "15", false],
    ["", "Unarmored", "", "13", false],
  ]);
  expect(screen.getAllByRole("img", { name: "Shows in the Armor Class box" })).toHaveLength(1);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  expect(
    within(menu)
      .getAllByRole("menuitemradio")
      .filter((item) => item.getAttribute("aria-checked") === "true")
      .map((item) => item.textContent),
  ).toEqual(["Chain Mail 16"]);
});

test("a pick of a pair that is not in the table is ignored: the worn AC shows, and Worn armor is checked (ORC-325)", async () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:leather", "~:shield": null })} play={playMocks()} />);
  const box = screen.getByRole("button", { name: "Armor class, 20" });
  expect(acTable().filter(([dot]) => dot === "E")).toEqual([["E", "Plate + Shield", "worn", "20", true]]);
  fireEvent.click(box);
  const menu = await screen.findByRole("menu", { name: "Armor class shows" });
  expect(
    within(menu)
      .getByRole("menuitemradio", { name: /^Worn armor/ })
      .getAttribute("aria-checked"),
  ).toBe("true");
});

test("without play, the Armor Class box is not a button; the table shows the same marks (ORC-325)", () => {
  render(<CharacterSheet sheet={pickedSheet({ "~:armor": "~:plate", "~:shield": null })} />);
  expect(screen.queryByRole("button", { name: /^Armor class/ })).toBeNull();
  expect(screen.getByLabelText("Armor Class").textContent).toBe("18");
  expect(acTable().filter(([dot, , tag]) => dot === "E" || tag === "worn")).toEqual([
    ["", "Plate + Shield", "worn", "20", false],
    ["E", "Plate", "", "18", true],
  ]);
});

test("with play, the status text and the concentration note show in the toast, not in the vitals panel (ORC-326)", () => {
  const onDismissNote = vi.fn();
  const play = { ...playMocks(), status: "24 damage.", statusKey: 1, concentrationNote: { spell: "bless", dc: 12 }, onDismissNote };
  render(<CharacterSheet sheet={{ ...sheet, concentration: "bless" }} play={play} />);
  const toast = document.querySelector(".ui-toast")!;
  // The toast is out of the sheet, at the end of the body, so it takes no space in the vitals panel.
  expect(toast.parentElement).toBe(document.body);
  expect(screen.getByRole("article").querySelector("[role=status]")).toBeNull();
  expect(toast.querySelector("[data-toast-status]")?.textContent).toBe("24 damage.");
  const note = screen.getByRole("status", { name: "Concentration note" });
  expect(note.textContent).toBe("Concentration on Bless: Constitution save, DC 12. Dismiss");
  fireEvent.click(within(note).getByRole("button", { name: "Dismiss the concentration note" }));
  expect(onDismissNote).toHaveBeenCalledOnce();
});

test("without play, as a read-only sheet, there is no toast (ORC-326)", () => {
  render(<CharacterSheet sheet={sheet} />);
  expect(document.querySelector(".ui-toast")).toBeNull();
});
