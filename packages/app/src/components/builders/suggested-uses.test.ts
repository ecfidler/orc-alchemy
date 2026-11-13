// The text rules of suggested uses (ORC-206, docs/design/homebrew-forms.md,
// "Suggested uses", "Rules"), on the test pack and on the variants that
// each rule accepts.
import { describe, expect, test } from "vitest";
import { CASES, fixed, SUGGESTION_PACK } from "./test-suggestion-pack.ts";
import { readFeatureText, type SuggestedUses } from "./suggested-uses.ts";
import { suggestedFrequency } from "./uses.ts";

const uses = (text: string) => {
  const reading = readFeatureText(text)?.uses ?? null;
  return reading === null ? null : reading.kind === "hint" ? "hint" : reading.uses;
};
const type = (text: string) => readFeatureText(text)?.type?.type ?? null;

describe("the test pack", () => {
  test.each(SUGGESTION_PACK.map((f) => [f.name, f] as const))("%s", (_, feature) => {
    expect(uses(feature.description)).toEqual(feature.uses);
    expect(type(feature.description)).toBe(feature.type);
    const reading = readFeatureText(feature.description);
    if (feature.uses === null && feature.type === null) expect(reading).toBeNull();
    if (feature.phrase !== undefined) {
      const { phrase, sentence, quote } = reading!.uses!.match;
      expect(feature.description.slice(phrase.start, phrase.end)).toBe(feature.phrase);
      expect(feature.description.slice(sentence.start, sentence.end)).toBe(quote);
      expect(sentence.start).toBeLessThanOrEqual(phrase.start);
      expect(sentence.end).toBeGreaterThanOrEqual(phrase.end);
    }
  });

  test("has a feature for each case: each rule, each case that is not read, the hints and the types", () => {
    const covered = new Set(SUGGESTION_PACK.flatMap((f) => f.covers));
    expect(CASES.filter((c) => !covered.has(c))).toEqual([]);
  });
});

describe("uses rules", () => {
  test("can't use it again until a long rest: 1 / long rest, with the variants of the phrase", () => {
    for (const text of [
      "Once you use this feature, you can't use it again until you finish a long rest.",
      "Once you use this trait, you cannot use this trait again until you complete a long rest.",
      "After you do so, you can’t do so again until you finish a long rest.",
      "You must finish a long rest before you can use it again.",
    ])
      expect(uses(text), text).toEqual(fixed(1, "long-rest"));
  });

  test("a short or long rest is a short rest; a short rest is a short rest", () => {
    expect(uses("You can't use it again until you finish a short or long rest.")).toEqual(fixed(1, "short-rest"));
    expect(uses("You can't use it again until you finish a short rest.")).toEqual(fixed(1, "short-rest"));
    expect(uses("You must finish a short or long rest before you can use this feature again.")).toEqual(fixed(1, "short-rest"));
  });

  test("a number of times equal to your proficiency bonus, with the rest in the same or the next sentence", () => {
    expect(uses("You can use it a number of times equal to your proficiency bonus, and regain all uses on a short or long rest.")).toEqual({ amount: { kind: "prof" }, unit: "short-rest" });
    expect(uses("You can use it a number of times equal to your proficiency bonus. You regain all expended uses when you finish a long rest.")).toEqual({ amount: { kind: "prof" }, unit: "long-rest" });
  });

  test("a number of times equal to an ability modifier: each of the six abilities", () => {
    for (const [word, ability] of [["Strength", "str"], ["Dexterity", "dex"], ["Constitution", "con"], ["Intelligence", "int"], ["Wisdom", "wis"], ["Charisma", "cha"]])
      expect(uses(`You can do this a number of times equal to your ${word} modifier (minimum of once). You regain them when you finish a long rest.`)).toEqual({ amount: { kind: "ability", ability }, unit: "long-rest" });
  });

  test("once / twice / n times per day, a day or each day", () => {
    expect(uses("You can cast it once per day.")).toEqual(fixed(1, "day"));
    expect(uses("You can do this twice a day.")).toEqual(fixed(2, "day"));
    expect(uses("You can do this three times each day.")).toEqual(fixed(3, "day"));
    expect(uses("You can do this 4 times per day.")).toEqual(fixed(4, "day"));
  });

  test("use it once / twice / three times, then a rest", () => {
    expect(uses("You can use it once, and you regain the use when you finish a long rest.")).toEqual(fixed(1, "long-rest"));
    expect(uses("You can use this feature twice. You regain all expended uses when you finish a short or long rest.")).toEqual(fixed(2, "short-rest"));
    expect(uses("You can use your Channel Divinity three times between short rests.")).toEqual(fixed(3, "short-rest"));
  });
});

describe("cases that are not read", () => {
  test("a + n sum is a hint, not a suggestion", () => {
    expect(uses("You can use it a number of times equal to your Wisdom modifier + 1. You regain all uses on a long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to your proficiency bonus plus 2 per long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to 1 + your Charisma modifier per long rest.")).toBe("hint");
  });

  test("a + n later in the sentence is a hint; a minimum in parentheses is not a + n", () => {
    expect(uses("You can use it a number of times equal to your Wisdom modifier, plus one, and regain them on a long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to your Wisdom modifier (minimum of 1) + 2. You regain them on a long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to your Wisdom modifier - 1 per long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to your Wisdom modifier (minimum of 1). You regain them on a long rest.")).toEqual({ amount: { kind: "ability", ability: "wis" }, unit: "long-rest" });
    expect(uses("You can use it a number of times equal to your proficiency bonus (a minimum of once) per long rest.")).toEqual({ amount: { kind: "prof" }, unit: "long-rest" });
  });

  test("a level amount is a hint, not a suggestion", () => {
    expect(uses("You can use it a number of times equal to your paladin level per long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to half your level per long rest.")).toBe("hint");
    expect(uses("You can use it a number of times equal to twice your proficiency bonus per long rest.")).toBe("hint");
  });

  test("a rest phrase alone gives nothing", () => {
    expect(readFeatureText("When you finish a long rest, you gain 5 temporary hit points.")).toBeNull();
    expect(readFeatureText("You need only 4 hours of sleep to finish a long rest.")).toBeNull();
  });

  test("once per turn gives nothing, also as a count after use", () => {
    expect(readFeatureText("Once per turn, you can deal an extra 1d6 damage.")).toBeNull();
    expect(readFeatureText("You can use it once on each of your turns.")).toBeNull();
    expect(readFeatureText("You can use it twice per round.")).toBeNull();
  });

  test("a count with no rest that the rules read is a hint", () => {
    expect(uses("You can use it twice before a rest.")).toBe("hint");
  });
});

describe("hints", () => {
  test("two rules with different uses give a hint, with the place of the first", () => {
    const text = "You can use it twice per day. You can't use it again until you finish a long rest.";
    const reading = readFeatureText(text)!.uses!;
    expect(reading).toMatchObject({ kind: "hint", reason: "conflict" });
    expect(reading.match.quote).toBe("You can use it twice per day.");
  });

  test("a rule that is read and an amount that is not give a hint", () => {
    expect(uses("Once you use this feature, you must finish a short or long rest before you can use it again. At 17th level, you can use it twice before a rest.")).toBe("hint");
  });

  test("two rules with the same uses give one suggestion, at the first of them", () => {
    const text = "You can't use it again until you finish a long rest. You can use it once per long rest.";
    const reading = readFeatureText(text)!.uses!;
    expect(reading).toMatchObject({ kind: "suggestion", uses: fixed(1, "long-rest") });
    expect(reading.match.quote).toBe("You can't use it again until you finish a long rest.");
  });

  test("text that names uses with no amount is a hint", () => {
    expect(uses("You regain all expended uses when you finish a long rest.")).toBe("hint");
    expect(uses("It recovers its uses at dawn.")).toBe("hint");
    expect(uses("You can do this several times per day.")).toBe("hint");
    expect(readFeatureText("You regain all expended uses at dawn.")!.uses).toMatchObject({ kind: "hint", reason: "unclear" });
  });

  test("a hint phrase does not change a suggestion", () => {
    expect(uses("You can use this feature twice. You regain all expended uses when you finish a long rest.")).toEqual(fixed(2, "long-rest"));
  });
});

describe("type rules", () => {
  test("one type: action, bonus action or reaction, with each phrase", () => {
    expect(type("As an action, you can roar.")).toBe("action");
    expect(type("You can use your action to roar.")).toBe("action");
    expect(type("You can take the Dash action as a bonus action.")).toBe("b-action");
    expect(type("You can use a bonus action to hide.")).toBe("b-action");
    expect(type("When you are hit, you can use your reaction to halve the damage.")).toBe("reaction");
    expect(type("You can parry as a reaction.")).toBe("reaction");
    expect(type("As an action you roar. As an action you can stop.")).toBe("action");
  });

  test("two types give no type; no type phrase gives none", () => {
    expect(type("As a bonus action you can start, and you stop as an action.")).toBeNull();
    expect(type("You can use your reaction, or use your action.")).toBeNull();
    expect(type("You have advantage on saving throws against poison.")).toBeNull();
    // A bare "bonus action" or "reaction" counts as a second type.
    expect(type("You raise your shield as an action or a bonus action.")).toBeNull();
    expect(type("As an action, you mark a foe. The foe can't take reactions.")).toBeNull();
    // "bonus action" holds "action", and "the Dash action" names no type.
    expect(type("You can take the Dash action as a bonus action.")).toBe("b-action");
    expect(type("You can use a bonus action to hide. You can't hide as a bonus action twice.")).toBe("b-action");
  });

  test("a type with no uses gives a reading with the type only", () => {
    const text = "Your skin hardens.\nAs a bonus action, you can harden it more.";
    const reading = readFeatureText(text)!;
    expect(reading.uses).toBeNull();
    expect(reading.type!.match.quote).toBe("As a bonus action, you can harden it more.");
    expect(text.slice(reading.type!.match.phrase.start, reading.type!.match.phrase.end)).toBe("As a bonus action");
  });
});

describe("the matched sentence and the place of the phrase", () => {
  test("the phrase is in its sentence; the places count from the start of the text, in the text as written", () => {
    const text = "Brine Blessing.  Once you use this feature, you CAN’T use it again until you finish a Long Rest. Then rest.";
    const { match } = readFeatureText(text)!.uses!;
    expect(match.quote).toBe("Once you use this feature, you CAN’T use it again until you finish a Long Rest.");
    expect(text.slice(match.phrase.start, match.phrase.end)).toBe("CAN’T use it again until you finish a Long Rest");
  });

  test("empty text gives nothing", () => {
    expect(readFeatureText("")).toBeNull();
    expect(readFeatureText("   \n ")).toBeNull();
  });
});

describe("the frequency of a suggestion", () => {
  const LONG = "~:orcpub.dnd.e5.units/long-rest";
  test("is what the uses control writes for the same choice", () => {
    expect(suggestedFrequency(fixed(1, "short-rest"))).toEqual({ "~:units": "~:orcpub.dnd.e5.units/short-rest", "~:amount": 1 });
    expect(suggestedFrequency(fixed(2, "day"))).toEqual({ "~:units": "~:orcpub.dnd.e5.units/day", "~:amount": 2 });
    expect(suggestedFrequency({ amount: { kind: "prof" }, unit: "long-rest" })).toEqual({ "~:units": LONG, "~:amount": { "~:prof-bonus": true } });
    expect(suggestedFrequency({ amount: { kind: "ability", ability: "wis" }, unit: "long-rest" })).toEqual({ "~:units": LONG, "~:amount": { "~:ability": "~:wis", "~:min": 1 } });
  });
});
