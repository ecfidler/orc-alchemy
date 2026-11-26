import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, expect, test } from "vitest";
import {
  asksFirst,
  type CastAction,
  type CastSlots,
  type CastSpell,
  type CastState,
  castChoices,
  castSlots,
  castStatus,
  concentrationQuestion,
  type FeatureUses,
  INVOCATION_SPELLS,
} from "./cast.ts";
import { loadEngine, type StrictEntity } from "./engine.ts";
import { toSheet } from "./sheet.ts";
import { featureUses } from "./sheet-features.ts";
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

/** The play state of a cast: the slots, the concentration mark and the uses of the features. */
const state = (slots: CastSlots, concentration: string | null = null, uses: readonly FeatureUses[] = []): CastState => ({ slots, concentration, uses });

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
  expect(castChoices(known("burning-hands", 1), record("burning-hands"), state(sorcerer()))).toEqual({
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
  const control = castChoices(known("magic-missile", 1), record("magic-missile"), state(sorcerer([1, 3, 0])));
  expect(control.kind === "slots" && control.menu?.map((entry) => [entry.label, entry.amount, entry.leftText, entry.left])).toEqual([
    ["2nd level", "+1 dart", "none left", 0],
    ["3rd level", "+2 darts", "2 left", 2],
  ]);
  // A 2nd-level spell lists no 1st level.
  const hold = castChoices(known("hold-person", 2), record("hold-person"), state(sorcerer()));
  expect(hold.kind === "slots" && [hold.main?.level, hold.menu?.map((entry) => entry.label)]).toEqual([2, ["3rd level"]]);
});

test("with no slot of the spell level left, Cast is disabled and the menu works; with none of the spell level or higher, both are disabled", () => {
  const low = castChoices(known("burning-hands", 1), record("burning-hands"), state(sorcerer([4, 1, 0])));
  expect(low.kind === "slots" && [low.main?.left, low.none, low.hint]).toEqual([0, false, "No 1st-level slot left. Pick a higher level."]);
  const none = castChoices(known("burning-hands", 1), record("burning-hands"), state(sorcerer([4, 3, 2])));
  expect(none.kind === "slots" && [none.none, none.hint]).toEqual([true, "Each slot that can cast this spell is spent."]);
});

test("the app never spends a slot of a higher level without a choice: Cast spends only the spell level", () => {
  for (const spent of [
    [0, 0, 0],
    [4, 0, 0],
    [4, 3, 0],
  ] as const) {
    const control = castChoices(known("burning-hands", 1), record("burning-hands"), state(sorcerer([...spent])));
    expect(control.kind === "slots" && control.main?.level).toBe(1);
  }
});

test("with only one slot level that can cast the spell, the control is a plain Cast button with no menu", () => {
  expect(castChoices(known("fireball", 3), record("fireball"), state(sorcerer()))).toEqual({
    kind: "slots",
    main: { group: 3, level: 3, left: 2 },
    menu: null,
    none: false,
    hint: "3rd-level slot · 2 left",
    menuText: null,
  });
  const spent = castChoices(known("fireball", 3), record("fireball"), state(sorcerer([0, 0, 2])));
  expect(spent.kind === "slots" && [spent.none, spent.hint]).toEqual([true, "3rd-level slot · none left"]);
});

test("pact slots and other slots: Cast spends an other slot, and the menu has 'Pact (2nd)' when the pact level is the spell level or higher", () => {
  const missile = castChoices(known("magic-missile", 1), record("magic-missile"), state(wizardWarlock()));
  expect(missile.kind === "slots" && [missile.main?.group, missile.menu?.map((entry) => [entry.label, entry.amount, entry.leftText])]).toEqual([
    1,
    [
      ["2nd level", "+1 dart", "2 left"],
      ["3rd level", "+2 darts", "2 left"],
      ["Pact (2nd)", "+1 dart", "2 left"],
    ],
  ]);
  const hold = castChoices(known("hold-person", 2), record("hold-person"), state(wizardWarlock(1)));
  expect(hold.kind === "slots" && hold.menu?.map((entry) => [entry.label, entry.amount, entry.leftText])).toEqual([
    ["3rd level", "+1 humanoid", "2 left"],
    ["Pact (2nd)", "", "1 left"],
  ]);
  // A 3rd-level spell: the pact slots are of a lower level, so they are not in the menu.
  const fireball = castChoices(known("fireball", 3), record("fireball"), state(wizardWarlock()));
  expect(fireball.kind === "slots" && fireball.menu).toBeNull();
  expect(castSlots(wizardWarlock(), 3)).toEqual([{ group: 3, level: 3, left: 2 }]);
});

test("a warlock with no other slots: Cast spends a pact slot, with no menu, and the hint has the amount at the pact level", () => {
  expect(castChoices(known("hellish-rebuke", 1, { source: "Warlock" }), record("hellish-rebuke"), state(warlock()))).toEqual({
    kind: "slots",
    main: { group: "pact", level: 5, left: 2 },
    menu: null,
    none: false,
    hint: "Pact slot (5th) · 2 left · +4d10 at 5th level",
    menuText: null,
  });
  const bare = castChoices(known("misty-step", 2, { source: "Warlock" }), record("misty-step"), state(warlock(3)));
  expect(bare.kind === "slots" && [bare.none, bare.hint]).toEqual([true, "Pact slot (5th) · none left"]);
});

test("a spell with other words shows its text at the bottom of the menu, and its entries have no amount", () => {
  const control = castChoices(known("magic-weapon", 2), record("magic-weapon"), state(sorcerer()));
  expect(control.kind === "slots" && [control.menu?.map((entry) => entry.amount), control.menuText?.slice(0, 40)]).toEqual([
    [""],
    "When you cast this spell using a spell s",
  ]);
  // A spell with no "At Higher Levels" text: entries with no amount, and no text.
  const step = castChoices(known("misty-step", 2), record("misty-step"), state(sorcerer()));
  expect(step.kind === "slots" && [step.menu?.map((entry) => entry.amount), step.menuText]).toEqual([[""], null]);
});

test("the amount counts the levels above the base level of the text, not above the spell level", () => {
  // A made-up pack spell of the 1st level whose text counts from the 2nd level.
  const surge: SpellRecord = {
    key: "pack-surge",
    name: "Pack Surge",
    level: 1,
    school: "evocation",
    description:
      "A surge of force.\nAt Higher Levels. When you cast this spell using a spell slot of 3rd level or higher, the damage increases by 1d6 for each slot level above 2nd.",
  };
  const control = castChoices(known("pack-surge", 1), surge, state(sorcerer()));
  expect(control.kind === "slots" && control.menu?.map((entry) => [entry.label, entry.amount])).toEqual([
    ["2nd level", ""],
    ["3rd level", "+1d6"],
  ]);
  // With no ordinal after "above", the levels count from the spell level.
  const plain = castChoices(
    known("pack-surge", 1),
    { ...surge, description: "A surge of force.\nAt Higher Levels. The damage increases by 1d6 for each slot level above." },
    state(sorcerer()),
  );
  expect(plain.kind === "slots" && plain.menu?.map((entry) => entry.amount)).toEqual(["+1d6", "+2d6"]);
});

test("a cantrip, an at-will spell and an unprepared spell of a class that prepares have no Cast button", () => {
  const slots = sorcerer();
  expect(castChoices(known("fire-bolt", 0), record("fire-bolt"), state(slots))).toEqual({ kind: "none" });
  expect(castChoices(known("mage-armor", 1, { castNote: "at will" }), record("mage-armor"), state(slots))).toEqual({ kind: "none" });
  expect(castChoices(known("shield", 1, { source: "Wizard", prepared: false }), record("shield"), state(slots))).toEqual({ kind: "none" });
  expect(castChoices(known("shield", 1, { source: "Wizard", prepared: true }), record("shield"), state(slots)).kind).toBe("slots");
  // A ritual cast has no control.
  expect(castChoices(known("alarm", 1, { castNote: "ritual only" }), record("alarm"), state(slots))).toEqual({ kind: "none" });
  // A spell with no slot of its level or higher.
  expect(castChoices(known("cone-of-cold", 5), record("cone-of-cold"), state(slots))).toEqual({ kind: "none" });
});

test("a cantrip or an at-will spell that needs concentration has the Concentrate button", () => {
  expect(castChoices(known("guidance", 0), record("guidance"), state(sorcerer()))).toEqual({
    kind: "concentrate",
    active: false,
    hint: "This sets the concentration mark and spends nothing.",
  });
  expect(castChoices(known("guidance", 0), record("guidance"), state(sorcerer(), "guidance"))).toEqual({
    kind: "concentrate",
    active: true,
    hint: "You concentrate on this spell.",
  });
  expect(castChoices(known("levitate", 2, { castNote: "at will" }), record("levitate"), state(sorcerer())).kind).toBe("concentrate");
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

// A spell with its own uses (ORC-321).

const LONG_REST = "orcpub.dnd.e5.units/long-rest";
const arcanum = (spent = 0, amount = 1): FeatureUses => ({ amount, recharge: "Long rest", units: LONG_REST, name: "Mystic Arcanum", spent });
const fates = (spent = 0): FeatureUses => ({ amount: 1, recharge: "Long rest", units: LONG_REST, name: "Eldritch Invocation: Thief of Five Fates", spent });
const ARCANUM_KEY = { units: LONG_REST, name: "Mystic Arcanum" };
const FATES_KEY = { units: LONG_REST, name: "Eldritch Invocation: Thief of Five Fates" };

const KEY = "~:orcpub.entity.strict/key";
type Node = Record<string, unknown>;
/** The options of the first selection with the key `key` in the strict entity, found at any depth, or null. */
function selectionOptions(node: unknown, key: string): Node[] | null {
  if (!node || typeof node !== "object") return null;
  const n = node as Node;
  if (n[KEY] === key && Array.isArray(n["~:orcpub.entity.strict/options"])) return n["~:orcpub.entity.strict/options"] as Node[];
  for (const value of Object.values(n)) {
    const found = selectionOptions(value, key);
    if (found) return found;
  }
  return null;
}

/** Warlock 20 (e2e/warlock-20.strict.json): a tiefling with pact slots of the 5th level. */
const warlock20 = (): StrictEntity => JSON.parse(readFileSync(join(import.meta.dirname, "../../e2e/warlock-20.strict.json"), "utf8"));

/** The known spells of a built strict entity with their levels, the uses of its features, and its spellcasting. */
async function built(entity: StrictEntity) {
  const sheet = toSheet((await loadEngine()).evaluate(entity).built, entity);
  const spells = sheet.spellcasting!.byLevel.flatMap((level) => level.spells.map((spell) => ({ ...spell, level: level.level })));
  return { spells, uses: featureUses(sheet), slots: sheet.spellcasting! };
}

test("each row of the invocation table: with only that invocation, only its spell has a 'once per' note, and Cast links to that feature", async () => {
  expect(Object.keys(INVOCATION_SPELLS)).toHaveLength(6);
  for (const [key, feature] of Object.entries(INVOCATION_SPELLS)) {
    // The invocation key from the feature name: "Eldritch Invocation: Sign of Ill Omen" is "sign-of-ill-omen".
    const invocation = feature.replace("Eldritch Invocation: ", "").toLowerCase().replaceAll(" ", "-");
    const entity = warlock20();
    const options = selectionOptions(entity, "~:eldritch-invocations")!;
    options.splice(0, options.length, { [KEY]: `~:${invocation}` });
    const { spells, uses, slots } = await built(entity);
    // The spells of the table with a "once per" note: only the spell of this row.
    const oncePer = spells.filter((s) => s.key in INVOCATION_SPELLS && /^once per /.test(s.castNote ?? "")).map((s) => s.key);
    expect([feature, oncePer]).toEqual([feature, [key]]);
    expect(uses.find((u) => u.name === feature)).toMatchObject({ name: feature, amount: 1 });
    const spell = spells.find((s) => s.key === key && s.castNote !== null)!;
    expect(castChoices(spell, record(key), state(slots, null, uses))).toMatchObject({ kind: "uses", feature: { name: feature }, pact: true, disabled: false });
  }
});

test("the tiefling race spells cast with a slot: Hellish Rebuke and Darkness of the source 'Tiefling' have no cast note", async () => {
  const { spells, uses, slots } = await built(warlock20());
  for (const key of ["hellish-rebuke", "darkness"]) {
    const spell = spells.find((s) => s.key === key && s.source === "Tiefling")!;
    expect([key, spell.castNote]).toEqual([key, null]);
    expect(castChoices(spell, record(key), state(slots, null, uses))).toMatchObject({ kind: "slots", main: { group: "pact", level: 5 } });
  }
});

test("a spell with the cast note 'uses Mystic Arcanum' spends a use of Mystic Arcanum, a pack spell too; with no use left Cast is disabled", () => {
  const slots = warlock();
  const spell = known("circle-of-death", 6, { source: "Warlock", castNote: "uses Mystic Arcanum" });
  expect(castChoices(spell, record("circle-of-death"), state(slots, null, [fates(), arcanum()]))).toEqual({
    kind: "uses",
    feature: ARCANUM_KEY,
    label: "Mystic Arcanum",
    pact: false,
    disabled: false,
    hint: "Spends Mystic Arcanum (1 of 1 left).",
  });
  // A pack spell with the same note, and no record: the link is the cast note.
  const pack = known("pack-spell", 7, { source: "Warlock", castNote: "uses Mystic Arcanum" });
  expect(castChoices(pack, undefined, state(slots, null, [arcanum(1, 4)]))).toMatchObject({
    kind: "uses",
    disabled: false,
    hint: "Spends Mystic Arcanum (3 of 4 left).",
  });
  expect(castChoices(spell, record("circle-of-death"), state(slots, null, [arcanum(1)]))).toMatchObject({
    kind: "uses",
    disabled: true,
    hint: "Mystic Arcanum has no use left.",
  });
});

test("an invocation spell spends a use of its invocation and a pact slot; Cast is disabled when the use or the slot is not there", () => {
  const bane = known("bane", 1, { source: "Warlock", castNote: "once per long rest" });
  expect(castChoices(bane, record("bane"), state(warlock(1), null, [arcanum(), fates()]))).toEqual({
    kind: "uses",
    feature: FATES_KEY,
    label: "Thief of Five Fates",
    pact: true,
    disabled: false,
    hint: "Spends Thief of Five Fates (1 left) and a pact slot (5th, 2 left).",
  });
  expect(castChoices(bane, record("bane"), state(warlock(1), null, [fates(1)]))).toMatchObject({
    disabled: true,
    hint: "Thief of Five Fates has no use left.",
  });
  expect(castChoices(bane, record("bane"), state(warlock(3), null, [fates()]))).toMatchObject({ disabled: true, hint: "No pact slot left." });
  // A pact slot below the spell level cannot cast it; with no pact slots at all, the same.
  const curse = known("bestow-curse", 3, { source: "Warlock", castNote: "once per long rest" });
  expect(castChoices(curse, record("bestow-curse"), state(wizardWarlock(), null, [{ ...fates(), name: INVOCATION_SPELLS["bestow-curse"] }]))).toMatchObject({
    disabled: true,
    hint: "No pact slot left.",
  });
  expect(castChoices(bane, record("bane"), state(sorcerer(), null, [fates()]))).toMatchObject({ disabled: true, hint: "No pact slot left." });
});

test("a cast note with uses that the app cannot link has no Cast button, only the line", () => {
  const slots = warlock();
  const line = (name: string) => ({ kind: "unlinked", text: `This spell has its own uses (${name}). Spend the use on the sheet.` });
  expect(castChoices(known("misty-step", 2, { castNote: "uses Fey Step" }), record("misty-step"), state(slots, null, [arcanum()]))).toEqual(line("Fey Step"));
  expect(castChoices(known("misty-step", 2, { castNote: "once per long rest" }), record("misty-step"), state(slots))).toEqual(line("once per long rest"));
  // A note that the app can link, but the sheet has no uses of its feature.
  expect(castChoices(known("bane", 1, { castNote: "once per long rest" }), record("bane"), state(slots, null, [arcanum()]))).toEqual(
    line("Thief of Five Fates"),
  );
  expect(castChoices(known("circle-of-death", 6, { castNote: "uses Mystic Arcanum" }), record("circle-of-death"), state(slots))).toEqual(
    line("Mystic Arcanum"),
  );
  // A spell of the table with another note is not an invocation spell: the line has the note.
  expect(castChoices(known("bane", 1, { castNote: "uses Fey Step" }), record("bane"), state(slots, null, [fates()]))).toEqual(line("Fey Step"));
});

test("a cast note that is not 'at will', a ritual cast, 'uses …' or 'once per …' gives no control, as before ORC-321", () => {
  const slots = warlock();
  for (const castNote of ["Tiefling", "3/day", "self only", "once"]) {
    expect([castNote, castChoices(known("misty-step", 2, { castNote }), record("misty-step"), state(slots, null, [arcanum()]))]).toEqual([
      castNote,
      { kind: "none" },
    ]);
  }
});

test("the status of a cast with a use names the feature, and the pact slot of an invocation spell", () => {
  const use: CastAction = {
    kind: "uses",
    key: "bane",
    name: "Bane",
    level: 1,
    feature: FATES_KEY,
    label: "Thief of Five Fates",
    pact: true,
    concentration: true,
  };
  expect(castStatus(use, { level: 5, left: 3 }, 0)).toBe("Cast Bane at 5th level. Thief of Five Fates −1 (0 left), Pact slots −1 (3 left).");
  const arcane: CastAction = { ...use, key: "circle-of-death", name: "Circle of Death", level: 6, feature: ARCANUM_KEY, label: "Mystic Arcanum", pact: false };
  expect(castStatus(arcane, undefined, 3)).toBe("Cast Circle of Death. Mystic Arcanum −1 (3 left).");
});
