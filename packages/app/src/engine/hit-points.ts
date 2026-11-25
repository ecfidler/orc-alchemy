// The rules of the Hit points box (ORC-314, docs/design/sheet-interactivity.md
// "Hit points"): Damage, Heal and Set HP of the Hit points popup, and Set
// temp HP and Remove of the Temporary hit points popup. Each rule is a pure
// function of the numbers of the play state and the amount. It gives the new
// values to write and the text of the status line. No engine and no React:
// applyHitPoints (hit-points-apply.ts) writes the values with the play state
// writers (play.ts).
import { DEATH_SAVE_LIMIT, type DeathSaves } from "./play.ts";

/** The numbers of the play state that the rules read. */
export interface HitPointState {
  /** The current hit points as the sheet shows them: from 0 to `max`. */
  current: number;
  /**
   * The hit point maximum that shows. Each rule uses it (spec, "The hit
   * point maximum"). Exhaustion level 4 halves it (ORC-323).
   */
  max: number;
  /**
   * The hit point maximum of the engine, before exhaustion. The rules write
   * null (full hit points) only at it. At a halved maximum they write the
   * number, so that the hit points do not come back when the exhaustion
   * level goes down.
   */
  full: number;
  /** The temporary hit points, 0 when there are none. */
  temp: number;
  deathSaves: DeathSaves;
}

/** The new values after an action, and the text of the status line. */
export interface HitPointChange {
  /**
   * The current hit points to write: null at the maximum of the engine (`full`), which is full hit points.
   * Not given when the action does not change them, so that the stored value
   * stays as it is, also a stored value above the maximum.
   */
  current?: number | null;
  /** The temporary hit points to write: 0 removes them. */
  temp: number;
  deathSaves: DeathSaves;
  /** What changed, for the status line: "12 damage (5 from the temporary hit points)." */
  status: string;
}

/** An action of the two popups. The amount is a whole number of 0 or more. */
export type HitPointAction =
  | { kind: "damage" | "heal" | "set" | "set-temp"; amount: number }
  | {
      kind: "remove-temp";
    };

const NO_SAVES: DeathSaves = { successes: 0, failures: 0 };

/** An amount as a whole number of 0 or more. */
const whole = (amount: number) => (Number.isFinite(amount) ? Math.max(0, Math.trunc(amount)) : 0);

/** The current hit points to write: null at the maximum of the engine or above. */
const toStored = (current: number, state: HitPointState) => (current >= state.full ? null : Math.max(0, current));

/**
 * Damage (spec, "Damage"). The damage takes the temporary hit points first.
 * The damage that is left lowers the current hit points, which stop at 0.
 * When the hit points go to 0, or were at 0, and the damage that is left
 * past 0 is the maximum or more, the character dies at once: three
 * failures. Damage at 0 hit points adds one failure, and it clears the
 * successes of a Stable character. Damage that the temporary hit points
 * take all of adds no failure.
 */
export function damage(state: HitPointState, amount: number): HitPointChange {
  const hit = whole(amount);
  const fromTemp = Math.min(state.temp, hit);
  const left = hit - fromTemp;
  const temp = state.temp - fromTemp;
  const current = Math.max(0, state.current - left);
  const over = left - state.current;
  const text = `${hit} damage${fromTemp > 0 ? ` (${fromTemp} from the temporary hit points)` : ""}`;
  const change = (deathSaves: DeathSaves, result = ""): HitPointChange => ({
    ...(left > 0 && { current: toStored(current, state) }),
    temp,
    deathSaves,
    status: `${text}${result}.`,
  });
  if (left > 0 && current === 0 && over >= state.max) return change({ successes: 0, failures: DEATH_SAVE_LIMIT }, ": instant death");
  if (state.current > 0 || left === 0) return change(state.deathSaves);
  // At 0 hit points before the damage.
  const { successes, failures } = state.deathSaves;
  if (failures >= DEATH_SAVE_LIMIT) return change(state.deathSaves);
  if (successes >= DEATH_SAVE_LIMIT) return change({ successes: 0, failures: failures + 1 }, ": no longer stable, one failure");
  return change({ successes, failures: failures + 1 }, " at 0 hit points: one failure");
}

/**
 * Heal (spec, "Heal"). It always works, also from Dead. It adds to the
 * current hit points and stops at the maximum, and it clears the two death
 * save counts.
 */
export function heal(state: HitPointState, amount: number): HitPointChange {
  const healed = whole(amount);
  return { current: toStored(Math.min(state.max, state.current + healed), state), temp: state.temp, deathSaves: NO_SAVES, status: `${healed} healed.` };
}

/**
 * Set HP (spec, "Set HP"). The amount is the current hit points, at most the
 * maximum. An amount above 0 clears the death save counts. The temporary
 * hit points do not change.
 */
export function setHitPoints(state: HitPointState, amount: number): HitPointChange {
  const current = Math.min(state.max, whole(amount));
  return {
    current: toStored(current, state),
    temp: state.temp,
    deathSaves: current > 0 ? NO_SAVES : state.deathSaves,
    status: `Hit points set to ${current}.`,
  };
}

/**
 * Set temp HP (spec, "The Temporary hit points popup"). The new amount
 * replaces the old amount, also when it is smaller. 0 takes the temporary
 * hit points away.
 */
export function replaceTempHitPoints(state: HitPointState, amount: number): HitPointChange {
  const temp = whole(amount);
  if (temp === 0) return removeTempHitPoints(state);
  return { temp, deathSaves: state.deathSaves, status: `Temporary hit points set to ${temp}.` };
}

/** Remove: takes the temporary hit points away. */
export function removeTempHitPoints(state: HitPointState): HitPointChange {
  return { temp: 0, deathSaves: state.deathSaves, status: "Temporary hit points removed." };
}

/** The change of an action of the two popups. */
export function applyHitPointAction(state: HitPointState, action: HitPointAction): HitPointChange {
  switch (action.kind) {
    case "damage":
      return damage(state, action.amount);
    case "heal":
      return heal(state, action.amount);
    case "set":
      return setHitPoints(state, action.amount);
    case "set-temp":
      return replaceTempHitPoints(state, action.amount);
    case "remove-temp":
      return removeTempHitPoints(state);
  }
}
