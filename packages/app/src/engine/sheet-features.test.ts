// Tests of the feature helpers of the sheet that need no character.
import { expect, test } from "vitest";
import { sectionOf, usesDisplay } from "./sheet-features.ts";

// ORC-203 (homebrew-forms.md, "On the sheet"): the engine puts every homebrew feature in traits, with its type.
test("a feature's type gives its section; no type, other, or an unknown type is a trait", () => {
  expect(sectionOf("action")).toBe("actions");
  expect(sectionOf("b-action")).toBe("bonusActions");
  expect(sectionOf("reaction")).toBe("reactions");
  expect(sectionOf("orcpub.dnd.e5/b-action")).toBe("bonusActions");
  expect(sectionOf("other")).toBe("traits");
  expect(sectionOf(undefined)).toBe("traits");
  expect(sectionOf(null)).toBe("traits");
  expect(sectionOf("legendary")).toBe("traits");
});

test("uses show as circles up to 8, a pool above 8, and plain text for none or 0 or fewer", () => {
  expect(usesDisplay(undefined)).toEqual({ kind: "plain" });
  expect(usesDisplay(null)).toEqual({ kind: "plain" });
  expect(usesDisplay({ amount: 0 })).toEqual({ kind: "plain" });
  expect(usesDisplay({ amount: -1 })).toEqual({ kind: "plain" });
  // A unit with no amount is 1 use.
  expect(usesDisplay({})).toEqual({ kind: "circles", count: 1 });
  expect(usesDisplay({ amount: null })).toEqual({ kind: "circles", count: 1 });
  expect(usesDisplay({ amount: 8 })).toEqual({ kind: "circles", count: 8 });
  expect(usesDisplay({ amount: 9 })).toEqual({ kind: "pool", max: 9 });
  expect(usesDisplay({ amount: 20 })).toEqual({ kind: "pool", max: 20 });
  // A turn has no circles, also with more than 8 uses (ORC-316).
  expect(usesDisplay({ amount: 1, units: "orcpub.dnd.e5.units/turn" })).toEqual({ kind: "turn" });
  expect(usesDisplay({ amount: 12, units: "~:orcpub.dnd.e5.units/turn" })).toEqual({ kind: "turn" });
  expect(usesDisplay({ amount: 0, units: "orcpub.dnd.e5.units/turn" })).toEqual({ kind: "plain" });
});
