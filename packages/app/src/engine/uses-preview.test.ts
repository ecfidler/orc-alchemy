import { expect, test } from "vitest";
import { scaledAmount } from "./sheet.ts";
import { builtFrequency, exampleNumbers, previewFeature } from "./uses-preview.ts";

const LONG = "~:orcpub.dnd.e5.units/long-rest";

test("the example character: proficiency bonus by level, and the modifier of the score", () => {
  const at = (level: number, score: number) => {
    const n = exampleNumbers(level, score);
    return [n.proficiencyBonus, n.abilityModifier("wis")];
  };
  expect(at(1, 10)).toEqual([2, 0]);
  expect(at(5, 16)).toEqual([3, 3]);
  expect(at(9, 9)).toEqual([4, -1]);
  expect(at(20, 30)).toEqual([6, 10]);
});

test("scaledAmount follows the engine's truth: an ability only when it is a keyword, 0 for an unknown ability, a minimum only when it is a number", () => {
  const n = (amount: Record<string, unknown>) => scaledAmount(amount, exampleNumbers(5, 16));
  expect(n({ "~:ability": 3, "~:prof-bonus": true })).toBe(3);
  expect(n({ "~:ability": "~:foo" })).toBe(0);
  expect(n({ "~:ability": "~:foo", "~:plus": 2 })).toBe(2);
  expect(n({ "~:prof-bonus": 0 })).toBe(3);
  expect(n({ "~:prof-bonus": false, "~:level": "yes" })).toBe(5);
  expect(n({ "~:level": true, "~:times": null, "~:plus": null })).toBe(5);
  expect(n({ "~:level": true, "~:min": null })).toBe(5);
  expect(n({ "~:level": true, "~:plus": -9, "~:min": 1 })).toBe(1);
  expect(n({ "~:plus": 3 })).toBe(3);
});

test("the frequency as the engine builds it: the unit without its tag and the amount a number; no unit and no amount stay absent", () => {
  const numbers = exampleNumbers(5, 16);
  expect(builtFrequency(undefined, numbers)).toBeUndefined();
  expect(builtFrequency({ "~:units": LONG, "~:amount": 3 }, numbers)).toEqual({ units: "orcpub.dnd.e5.units/long-rest", amount: 3 });
  expect(builtFrequency({ "~:units": "~:short-rest" }, numbers)).toEqual({ units: "short-rest" });
  expect(builtFrequency({ "~:amount": 2 }, numbers)).toEqual({ amount: 2 });
  expect(builtFrequency({ "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5 } }, numbers)).toEqual({ units: "orcpub.dnd.e5.units/long-rest", amount: 25 });
});

test("previewFeature: the sheet section of the type, and the feature as the sheet shows it; no unit gives no tag", () => {
  const numbers = exampleNumbers(5, 16);
  expect(previewFeature({ "~:name": "Undertow", "~:type": "~:reaction", "~:description": "you pull", "~:frequency": { "~:units": LONG, "~:amount": { "~:prof-bonus": true } } }, numbers)).toEqual({
    section: "reactions",
    feature: { name: "Undertow", text: "You pull.", uses: { amount: 3, recharge: "Long rest" } },
  });
  expect(previewFeature({ "~:name": "No Unit", "~:frequency": { "~:amount": 2 } }, numbers)).toEqual({
    section: "traits",
    feature: { name: "No Unit", text: "", uses: { amount: 2, recharge: null } },
  });
  expect(previewFeature({}, numbers)).toEqual({ section: "traits", feature: { name: "Unnamed feature", text: "" } });
});
