// The suite of the golden characters (ORC-237). The README of this folder
// has the rules.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUILT_IN } from "../src/rules2024/built-in.ts";
import { recordsOf } from "../src/rules2024/content.ts";
import { tester } from "./characters/tester.ts";
import { checkGolden, defineGolden, describeMismatch } from "./harness.ts";
import { GOLDEN_CHARACTERS } from "./index.ts";

describe.each(GOLDEN_CHARACTERS.map((character) => [character.name, character] as const))("%s", (_, character) => {
  const results = checkGolden(character);
  it.each(results.map((result) => [result.level, result] as const))("level %i has the expected values and no problem", (_, { problems, mismatches }) => {
    expect(problems).toEqual([]);
    expect(mismatches.map(describeMismatch)).toEqual([]);
  });
});

describe("the harness", () => {
  it("names the character, the level and the sheet value of a wrong expected value", () => {
    const [check] = tester.checks;
    const wrong = defineGolden({ ...tester, checks: [{ ...check, expected: { ...check.expected, armorClass: 13 } }] });
    const [{ mismatches }] = checkGolden(wrong);
    expect(mismatches.map(describeMismatch)).toEqual(["Tester (test class), level 1, armorClass: expected 13, got 12"]);
  });

  it("refuses a level outside 1 to 20 or a level two times", () => {
    const [check] = tester.checks;
    expect(() => defineGolden({ ...tester, checks: [{ ...check, level: 21 }] })).toThrow("each checked level must be from 1 to 20 and come once");
    expect(() => defineGolden({ ...tester, checks: [check, check] })).toThrow("each checked level must be from 1 to 20 and come once");
  });
});

describe("the plan", () => {
  const readme = readFileSync(new URL("./README.md", import.meta.url), "utf8");
  const rows = readme
    .slice(readme.indexOf("## Plan"))
    .split("\n")
    .filter((line) => line.startsWith("|") && !line.startsWith("| Character") && !/^\|[\s:-]+\|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );

  it("lists 14 characters, each with three levels or more and level 20", () => {
    expect(rows).toHaveLength(14);
    for (const [, , , , levels] of rows) {
      const numbers = levels.split(",").map(Number);
      expect(numbers.length).toBeGreaterThanOrEqual(3);
      expect(numbers).toContain(20);
    }
  });

  it("covers each species and each background of the built-in pack", () => {
    const names = (type: "species" | "backgrounds") => recordsOf(BUILT_IN, type).map(({ record }) => record.name);
    expect(new Set(rows.map((row) => row[2]))).toEqual(new Set(names("species")));
    expect(new Set(rows.map((row) => row[3]))).toEqual(new Set(names("backgrounds")));
  });
});
