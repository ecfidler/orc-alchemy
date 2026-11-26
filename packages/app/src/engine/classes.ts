// The hit points of the Class step (ORC-58, ORC-351, docs/design/character-builder.md "Hit points"): the hit points of
// each level of a class, read from the strict entity, the method of the class (Average or By level), its total, and
// the mutations of the Hit points section.
//
// The engine keeps the hit points of a level in the hit-points selection of the level: the option "average", "roll"
// or "manual-entry", with a number. "average" counts the average of the die, whatever its number; "roll" and
// "manual-entry" count their number. Level 1 of the first class has no selection: the engine counts the maximum of the
// die. The method of a class is not stored: it is Average when each level with a selection has "average", and else By
// level.
import type { BuilderOption, BuilderSelection } from "./builder.ts";
import type { Built2014, Content, Engine, StrictEntity } from "./engine.ts";

/** The hit-points option keys: how a level's hit points were set. */
export type HitPointsMethod = "average" | "roll" | "manual-entry";

/** The method of the hit points of a class: the average at each level, or a number for each level. */
export type ClassHitPointsMethod = "average" | "by-level";

type StrictSelection = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/option"?: StrictOption;
  "~:orcpub.entity.strict/options"?: StrictOption[];
};
type StrictOption = {
  "~:orcpub.entity.strict/key": string;
  "~:orcpub.entity.strict/int-value"?: number;
  "~:orcpub.entity.strict/selections"?: StrictSelection[];
};

/**
 * The hit points stored at a hit-points selection's actualPath, such as
 * ["class", "wizard", "levels", "level-1", "hit-points"]; null when none are.
 * The path alternates selection and option keys.
 */
export function storedHitPoints(entity: StrictEntity, actualPath: string[]): { method: HitPointsMethod; value: number } | null {
  let selections = ((typeof entity === "string" ? JSON.parse(entity) : entity) as StrictOption)["~:orcpub.entity.strict/selections"];
  let option: StrictOption | undefined;
  for (let i = 0; i < actualPath.length; i += 2) {
    const selection = selections?.find((s) => s["~:orcpub.entity.strict/key"] === `~:${actualPath[i]}`);
    const options = selection?.["~:orcpub.entity.strict/options"] ?? [selection?.["~:orcpub.entity.strict/option"]];
    // The last selection's option is the method, whatever its key.
    option = i + 1 < actualPath.length ? options.find((o) => o?.["~:orcpub.entity.strict/key"] === `~:${actualPath[i + 1]}`) : options[0];
    selections = option?.["~:orcpub.entity.strict/selections"];
  }
  const value = option?.["~:orcpub.entity.strict/int-value"];
  if (option === undefined || value === undefined) return null;
  return { method: option["~:orcpub.entity.strict/key"].replace(/^~:/, "") as HitPointsMethod, value };
}

/** The old builder's average for a hit die: half the die, plus 1. The engine's "average" counts the same. */
export const averageHitPoints = (die: number) => die / 2 + 1;

/** A roll of the hit die, from 1 to die. */
export const rollHitPoints = (die: number, random: () => number = Math.random) => 1 + Math.floor(random() * die);

/** True for the hit points of a class level: the hit-points selection that takes a number. */
export const isHitPoints = (selection: BuilderSelection) => selection.key === "hit-points" && selection.requireValue;

/** The hit points of each picked level of the class option, in the order of the levels. Level 1 of the first class has none. */
export function hitPointSelections(option: BuilderOption): BuilderSelection[] {
  return option.selections
    .filter((s) => s.sequential)
    .flatMap((levels) => levels.options.filter((o) => o.selected).flatMap((o) => o.selections.filter(isHitPoints)));
}

/** The hit points of one level of a class. */
export interface LevelHitPoints {
  level: number;
  /** The actualPath of the hit-points selection of the level; null for level 1 of the first class, which cannot change. */
  path: string[] | null;
  /** The hit points that the die gives at the level; null when the level has none yet. */
  value: number | null;
  /** How the value was set; null for the level 1 of the first class and for a level with no value. */
  stored: HitPointsMethod | null;
}

/** The Hit points section of a class block. */
export interface ClassHitPoints {
  classKey: string;
  die: number;
  /** The method, from the stored levels; null when no level can change (level 1 of the first class only). */
  method: ClassHitPointsMethod | null;
  levels: LevelHitPoints[];
  /** The levels with no value: the picks left. */
  left: number;
  /** The Constitution modifier, which each level adds. */
  constitution: number;
  /** The other bonus of each level of the class, such as the feat Tough or Draconic Resilience. */
  otherPerLevel: number;
  /** The hit points of the class: its levels, its bonuses of each level, and for the first class the bonuses that are not per level. */
  total: number;
}

const CON = "orcpub.dnd.e5.character/con";

/** The value that a stored option counts: the average of the die for "average", else its number. */
const countOf = (stored: { method: HitPointsMethod; value: number }, die: number) => (stored.method === "average" ? averageHitPoints(die) : stored.value);

/**
 * The Hit points section of each class option, in the order of the options; the first is the first class. The totals
 * add up to the hit point maximum of the engine (built "max-hit-points"): each level adds its value and the bonus of
 * each level (built "hit-point-level-bonus", the Constitution modifier and bonuses such as the feat Tough, and the
 * bonus of the class in "class-hit-point-level-bonus"). The rest of the maximum, a bonus that is not per level, is in the
 * total of the first class.
 */
export function classHitPoints(entity: StrictEntity, built: Built2014, options: BuilderOption[]): ClassHitPoints[] {
  const perLevel = (built["hit-point-level-bonus"] as number | undefined) ?? 0;
  const byClass = (built["class-hit-point-level-bonus"] as Record<string, number> | null | undefined) ?? {};
  const constitution = built["ability-bonuses"]?.[CON] ?? 0;
  const sections = options.map((option, index): ClassHitPoints => {
    const classLevels = built.levels?.[option.key];
    const die = classLevels?.["hit-die"] ?? 0;
    const count = classLevels?.["class-level"] ?? 0;
    const selections = new Map(hitPointSelections(option).map((s) => [s.actualPath[3], s]));
    const levels: LevelHitPoints[] = [];
    for (let level = 1; level <= count; level++) {
      if (index === 0 && level === 1) {
        levels.push({ level, path: null, value: die, stored: null });
        continue;
      }
      const selection = selections.get(`level-${level}`);
      if (selection === undefined) continue;
      const stored = storedHitPoints(entity, selection.actualPath);
      levels.push({ level, path: selection.actualPath, value: stored ? countOf(stored, die) : null, stored: stored?.method ?? null });
    }
    const changeable = levels.filter((l) => l.path !== null);
    const method: ClassHitPointsMethod | null = changeable.length === 0 ? null : changeable.every((l) => l.stored === "average") ? "average" : "by-level";
    const classBonus = byClass[option.key] ?? 0;
    const dice = levels.reduce((sum, l) => sum + (l.value ?? 0), 0);
    return {
      classKey: option.key,
      die,
      method,
      levels,
      left: changeable.filter((l) => l.value === null).length,
      constitution,
      otherPerLevel: perLevel - constitution + classBonus,
      total: dice + count * (perLevel + classBonus),
    };
  });
  const rest = (built["max-hit-points"] ?? 0) - sections.reduce((sum, s) => sum + s.total, 0);
  if (sections.length > 0 && rest !== 0) sections[0] = { ...sections[0], total: sections[0].total + rest };
  return sections;
}

const signed = (n: number) => (n < 0 ? `−${-n}` : `+${n}`);

/**
 * The text of the hit die beside the total: "Hit die d10, and +1 from Constitution at each level", or with a bonus of
 * each level other than Constitution, "Hit die d10, +1 from Constitution and +2 from other bonuses at each level".
 */
export function hitDieText({ die, constitution, otherPerLevel }: ClassHitPoints): string {
  const con = `${signed(constitution)} from Constitution`;
  return otherPerLevel === 0
    ? `Hit die d${die}, and ${con} at each level`
    : `Hit die d${die}, ${con} and ${signed(otherPerLevel)} from other bonuses at each level`;
}

/** The engine's write of the hit points of the level at `path`. */
const write = (e: Engine, entity: StrictEntity, path: string[], method: HitPointsMethod, value: number, content?: Content) =>
  e.setField(entity, [...path, method], value, content) as StrictEntity;

/**
 * The entity with the method of the class. Average writes the average at each level that can change. By level writes
 * the average as a typed number at each level that has the average, so that the fields show it and the total stays;
 * a number that was rolled or typed stays. `kept` are the levels of the class from before a change to Average: By
 * level puts back the rolled or typed number of each level in it, and a level that is new since then gets the average.
 */
export function setHitPointsMethod(
  e: Engine,
  entity: StrictEntity,
  hp: ClassHitPoints,
  method: ClassHitPointsMethod,
  content?: Content,
  kept: LevelHitPoints[] = [],
): StrictEntity {
  const average = averageHitPoints(hp.die);
  let next = entity;
  for (const { level, path, stored } of hp.levels) {
    if (path === null) continue;
    const before = kept.find((l) => l.level === level);
    if (method === "average") next = write(e, next, path, "average", average, content);
    else if (before?.value != null && (before.stored === "roll" || before.stored === "manual-entry"))
      next = write(e, next, path, before.stored, before.value, content);
    else if (stored === "average") next = write(e, next, path, "manual-entry", average, content);
  }
  return next;
}

/** The entity with a number typed in for the level at `path`. */
export const typeHitPoints = (e: Engine, entity: StrictEntity, path: string[], value: number, content?: Content) =>
  write(e, entity, path, "manual-entry", value, content);

/**
 * The entity with a roll of the die at each of the levels (a roll button, or Roll all with each level that can
 * change). `random` gives a number from 0 to 1, as Math.random does; a test gives its own.
 */
export function rollLevels(e: Engine, entity: StrictEntity, hp: ClassHitPoints, levels: number[], random: () => number = Math.random, content?: Content) {
  let next = entity;
  for (const { level, path } of hp.levels)
    if (path !== null && levels.includes(level)) next = write(e, next, path, "roll", rollHitPoints(hp.die, random), content);
  return next;
}

/** The levels of the class that can change: each level but level 1 of the first class. Roll all rolls them. */
export const changeableLevels = (hp: ClassHitPoints) => hp.levels.filter((l) => l.path !== null).map((l) => l.level);

/**
 * The entity with the average at each level of the class that has no hit points: for a class with the method
 * Average, after a new class or a new level. The engine gives a new level no hit points.
 */
export function withAverageHitPoints(e: Engine, entity: StrictEntity, classKey: string, content?: Content): StrictEntity {
  const { built, selections } = e.evaluate(entity, content);
  const die = built.levels?.[classKey]?.["hit-die"] ?? 0;
  let next = entity;
  for (const s of selections)
    if (s.key === "hit-points" && s.actualPath[0] === "class" && s.actualPath[1] === classKey && s.selected.length === 0)
      next = write(e, next, s.actualPath, "average", averageHitPoints(die), content);
  return next;
}
