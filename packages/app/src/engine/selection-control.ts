// The control rule of a builder selection (ORC-343, docs/design/character-builder.md "The control for each kind of
// selection"), and the options that the character cannot take ("A pick that the character cannot take"): which
// options show, which control they get, and the reason of each option that is not available.

import { type BuilderOption, type BuilderSelection, type BuilderStep, treeNodes } from "./builder.ts";
import type { Built2014, Content, Engine, StrictEntity } from "./engine.ts";
import { withoutOption } from "./reconcile.ts";

/** The control of a selection: option cards, the ui Picker with tokens, or a Choose button with the ui ListModal. */
export type ControlKind = "cards" | "picker" | "list";

/** A selection with this many shown options or fewer has option cards. */
export const MAX_CARDS = 6;

/** A picker or a list with more options than this has a search field (docs/design/homebrew-forms.md, "Picker"). */
export const SEARCH_ABOVE = 20;

/** The key of the engine's "Custom" option of a race, a subrace, a background or a subclass. */
export const CUSTOM_KEY = "custom";

/** The options that the control shows: all but the engine's "Custom" option, which shows only when it is picked. */
export function shownOptions(selection: BuilderSelection): BuilderOption[] {
  return selection.options.filter((option) => option.key !== CUSTOM_KEY || option.selected);
}

/**
 * True when the selection takes more than one pick: its max is more than 1, or it has none. A multiselect with a max
 * of 1, such as the language of a human, takes one pick.
 */
export const picksMany = (selection: BuilderSelection) => selection.max === null || selection.max > 1;

/**
 * The control of a selection with `count` shown options: cards to MAX_CARDS options, then a picker for more than one
 * pick, or a list for one pick. The caller keeps the first kind while the step is open, so a change of the number of
 * options does not change the control.
 */
export function controlKind(selection: BuilderSelection, count = shownOptions(selection).length): ControlKind {
  if (count <= MAX_CARDS) return "cards";
  return picksMany(selection) ? "picker" : "list";
}

/** True when a picker or a list of `count` options has a search field. */
export const hasSearch = (count: number) => count > SEARCH_ABOVE;

/** "A", "A and B", "A, B and C"; with `serialComma`, "A, B, and C", as the old builder's text of the Spells step. */
export function listText(items: string[], { serialComma = false } = {}): string {
  if (items.length <= 2) return items.join(" and ");
  return `${items.slice(0, -1).join(", ")}${serialComma ? "," : ""} and ${items.at(-1)}`;
}

/**
 * The reason text of a prerequisite label of the engine, as a sentence: "Requires Strength 13" is "It needs Strength
 * 13.", and another label, such as "You already have this skill", gets its full stop.
 */
export function reasonText(label: string): string {
  const text = label.trim().replace(/\.+$/, "");
  const needs = /^requires (.+)$/i.exec(text);
  return needs ? `It needs ${needs[1]}.` : `${text}.`;
}

/** The reason of an option that gives only what the character already has from these sources: "From Acolyte". */
export const fromText = (sources: string[]) => `From ${listText(sources)}`;

/**
 * The text of an option that is not available, for a place that shows it beside a disabled Choose button, such as a
 * detail panel: "Not available. It needs the class Paladin."
 */
export const notAvailableText = (reason: string) => `Not available. ${reason}`;

/** The prerequisite of an engine refusal of a select ("…: it requires {label}"), as reasonText; null for another refusal. */
export function refusalReason(message: string): string | null {
  const match = /: it requires (.+)$/s.exec(message);
  return match ? reasonText(match[1]) : null;
}

/** A top-level option of the character that can give a language: its path in the entity and its name. */
export interface TopSource {
  path: [selection: string, option: string];
  name: string;
}

/** What unavailableOptions reads: the engine, the character and what it builds against, and where its picks are. */
export interface AvailabilityInput {
  engine: Engine;
  entity: StrictEntity;
  built: Built2014;
  content: Content;
  /** The selected race, background and classes, for the source of a language that the character has. */
  tops: TopSource[];
  /** The sources of each skill, tool and language that the character picked, by "{kind}:{key}" (pickSources). */
  picks: Map<string, string[]>;
}

const TOP_SOURCES = ["race", "background", "class"];

/** The selected options of the top-level class, background and race selections of the steps, as TopSource. */
export function topSources(steps: BuilderStep[]): TopSource[] {
  return steps.flatMap((step) =>
    step.selections
      .filter((s) => s.actualPath.length === 1 && TOP_SOURCES.includes(s.actualPath[0]))
      .flatMap((s) => s.options.filter((o) => o.selected).map((o): TopSource => ({ path: [s.actualPath[0], o.key], name: o.name }))),
  );
}

/**
 * The sources of each skill, tool and language that the character picked in a selection, by "{kind}:{key}": the
 * sources of that selection, or its name when it has none. The engine builds a picked skill with no source name.
 */
export function pickSources(steps: BuilderStep[]): Map<string, string[]> {
  const picks = new Map<string, string[]>();
  // Each selection of the steps, and the selections that their picks open, once.
  for (const node of treeNodes(
    steps.flatMap((step) => step.selections),
    { picked: true },
  )) {
    const kind = proficiencyKind(node);
    if (kind === null) continue;
    for (const key of node.selected) {
      const id = `${kind}:${key}`;
      picks.set(id, [...new Set([...(picks.get(id) ?? []), ...(node.sources.length > 0 ? node.sources : [node.name])])]);
    }
  }
  return picks;
}

// The reasons of the last entity and content, so a render of another section of the page does not ask the engine
// again. The entity can be a text, so it is no WeakMap key.
let memo: { entity: StrictEntity; content: Content; reasons: Map<string, string | null> } | null = null;

function cached(input: AvailabilityInput, key: string, find: () => string | null): string | null {
  if (memo === null || memo.entity !== input.entity || memo.content !== input.content)
    memo = { entity: input.entity, content: input.content, reasons: new Map() };
  const { reasons } = memo;
  if (!reasons.has(key)) reasons.set(key, find());
  return reasons.get(key)!;
}

/** The kind of proficiency that a selection's options give, by its tags; an expertise selection gives none. */
export function proficiencyKind(selection: BuilderSelection): ProficiencyKind | null {
  if (selection.key.includes("expertise")) return null;
  if (selection.tags.includes("skill-profs")) return "skill";
  if (selection.tags.includes("tool-profs")) return "tool";
  if (selection.tags.includes("language-profs")) return "language";
  return null;
}

/** The kinds of proficiency that a character has from fixed sources and from picks. */
export type ProficiencyKind = "skill" | "tool" | "language";

/** The ids ("{kind}:{key}") of each skill, tool and language that the built character has. */
function proficiencyIds(built: Built2014): Set<string> {
  return new Set([
    ...Object.keys(built["skill-profs"] ?? {}).map((key) => `skill:${key}`),
    ...Object.keys(built["tool-profs"] ?? {}).map((key) => `tool:${key}`),
    ...(built.languages ?? []).map((key) => `language:${key}`),
  ]);
}

// The givers of the last entity and content: one evaluate for each top-level option, and not one for each item.
let giversMemo: { entity: StrictEntity; content: Content; givers: Map<string, string[]> } | null = null;

/**
 * The top-level options (the race, the background, each class) without which the character does not have the skill,
 * the tool or the language, by "{kind}:{key}". The engine gives no source name for a language, and "nil" for some
 * fixed skills and tools, such as the Perception of an elf, so the builder finds the source in this way.
 */
function givers(input: AvailabilityInput): Map<string, string[]> {
  const { engine, entity, built, content, tops } = input;
  if (giversMemo !== null && giversMemo.entity === entity && giversMemo.content === content) return giversMemo.givers;
  const all = proficiencyIds(built);
  const map = new Map<string, string[]>();
  for (const { path, name } of tops) {
    let without: Set<string>;
    try {
      without = proficiencyIds(engine.evaluate(withoutOption(entity, path), content).built);
    } catch {
      continue;
    }
    for (const id of all) if (!without.has(id)) map.set(id, [...(map.get(id) ?? []), name]);
  }
  giversMemo = { entity, content, givers: map };
  return map;
}

/**
 * The names of the sources of a skill or a tool that the character has, from the built proficiencies. In the place
 * of the engine's "nil", the sources of a pick, or else the top-level options that give it (givers). Null when it
 * does not have it.
 */
function proficiencySources(input: AvailabilityInput, kind: "skill" | "tool", key: string): string[] | null {
  const sources = input.built[kind === "skill" ? "skill-profs" : "tool-profs"]?.[key];
  if (!sources) return null;
  const nil = () => input.picks.get(`${kind}:${key}`) ?? givers(input).get(`${kind}:${key}`) ?? [];
  return [...new Set(Object.keys(sources).flatMap((name) => (name === "nil" ? nil() : [name])))];
}

/** The top-level options without which the character does not have the language: they give it. */
function languageSources(input: AvailabilityInput, key: string): string[] {
  return givers(input).get(`language:${key}`) ?? [];
}

/** A skill, a tool or a language that the character has from a fixed source, not from a pick. */
export interface FixedProficiency {
  kind: ProficiencyKind;
  key: string;
  /** The names of its sources, such as ["Acolyte"]; empty when the builder cannot find one. */
  sources: string[];
}

/**
 * Each skill, tool and language that the character has and that no selection picked, with its sources (spec, "The
 * Proficiencies step": "Already has"). The sources of a skill and a tool are the names in the built proficiencies;
 * for a language, and in the place of a "nil", they are the top-level options that give it.
 */
export function fixedProficiencies(input: AvailabilityInput): FixedProficiency[] {
  return [...proficiencyIds(input.built)]
    .filter((id) => !input.picks.has(id))
    .map((id) => {
      const [kind, key] = id.split(/:(.*)/s) as [ProficiencyKind, string];
      const sources = kind === "language" ? languageSources(input, key) : (proficiencySources(input, kind, key) ?? []);
      return { kind, key, sources };
    });
}

/**
 * The reason that the engine refuses to select the option, from a select that is not kept: its prerequisite label.
 * When the selection is full, the select is tried after the last pick is removed, so the refusal is the prerequisite
 * and not the count. Null when the engine takes the pick, or refuses it for another reason.
 */
function dryRunReason(input: AvailabilityInput, selection: BuilderSelection, key: string): string | null {
  const { engine, entity, content } = input;
  const path = selection.actualPath;
  const refusal = (from: StrictEntity) => {
    try {
      engine.select(from, path, key, content);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  };
  let message = refusal(entity);
  const last = selection.selected.at(-1);
  if (message !== null && /no selections remain/.test(message) && last !== undefined) {
    try {
      message = refusal(engine.deselect(entity, path, last, content) as StrictEntity);
    } catch {
      return null;
    }
  }
  return message === null ? null : refusalReason(message);
}

/**
 * The reason of each option of the selection that the character cannot take, by option key. A picked option and an
 * option with no prerequisite are always available.
 *
 * * A skill, a tool or a language that the character has: "From {source}". The sources of a skill and a tool are in
 *   the built proficiencies, and a picked one has the sources of the selection that picked it (pickSources). A
 *   language has no source there: it is the selection that picked it, or each selected race, background or class
 *   without which the character does not have it. With no source, the reason is the engine's label.
 * * Any other option with a prerequisite: the label of the engine's refusal of a select, as reasonText.
 */
export function unavailableOptions(input: AvailabilityInput, selection: BuilderSelection): Map<string, string> {
  const reasons = new Map<string, string>();
  const kind = proficiencyKind(selection);
  for (const option of selection.options) {
    if (option.selected || option.prereqs === 0) continue;
    const id = `${JSON.stringify(selection.actualPath)}|${option.key}`;
    const reason = cached(input, id, () => {
      if (kind === "skill" || kind === "tool") {
        const sources = proficiencySources(input, kind, option.key);
        if (sources === null) return null;
        return sources.length > 0 ? fromText(sources) : reasonText(`You already have this ${kind}`);
      }
      if (kind === "language") {
        if (!(input.built.languages ?? []).includes(option.key)) return null;
        const picked = input.picks.get(`language:${option.key}`);
        const sources = picked ?? languageSources(input, option.key);
        return sources.length > 0 ? fromText(sources) : reasonText("You already have this language");
      }
      return dryRunReason(input, selection, option.key);
    });
    if (reason !== null) reasons.set(option.key, reason);
  }
  return reasons;
}

/**
 * The heading name of each section on a step: the selections of the step and the selections that their picks open,
 * flat. When two sections have the same name, each heading names its sources: "Skill Proficiency: Fighter" (spec,
 * "Text").
 */
export function sectionNames(selections: BuilderSelection[]): Map<BuilderSelection, string> {
  const all = treeNodes(selections, { picked: true });
  const count = new Map<string, number>();
  for (const node of all) count.set(node.name, (count.get(node.name) ?? 0) + 1);
  return new Map(
    all.map((node) => [node, (count.get(node.name) ?? 0) > 1 && node.sources.length > 0 ? `${node.name}: ${node.sources.join(", ")}` : node.name]),
  );
}
