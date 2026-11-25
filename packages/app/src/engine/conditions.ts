// The rules of the Conditions and statuses box (ORC-322,
// docs/design/sheet-interactivity.md "Conditions and statuses" and
// "Concentration"): the tokens of the box and their order, the entries of
// the Add condition menu, speed 0 with its cause, the Unconscious token at 0
// hit points, the DC of the concentration note and the status texts. Pure
// functions of the play state: no engine and no React. applyConditions
// (conditions-apply.ts) writes a change with the play state writers.
// Exhaustion (ORC-323) adds its menu entry, its token and its speed effect
// here.
import { unqualify, untag } from "./content.ts";
import { CONDITION_KEYS, type Condition, DEATH_SAVE_LIMIT, type DeathSaves } from "./play.ts";

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
}

/**
 * True when the app adds the Unconscious token by itself: the hit points are
 * 0 and the character is not dead (three failures). A Stable character keeps
 * it. The token is not in the record. When the record has Unconscious, that
 * token shows in its place.
 */
export const unconsciousAtZero = (state: StatusState) =>
  state.currentHitPoints === 0 && state.deathSaves.failures < DEATH_SAVE_LIMIT && !state.conditions.includes("unconscious");

/** A token of the box, in the order of the box. */
export type StatusToken =
  /** The concentration mark, with the spell key. */
  | { kind: "concentration"; spell: string }
  /** A condition. `auto` is the Unconscious token that the app adds at 0 hit points: it has no X. */
  | { kind: "condition"; condition: Condition; auto: boolean };

/**
 * The tokens of the box, in the order of the spec: the concentration mark,
 * the conditions in the order of the menu, then the Unconscious token that
 * the app adds at 0 hit points. The button "+ Add condition" comes after
 * them.
 */
export function statusTokens(state: StatusState & { concentration: string | null }): StatusToken[] {
  return [
    ...(state.concentration === null ? [] : [{ kind: "concentration" as const, spell: state.concentration }]),
    ...CONDITION_KEYS.filter((condition) => state.conditions.includes(condition)).map((condition) => ({ kind: "condition" as const, condition, auto: false })),
    ...(unconsciousAtZero(state) ? [{ kind: "condition" as const, condition: "unconscious" as const, auto: true }] : []),
  ];
}

/** An entry of the Add condition menu: a condition that is not set, with its notes. */
export interface ConditionMenuEntry {
  condition: Condition;
  name: string;
  /** "immune" when the character is immune to it, and "speed 0" when it sets the speed to 0. "" for none. */
  note: string;
}

/**
 * The entries of the Add condition menu: the conditions that are not set, in
 * the order of the list. The user can add a condition that the character is
 * immune to. Unconscious is always in it while the record does not have it,
 * also at 0 hit points.
 */
export function conditionMenu(conditions: readonly Condition[], immune: readonly Condition[]): ConditionMenuEntry[] {
  return CONDITION_KEYS.filter((condition) => !conditions.includes(condition)).map((condition) => ({
    condition,
    name: conditionName(condition),
    note: [immune.includes(condition) && "immune", SPEED_ZERO.has(condition) && "speed 0"].filter(Boolean).join(", "),
  }));
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
 * result, the first cause in the order of the menu. Exhaustion (ORC-323)
 * adds its effects to the list.
 */
export function shownSpeeds<S extends SpeedLine>(speeds: readonly S[], state: StatusState): { speeds: S[]; cause: string | null } {
  const zero: SpeedEffect[] = CONDITION_KEYS.filter(
    (condition) => SPEED_ZERO.has(condition) && (state.conditions.includes(condition) || (condition === "unconscious" && unconsciousAtZero(state))),
  ).map((condition) => ({ cause: conditionName(condition), feet: () => 0 }));
  const first = speeds[0]?.feet ?? 0;
  const lowest = zero.reduce<SpeedEffect | null>((low, effect) => (low === null || effect.feet(first) < low.feet(first) ? effect : low), null);
  if (lowest === null) return { speeds: [...speeds], cause: null };
  return { speeds: speeds.map((speed) => ({ ...speed, feet: lowest.feet(speed.feet) })), cause: lowest.cause };
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

/** An action of the box. The name of the spell is the name that the token shows. */
export type ConditionAction = { kind: "add" | "remove"; condition: Condition } | { kind: "end-concentration"; name: string };

/** The status line after an action: "Poisoned added.", "Poisoned removed.", "Concentration on Bless ended." */
export function conditionStatus(action: ConditionAction): string {
  if (action.kind === "end-concentration") return `Concentration on ${action.name} ended.`;
  return `${conditionName(action.condition)} ${action.kind === "add" ? "added" : "removed"}.`;
}
