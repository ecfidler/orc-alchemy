import { expect, test } from "vitest";
import {
  concentrationDc,
  concentrationNoteText,
  conditionMenu,
  conditionStatus,
  conditionsOf,
  type StatusState,
  shownSpeeds,
  statusTokens,
  unconsciousAtZero,
} from "./conditions.ts";
import { CONDITION_KEYS } from "./play.ts";

const NO_SAVES = { successes: 0, failures: 0 };
const state = (patch: Partial<StatusState> = {}): StatusState => ({ conditions: [], currentHitPoints: null, deathSaves: NO_SAVES, ...patch });

test("the menu lists the conditions that are not set, in the order of the list, with the notes immune and speed 0", () => {
  const menu = conditionMenu(["poisoned", "blinded"], ["charmed", "poisoned", "grappled"]);
  expect(menu.map((entry) => entry.condition)).toEqual(CONDITION_KEYS.filter((key) => key !== "poisoned" && key !== "blinded"));
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
