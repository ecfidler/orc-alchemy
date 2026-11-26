// The race copy (ORC-136, ORC-247): an SRD race as a form record, with the
// values that the character's picks under the race give.
import { asSet, tag } from "./content.ts";
import { formTraits, tagKeys } from "./custom.ts";
import type { StrictEntity } from "./engine.ts";
import { type AreaAttack, breathWeaponText, hasArea, raceGives } from "./race-gives.ts";
import { pickableSubraces, subraceOptions, subracePick, templateRace } from "./race-step.ts";
import { picksUnder, withoutOption } from "./reconcile.ts";
import { srdList } from "./srd-lists.ts";

/** The six ability keys, as a race's :abilities has them. */
export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"].map((a) => `orcpub.dnd.e5.character/${a}`);

/**
 * The Breath Weapon, the only area attack of an SRD race, as a feature
 * of a pack race, which has no attacks: an action with one use for each
 * short rest, with its text (breathWeaponText).
 */
function breathWeaponTrait(attack: AreaAttack): Record<string, unknown> {
  return {
    name: attack.name,
    type: tag("action"),
    frequency: { units: tag("orcpub.dnd.e5.units/short-rest"), amount: 1 },
    description: breathWeaponText(attack),
  };
}

/** The choices of an SRD race that a pack race can hold, by the key of the choice in the template: the key of the choice in :profs. */
const KEPT_CHOICES: Record<string, string> = { languages: "language-options", "skill-proficiency": "skill-options" };

/**
 * The language choice and the skill choice of the SRD race with the key,
 * as the :profs of a pack race: {:language-options {:choose 1 :options
 * {:elvish true}}}. The template gives the number to choose and the
 * options. The engine gives the choice of the copy the key of the SRD
 * choice, so the character's picks stay.
 *
 * With subrace, the key of an SRD subrace of the race, the result also
 * has the choices of the subrace that the character must make, such as
 * the language of the High Elf. A choice of the race and the same choice
 * of the subrace become one choice, of the two numbers together.
 */
function raceChoices(key: string, subrace?: string): Record<string, unknown> {
  // The option of the SRD race in the template, with its choices: the template with no homebrew has the SRD races only.
  const option = templateRace(key, { homebrew: undefined });
  const own = option?.selections ?? [];
  const ofSubrace = subraceOptions(option).find((o) => o.key === subrace)?.selections ?? [];
  const choices: Record<string, { choose: number; options: Record<string, true> }> = {};
  for (const s of [...own, ...ofSubrace]) {
    const field = KEPT_CHOICES[s.key];
    // A choice with a minimum of 0, such as those of the engine's custom subrace, is not one that the character must make.
    const choose = s.min ?? 1;
    if (field === undefined || s.options.length === 0 || choose === 0) continue;
    const choice = choices[field] ?? { choose: 0, options: {} };
    for (const o of s.options) choice.options[o.key] = true;
    choices[field] = { choose: choice.choose + choose, options: choice.options };
  }
  return choices;
}

/** The picks of a character under its race that a copy of the race holds, and the entity that has only them under the race (racePicks). */
interface RacePicks {
  /** The entity without the picks under the race that the copy does not hold as values. */
  entity: StrictEntity;
  /** The paths of the picks that the copy holds as values, such as ["race", "dwarf", "tool-proficiency", "smiths-tools"]. */
  held: string[][];
}

/**
 * The picks under the race with the key that a copy holds as fixed
 * values, because a pack race does not have their choices: the tool of a
 * Dwarf, the ability picks of a Half-Elf, the variant of a Human with its
 * picks, the ancestry of a Dragonborn, and an SRD subrace with the picks
 * under it, such as the cantrip of a High Elf. Not the picks of a choice
 * that the copy keeps (KEPT_CHOICES), and not a pack subrace, whose
 * values come from its record (withSubrace). undefined when the entity
 * has no pick under the race with the key, for example because it has
 * another race.
 */
function racePicks(entity: StrictEntity, key: string): RacePicks | undefined {
  const picks = picksUnder(entity, ["race", key]);
  if (picks.length === 0) return undefined;
  // The engine's custom subrace has picks that the probe does not read, such as a speed, so the copy does not hold it, and Save names it.
  const srdSubraces = new Set(pickableSubraces(templateRace(key, { homebrew: undefined })).map((o) => o.key));
  const dropped = (path: string[]) => (path[2] === "subrace" ? !srdSubraces.has(path[3]) : KEPT_CHOICES[path[2]] !== undefined);
  const top = picks.filter((p) => p.length === 4 && dropped(p));
  return { entity: top.reduce((result, path) => withoutOption(result, path), entity), held: picks.filter((p) => !dropped(p)) };
}

/** A copy of an SRD race for a character (srdRaceCopy). */
export interface RaceCopy {
  record: Record<string, unknown>;
  /** The paths of the character's picks under the race whose values the record has. A save of the copy removes them, but loses nothing. */
  held: string[][];
}

/**
 * The SRD race with the key as a form record in the shape of a pack race
 * (RaceForm.tsx), for its copy, or undefined if the engine's content list
 * (content/races.json) has no such race. The record has what the list has:
 * the name, the description (:help), the size, the speed, the darkvision,
 * the ability score increases, the languages, the weapon proficiencies and
 * the features (formTraits). What the list does not have comes from the
 * engine (raceGives): the skill proficiencies, the damage resistances, the
 * spells, and each trait whose name the list does not have, such as those
 * of the Tiefling. The language choice and the skill choice of the race
 * are choices of the record (raceChoices).
 *
 * With the entity of a character of this race, the record also has what
 * the character's picks under the race give, as fixed values (racePicks):
 * a tool, ability score increases, a skill, a damage resistance, and an
 * attack as a feature (breathWeaponTrait). An SRD subrace is such a pick:
 * the record has its ability score increase, its weapons, its hit points
 * for each level, its features and the spell that the character picked,
 * and its language choice is a choice of the record. held has those
 * picks.
 *
 * Without a variant pick, the Human gets +1 to each ability, which the
 * engine gives with its variant Standard Human. The race form has no
 * saving throw advantage, so the copy has it only as the text of a
 * feature. The copy has no Subrace choice. The SRD list loads once, as
 * its own chunk.
 */
export async function srdRaceCopy(key: string, entity?: StrictEntity | null): Promise<RaceCopy | undefined> {
  const race = (await srdList("races")).find((r) => r.key === key);
  if (race === undefined) return undefined;
  const { key: _key, subraces: _subraces, size, languages, "weapon-proficiencies": weapons, traits, abilities: _abilities, ...rest } = race;
  const picks = entity == null ? undefined : racePicks(entity, key);
  const held = picks?.held ?? [];
  // Without a held pick, the probe is that of the race alone, which is computed once.
  const gives = raceGives(key, held.length > 0 ? picks?.entity : undefined);
  // The engine gives the Human's +1 to each ability with the variant Standard Human, so a Human without a variant pick gets it here.
  const standard = key === "human" && !held.some((p) => p[2] === "variant");
  const abilities = standard ? Object.fromEntries(ABILITY_KEYS.map((a) => [a, 1])) : gives.abilities;
  const flags = (keys: string[]) => Object.fromEntries(keys.map((k) => [k, true]));
  // The list has the weapons of the race. The probe also has those of a subrace.
  const allWeapons = [...new Set([...(Array.isArray(weapons) ? (weapons as string[]) : []), ...gives.weapons])];
  const props = {
    ...(allWeapons.length > 0 && { "weapon-prof": flags(allWeapons) }),
    ...(gives.hitPoints > 0 && { "max-hp-bonus": gives.hitPoints }),
    ...(gives.skills.length > 0 && { "skill-prof": flags(gives.skills) }),
    ...(gives.resistances.length > 0 && { "damage-resistance": flags(gives.resistances) }),
  };
  const profs = {
    ...(gives.tools.length > 0 && { tool: flags(gives.tools) }),
    ...raceChoices(key, subracePick(held)?.[3]),
  };
  const listed = Array.isArray(traits) ? traits : [];
  const names = new Set(listed.map((t: Record<string, unknown>) => t.name));
  const record = tagKeys({
    ...rest,
    ...(Object.keys(abilities).length > 0 && { abilities }),
    ...(Object.keys(props).length > 0 && { props }),
    ...(Object.keys(profs).length > 0 && { profs }),
    traits: [...formTraits([...listed, ...gives.traits.filter((t) => !names.has(t.name))]), ...gives.attacks.filter(hasArea).map(breathWeaponTrait)],
  }) as Record<string, unknown>;
  // A keyword value and a set, which tagKeys does not make.
  return {
    held,
    record: {
      ...record,
      ...(typeof size === "string" && { [tag("size")]: tag(size) }),
      [tag("languages")]: asSet(Array.isArray(languages) ? languages : []),
      // A spell's ability and key are keywords.
      ...(gives.spells.length > 0 && {
        [tag("spells")]: gives.spells.map(({ level, value }) => ({
          [tag("level")]: level,
          [tag("value")]: { [tag("level")]: value.level, [tag("ability")]: tag(value.ability), [tag("key")]: tag(value.key) },
        })),
      }),
    },
  };
}

/** The record of srdRaceCopy for no character: the SRD race with the key, with no value from a pick. */
export const srdRaceRecord = async (key: string): Promise<Record<string, unknown> | undefined> => (await srdRaceCopy(key))?.record;
