import { describe, expect, test } from "vitest";
import { applyHitPointAction, damage, type HitPointState, heal, removeTempHitPoints, replaceTempHitPoints, setHitPoints } from "./hit-points.ts";

const state = (over: Partial<HitPointState> = {}): HitPointState => ({
  current: 26,
  max: 44,
  temp: 0,
  deathSaves: { successes: 0, failures: 0 },
  ...over,
});

describe("Damage", () => {
  test("lowers the current hit points", () => {
    expect(damage(state(), 12)).toEqual({ current: 14, temp: 0, deathSaves: { successes: 0, failures: 0 }, status: "12 damage." });
  });

  test("takes the temporary hit points first", () => {
    expect(damage(state({ temp: 5 }), 12)).toEqual({
      current: 19,
      temp: 0,
      deathSaves: { successes: 0, failures: 0 },
      status: "12 damage (5 from the temporary hit points).",
    });
    // The temporary hit points take all of it: the stored hit points stay as they are.
    expect(damage(state({ temp: 8 }), 5)).toEqual({
      temp: 3,
      deathSaves: { successes: 0, failures: 0 },
      status: "5 damage (5 from the temporary hit points).",
    });
    expect(damage(state({ temp: 5 }), 75).status).toBe("75 damage (5 from the temporary hit points): instant death.");
  });

  test("stops at 0", () => {
    expect(damage(state(), 30)).toMatchObject({ current: 0, deathSaves: { successes: 0, failures: 0 }, status: "30 damage." });
  });

  test("kills at once when the damage left past 0 is the maximum or more: three failures", () => {
    // 26 to 0 leaves 44, the maximum.
    expect(damage(state({ deathSaves: { successes: 1, failures: 0 } }), 70)).toEqual({
      current: 0,
      temp: 0,
      deathSaves: { successes: 0, failures: 3 },
      status: "70 damage: instant death.",
    });
    // The temporary hit points take their part first: 5 + 26 + 43 is not enough.
    expect(damage(state({ temp: 5 }), 74).deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(damage(state({ temp: 5 }), 75).deathSaves).toEqual({ successes: 0, failures: 3 });
    // At 0 hit points, damage of the maximum or more kills too.
    expect(damage(state({ current: 0 }), 44).deathSaves).toEqual({ successes: 0, failures: 3 });
  });

  test("at 0 hit points adds one failure", () => {
    expect(damage(state({ current: 0, deathSaves: { successes: 1, failures: 1 } }), 3)).toEqual({
      current: 0,
      temp: 0,
      deathSaves: { successes: 1, failures: 2 },
      status: "3 damage at 0 hit points: one failure.",
    });
    // A dead character stays at three failures.
    expect(damage(state({ current: 0, deathSaves: { successes: 0, failures: 3 } }), 3)).toMatchObject({
      deathSaves: { successes: 0, failures: 3 },
      status: "3 damage.",
    });
  });

  test("at 0 hit points, damage that the temporary hit points take all of adds no failure", () => {
    expect(damage(state({ current: 0, temp: 5, deathSaves: { successes: 1, failures: 0 } }), 4)).toMatchObject({
      temp: 1,
      deathSaves: { successes: 1, failures: 0 },
    });
  });

  test("a Stable character loses the successes and gets one failure", () => {
    expect(damage(state({ current: 0, deathSaves: { successes: 3, failures: 1 } }), 2)).toEqual({
      current: 0,
      temp: 0,
      deathSaves: { successes: 0, failures: 2 },
      status: "2 damage: no longer stable, one failure.",
    });
  });
});

describe("Heal", () => {
  test("adds to the current hit points and stops at the maximum, which it writes as null", () => {
    expect(heal(state(), 8)).toEqual({ current: 34, temp: 0, deathSaves: { successes: 0, failures: 0 }, status: "8 healed." });
    expect(heal(state(), 18).current).toBeNull();
    expect(heal(state(), 100)).toMatchObject({ current: null, status: "100 healed." });
  });

  test("always works, also from Dead, and clears the two death save counts", () => {
    expect(heal(state({ current: 0, deathSaves: { successes: 0, failures: 3 } }), 4)).toEqual({
      current: 4,
      temp: 0,
      deathSaves: { successes: 0, failures: 0 },
      status: "4 healed.",
    });
    expect(heal(state({ current: 0, deathSaves: { successes: 3, failures: 2 } }), 1).deathSaves).toEqual({ successes: 0, failures: 0 });
  });

  test("does not change the temporary hit points", () => {
    expect(heal(state({ temp: 6 }), 2).temp).toBe(6);
  });
});

describe("Set HP", () => {
  test("writes the amount; the maximum or above writes null", () => {
    expect(setHitPoints(state(), 20)).toEqual({ current: 20, temp: 0, deathSaves: { successes: 0, failures: 0 }, status: "Hit points set to 20." });
    expect(setHitPoints(state(), 44).current).toBeNull();
    expect(setHitPoints(state(), 60)).toMatchObject({ current: null, status: "Hit points set to 44." });
  });

  test("an amount above 0 clears the death saves; 0 keeps them", () => {
    const dying = state({ current: 0, deathSaves: { successes: 2, failures: 1 } });
    expect(setHitPoints(dying, 1).deathSaves).toEqual({ successes: 0, failures: 0 });
    expect(setHitPoints(dying, 0)).toMatchObject({ current: 0, deathSaves: { successes: 2, failures: 1 }, status: "Hit points set to 0." });
  });

  test("does not change the temporary hit points", () => {
    expect(setHitPoints(state({ temp: 7 }), 10).temp).toBe(7);
  });
});

describe("Set temp HP and Remove", () => {
  test("the new amount replaces the old amount, also when it is smaller", () => {
    expect(replaceTempHitPoints(state({ temp: 8 }), 3)).toEqual({
      temp: 3,
      deathSaves: { successes: 0, failures: 0 },
      status: "Temporary hit points set to 3.",
    });
    expect(replaceTempHitPoints(state({ temp: 3 }), 8).temp).toBe(8);
  });

  test("0 or Remove takes them away", () => {
    expect(replaceTempHitPoints(state({ temp: 8 }), 0)).toMatchObject({ temp: 0, status: "Temporary hit points removed." });
    expect(removeTempHitPoints(state({ temp: 8 }))).toMatchObject({ temp: 0, status: "Temporary hit points removed." });
  });

  test("do not change the hit points or the death saves", () => {
    const dying = state({ current: 0, deathSaves: { successes: 1, failures: 2 } });
    expect(replaceTempHitPoints(dying, 5)).toMatchObject({ deathSaves: { successes: 1, failures: 2 } });
    // No value for the hit points: the stored value stays, also one above the maximum.
    expect(replaceTempHitPoints(dying, 5)).not.toHaveProperty("current");
    expect(removeTempHitPoints(state({ temp: 2 }))).not.toHaveProperty("current");
  });
});

test("applyHitPointAction runs the rule of each action", () => {
  const s = state({ temp: 5 });
  expect(applyHitPointAction(s, { kind: "damage", amount: 12 })).toEqual(damage(s, 12));
  expect(applyHitPointAction(s, { kind: "heal", amount: 8 })).toEqual(heal(s, 8));
  expect(applyHitPointAction(s, { kind: "set", amount: 20 })).toEqual(setHitPoints(s, 20));
  expect(applyHitPointAction(s, { kind: "set-temp", amount: 9 })).toEqual(replaceTempHitPoints(s, 9));
  expect(applyHitPointAction(s, { kind: "remove-temp" })).toEqual(removeTempHitPoints(s));
});
