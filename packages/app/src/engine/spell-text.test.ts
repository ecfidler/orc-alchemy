import { beforeAll, expect, test } from "vitest";
import { ordinal } from "./sheet.ts";
import type { SpellRecord } from "./spell-records.ts";
import { castNoteLine, componentsLine, descriptionParts, durationParts, levelLine } from "./spell-text.ts";
import { loadSpellContent, type SpellContent } from "./spells.ts";

let srd: SpellContent;
beforeAll(async () => {
  srd = await loadSpellContent();
});
const spell = (key: string): SpellRecord => srd.get(key)!;

test("ordinal gives the level names", () => {
  expect([1, 2, 3, 4, 9].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "9th"]);
});

test("the level line has the level and the school, or the school and 'cantrip'", () => {
  expect(levelLine(spell("bless"))).toBe("1st-level enchantment");
  expect(levelLine(spell("fireball"))).toBe("3rd-level evocation");
  expect(levelLine(spell("sacred-flame"))).toBe("Evocation cantrip");
});

test("the school 'unknown' of a pack spell does not show: the line has only the level", () => {
  expect(levelLine({ level: 2, school: "unknown" })).toBe("2nd level");
  expect(levelLine({ level: 0, school: "unknown" })).toBe("Cantrip");
});

test("a pack school with capitals is lower case in the line, and has a capital first letter for a cantrip", () => {
  expect(levelLine({ level: 1, school: "Evocation" })).toBe("1st-level evocation");
  expect(levelLine({ level: 0, school: "EVOCATION" })).toBe("Evocation cantrip");
  expect(levelLine({ level: 3, school: "Unknown" })).toBe("3rd level");
});

test("a duration that starts with the word 'concentration' needs concentration; the other words follow, as the data has them", () => {
  expect(durationParts(spell("bless").duration!)).toEqual({ concentration: true, rest: "up to 1 minute" });
  // No comma after the word.
  expect(spell("protection-from-evil-and-good").duration).toBe("Concentration up to 10 minutes");
  expect(durationParts(spell("protection-from-evil-and-good").duration!)).toEqual({ concentration: true, rest: "up to 10 minutes" });
  // Any case of the word. The words after it keep their case.
  expect(durationParts("CONCENTRATION, Up to 1 hour")).toEqual({ concentration: true, rest: "Up to 1 hour" });
  expect(durationParts("Concentration")).toEqual({ concentration: true, rest: "" });
});

test("a duration with no concentration shows as it is", () => {
  expect(durationParts(spell("mage-armor").duration!)).toEqual({ concentration: false, rest: "8 hours" });
  // The word must be first, and a whole word.
  expect(durationParts("Until dispelled, concentration not needed")).toEqual({ concentration: false, rest: "Until dispelled, concentration not needed" });
  expect(durationParts("Concentrations")).toEqual({ concentration: false, rest: "Concentrations" });
});

test("the components line has the letters, then the material text in parentheses", () => {
  expect(componentsLine(spell("bless").components)).toEqual({ text: "V, S, M (a sprinkling of holy water)", wide: false });
  expect(componentsLine(spell("sacred-flame").components)).toEqual({ text: "V, S", wide: false });
  expect(componentsLine(spell("magic-missile").components)).toEqual({ text: "V, S", wide: false });
});

test("a material text of more than 28 characters, as it shows, makes the line wide", () => {
  const material = spell("protection-from-evil-and-good").components!["material-component"]!;
  expect(material.length).toBeGreaterThan(28);
  expect(componentsLine(spell("protection-from-evil-and-good").components)?.wide).toBe(true);
  // 28 characters after the trim is not wide.
  expect(componentsLine({ material: true, "material-component": `  ${"x".repeat(28)}   ` })).toEqual({ text: `M (${"x".repeat(28)})`, wide: false });
  // Material text that does not show, without the M, does not make the line wide.
  expect(componentsLine({ verbal: true, material: false, "material-component": "x".repeat(40) })).toEqual({ text: "V", wide: false });
});

test("a pack spell's components: a false flag gives no letter, material text without the M does not show, and no letter gives no line", () => {
  expect(componentsLine({ verbal: true, somatic: false, material: true, "material-component": "" })?.text).toBe("V, M");
  expect(componentsLine({ verbal: true, material: false, "material-component": "a feather" })?.text).toBe("V");
  expect(componentsLine({ verbal: false, somatic: false })).toBeNull();
  expect(componentsLine(undefined)).toBeNull();
});

test("the cast note line is trimmed and has a capital first letter", () => {
  expect(castNoteLine("at will")).toBe("At will");
  expect(castNoteLine("  ritual only ")).toBe("Ritual only");
  expect(castNoteLine("  ")).toBeNull();
  expect(castNoteLine(null)).toBeNull();
  expect(castNoteLine(undefined)).toBeNull();
});

test("each line break starts a paragraph, and a description with no 'At Higher Levels' has no part apart", () => {
  const parts = descriptionParts(spell("eldritch-blast").description!);
  expect(parts.higherLevels).toBeNull();
  expect(parts.paragraphs).toHaveLength(2);
  expect(parts.paragraphs[1]).toMatch(/^The spell creates more than one beam when you reach higher levels/);
});

test("'At Higher Levels.' after a line break starts the part apart", () => {
  const parts = descriptionParts(spell("bless").description!);
  expect(parts.paragraphs).toEqual([
    "You bless up to three creatures of your choice within range. Whenever a target makes an attack roll or a saving throw before the spell ends, the target can roll a d4 and add the number rolled to the attack roll or saving throw.",
  ]);
  expect(parts.higherLevels).toEqual([
    "When you cast this spell using a spell slot of 2nd level or higher, you can target one additional creature for each slot level above 1st.",
  ]);
});

test("'At Higher Levels.' in the same line as the sentence before it starts the part apart", () => {
  const parts = descriptionParts(spell("banishment").description!);
  expect(parts.paragraphs).toHaveLength(3);
  expect(parts.paragraphs[2]).toMatch(/Otherwise, the target doesn't return\.$/);
  expect(parts.higherLevels).toEqual([
    "When you cast this spell using a spell slot of 5th level or higher, you can target one additional creature for each slot level above 4th.",
  ]);
});

test("'At Higher Levels:' after a line break and four spaces starts the part apart", () => {
  const parts = descriptionParts(spell("counterspell").description!);
  expect(parts.paragraphs).toHaveLength(1);
  expect(parts.higherLevels).toEqual(["The interrupted spell has no effect if its level is less than or equal to the level of the spell slot you used."]);
});

test("words that match no form show as they are", () => {
  expect(descriptionParts("A bright light.\nAt higher levels, it is brighter.")).toEqual({
    paragraphs: ["A bright light.", "At higher levels, it is brighter."],
    higherLevels: null,
  });
  expect(descriptionParts("Read **this**.")).toEqual({ paragraphs: ["Read **this**."], higherLevels: null });
});
