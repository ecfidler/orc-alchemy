// The subrace of a race copy (ORC-248): the values of a pack subrace as values
// of the copy of its race.
import { isMap, SUBRACE_TYPE, tag } from "./content.ts";
import { optionOrigin } from "./custom.ts";
import { ABILITY_KEYS, type RaceCopy } from "./custom-race.ts";
import type { Content, StrictEntity } from "./engine.ts";
import { subracePick } from "./race-step.ts";
import { picksUnder } from "./reconcile.ts";

/** The keys of the numbers of a race and its subrace that the engine adds: the hit points for each level, the number to choose of a choice, and each ability score increase. */
const SUMMED_KEYS = new Set(["max-hp-bonus", "choose", ...ABILITY_KEYS].map(tag));

/**
 * The two values at the key of a race and its subrace as one value: maps
 * as one map, and numbers that the engine adds as their sum. Else the
 * subrace's value, as for a flying speed, where the engine uses that of
 * the subrace.
 */
function merged(key: string, ofRace: unknown, ofSubrace: unknown): unknown {
  if (ofRace === undefined) return ofSubrace;
  if (typeof ofRace === "number" && typeof ofSubrace === "number") {
    return SUMMED_KEYS.has(key) ? ofRace + ofSubrace : ofSubrace;
  }
  if (!isMap(ofRace) || !isMap(ofSubrace)) return ofSubrace;
  const result: Record<string, unknown> = { ...ofRace };
  for (const [k, value] of Object.entries(ofSubrace)) result[k] = merged(k, ofRace[k], value);
  return result;
}

/** The fields of a pack subrace that replace those of the race in withSubrace, and the fields that it adds to those of the race. The other fields are the name, the key, the race and the option source. */
const SUBRACE_OWN_FIELDS = ["size", "speed", "darkvision"].map(tag);
const SUBRACE_ADDED_FIELDS = ["abilities", "props", "profs", "spells", "traits"].map(tag);
const PROFS = tag("profs");
/** The keys of the :profs of a pack subrace that the engine uses. */
const SUBRACE_PROFS = new Set(["tool", "skill-options"].map(tag));

/** The :profs of a pack subrace that the engine uses: the tools and the skill choice. undefined when it has neither. */
function subraceProfs(profs: Record<string, unknown>): Record<string, unknown> | undefined {
  const used = Object.entries(profs).filter(([key]) => SUBRACE_PROFS.has(key));
  return used.length > 0 ? Object.fromEntries(used) : undefined;
}

/**
 * The race record with the values of the pack subrace record as its own,
 * for a copy of the race of a character with that subrace (ORC-248). The
 * size, the speed and the darkvision are those of the subrace when it has
 * them. Ability score increases and the hit points for each level are
 * sums. The proficiencies, the resistances and the options of a choice
 * are those of the two together, and a choice of both has the two numbers
 * to choose together. A flying or swimming speed is that of the subrace.
 * The spells and the features of the subrace come after those of the
 * race. The only choice of a subrace that the engine offers is its skill
 * choice, so the record gets no other choice of the subrace.
 */
export function withSubrace(race: Record<string, unknown>, subrace: Record<string, unknown>): Record<string, unknown> {
  const result = { ...race };
  for (const field of SUBRACE_OWN_FIELDS) if (subrace[field] !== undefined) result[field] = subrace[field];
  for (const field of SUBRACE_ADDED_FIELDS) {
    const ofRace = race[field];
    const ofSubrace = field === PROFS && isMap(subrace[field]) ? subraceProfs(subrace[field]) : subrace[field];
    if (ofSubrace === undefined) continue;
    result[field] = Array.isArray(ofSubrace) ? [...(Array.isArray(ofRace) ? ofRace : []), ...ofSubrace] : merged(field, ofRace, ofSubrace);
  }
  return result;
}

/** The record with the skills as skill proficiencies, and with that many fewer skills to choose in its skill choice. A choice of no skill goes. */
function withPickedSkills(record: Record<string, unknown>, skills: string[]): Record<string, unknown> {
  if (skills.length === 0) return record;
  const [propsKey, skillKey, optionsKey, chooseKey] = ["props", "skill-prof", "skill-options", "choose"].map(tag);
  const props = isMap(record[propsKey]) ? record[propsKey] : {};
  const { [optionsKey]: choice, ...profs } = isMap(record[PROFS]) ? record[PROFS] : {};
  const choose = isMap(choice) ? Number(choice[chooseKey] ?? 0) - skills.length : 0;
  const { [PROFS]: _profs, ...rest } = record;
  const nextProfs = { ...profs, ...(choose > 0 && { [optionsKey]: { ...(choice as object), [chooseKey]: choose } }) };
  return {
    ...rest,
    [propsKey]: {
      ...props,
      [skillKey]: { ...(isMap(props[skillKey]) ? props[skillKey] : {}), ...Object.fromEntries(skills.map((skill) => [tag(skill), true])) },
    },
    ...(Object.keys(nextProfs).length > 0 && { [PROFS]: nextProfs }),
  };
}

/**
 * The copy of the race with the key with the values of the character's
 * pack subrace (withSubrace), and the subrace pick as a held pick. The
 * character's skill picks under the subrace are skill proficiencies of
 * the copy, and held picks: the skill choice of the copy is a choice of
 * the race, so a pick under the subrace does not stay. The copy itself
 * when the character has no subrace of the race, when the copy has the
 * subrace already (an SRD subrace, srdRaceCopy), or when no enabled pack
 * has the subrace. homebrew is the loaded content's.
 */
export function withPickedSubrace(copy: RaceCopy, key: string, entity: StrictEntity | null, homebrew: Content["homebrew"]): RaceCopy {
  const picks = entity === null ? [] : picksUnder(entity, ["race", key]);
  const pick = subracePick(picks);
  if (pick === undefined || copy.held.some((p) => p.join("/") === pick.join("/"))) return copy;
  const origin = optionOrigin(homebrew, undefined, SUBRACE_TYPE, pick[3]);
  if (origin.from !== "pack") return copy;
  const skills = picks.filter((p) => p.length === 6 && p[3] === pick[3] && p[4] === "skill-proficiency");
  return {
    record: withPickedSkills(
      withSubrace(copy.record, origin.item),
      skills.map((p) => p[5]),
    ),
    held: [...copy.held, pick, ...skills],
  };
}
