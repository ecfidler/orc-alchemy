import { expect, test } from "vitest";
import { usesSentence } from "./uses-example.ts";

const LONG = "~:orcpub.dnd.e5.units/long-rest";

test("the one sentence of a scaled amount", () => {
  const sentence = (amount: object, levelName: string | null = null, level = 5, score = 16) => usesSentence({ "~:units": LONG, "~:amount": amount }, levelName, level, score);
  expect(sentence({ "~:level": true, "~:times": 5 }, "Paladin")).toBe("Uses equal 5 × your paladin level. A level 5 character gets 25.");
  expect(sentence({ "~:level": true })).toBe("Uses equal your character level. A level 5 character gets 5.");
  expect(sentence({ "~:ability": "~:wis", "~:min": 1 })).toBe("Uses equal your Wisdom modifier (minimum 1). A level 5 character with 16 Wisdom gets 3.");
  expect(sentence({ "~:ability": "~:orcpub.dnd.e5.character/int" }, null, 5, 8)).toBe("Uses equal your Intelligence modifier. A level 5 character with 8 Intelligence gets -1.");
  expect(sentence({ "~:prof-bonus": true, "~:plus": 2 })).toBe("Uses equal your proficiency bonus + 2. A level 5 character gets 5.");
  expect(sentence({ "~:prof-bonus": true, "~:plus": -1 }, null, 17)).toBe("Uses equal your proficiency bonus − 1. A level 17 character gets 5.");
  expect(sentence({ "~:plus": 3 })).toBe("Uses equal 3. A level 5 character gets 3.");
  // A minimum that is not a number does not apply, as in the engine.
  expect(sentence({ "~:level": true, "~:min": null })).toBe("Uses equal your character level. A level 5 character gets 5.");
});
