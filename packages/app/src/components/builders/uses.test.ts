import { expect, test } from "vitest";
import {
  baseOf,
  builtFrequency,
  exampleNumbers,
  rechargeOptions,
  unitName,
  usesKind,
  usesSentence,
  withBase,
  withFixed,
  withKind,
  withScaledNumber,
  withUnit,
} from "./uses.ts";

const LONG = "~:orcpub.dnd.e5.units/long-rest";
const SHORT = "~:orcpub.dnd.e5.units/short-rest";

test("the kind of the stored uses: none, fixed (also with no amount), or scaled", () => {
  expect(usesKind(undefined)).toBe("none");
  expect(usesKind(null)).toBe("none");
  expect(usesKind({ "~:units": LONG, "~:amount": 3 })).toBe("fixed");
  expect(usesKind({ "~:units": LONG })).toBe("fixed");
  expect(usesKind({ "~:units": LONG, "~:amount": { "~:prof-bonus": true } })).toBe("scaled");
});

test("the Recharges segments: the four rests, and a unit from the pack as one more", () => {
  const rests = ["Short rest", "Long rest", "Day", "Turn"];
  expect(rechargeOptions(undefined).map(([, text]) => text)).toEqual(rests);
  expect(rechargeOptions({ "~:units": "~:short-rest", "~:amount": 1 }).map(([, text]) => text)).toEqual(rests);
  expect(unitName({ "~:units": "~:short-rest" })).toBe("short-rest");
  expect(rechargeOptions({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 1 })).toEqual([
    ["short-rest", "Short rest"],
    ["long-rest", "Long rest"],
    ["day", "Day"],
    ["turn", "Turn"],
    ["minute", "Minute (from the pack)"],
  ]);
  expect(rechargeOptions({ "~:units": "~:rest" }).at(-1)).toEqual(["rest", "Rest (from the pack)"]);
});

test("a kind: none removes the uses; fixed is 1 use; scaled is the proficiency bonus; the rest and other keys stay", () => {
  expect(withKind(undefined, "fixed")).toEqual({ "~:units": LONG, "~:amount": 1 });
  expect(withKind(undefined, "scaled")).toEqual({ "~:units": LONG, "~:amount": { "~:prof-bonus": true } });
  expect(withKind({ "~:units": SHORT, "~:amount": 3, "~:note": "x" }, "none")).toBeUndefined();
  expect(withKind({ "~:units": "~:day", "~:amount": 3, "~:note": "x" }, "scaled")).toEqual({
    "~:units": "~:orcpub.dnd.e5.units/day",
    "~:amount": { "~:prof-bonus": true },
    "~:note": "x",
  });
  // The pressed kind changes nothing.
  const stored = { "~:units": "~:short-rest", "~:amount": 2 };
  expect(withKind(stored, "fixed")).toBe(stored);
});

test("a change writes the full unit keyword; a full unit from the pack stays", () => {
  expect(withFixed({ "~:units": "~:short-rest", "~:amount": 2 }, 4)).toEqual({ "~:units": SHORT, "~:amount": 4 });
  expect(withFixed({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 2 }, 4)).toEqual({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 4 });
  expect(withFixed({ "~:units": "~:minute", "~:amount": 2 }, 4)).toEqual({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 4 });
  expect(withUnit({ "~:units": "~:orcpub.dnd.e5.units/minute", "~:amount": 2 }, "day")).toEqual({ "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": 2 });
  // No amount stays no amount when only the rest changes.
  expect(withUnit({ "~:units": LONG }, "turn")).toEqual({ "~:units": "~:orcpub.dnd.e5.units/turn" });
});

test("the base of a scaled amount follows the engine's order: ability, proficiency bonus, level", () => {
  expect(baseOf({ "~:amount": { "~:ability": "~:orcpub.dnd.e5.character/int" } })).toBe("int");
  expect(baseOf({ "~:amount": { "~:ability": "~:cha", "~:level": true } })).toBe("cha");
  expect(baseOf({ "~:amount": { "~:prof-bonus": true, "~:level": true } })).toBe("prof");
  expect(baseOf({ "~:amount": { "~:level": true, "~:times": 2 } })).toBe("level");
  expect(baseOf({ "~:amount": { "~:plus": 2 } })).toBeUndefined();
});

test("a base: the other bases and n go, plus and the minimum stay; an ability from another base sets the minimum to 1", () => {
  const prof = { "~:units": LONG, "~:amount": { "~:prof-bonus": true, "~:plus": 2 } };
  expect(withBase(prof, "wis")).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:wis", "~:plus": 2, "~:min": 1 } });
  const wis = { "~:units": LONG, "~:amount": { "~:ability": "~:wis" } };
  // Ability to ability keeps the minimum the user set (here none).
  expect(withBase(wis, "cha")).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:cha" } });
  expect(withBase({ "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5, "~:min": 2 } }, "prof")).toEqual({
    "~:units": LONG,
    "~:amount": { "~:prof-bonus": true, "~:min": 2 },
  });
  expect(withBase(prof, "level")).toEqual({ "~:units": LONG, "~:amount": { "~:level": true, "~:plus": 2 } });
  expect(withBase(prof, "prof")).toBe(prof);
});

test("n, plus and the minimum: the engine's default removes the key", () => {
  const level = { "~:units": LONG, "~:amount": { "~:level": true } };
  const five = withScaledNumber(level, "times", 5);
  expect(five).toEqual({ "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5 } });
  expect(withScaledNumber(five, "times", 1)).toEqual(level);
  expect(withScaledNumber(level, "plus", -1)).toEqual({ "~:units": LONG, "~:amount": { "~:level": true, "~:plus": -1 } });
  expect(withScaledNumber({ "~:units": LONG, "~:amount": { "~:level": true, "~:plus": 2 } }, "plus", 0)).toEqual(level);
  expect(withScaledNumber(level, "min", 0)).toEqual({ "~:units": LONG, "~:amount": { "~:level": true, "~:min": 0 } });
  expect(withScaledNumber({ "~:units": LONG, "~:amount": { "~:level": true, "~:min": 0 } }, "min", undefined)).toEqual(level);
});

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

test("the frequency as the engine builds it: the unit without its tag and the amount a number", () => {
  const numbers = exampleNumbers(5, 16);
  expect(builtFrequency(undefined, numbers)).toBeUndefined();
  expect(builtFrequency({ "~:units": LONG, "~:amount": 3 }, numbers)).toEqual({ units: "orcpub.dnd.e5.units/long-rest", amount: 3 });
  expect(builtFrequency({ "~:units": "~:short-rest" }, numbers)).toEqual({ units: "short-rest" });
  expect(builtFrequency({ "~:units": LONG, "~:amount": { "~:level": true, "~:times": 5 } }, numbers)).toEqual({ units: "orcpub.dnd.e5.units/long-rest", amount: 25 });
});

test("the one sentence of a scaled amount", () => {
  const sentence = (amount: object, levelName: string | null = null, level = 5, score = 16) => usesSentence({ "~:units": LONG, "~:amount": amount }, levelName, level, score);
  expect(sentence({ "~:level": true, "~:times": 5 }, "Paladin")).toBe("Uses equal 5 × your paladin level. A level 5 character gets 25.");
  expect(sentence({ "~:level": true })).toBe("Uses equal your character level. A level 5 character gets 5.");
  expect(sentence({ "~:ability": "~:wis", "~:min": 1 })).toBe("Uses equal your Wisdom modifier (minimum 1). A level 5 character with 16 Wisdom gets 3.");
  expect(sentence({ "~:ability": "~:orcpub.dnd.e5.character/int" }, null, 5, 8)).toBe("Uses equal your Intelligence modifier. A level 5 character with 8 Intelligence gets -1.");
  expect(sentence({ "~:prof-bonus": true, "~:plus": 2 })).toBe("Uses equal your proficiency bonus + 2. A level 5 character gets 5.");
  expect(sentence({ "~:prof-bonus": true, "~:plus": -1 }, null, 17)).toBe("Uses equal your proficiency bonus − 1. A level 17 character gets 5.");
  expect(sentence({ "~:plus": 3 })).toBe("Uses equal 3. A level 5 character gets 3.");
});
