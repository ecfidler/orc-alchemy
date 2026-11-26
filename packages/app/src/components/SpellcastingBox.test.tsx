// The tests of the Spellcasting section of the character sheet. Each test renders the whole sheet.
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { engine, loadEngine } from "../engine/engine.ts";
import { type KnownSpell, type Sheet, toSheet } from "../engine/sheet.ts";
import { ordinal } from "../engine/sheet-text.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { sourceMarks } from "./SpellcastingBox.tsx";
import { expectedOf, renderAtWidth, sheet, sheetTestHooks, strictOf } from "./test-sheet.ts";

sheetTestHooks();

/** The Spellcasting table row whose level cell has this text. */
const spellsRow = (level: string) => screen.getByRole("rowheader", { name: level }).closest("tr")!;
/** The text of each spell in that row, its source tag or mark included (a mark is read as the source in brackets). */
// A non-breaking space keeps a tag on the line of the name's last word.
const spellNames = (level: string) =>
  within(spellsRow(level))
    .queryAllByRole("listitem")
    .map((item) => item.textContent?.replace(/\u00a0/g, " "));

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

// ORC-176: layout fixes from the level 20 audit.
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
