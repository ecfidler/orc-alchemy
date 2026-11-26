// The Proficiencies step (ORC-346, docs/design/character-builder.md "The Proficiencies step"): its selections in
// groups (Skills, Languages, Tools), one section for each source in the order class, background, race, feat, the
// Expertise sections after the skill sections, the heading name of each section, and the "Already has" line of each
// group.

import type { TemplateSelection } from "@pubdoor/dmv";
import type { BuilderSelection } from "./builder.ts";
import { type FixedProficiency, type ProficiencyKind, proficiencyKind, sectionNames, type TopSource } from "./selection-control.ts";
import { keyToName, SKILLS } from "./sheet.ts";

/**
 * The groups of the step, in their order. "Other proficiencies" holds a selection that gives no skill, language or
 * tool, such as the armor and the weapons of the engine's "Custom" race.
 */
export const GROUP_NAMES = ["Skills", "Languages", "Tools", "Other proficiencies"] as const;
export type GroupName = (typeof GROUP_NAMES)[number];

/** A group of the step: its heading, the "Already has" tokens, and its sections in order. */
export interface ProficiencyGroup {
  name: GroupName;
  /** The texts of the tokens: "Insight (Acolyte)", or the name alone when the builder finds no source. */
  alreadyHas: string[];
  sections: BuilderSelection[];
}

/** The group that each kind of fixed proficiency shows in. */
const KIND_GROUP: Record<ProficiencyKind, GroupName> = { skill: "Skills", language: "Languages", tool: "Tools" };

// The order of the sources, by the top-level selection of a position: the order of the steps.
const SOURCE_ORDER = ["class", "background", "race", "feats"];

/** True for an expertise selection, such as the Expertise of a rogue or the Skill Expertise of a bard. */
export const isExpertise = (selection: BuilderSelection) => selection.tags.includes("expertise") || selection.key.includes("expertise");

/** The group of a selection of the step. An expertise selection is in Skills. */
export function groupOf(selection: BuilderSelection): GroupName {
  if (isExpertise(selection)) return "Skills";
  const kind = proficiencyKind(selection);
  if (kind !== null) return KIND_GROUP[kind];
  // The custom background's "Tool / Language Proficiencies" opens a tool or a language selection.
  if (selection.key.startsWith("tool")) return "Tools";
  return "Other proficiencies";
}

/** The class level of a selection that a class level opens directly, such as the Expertise of a rogue 6; else null. */
function classLevel({ actualPath }: BuilderSelection): string | null {
  if (actualPath.length !== 5 || actualPath[0] !== "class" || actualPath[2] !== "levels") return null;
  return actualPath[3].match(/^level-(\d+)$/)?.[1] ?? null;
}

/**
 * The heading name of a section of the step: what it gives and its sources, "Skills: Fighter", "Languages: Acolyte,
 * Half-Elf", "Expertise: Rogue". An expertise selection of a class level has the level too, as the Abilities step
 * does: "Expertise: Rogue 6". A selection that gives no single kind, such as "Tool / Language Proficiencies", keeps
 * its own name before the sources. Without a source, the name alone.
 */
export function proficiencySectionName(selection: BuilderSelection): string {
  const group = groupOf(selection);
  const what = isExpertise(selection) ? "Expertise" : proficiencyKind(selection) !== null ? group : selection.name;
  if (selection.sources.length === 0) return what;
  const level = isExpertise(selection) ? classLevel(selection) : null;
  return `${what}: ${selection.sources.join(", ")}${level ? ` ${level}` : ""}`;
}

/**
 * The heading name of each section of the step: the selections of the step have proficiencySectionName, and the
 * selections that their picks open have the names of sectionNames.
 */
export function proficiencySectionNames(selections: BuilderSelection[]): Map<BuilderSelection, string> {
  const names = sectionNames(selections);
  for (const selection of selections) names.set(selection, proficiencySectionName(selection));
  return names;
}

// The names of the last template shape, by "{kind}:{key}".
let namesMemo: { shape: TemplateSelection[]; names: Map<string, string> } | null = null;

/**
 * The name of each skill, tool and language of the template, by "{kind}:{key}": the names of the options of its
 * selections, with homebrew content. The engine builds the proficiencies of a character as keys only.
 */
export function proficiencyNames(shape: TemplateSelection[]): Map<string, string> {
  if (namesMemo?.shape === shape) return namesMemo.names;
  const names = new Map<string, string>();
  const kindOf = (tags: string[]): ProficiencyKind | null =>
    tags.includes("skill-profs") ? "skill" : tags.includes("tool-profs") ? "tool" : tags.includes("language-profs") ? "language" : null;
  const walk = (list: TemplateSelection[]) => {
    for (const s of list) {
      const kind = s.key.includes("expertise") ? null : kindOf(s.tags ?? []);
      for (const o of s.options) {
        if (kind !== null && !names.has(`${kind}:${o.key}`)) names.set(`${kind}:${o.key}`, o.name);
        walk(o.selections ?? []);
      }
    }
  };
  walk(shape);
  namesMemo = { shape, names };
  return names;
}

const SKILL_NAMES = new Map(SKILLS.map(([key, name]) => [key, name]));

/** The name of a fixed proficiency: from the template, or the skill name, or the key as a name. */
function nameOf({ kind, key }: FixedProficiency, names: Map<string, string>): string {
  return names.get(`${kind}:${key}`) ?? (kind === "skill" ? SKILL_NAMES.get(key) : undefined) ?? keyToName(key);
}

/** What proficiencyGroups reads besides the selections of the step. */
export interface GroupsInput {
  /** What the character has from fixed sources (fixedProficiencies). */
  fixed: FixedProficiency[];
  /** The selected race, background and classes, for the order of a merged selection's sources (topSources). */
  tops: TopSource[];
  /** The class keys, the first class first, for the order of the sections of two classes. */
  classes: string[];
  /** The name of each skill, tool and language (proficiencyNames). */
  names: Map<string, string>;
}

/**
 * The groups of the Proficiencies step from its selections (spec, "The Proficiencies step"). A group with no
 * selection does not show. In a group, the sections are in the order of their sources: class (the first class
 * first, then by level), background, race, feat. In Skills, the Expertise sections come after the skill sections. A
 * merged selection, such as the Languages of the race and the background, is one section, in the place of its first
 * source. The "Already has" tokens are in the order of the names.
 */
export function proficiencyGroups(selections: BuilderSelection[], { fixed, tops, classes, names }: GroupsInput): ProficiencyGroup[] {
  const rankOfName = new Map(tops.map(({ path, name }) => [name, SOURCE_ORDER.indexOf(path[0])]));
  const rank = (selection: BuilderSelection) => {
    const own = SOURCE_ORDER.indexOf(selection.actualPath[0]);
    if (own !== -1) return own;
    // A merged top-level selection, such as ["languages"]: the rank of its first source.
    const ranks = selection.sources.map((name) => rankOfName.get(name) ?? SOURCE_ORDER.length);
    return ranks.length > 0 ? Math.min(...ranks) : SOURCE_ORDER.length;
  };
  const classIndex = ({ actualPath }: BuilderSelection) => (actualPath[0] === "class" ? Math.max(classes.indexOf(actualPath[1]), 0) : 0);
  const level = (selection: BuilderSelection) => Number(classLevel(selection) ?? 0);
  // A stable sort: two sections with the same keys keep the order of the template.
  const sorted = [...selections].sort(
    (a, b) => Number(isExpertise(a)) - Number(isExpertise(b)) || rank(a) - rank(b) || classIndex(a) - classIndex(b) || level(a) - level(b),
  );
  return GROUP_NAMES.flatMap((name): ProficiencyGroup[] => {
    const sections = sorted.filter((selection) => groupOf(selection) === name);
    if (sections.length === 0) return [];
    const alreadyHas = fixed
      .filter((item) => KIND_GROUP[item.kind] === name)
      .map((item) => {
        const itemName = nameOf(item, names);
        return item.sources.length > 0 ? `${itemName} (${item.sources.join(", ")})` : itemName;
      })
      .sort((a, b) => a.localeCompare(b));
    return [{ name, alreadyHas, sections }];
  });
}
