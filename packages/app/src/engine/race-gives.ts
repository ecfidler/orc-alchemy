// What the engine gives a race that the record of the race does not have (ORC-249, ORC-355): the proficiencies, the
// damage resistances, the hit points, the spells, the traits and the attacks of a character with the race. The copy of
// an SRD race holds them as values (custom.ts srdRaceCopy), and the detail panel of the Race step shows them
// (origin-detail.ts raceDetail). The engine gives them as the modifiers of the race, so a probe character with the race
// reads them.

import { unqualify } from "./content.ts";
import type { Content, StrictEntity } from "./engine.ts";
import { engine } from "./engine.ts";
import { SUBRACE_KEY, soleSubrace, templateRace } from "./race-step.ts";
import { withOptionOf } from "./reconcile.ts";
import type { Resistance } from "./sheet.ts";

/** An area attack of the built character, such as a Dragonborn's Breath Weapon. */
export interface AreaAttack {
  name: string;
  "attack-type"?: string;
  "area-type"?: string;
  /** The length of a cone, in feet. */
  length?: number;
  "line-width"?: number;
  "line-length"?: number;
  /** The ability of the saving throw, as a full key. */
  save?: string;
  "damage-type"?: string;
  "damage-die"?: number;
}

/** What the engine gives a race and the record of the race does not have (raceGives). */
export interface RaceGives {
  /** The keys of the skill proficiencies, such as "perception". */
  skills: string[];
  /** The keys of the tool proficiencies, such as "smiths-tools". */
  tools: string[];
  /** The keys of the weapon proficiencies, such as "longsword". */
  weapons: string[];
  /** The hit points for each level, such as 1 for the Hill Dwarf. 0 for none. */
  hitPoints: number;
  /** The damage types of the resistances, such as "poison". */
  resistances: string[];
  /** The ability score increases, by the full key of the ability. */
  abilities: Record<string, number>;
  /** The spells, as a race stores them: the character level that unlocks the spell, and its level, ability and key. */
  spells: { level: number; value: { level: number; ability: string; key: string } }[];
  /** The traits, each with its name, page and summary. */
  traits: Record<string, unknown>[];
  /**
   * The area attacks, which a pack race holds only as the text of a feature (breathWeaponText). Without the pick
   * that gives its area, such as a Dragonborn's ancestry, an attack has no area-type yet (hasArea).
   */
  attacks: AreaAttack[];
}

/** True when the attack has its area: the pick that gives it, such as a Dragonborn's ancestry, is made. */
export const hasArea = (attack: AreaAttack) => attack["area-type"] != null;

/** The level of the probe character: each spell of a race is unlocked, and a trait's text names each spell. */
const PROBE_LEVEL = 20;

/** The class of the probe character for the weapon proficiencies: the default class has each martial weapon, and this class has no weapon of an SRD race. */
const WEAPON_PROBE_CLASS = "wizard";

/** What the probe reads of a character as the engine builds it against the content. */
function probed(entity: StrictEntity, content?: Content) {
  const { built } = engine().evaluate(entity, content);
  return {
    weapons: (built["weapon-profs"] as string[] | null) ?? [],
    // The hit points for each level without those of the CON modifier.
    hitPoints:
      Number(built["hit-point-level-bonus"] ?? 0) - Number((built["ability-bonuses"] as Record<string, number> | null)?.["orcpub.dnd.e5.character/con"] ?? 0),
    skills: Object.keys(built["skill-profs"] ?? {}),
    tools: Object.keys(built["tool-profs"] ?? {}),
    // A resistance with a qualifier has no place in a pack race, which stores the damage type only.
    resistances: ((built.resistances as Resistance[] | null) ?? []).filter((r) => !r.qualifier).map((r) => r.value),
    // The scores, not the engine's ability-increases, which do not have the ability picks of a Half-Elf or a Variant Human.
    abilities: built.abilities as Record<string, number>,
    spells: Object.entries(built["spells-known"] ?? {}).flatMap(([level, known]) =>
      (known?.__entries ?? []).map(([[source], spell]) => ({ source, level: Number(level), ability: spell.ability, key: spell.key })),
    ),
    traits: built.traits ?? [],
    attacks: ((built.attacks as AreaAttack[] | null) ?? []).filter((a) => a["attack-type"] === "area"),
  };
}

const raceGivesCache = new Map<string, RaceGives>();
let probeBase: { levels: StrictEntity[]; top: ReturnType<typeof probed>; weaponProbe: StrictEntity; weapons: string[] } | undefined;

/** The probe characters with no race, of levels 1 to PROBE_LEVEL of the default class, and what they have. Made once. */
function base() {
  const e = engine();
  if (probeBase === undefined) {
    const levels = [e.emptyCharacter() as StrictEntity];
    const classKey = Object.keys(e.evaluate(levels[0]).built.levels ?? {})[0];
    while (levels.length < PROBE_LEVEL) levels.push(e.addLevel(levels[levels.length - 1], classKey));
    const weaponProbe = e.setClass(levels[0], 0, WEAPON_PROBE_CLASS);
    probeBase = { levels, top: probed(levels[PROBE_LEVEL - 1]), weaponProbe, weapons: probed(weaponProbe).weapons };
  }
  return probeBase;
}

/**
 * What the race with the key gives that its record does not have: the skill and tool proficiencies (Perception for
 * the Elf), the damage resistances (poison for the Dwarf), the ability score increases, the spells (the Tiefling),
 * the traits and the attacks. They are what a new character of level PROBE_LEVEL with only the race has, without
 * what that character has with no race. A spell's unlock level is the first level at which the character with the
 * race knows it.
 *
 * With picked, the probe character has the race as that entity has it, with the picks under it. Then the result has
 * what the picks give too, such as the tool of a Dwarf or the resistance of a Dragonborn's ancestry. Without picked, a
 * choice of the race gives nothing. The probe builds against the content, or the SRD alone without it. For the SRD
 * alone and no picked, each key is computed once: the pinned SRD content does not change.
 */
export function raceGives(key: string, picked?: StrictEntity, content?: Content): RaceGives {
  const cacheable = picked === undefined && content?.homebrew === undefined && content?.magicItems === undefined;
  const cached = cacheable ? raceGivesCache.get(key) : undefined;
  if (cached !== undefined) return cached;
  const e = engine();
  const { levels, top: before, weaponProbe, weapons: ownWeapons } = base();
  const probedWithRace = (from: StrictEntity) => {
    const entity = e.select(from, ["race"], key, content) as StrictEntity;
    return probed(picked === undefined ? entity : withOptionOf(entity, picked, ["race", key]), content);
  };
  const withRace = (level: number) => probedWithRace(levels[level - 1]);
  const top = withRace(PROBE_LEVEL);
  const raceSpells = top.spells.filter((spell) => !before.spells.some((s) => s.source === spell.source && s.key === spell.key));
  const unlocked = new Map<string, number>();
  for (let level = 1; level <= PROBE_LEVEL && unlocked.size < raceSpells.length; level++) {
    const known = withRace(level).spells;
    for (const spell of raceSpells) {
      if (!unlocked.has(spell.key) && known.some((s) => s.source === spell.source && s.key === spell.key)) unlocked.set(spell.key, level);
    }
  }
  const ownTraits = new Set(before.traits.map((t) => t.name));
  const ownAttacks = new Set(before.attacks.map((a) => a.name));
  const gives: RaceGives = {
    skills: top.skills.filter((skill) => !before.skills.includes(skill)),
    tools: top.tools.filter((tool) => !before.tools.includes(tool)),
    weapons: probedWithRace(weaponProbe).weapons.filter((weapon) => !ownWeapons.includes(weapon)),
    hitPoints: top.hitPoints - before.hitPoints,
    resistances: top.resistances.filter((r) => !before.resistances.includes(r)),
    // The increase of each score that the race makes.
    abilities: Object.fromEntries(
      Object.entries(top.abilities)
        .map(([ability, bonus]): [string, number] => [ability, bonus - (before.abilities[ability] ?? 0)])
        .filter(([, bonus]) => bonus !== 0),
    ),
    spells: raceSpells
      .map((spell) => ({ level: unlocked.get(spell.key) ?? 1, value: { level: spell.level, ability: spell.ability, key: spell.key } }))
      .sort((a, b) => a.level - b.level),
    traits: top.traits
      .filter((t) => !ownTraits.has(t.name))
      .map((t) => ({ name: t.name, ...(t.page != null && { page: t.page }), ...(t.summary != null && { summary: t.summary }) })),
    attacks: top.attacks.filter((a) => !ownAttacks.has(a.name)),
  };
  if (cacheable) raceGivesCache.set(key, gives);
  return gives;
}

/**
 * The text of the Breath Weapon, the only area attack of an SRD race: the area, the saving throw and the damage type,
 * and the damage of the SRD Breath Weapon by level, in our own words, because the engine gives the dice for one level
 * only. An attack with no area yet (hasArea) names the choice that gives them, `choice`, such as "Draconic Ancestry".
 */
export function breathWeaponText(attack: AreaAttack, choice = "a choice of the race"): string {
  const die = `d${attack["damage-die"]}`;
  const scale = `The damage is 3${die} at level 6, 4${die} at level 11 and 5${die} at level 16.`;
  if (!hasArea(attack)) {
    return (
      `Each creature in the area makes a saving throw, DC 8 + your CON modifier + your proficiency bonus. ` +
      `It takes 2${die} damage on a failed save, and half on a success. ${scale} ` +
      `Your ${choice} gives the area, the saving throw and the damage type.`
    );
  }
  const area =
    attack["area-type"] === "line"
      ? `a line ${attack["line-width"]} ft. wide and ${attack["line-length"]} ft. long`
      : `a ${attack.length} ft. ${attack["area-type"]}`;
  const save = unqualify(attack.save ?? "").toUpperCase();
  return (
    `Each creature in ${area} makes a ${save} saving throw, DC 8 + your CON modifier + your proficiency bonus. ` +
    `It takes 2${die} ${attack["damage-type"]} damage on a failed save, and half on a success. ${scale}`
  );
}

/** How the Breath Weapon is used, as its feature in a copy has it (custom.ts breathWeaponTrait): an action, with one use for each short rest. */
export const BREATH_WEAPON_USE = "It takes an action. You can use it again after a short or long rest.";

/** What the detail panel of a race shows from the engine (raceDetailGives). */
export interface RaceDetailGives {
  /** What the race, with its one subrace when it has one (soleSubrace), gives. */
  gives: RaceGives;
  /** The name of the choice of the race that gives an attack its area, such as "Draconic Ancestry". null when no attack needs one. */
  areaChoice: string | null;
}

const detailCache = new WeakMap<Content, Map<string, RaceDetailGives>>();

/**
 * What the engine gives the race with the key, for its detail panel: raceGives of the race, with its one subrace
 * picked when it has one (the pick of the race picks it too), and the choice of the race that gives an attack its
 * area. The probe has no other pick, so the text is the same for each character. Each key is computed once for each
 * content: a probe evaluates the character some times (about 60 ms).
 */
export function raceDetailGives(key: string, content: Content): RaceDetailGives {
  let forContent = detailCache.get(content);
  if (forContent === undefined) {
    forContent = new Map();
    detailCache.set(content, forContent);
  }
  const cached = forContent.get(key);
  if (cached !== undefined) return cached;
  const e = engine();
  const option = templateRace(key, content);
  const sole = soleSubrace(option);
  const withRace = e.select(base().levels[0], ["race"], key, content) as StrictEntity;
  const picked = sole === null ? undefined : (e.select(withRace, ["race", key, SUBRACE_KEY], sole.key, content) as StrictEntity);
  const gives = raceGives(key, picked, content);
  let areaChoice: string | null = null;
  const pending = gives.attacks.filter((a) => !hasArea(a)).map((a) => a.name);
  if (pending.length > 0) {
    // The required choice of the race whose first option gives the attack its area.
    const choice = (option?.selections ?? []).find((s) => {
      if ((s.min ?? 0) < 1 || s.options.length === 0) return false;
      const entity = e.select(picked ?? withRace, ["race", key, s.key], s.options[0].key, content) as StrictEntity;
      return probed(entity, content).attacks.some((a) => pending.includes(a.name) && hasArea(a));
    });
    areaChoice = choice?.name ?? null;
  }
  const result = { gives, areaChoice };
  forContent.set(key, result);
  return result;
}
