// The rules of the Conditions and statuses box (ORC-322,
// docs/design/sheet-interactivity.md "Conditions and statuses" and
// "Concentration"): the tokens of the box and their order, the entries of
// the Add condition menu, speed 0 with its cause, the Unconscious token at 0
// hit points, the DC of the concentration note and the status texts, and
// exhaustion (ORC-323, "Exhaustion"): its menu entry, its token, its effects
// on the speed and the hit point maximum, and Dead at level 6. Pure
// functions of the play state: no engine and no React. applyConditions
// (conditions-apply.ts) writes a change with the play state writers.
import { EXHAUSTION_TEXTS } from "./condition-texts.ts";
import { unqualify, untag } from "./content.ts";
import { CONDITION_KEYS, type Condition, DEATH_SAVE_LIMIT, type DeathSaves, EXHAUSTION_LIMIT } from "./play.ts";

/** The name of a condition on the sheet: "Poisoned". */
export const conditionName = (condition: Condition) => condition.charAt(0).toUpperCase() + condition.slice(1);

/** The conditions that set each speed of the sheet to 0. */
export const SPEED_ZERO: ReadonlySet<Condition> = new Set<Condition>(["grappled", "paralyzed", "petrified", "restrained", "stunned", "unconscious"]);

/** The conditions of a list of condition keys, as built gives them ("poisoned", "~:poisoned"), in the order of the menu. */
export function conditionsOf(keys: readonly string[]): Condition[] {
  const names = new Set(keys.map((key) => unqualify(untag(key))));
  return CONDITION_KEYS.filter((condition) => names.has(condition));
}

/** The play state that the box reads. */
export interface StatusState {
  /** The conditions that are set, from the record. */
  conditions: readonly Condition[];
  /** The current hit points that show; null is full hit points. */
  currentHitPoints: number | null;
  deathSaves: DeathSaves;
  /** The exhaustion level, from 0 to 6. */
  exhaustion: number;
}

/**
 * True when the app adds the Unconscious token by itself: the hit points are
 * 0 and the character is not dead (three failures, or exhaustion level 6). A Stable character keeps
 * it. The token is not in the record. When the record has Unconscious, that
 * token shows in its place.
 */
export const unconsciousAtZero = (state: StatusState) =>
  state.currentHitPoints === 0 &&
  state.deathSaves.failures < DEATH_SAVE_LIMIT &&
  !deadOfExhaustion(state.exhaustion) &&
  !state.conditions.includes("unconscious");

/** A token of the box, in the order of the box. */
export type StatusToken =
  /** The concentration mark, with the spell key. */
  | { kind: "concentration"; spell: string }
  /** A condition. `auto` is the Unconscious token that the app adds at 0 hit points: it has no X. */
  | { kind: "condition"; condition: Condition; auto: boolean }
  /** The Exhaustion token, with its level from 1 to 6. */
  | { kind: "exhaustion"; level: number };

/**
 * The tokens of the box, in the order of the spec: the concentration mark,
 * the conditions in the order of the menu, then the Unconscious token that
 * the app adds at 0 hit points, then the Exhaustion token above level 0.
 * The button "+ Add condition" comes after them.
 */
export function statusTokens(state: StatusState & { concentration: string | null }): StatusToken[] {
  return [
    ...(state.concentration === null ? [] : [{ kind: "concentration" as const, spell: state.concentration }]),
    ...CONDITION_KEYS.filter((condition) => state.conditions.includes(condition)).map((condition) => ({ kind: "condition" as const, condition, auto: false })),
    ...(unconsciousAtZero(state) ? [{ kind: "condition" as const, condition: "unconscious" as const, auto: true }] : []),
    ...(state.exhaustion > 0 ? [{ kind: "exhaustion" as const, level: exhaustionLevel(state.exhaustion) }] : []),
  ];
}

/** The key of the menu entry and of the token of exhaustion. */
export const EXHAUSTION = "exhaustion";

/** The name of exhaustion on the sheet. */
export const EXHAUSTION_NAME = "Exhaustion";

/** An entry of the Add condition menu: a condition that is not set, or exhaustion, with its notes. */
export interface ConditionMenuEntry {
  condition: Condition | typeof EXHAUSTION;
  name: string;
  /** "immune" when the character is immune to it, and "speed 0" when it sets the speed to 0. "" for none. */
  note: string;
}

/**
 * The entries of the Add condition menu: the conditions that are not set, in
 * the order of the list. The user can add a condition that the character is
 * immune to. Unconscious is always in it while the record does not have it,
 * also at 0 hit points. Exhaustion is the last entry at level 0: it adds
 * the Exhaustion token at level 1.
 */
export function conditionMenu(conditions: readonly Condition[], immune: readonly Condition[], exhaustion: number): ConditionMenuEntry[] {
  const entries: ConditionMenuEntry[] = CONDITION_KEYS.filter((condition) => !conditions.includes(condition)).map((condition) => ({
    condition,
    name: conditionName(condition),
    note: [immune.includes(condition) && "immune", SPEED_ZERO.has(condition) && "speed 0"].filter(Boolean).join(", "),
  }));
  return exhaustion > 0 ? entries : [...entries, { condition: EXHAUSTION, name: EXHAUSTION_NAME, note: "" }];
}

/** A speed of the sheet. */
export interface SpeedLine {
  feet: number;
  label: string | null;
}

/** What changes the speed: the cause, as the caption names it, and the result for a speed. */
interface SpeedEffect {
  cause: string;
  feet: (feet: number) => number;
}

/**
 * The speeds that show, and the cause of the change for the caption under
 * the speed, or null with no change. Each condition of SPEED_ZERO, also the
 * Unconscious token at 0 hit points, sets each speed to 0. With two causes,
 * the lowest result of the first speed shows with its cause; with the same
 * result, the first cause in the order of the menu, so exhaustion comes
 * last. Exhaustion level 2 halves each speed, rounded down, and level 5 sets
 * each to 0.
 */
export function shownSpeeds<S extends SpeedLine>(speeds: readonly S[], state: StatusState): { speeds: S[]; cause: string | null } {
  const zero: SpeedEffect[] = CONDITION_KEYS.filter(
    (condition) => SPEED_ZERO.has(condition) && (state.conditions.includes(condition) || (condition === "unconscious" && unconsciousAtZero(state))),
  ).map((condition) => ({ cause: conditionName(condition), feet: () => 0 }));
  const effects = [...zero, ...exhaustionSpeed(state.exhaustion)];
  const first = speeds[0]?.feet ?? 0;
  const lowest = effects.reduce<SpeedEffect | null>((low, effect) => (low === null || effect.feet(first) < low.feet(first) ? effect : low), null);
  if (lowest === null) return { speeds: [...speeds], cause: null };
  return { speeds: speeds.map((speed) => ({ ...speed, feet: lowest.feet(speed.feet) })), cause: lowest.cause };
}

// Exhaustion.

/** The level from which each speed shows at half. */
export const SPEED_HALVED_FROM = 2;
/** The level from which the hit point maximum shows at half. */
export const MAX_HALVED_FROM = 4;
/** The level from which each speed shows 0. */
export const SPEED_ZERO_FROM = 5;

/** A stored level as a level from 0 to 6. */
const exhaustionLevel = (level: number) => (Number.isInteger(level) ? Math.max(0, Math.min(EXHAUSTION_LIMIT, level)) : 0);

/** True at exhaustion level 6: the character is dead, and the Death saves box shows "Dead". */
export const deadOfExhaustion = (level: number) => exhaustionLevel(level) >= EXHAUSTION_LIMIT;

/** True from exhaustion level 4: the hit point maximum shows at half. */
export const maxHalved = (level: number) => exhaustionLevel(level) >= MAX_HALVED_FROM;

/** Half a value, rounded down to a whole number, with no 5-foot step: 25 becomes 12, and 45 becomes 22. */
export const halved = (value: number) => Math.floor(value / 2);

/** The hit point maximum that shows: the engine value, halved from exhaustion level 4. Each hit point rule uses it. */
export const shownMaxHitPoints = (max: number, level: number) => (maxHalved(level) ? halved(max) : max);

/**
 * The caption under the Hit points box when exhaustion halves the maximum, or null. The sheet shows it in caps. A
 * no-break space keeps the dot on the first line when the caption needs two.
 */
export const maxCaption = (level: number) => (maxHalved(level) ? `Maximum halved\u00a0· ${EXHAUSTION_NAME}` : null);

/** The effect of exhaustion on the speed: level 5 sets it to 0, and level 2 halves it. None below level 2. */
function exhaustionSpeed(level: number): SpeedEffect[] {
  const n = exhaustionLevel(level);
  if (n >= SPEED_ZERO_FROM) return [{ cause: EXHAUSTION_NAME, feet: () => 0 }];
  if (n >= SPEED_HALVED_FROM) return [{ cause: EXHAUSTION_NAME, feet: halved }];
  return [];
}

/** The state of the circles of the Exhaustion token for a screen reader, after the name: "level 2 of 6". */
export const exhaustionValueText = (level: number, limit: number) => `level ${level} of ${limit}`;

/** The effects of the six levels for the popup of the token: the level, its rule text, and true for a level that applies. */
export function exhaustionEffects(level: number): { level: number; text: string; applies: boolean }[] {
  return EXHAUSTION_TEXTS.map((text, i) => ({ level: i + 1, text, applies: i < exhaustionLevel(level) }));
}

// The concentration mark.

/** The DC of the Constitution save after damage: 10, or half the damage if that is higher, rounded down. */
export const concentrationDc = (damage: number) => Math.max(10, Math.floor(damage / 2));

/** The concentration note after Damage: the spell key of the mark and the DC of the save. */
export interface ConcentrationNote {
  spell: string;
  dc: number;
}

/** The text of the note: "Concentration on Bless: Constitution save, DC 10." `name` is the name of the spell that shows. */
export const concentrationNoteText = (name: string, dc: number) => `Concentration on ${name}: Constitution save, DC ${dc}.`;

/** The name of the token of the mark: "Concentrating on Bless". */
export const concentrationLabel = (name: string) => `Concentrating on ${name}`;

// Actions of the box.

/**
 * An action of the box. The name of the spell is the name that the token
 * shows. "exhaustion" sets the level: 1 from the menu, one more or one less
 * from the circles, and 0 from the X.
 */
export type ConditionAction =
  | { kind: "add" | "remove"; condition: Condition }
  | { kind: "end-concentration"; name: string }
  | { kind: "exhaustion"; level: number };

/** The status line after an action: "Poisoned added.", "Poisoned removed.", "Concentration on Bless ended." */
export function conditionStatus(action: Exclude<ConditionAction, { kind: "exhaustion" }>): string {
  if (action.kind === "end-concentration") return `Concentration on ${action.name} ended.`;
  return `${conditionName(action.condition)} ${action.kind === "add" ? "added" : "removed"}.`;
}

/**
 * The status line after a change of the exhaustion level: "Exhaustion
 * added.", "Exhaustion removed.", "Exhaustion 1 → 2." With `hitPoints`, the
 * current hit points that level 4 wrote down: "Exhaustion 3 → 4, hit points
 * 30 → 22."
 */
export function exhaustionStatus(from: number, to: number, hitPoints?: { from: number; to: number }): string {
  if (from === 0) return `${EXHAUSTION_NAME} added.`;
  if (to === 0) return `${EXHAUSTION_NAME} removed.`;
  return `${EXHAUSTION_NAME} ${from} → ${to}${hitPoints ? `, hit points ${hitPoints.from} → ${hitPoints.to}` : ""}.`;
}
