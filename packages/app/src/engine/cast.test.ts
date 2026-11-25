import { beforeAll, expect, test } from "vitest";
import { asksFirst, type CastAction, type CastSlots, type CastSpell, castChoices, castSlots, castStatus, concentrationQuestion } from "./cast.ts";
import type { SpellRecord } from "./spell-records.ts";
import { loadSpellContent, type SpellContent } from "./spells.ts";

let srd: SpellContent;
beforeAll(async () => {
  srd = await loadSpellContent();
});
const record = (key: string): SpellRecord => srd.get(key)!;

/** A known spell of a class that does not prepare, such as a sorcerer. */
const known = (key: string, level: number, more: Partial<CastSpell> = {}): CastSpell => ({
  key,
  level,
  source: "Sorcerer",
  prepared: false,
  castNote: null,
  ...more,
});

const CASTERS: CastSlots["casters"] = [
  { name: "Sorcerer", ability: "cha", saveDc: 13, attackBonus: 5, prepares: false, canPrepare: null },
  { name: "Wizard", ability: "int", saveDc: 13, attackBonus: 5, prepares: true, canPrepare: 8 },
  { name: "Warlock", ability: "cha", saveDc: 13, attackBonus: 5, prepares: false, canPrepare: null },
];

/** Slots of a sorcerer 5: 4 1st, 3 2nd and 2 3rd. `spent` gives the spent slots of each level. */
const sorcerer = (spent: [number, number, number] = [1, 1, 0]): CastSlots => ({
  slots: [
    { level: 1, count: 4, spent: spent[0] },
    { level: 2, count: 3, spent: spent[1] },
    { level: 3, count: 2, spent: spent[2] },
  ],
  pact: null,
  casters: CASTERS,
});

/** A wizard 5 / warlock 3: other slots 1st to 3rd, and 2 pact slots of the 2nd level. */
const wizardWarlock = (pactSpent = 0): CastSlots => ({ ...sorcerer(), pact: { slotLevel: 2, count: 2, spent: pactSpent } });

/** A warlock 11: only pact slots, 3 of the 5th level. */
const warlock = (spent = 1): CastSlots => ({ slots: [], pact: { slotLevel: 5, count: 3, spent }, casters: CASTERS });

test("Cast spends a slot of the spell level; the menu lists each higher level with its calculated amount and the slots left", () => {
  expect(castChoices(known("burning-hands", 1), record("burning-hands"), sorcerer(), null)).toEqual({
    kind: "slots",
    main: { group: 1, level: 1, left: 3 },
    menu: [
      { group: 2, level: 2, left: 2, label: "2nd level", amount: "+1d6", leftText: "2 left" },
      { group: 3, level: 3, left: 2, label: "3rd level", amount: "+2d6", leftText: "2 left" },
    ],
    none: false,
    hint: "1st-level slot · 3 left",
    menuText: null,
  });
});

test("a level with no slot left is disabled and says 'none left'; a level with no slots is not in the menu", () => {
  const control = castChoices(known("magic-missile", 1), record("magic-missile"), sorcerer([1, 3, 0]), null);
  expect(control.kind === "slots" && control.menu?.map((entry) => [entry.label, entry.amount, entry.leftText, entry.left])).toEqual([
    ["2nd level", "+1 dart", "none left", 0],
    ["3rd level", "+2 darts", "2 left", 2],
  ]);
  // A 2nd-level spell lists no 1st level.
  const hold = castChoices(known("hold-person", 2), record("hold-person"), sorcerer(), null);
  expect(hold.kind === "slots" && [hold.main?.level, hold.menu?.map((entry) => entry.label)]).toEqual([2, ["3rd level"]]);
});

test("with no slot of the spell level left, Cast is disabled and the menu works; with none of the spell level or higher, both are disabled", () => {
  const low = castChoices(known("burning-hands", 1), record("burning-hands"), sorcerer([4, 1, 0]), null);
  expect(low.kind === "slots" && [low.main?.left, low.none, low.hint]).toEqual([0, false, "No 1st-level slot left. Pick a higher level."]);
  const none = castChoices(known("burning-hands", 1), record("burning-hands"), sorcerer([4, 3, 2]), null);
  expect(none.kind === "slots" && [none.none, none.hint]).toEqual([true, "Each slot that can cast this spell is spent."]);
});

test("the app never spends a slot of a higher level without a choice: Cast spends only the spell level", () => {
  for (const spent of [
    [0, 0, 0],
    [4, 0, 0],
    [4, 3, 0],
  ] as const) {
    const control = castChoices(known("burning-hands", 1), record("burning-hands"), sorcerer([...spent]), null);
    expect(control.kind === "slots" && control.main?.level).toBe(1);
  }
});

test("with only one slot level that can cast the spell, the control is a plain Cast button with no menu", () => {
  expect(castChoices(known("fireball", 3), record("fireball"), sorcerer(), null)).toEqual({
    kind: "slots",
    main: { group: 3, level: 3, left: 2 },
    menu: null,
    none: false,
    hint: "3rd-level slot · 2 left",
    menuText: null,
  });
  const spent = castChoices(known("fireball", 3), record("fireball"), sorcerer([0, 0, 2]), null);
  expect(spent.kind === "slots" && [spent.none, spent.hint]).toEqual([true, "3rd-level slot · none left"]);
});

test("pact slots and other slots: Cast spends an other slot, and the menu has 'Pact (2nd)' when the pact level is the spell level or higher", () => {
  const missile = castChoices(known("magic-missile", 1), record("magic-missile"), wizardWarlock(), null);
  expect(missile.kind === "slots" && [missile.main?.group, missile.menu?.map((entry) => [entry.label, entry.amount, entry.leftText])]).toEqual([
    1,
    [
      ["2nd level", "+1 dart", "2 left"],
      ["3rd level", "+2 darts", "2 left"],
      ["Pact (2nd)", "+1 dart", "2 left"],
    ],
  ]);
  const hold = castChoices(known("hold-person", 2), record("hold-person"), wizardWarlock(1), null);
  expect(hold.kind === "slots" && hold.menu?.map((entry) => [entry.label, entry.amount, entry.leftText])).toEqual([
    ["3rd level", "+1 humanoid", "2 left"],
    ["Pact (2nd)", "", "1 left"],
  ]);
  // A 3rd-level spell: the pact slots are of a lower level, so they are not in the menu.
  const fireball = castChoices(known("fireball", 3), record("fireball"), wizardWarlock(), null);
  expect(fireball.kind === "slots" && fireball.menu).toBeNull();
  expect(castSlots(wizardWarlock(), 3)).toEqual([{ group: 3, level: 3, left: 2 }]);
});

test("a warlock with no other slots: Cast spends a pact slot, with no menu, and the hint has the amount at the pact level", () => {
  expect(castChoices(known("hellish-rebuke", 1, { source: "Warlock" }), record("hellish-rebuke"), warlock(), null)).toEqual({
    kind: "slots",
    main: { group: "pact", level: 5, left: 2 },
    menu: null,
    none: false,
    hint: "Pact slot (5th) · 2 left · +4d10 at 5th level",
    menuText: null,
  });
  const bare = castChoices(known("misty-step", 2, { source: "Warlock" }), record("misty-step"), warlock(3), null);
  expect(bare.kind === "slots" && [bare.none, bare.hint]).toEqual([true, "Pact slot (5th) · none left"]);
});

test("a spell with other words shows its text at the bottom of the menu, and its entries have no amount", () => {
  const control = castChoices(known("magic-weapon", 2), record("magic-weapon"), sorcerer(), null);
  expect(control.kind === "slots" && [control.menu?.map((entry) => entry.amount), control.menuText?.slice(0, 40)]).toEqual([
    [""],
    "When you cast this spell using a spell s",
  ]);
  // A spell with no "At Higher Levels" text: entries with no amount, and no text.
  const step = castChoices(known("misty-step", 2), record("misty-step"), sorcerer(), null);
  expect(step.kind === "slots" && [step.menu?.map((entry) => entry.amount), step.menuText]).toEqual([[""], null]);
});

test("a cantrip, an at-will spell and an unprepared spell of a class that prepares have no Cast button", () => {
  const slots = sorcerer();
  expect(castChoices(known("fire-bolt", 0), record("fire-bolt"), slots, null)).toEqual({ kind: "none" });
  expect(castChoices(known("mage-armor", 1, { castNote: "at will" }), record("mage-armor"), slots, null)).toEqual({ kind: "none" });
  expect(castChoices(known("shield", 1, { source: "Wizard", prepared: false }), record("shield"), slots, null)).toEqual({ kind: "none" });
  expect(castChoices(known("shield", 1, { source: "Wizard", prepared: true }), record("shield"), slots, null).kind).toBe("slots");
  // A ritual cast, and a spell with its own uses (ORC-321), have no control yet.
  expect(castChoices(known("alarm", 1, { castNote: "ritual only" }), record("alarm"), slots, null)).toEqual({ kind: "none" });
  expect(castChoices(known("misty-step", 2, { castNote: "once per long rest" }), record("misty-step"), slots, null)).toEqual({ kind: "none" });
  // A spell with no slot of its level or higher.
  expect(castChoices(known("cone-of-cold", 5), record("cone-of-cold"), slots, null)).toEqual({ kind: "none" });
});

test("a cantrip or an at-will spell that needs concentration has the Concentrate button", () => {
  expect(castChoices(known("guidance", 0), record("guidance"), sorcerer(), null)).toEqual({
    kind: "concentrate",
    active: false,
    hint: "This sets the concentration mark and spends nothing.",
  });
  expect(castChoices(known("guidance", 0), record("guidance"), sorcerer(), "guidance")).toEqual({
    kind: "concentrate",
    active: true,
    hint: "You concentrate on this spell.",
  });
  expect(castChoices(known("levitate", 2, { castNote: "at will" }), record("levitate"), sorcerer(), null).kind).toBe("concentrate");
});

const bless: CastAction = { kind: "slot", key: "bless", name: "Bless", level: 1, group: 1, concentration: true };

test("a second concentration spell asks first; the same spell, a spell without concentration and no mark do not", () => {
  expect(asksFirst(bless, "hold-person")).toBe(true);
  expect(asksFirst(bless, "bless")).toBe(false);
  expect(asksFirst(bless, null)).toBe(false);
  expect(asksFirst({ ...bless, concentration: false }, "hold-person")).toBe(false);
  expect(asksFirst({ kind: "concentrate", key: "guidance", name: "Guidance" }, "bless")).toBe(true);
  expect(concentrationQuestion({ ...bless, key: "invisibility", name: "Invisibility", level: 2, group: 2 }, "Hold Person")).toEqual({
    title: "Cast Invisibility?",
    text: "You concentrate on Hold Person. Invisibility also needs concentration, so Hold Person ends.",
    action: "Cast and end Hold Person",
  });
  expect(concentrationQuestion({ kind: "concentrate", key: "guidance", name: "Guidance" }, "Bless").action).toBe("Concentrate and end Bless");
});

test("the status says what the cast did, with the level only for a higher level", () => {
  const missile: CastAction = { kind: "slot", key: "magic-missile", name: "Magic Missile", level: 1, group: 2, concentration: false };
  expect(castStatus(missile, { level: 2, left: 1 })).toBe("Cast Magic Missile at 2nd level. 2nd-level slots −1 (1 left).");
  expect(castStatus({ ...missile, group: 1 }, { level: 1, left: 3 })).toBe("Cast Magic Missile. 1st-level slots −1 (3 left).");
  expect(castStatus({ ...missile, group: "pact" }, { level: 5, left: 0 })).toBe("Cast Magic Missile at 5th level. Pact slots −1 (0 left).");
  expect(castStatus({ kind: "concentrate", key: "guidance", name: "Guidance" })).toBe("Concentrating on Guidance.");
});
