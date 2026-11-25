import { expect, test } from "vitest";
import {
  concentrationDc,
  concentrationNoteText,
  conditionMenu,
  conditionStatus,
  conditionsOf,
  deadOfExhaustion,
  exhaustionEffects,
  exhaustionStatus,
  exhaustionValueText,
  maxCaption,
  type StatusState,
  shownMaxHitPoints,
  shownSpeeds,
  statusTokens,
  unconsciousAtZero,
} from "./conditions.ts";
import { CONDITION_KEYS } from "./play.ts";

const NO_SAVES = { successes: 0, failures: 0 };
const state = (patch: Partial<StatusState> = {}): StatusState => ({ conditions: [], currentHitPoints: null, deathSaves: NO_SAVES, exhaustion: 0, ...patch });

test("the menu lists the conditions that are not set, in the order of the list, with the notes immune and speed 0", () => {
  const menu = conditionMenu(["poisoned", "blinded"], ["charmed", "poisoned", "grappled"], 0);
  expect(menu.map((entry) => entry.condition)).toEqual([...CONDITION_KEYS.filter((key) => key !== "poisoned" && key !== "blinded"), "exhaustion"]);
  const note = (condition: string) => menu.find((entry) => entry.condition === condition)?.note;
  expect(note("charmed")).toBe("immune");
  expect(note("restrained")).toBe("speed 0");
  expect(note("grappled")).toBe("immune, speed 0");
  expect(note("prone")).toBe("");
  expect(menu.filter((entry) => entry.note.includes("speed 0")).map((entry) => entry.name)).toEqual([
    "Grappled",
    "Paralyzed",
    "Petrified",
    "Restrained",
    "Stunned",
    "Unconscious",
  ]);
});

test("the immunities come from the keys as built gives them; a key that is not a condition is left out", () => {
  expect(conditionsOf(["~:poisoned", "charmed", "disease", "orcpub.dnd.e5/frightened"])).toEqual(["charmed", "frightened", "poisoned"]);
});

test("the tokens: the concentration mark first, then the conditions in the order of the menu, then Unconscious at 0 hit points", () => {
  expect(statusTokens({ ...state({ conditions: ["prone", "blinded"], currentHitPoints: 0 }), concentration: "bless" })).toEqual([
    { kind: "concentration", spell: "bless" },
    { kind: "condition", condition: "blinded", auto: false },
    { kind: "condition", condition: "prone", auto: false },
    { kind: "condition", condition: "unconscious", auto: true },
  ]);
  expect(statusTokens({ ...state(), concentration: null })).toEqual([]);
});

test("the app adds Unconscious at 0 hit points, also for a Stable character, but not when dead or when the record has it", () => {
  expect(unconsciousAtZero(state({ currentHitPoints: 0 }))).toBe(true);
  expect(unconsciousAtZero(state({ currentHitPoints: 0, deathSaves: { successes: 3, failures: 0 } }))).toBe(true);
  expect(unconsciousAtZero(state({ currentHitPoints: 0, deathSaves: { successes: 0, failures: 3 } }))).toBe(false);
  expect(unconsciousAtZero(state({ currentHitPoints: 1 }))).toBe(false);
  expect(unconsciousAtZero(state({ currentHitPoints: null }))).toBe(false);
  // The token from the record takes the place of the one that the app adds, with its X.
  expect(statusTokens({ ...state({ conditions: ["unconscious"], currentHitPoints: 0 }), concentration: null })).toEqual([
    { kind: "condition", condition: "unconscious", auto: false },
  ]);
});

const SPEEDS = [
  { feet: 40, label: "unarmored" },
  { feet: 30, label: "swim" },
];

test("each speed-0 condition sets each speed to 0, with its name as the cause; the first in the order of the menu wins", () => {
  expect(shownSpeeds(SPEEDS, state())).toEqual({ speeds: SPEEDS, cause: null });
  expect(shownSpeeds(SPEEDS, state({ conditions: ["prone", "poisoned", "blinded"] })).cause).toBeNull();
  for (const condition of ["grappled", "paralyzed", "petrified", "restrained", "stunned", "unconscious"] as const) {
    expect(shownSpeeds(SPEEDS, state({ conditions: [condition] }))).toEqual({
      speeds: [
        { feet: 0, label: "unarmored" },
        { feet: 0, label: "swim" },
      ],
      cause: condition.charAt(0).toUpperCase() + condition.slice(1),
    });
  }
  expect(shownSpeeds(SPEEDS, state({ conditions: ["stunned", "grappled"] })).cause).toBe("Grappled");
});

test("the Unconscious token at 0 hit points also sets the speed to 0; a dead character's speed stays", () => {
  expect(shownSpeeds(SPEEDS, state({ currentHitPoints: 0 })).cause).toBe("Unconscious");
  expect(shownSpeeds(SPEEDS, state({ currentHitPoints: 0, deathSaves: { successes: 0, failures: 3 } })).cause).toBeNull();
});

test("the DC of the concentration save is 10, or half the damage rounded down when that is higher", () => {
  expect([1, 19, 20, 21, 22, 45].map(concentrationDc)).toEqual([10, 10, 10, 10, 11, 22]);
  expect(concentrationNoteText("Bless", 10)).toBe("Concentration on Bless: Constitution save, DC 10.");
});

test("the status texts of the box", () => {
  expect(conditionStatus({ kind: "add", condition: "poisoned" })).toBe("Poisoned added.");
  expect(conditionStatus({ kind: "remove", condition: "prone" })).toBe("Prone removed.");
  expect(conditionStatus({ kind: "end-concentration", name: "Bless" })).toBe("Concentration on Bless ended.");
});

test("the menu has Exhaustion as its last entry at level 0, and no Exhaustion entry above 0", () => {
  expect(conditionMenu([], [], 0).at(-1)).toEqual({ condition: "exhaustion", name: "Exhaustion", note: "" });
  expect(conditionMenu([], [], 2).map((entry) => entry.condition)).toEqual([...CONDITION_KEYS]);
});

test("the Exhaustion token comes after the Unconscious token at 0 hit points, with its level", () => {
  expect(statusTokens({ ...state({ conditions: ["prone"], currentHitPoints: 0, exhaustion: 3 }), concentration: null })).toEqual([
    { kind: "condition", condition: "prone", auto: false },
    { kind: "condition", condition: "unconscious", auto: true },
    { kind: "exhaustion", level: 3 },
  ]);
  expect(statusTokens({ ...state({ exhaustion: 0 }), concentration: null })).toEqual([]);
});

test("exhaustion at each level from 0 to 6: the speed, the maximum, its caption and Dead", () => {
  const rows = [0, 1, 2, 3, 4, 5, 6].map((level) => {
    const speeds = shownSpeeds([{ feet: 25, label: null }], state({ exhaustion: level }));
    return [level, speeds.speeds[0]?.feet, speeds.cause, shownMaxHitPoints(45, level), maxCaption(level), deadOfExhaustion(level)];
  });
  expect(rows).toEqual([
    [0, 25, null, 45, null, false],
    [1, 25, null, 45, null, false],
    [2, 12, "Exhaustion", 45, null, false],
    [3, 12, "Exhaustion", 45, null, false],
    [4, 12, "Exhaustion", 22, "Maximum halved\u00a0· Exhaustion", false],
    [5, 0, "Exhaustion", 22, "Maximum halved\u00a0· Exhaustion", false],
    [6, 0, "Exhaustion", 22, "Maximum halved\u00a0· Exhaustion", true],
  ]);
});

test("with two causes, the lowest speed shows with its cause; on the same result, the condition comes first", () => {
  expect(shownSpeeds(SPEEDS, state({ exhaustion: 2 }))).toEqual({
    speeds: [
      { feet: 20, label: "unarmored" },
      { feet: 15, label: "swim" },
    ],
    cause: "Exhaustion",
  });
  expect(shownSpeeds(SPEEDS, state({ conditions: ["restrained"], exhaustion: 2 })).cause).toBe("Restrained");
  expect(shownSpeeds(SPEEDS, state({ conditions: ["restrained"], exhaustion: 5 })).cause).toBe("Restrained");
});

test("at exhaustion level 6 the character is dead: no Unconscious token at 0 hit points", () => {
  expect(unconsciousAtZero(state({ currentHitPoints: 0, exhaustion: 6 }))).toBe(false);
  expect(unconsciousAtZero(state({ currentHitPoints: 0, exhaustion: 5 }))).toBe(true);
});

test("the popup of the token: the six levels, the levels that apply in bold", () => {
  const effects = exhaustionEffects(2);
  expect(effects.map((effect) => effect.text)).toEqual([
    "Disadvantage on ability checks",
    "Speed halved",
    "Disadvantage on attack rolls and saving throws",
    "Hit point maximum halved",
    "Speed reduced to 0",
    "Death",
  ]);
  expect(effects.filter((effect) => effect.applies).map((effect) => effect.level)).toEqual([1, 2]);
  expect(exhaustionEffects(0).some((effect) => effect.applies)).toBe(false);
  expect(exhaustionValueText(2, 6)).toBe("level 2 of 6");
});

test("the status texts of exhaustion", () => {
  expect(exhaustionStatus(0, 1)).toBe("Exhaustion added.");
  expect(exhaustionStatus(3, 0)).toBe("Exhaustion removed.");
  expect(exhaustionStatus(1, 2)).toBe("Exhaustion 1 → 2.");
  expect(exhaustionStatus(3, 4, { from: 30, to: 22 })).toBe("Exhaustion 3 → 4, hit points 30 → 22.");
});
