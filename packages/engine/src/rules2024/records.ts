// The converter from records of the content format to the options,
// selections and modifiers of the core (docs/design/2024-content-format.md).
// The engine gets the declared dependencies of each effect from its reads,
// so a pack does not write them.
//
// This file converts classes, subclasses, species, backgrounds and feats.

import type { Key, Modifier, OptionModifier, Reader } from "../core/modifiers.ts";
import { type Option, type OptionParts, option, type Prereq, selection } from "../core/template.ts";
import { parseReference, referenceTo } from "../format/keys.ts";
import type { IssuePath } from "../format/load.ts";
import type {
  BackgroundRecord,
  ClassRecord,
  Condition,
  Effect,
  FeatRecord,
  Pack,
  Prerequisite,
  Records,
  RecordType,
  SelectionOption,
  SpeciesRecord,
  SubclassRecord,
  Trait,
  Value,
} from "../format/schema.ts";
import { backgroundAbilitySelection, notTakenAlready } from "./abilities.ts";
import { type Built2024, type Feature, m, type Size, type Skill } from "./built.ts";
import { classLevelModifiers } from "./class-frame.ts";
import { HOOKS, type HookRegistry } from "./hooks/index.ts";
import { isSheetValue, SHEET_VALUES, type SheetValueKind, type SheetValueName } from "./sheet-values.ts";

/** A rule of a record that the engine cannot convert. `path` is the place in the record. */
export class RecordError extends Error {
  constructor(
    readonly record: string,
    readonly path: IssuePath,
    /** The message without the record and the path. */
    readonly reason: string,
  ) {
    super(`${record} at ${path.join(".") || "the record"}: ${reason}`);
    this.name = "RecordError";
  }
}

/** The loaded packs that references resolve against, and the hooks of the engine. */
export interface Content {
  packs: readonly Pack[];
  hooks?: HookRegistry;
}

/** The record of `type` that `reference` names, or undefined. */
export function findRecord<T extends RecordType>(content: Content, type: T, reference: string): Records[T] | undefined {
  const { pack, key } = parseReference(reference);
  const found = content.packs.find((p) => p.pack.id === pack);
  return (found?.[type] as Records[T][] | undefined)?.find((record) => record.key === key);
}

/** Each record of `type` in the content, with its reference. */
export function recordsOf<T extends RecordType>(content: Content, type: T): { reference: string; record: Records[T] }[] {
  return content.packs.flatMap((pack) => (pack[type] as Records[T][]).map((record) => ({ reference: referenceTo(pack.pack.id, record.key), record })));
}

type Read = (key: SheetValueName) => unknown;

/** The kind of the result of a value, as far as the converter can tell before a build. */
type ValueKind = SheetValueKind | "unknown";

interface Compiled<T> {
  deps: SheetValueName[];
  get: (read: Read) => T;
  kind: ValueKind;
}

/** Where a conversion is: the record, its traits, and the content. */
interface Context {
  record: string;
  content: Content;
  traits: readonly Trait[];
  /** The uses that `uses` effects give to traits, by trait key. */
  uses: Map<string, Compiled<NonNullable<Feature["uses"]>>>;
  /** The feats that grant this record, through `grantFeat`. A feat that grants one of them makes a loop. */
  via: readonly string[];
  /** True in the effects of an option of a `selection` effect. */
  inOption?: true;
}

function sheetValue(context: Context, path: IssuePath, name: string): SheetValueName {
  if (!isSheetValue(name)) throw new RecordError(context.record, path, `"${name}" is not a sheet value`);
  return name;
}

const unique = <T>(items: readonly T[]) => [...new Set(items)];

// Values and conditions.

export function compileValue(context: Context, value: Value, path: IssuePath): Compiled<unknown> {
  if (typeof value !== "object") return { deps: [], get: () => value, kind: typeof value as "number" | "string" | "boolean" };
  if ("read" in value) {
    const name = sheetValue(context, [...path, "read"], value.read);
    const entry = value.entry;
    if (entry !== undefined && SHEET_VALUES[name] !== "record") {
      throw new RecordError(context.record, [...path, "entry"], `"${name}" has no entries`);
    }
    return {
      deps: [name],
      get: (read) => (entry === undefined ? read(name) : ((read(name) as Record<string, unknown>)[entry] ?? 0)),
      kind: entry === undefined ? SHEET_VALUES[name] : "unknown",
    };
  }
  if ("sum" in value) {
    const parts = value.sum.map((part, i) => compileNumber(context, part, [...path, "sum", i]));
    const min = value.min ?? Number.NEGATIVE_INFINITY;
    return {
      deps: unique(parts.flatMap((p) => p.deps)),
      get: (read) =>
        Math.max(
          min,
          parts.reduce((sum, p) => sum + p.get(read), 0),
        ),
      kind: "number",
    };
  }
  const by = compileNumber(context, value.by, [...path, "by"]);
  const steps = value.steps.map(([at, step], i) => ({ at, value: compileValue(context, step, [...path, "steps", i, 1]) }));
  const kinds = unique(steps.map((s) => s.value.kind));
  return {
    // Below the first step the value is 0.
    kind: kinds.length === 1 && kinds[0] === "number" ? "number" : "unknown",
    deps: unique([...by.deps, ...steps.flatMap((s) => s.value.deps)]),
    get: (read) => {
      const n = by.get(read);
      const step = steps.filter((s) => s.at <= n).at(-1);
      return step ? step.value.get(read) : 0;
    },
  };
}

function compileNumber(context: Context, value: Value, path: IssuePath): Compiled<number> {
  const compiled = compileValue(context, value, path);
  if (compiled.kind !== "number" && compiled.kind !== "unknown") {
    throw new RecordError(context.record, path, `the value is a ${compiled.kind}, not a number`);
  }
  return {
    kind: "number",
    deps: compiled.deps,
    get: (read) => {
      const result = compiled.get(read);
      if (typeof result !== "number") throw new RecordError(context.record, path, `the value is ${JSON.stringify(result)}, not a number`);
      return result;
    },
  };
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === "" || value === 0) return true;
  if (Array.isArray(value)) return value.length === 0;
  return typeof value === "object" && Object.keys(value).length === 0;
}

export function compileCondition(context: Context, condition: Condition, path: IssuePath): Compiled<boolean> {
  if ("has" in condition) {
    const name = sheetValue(context, [...path, "has"], condition.has);
    const item = condition.item;
    return {
      kind: "boolean",
      deps: [name],
      get: (read) => {
        const value = read(name);
        if (item === undefined) return !isEmpty(value);
        if (!Array.isArray(value)) return value === item;
        return value.some((v) => v === item || (typeof v === "object" && v !== null && (v as { key?: unknown }).key === item));
      },
    };
  }
  if ("atLeast" in condition || "equals" in condition) {
    const [a, b] = ("atLeast" in condition ? condition.atLeast : condition.equals).map((v, i) =>
      compileValue(context, v, [...path, "atLeast" in condition ? "atLeast" : "equals", i]),
    );
    const compare = "atLeast" in condition ? (x: unknown, y: unknown) => Number(x) >= Number(y) : (x: unknown, y: unknown) => x === y;
    return { kind: "boolean", deps: unique([...a.deps, ...b.deps]), get: (read) => compare(a.get(read), b.get(read)) };
  }
  if ("not" in condition) {
    const inner = compileCondition(context, condition.not, [...path, "not"]);
    return { kind: "boolean", deps: inner.deps, get: (read) => !inner.get(read) };
  }
  const list = "any" in condition ? condition.any : condition.all;
  const parts = list.map((c, i) => compileCondition(context, c, [...path, "any" in condition ? "any" : "all", i]));
  const every = !("any" in condition);
  return {
    kind: "boolean",
    deps: unique(parts.flatMap((p) => p.deps)),
    get: (read) => (every ? parts.every((p) => p.get(read)) : parts.some((p) => p.get(read))),
  };
}

const fromReader =
  (q: Reader<Built2024>): Read =>
  (key) =>
    q(key);
const fromBuilt =
  (built: Built2024): Read =>
  (key) =>
    built[key];

function prerequisite(context: Context, prereq: Prerequisite, path: IssuePath): Prereq<Built2024> {
  const test = compileCondition(context, prereq.test, [...path, "test"]);
  return { label: prereq.label, canChoose: (built) => test.get(fromBuilt(built)) };
}

// Effects.

export type Parts = OptionParts<Built2024>;

const EMPTY: Parts = { modifiers: [], selections: [] };

function merge(...parts: Parts[]): Parts {
  return { modifiers: parts.flatMap((p) => p.modifiers), selections: parts.flatMap((p) => p.selections) };
}

function changeModifier(context: Context, effect: Extract<Effect, { set: string } | { add: string } | { push: string }>, path: IssuePath): Modifier<Built2024> {
  const [word, name] = "set" in effect ? (["set", effect.set] as const) : "add" in effect ? (["add", effect.add] as const) : (["push", effect.push] as const);
  const target = sheetValue(context, [...path, word], name);
  const kind = SHEET_VALUES[target];
  if (word === "add" && kind !== "number") throw new RecordError(context.record, [...path, "add"], `"${target}" is not a number`);
  if (word === "push" && kind !== "list") throw new RecordError(context.record, [...path, "push"], `"${target}" is not a list`);
  const value = word === "add" ? compileNumber(context, effect.value, [...path, "value"]) : compileValue(context, effect.value, [...path, "value"]);
  if (word === "set" && !fits(kind, value.kind))
    throw new RecordError(context.record, [...path, "value"], `"${target}" is a ${kind}, and the value is a ${value.kind}`);
  const when = effect.when ? compileCondition(context, effect.when, [...path, "when"]) : undefined;
  const deps = unique([...value.deps, ...(when?.deps ?? [])]) as Key<Built2024>[];
  const options = { deps, name: effect.name, when: when && ((q: Reader<Built2024>) => when.get(fromReader(q))) };
  const get = (q: Reader<Built2024>) => value.get(fromReader(q));
  const key = target as never;
  if (word === "set") return m.set(key, get as never, options);
  if (word === "add") return m.add(key, get as (q: Reader<Built2024>) => number, options);
  return m.push(key, get as never, options);
}

/** Whether a value of kind `value` can be the value of a sheet value of kind `target`. */
function fits(target: SheetValueKind, value: ValueKind): boolean {
  return value === "unknown" || value === target || (target === "nullable" && value === "string");
}

function selectionOption(context: Context, from: SelectionOption, path: IssuePath): Option<Built2024> {
  const parts = effectParts({ ...context, inOption: true }, from.effects ?? [], [...path, "effects"]);
  return option({
    key: from.key,
    name: from.name,
    ...parts,
    prereqs: (from.prerequisites ?? []).map((p, i) => prerequisite(context, p, [...path, "prerequisites", i])),
  });
}

/** The modifiers and selections of a list of effects. */
export function effectParts(context: Context, effects: readonly Effect[], path: IssuePath): Parts {
  return merge(
    EMPTY,
    ...effects.map((effect, i): Parts => {
      const at = [...path, i];
      if ("set" in effect || "add" in effect || "push" in effect) return { modifiers: [changeModifier(context, effect, at)], selections: [] };
      if ("uses" in effect) {
        const { trait, amount, recover } = effect.uses;
        // The uses of a trait apply whatever the character chooses, so an option cannot give them.
        if (context.inOption) throw new RecordError(context.record, [...at, "uses"], "an option of a selection cannot give uses to a trait");
        if (!context.traits.some((t) => t.key === trait)) throw new RecordError(context.record, [...at, "uses", "trait"], `the record has no trait "${trait}"`);
        const value = compileNumber(context, amount, [...at, "uses", "amount"]);
        context.uses.set(trait, { kind: "record", deps: value.deps, get: (read) => ({ amount: value.get(read), recover }) });
        return EMPTY;
      }
      if ("grantFeat" in effect) {
        const feat = findRecord(context.content, "feats", effect.grantFeat);
        if (!feat) throw new RecordError(context.record, [...at, "grantFeat"], `no feat "${effect.grantFeat}" is loaded`);
        const chain = [...context.via, context.record];
        if (chain.includes(effect.grantFeat)) {
          throw new RecordError(context.record, [...at, "grantFeat"], `the feats grant each other in a loop: ${[...chain, effect.grantFeat].join(" > ")}`);
        }
        return featParts(context.content, effect.grantFeat, feat, chain);
      }
      if ("selection" in effect) {
        const { key, name, choose, from } = effect.selection;
        const options = from.map((o, j) => selectionOption(context, o, [...at, "selection", "from", j]));
        return { modifiers: [], selections: [selection({ key, name, min: choose, max: choose, multiselect: choose > 1, options })] };
      }
      const hooks = context.content.hooks ?? HOOKS;
      const hook = hooks.get(effect.hook);
      if (!hook) throw new RecordError(context.record, [...at, "hook"], `the engine has no hook "${effect.hook}"`);
      const args = hook.args.safeParse(effect.args ?? {});
      if (!args.success) throw new RecordError(context.record, [...at, "args"], args.error.issues.map((issue) => issue.message).join("; "));
      return hook.apply(args.data, { record: context.record });
    }),
  );
}

/**
 * A feature on the sheet for each trait of the record. A trait with uses
 * reads the sheet values of its amount. `level` gates a class feature.
 */
function traitFeatures(context: Context, traits: readonly (Trait & { level?: number })[]): OptionModifier<Built2024>[] {
  return traits.map((trait) => {
    const feature: Feature = {
      key: `${context.record}/${trait.key}`,
      name: trait.name,
      summary: trait.text,
      source: context.record,
      ...(trait.level === undefined ? {} : { level: trait.level }),
    };
    const uses = context.uses.get(trait.key);
    if (!uses) return m.push("features", feature);
    return m.push("features", (q) => ({ ...feature, uses: uses.get(fromReader(q)) }), { deps: uses.deps as Key<Built2024>[] });
  });
}

/** The parts of a record: its effects, then a feature for each trait. */
function recordParts(content: Content, reference: string, record: FeatRecord | SpeciesRecord | BackgroundRecord, via: readonly string[] = []): Parts {
  const traits = record.traits ?? [];
  const context: Context = { record: reference, content, traits, uses: new Map(), via };
  const effects = effectParts(context, record.effects ?? [], ["effects"]);
  return merge(effects, { modifiers: traitFeatures(context, traits), selections: [] });
}

// Record types.

/**
 * What taking a feat gives: the feat on the sheet, its effects, and its
 * traits as features. `via` is the chain of feats that grant it.
 */
export function featParts(content: Content, reference: string, feat: FeatRecord, via: readonly string[] = []): Parts {
  return merge(
    { modifiers: [m.push("feats", { key: reference, name: feat.name, category: feat.category })], selections: [] },
    recordParts(content, reference, feat, via),
  );
}

/**
 * A feat as an option of a feat selection, with its prerequisites. A feat
 * that is not repeatable can be taken once (SRD 5.2.1 p87).
 */
export function featOption(content: Content, reference: string, feat: FeatRecord): Option<Built2024> {
  const context: Context = { record: reference, content, traits: feat.traits ?? [], uses: new Map(), via: [] };
  const prereqs = (feat.prerequisites ?? []).map((p, i) => prerequisite(context, p, ["prerequisites", i]));
  return option({
    key: reference,
    name: feat.name,
    ...featParts(content, reference, feat),
    prereqs: feat.repeatable ? prereqs : [...prereqs, notTakenAlready(reference)],
  });
}

/** A species as an option of the species selection. */
export function speciesOption(content: Content, reference: string, species: SpeciesRecord): Option<Built2024> {
  const size = species.size;
  const sizeParts: Parts =
    typeof size === "string"
      ? { modifiers: [m.set("size", size)], selections: [] }
      : {
          modifiers: [],
          selections: [
            selection({
              name: "Size",
              min: size.choose,
              max: size.choose,
              options: size.from.map((s) => option<Built2024>({ key: s, name: s[0].toUpperCase() + s.slice(1), modifiers: [m.set("size", s as Size)] })),
            }),
          ],
        };
  return option({
    key: reference,
    name: species.name,
    ...merge(
      {
        modifiers: [m.set("species", reference), m.set("creatureType", species.creatureType), m.set("speed", species.speed)],
        selections: [],
      },
      sizeParts,
      recordParts(content, reference, species),
    ),
  });
}

/** The tool proficiencies of a typed field: a tool, the tools of a list, or a choice. */
function toolParts(content: Content, name: string, tool: ClassRecord["tools"] | BackgroundRecord["tool"]): Parts {
  if (tool === undefined) return EMPTY;
  if (typeof tool === "string" || Array.isArray(tool)) {
    return { modifiers: [tool].flat().map((ref) => m.push("toolProficiencies", ref)), selections: [] };
  }
  const from = tool.from;
  const tools = Array.isArray(from)
    ? from.map((ref) => ({ reference: ref, name: findRecord(content, "equipment", ref)?.name ?? ref }))
    : recordsOf(content, "equipment")
        .filter(({ record }) => record.category === from.category)
        .map(({ reference, record }) => ({ reference, name: record.name }));
  return {
    modifiers: [],
    selections: [
      selection({
        name,
        min: tool.choose,
        max: tool.choose,
        options: tools.map(({ reference, name }) => option<Built2024>({ key: reference, name, modifiers: [m.push("toolProficiencies", reference)] })),
      }),
    ],
  };
}

/**
 * A background as an option of the background selection. The engine makes
 * its rules from the typed fields: the ability score choice, the Origin
 * feat, the skills and the tool.
 */
export function backgroundOption(content: Content, reference: string, background: BackgroundRecord): Option<Built2024> {
  const feat = findRecord(content, "feats", background.feat);
  if (!feat) throw new RecordError(reference, ["feat"], `no feat "${background.feat}" is loaded`);
  return option({
    key: reference,
    name: background.name,
    ...merge(
      {
        modifiers: [m.set("background", reference), ...background.skills.map((skill) => m.push("skillProficiencies", skill as Skill))],
        selections: [backgroundAbilitySelection(background.abilityScores, background.name)],
      },
      toolParts(content, "Tool", background.tool),
      featParts(content, background.feat, feat),
      recordParts(content, reference, background),
    ),
  });
}

/**
 * A subclass as an option of a subclass selection. Its features and the
 * effects of its levels apply from their class level, which the parts read
 * from `classLevels`.
 */
export function subclassOption(content: Content, reference: string, subclass: SubclassRecord): Option<Built2024> {
  const classRef = subclass.class;
  const context: Context = { record: reference, content, traits: subclass.features ?? [], uses: new Map(), via: [] };
  const atLevel = (level: number) => (q: Reader<Built2024>) => (q("classLevels")[classRef] ?? 0) >= level;
  const gate = (level: number, modifier: OptionModifier<Built2024>): OptionModifier<Built2024> => {
    if ("deferred" in modifier) throw new RecordError(reference, ["levels"], "a level effect cannot need the value of its option");
    const own = modifier.when;
    return {
      ...modifier,
      deps: unique([...modifier.deps, "classLevels" as const]),
      when: (q) => atLevel(level)(q) && (!own || own(q)),
    };
  };
  const levelParts = (subclass.levels ?? []).map((entry, i) => {
    const parts = effectParts(context, entry.effects, ["levels", i, "effects"]);
    if (parts.selections.length) throw new RecordError(reference, ["levels", i], "a choice at a level needs the class frame (ORC-230)");
    return parts.modifiers.map((modifier) => gate(entry.level, modifier));
  });
  const own = effectParts(context, subclass.effects ?? [], ["effects"]);
  const features = traitFeatures(context, subclass.features ?? []).map((modifier, i) => gate(subclass.features?.[i].level ?? 1, modifier));
  return option({
    key: reference,
    name: subclass.name,
    modifiers: [m.update("subclasses", (current) => ({ ...current, [classRef]: reference })), ...own.modifiers, ...levelParts.flat(), ...features],
    selections: own.selections,
  });
}

/** The highest class level. */
const MAX_LEVEL = 20;

/**
 * A class as an option of the class selection. The engine makes the class
 * frame from the typed fields: the Hit Point Die, the saving throws, the
 * skill choice, the weapon, armor and tool training, and one sequential
 * `levels` selection. Each level option gives the class level, its Hit
 * Points, the features of that level, and the effects of `levels` at that
 * level. Level 3 opens the subclass choice (SRD 5.2.1 p19). The skill name
 * comes from the skill records. The saves and the full training are the
 * rules of a first class; ORC-234 adds the rules of a second class (SRD
 * 5.2.1 p24).
 */
export function classOption(content: Content, reference: string, record: ClassRecord): Option<Built2024> {
  const context: Context = { record: reference, content, traits: record.features ?? [], uses: new Map(), via: [] };
  const own = effectParts(context, record.effects ?? [], ["effects"]);
  // The effects of each level first, so that `uses` effects reach the features of their traits.
  const levelEffects = (record.levels ?? []).map((entry, i) => ({ level: entry.level, parts: effectParts(context, entry.effects, ["levels", i, "effects"]) }));
  const features = traitFeatures(context, record.features ?? []).map((modifier, i) => ({ level: record.features?.[i].level ?? 1, modifier }));
  const subclasses = recordsOf(content, "subclasses").filter(({ record: subclass }) => subclass.class === reference);
  const skillName = (key: string) => recordsOf(content, "skills").find(({ record: skill }) => skill.key === key)?.record.name ?? key;

  const levels = Array.from({ length: MAX_LEVEL }, (_, i) => {
    const level = i + 1;
    const parts = merge(EMPTY, ...levelEffects.filter((entry) => entry.level === level).map((entry) => entry.parts));
    const subclassChoice =
      level === 3 && subclasses.length > 0
        ? [
            selection<Built2024>({
              name: `${record.name} Subclass`,
              key: "subclass",
              options: subclasses.map(({ reference: ref, record: subclass }) => subclassOption(content, ref, subclass)),
            }),
          ]
        : [];
    return option<Built2024>({
      name: `Level ${level}`,
      modifiers: [
        ...classLevelModifiers(reference, record.hitDie, level),
        ...features.filter((feature) => feature.level === level).map((feature) => feature.modifier),
        ...parts.modifiers,
      ],
      selections: [...parts.selections, ...subclassChoice],
    });
  });

  return option({
    key: reference,
    name: record.name,
    ...merge(
      {
        modifiers: [
          m.push("classes", reference),
          m.put("hitDice", reference, record.hitDie),
          ...record.savingThrows.map((ability) => m.push("savingThrowProficiencies", ability)),
          ...(record.weaponProficiencies ?? []).map((category) => m.push("weaponProficiencies", category)),
          ...(record.armorTraining ?? []).map((category) => m.push("armorTraining", category)),
        ],
        selections: [
          selection({
            name: "Skill Proficiencies",
            min: record.skills.choose,
            max: record.skills.choose,
            options: record.skills.from.map((skill) =>
              option<Built2024>({ key: skill, name: skillName(skill), modifiers: [m.push("skillProficiencies", skill as Skill)] }),
            ),
          }),
        ],
      },
      toolParts(content, "Tool Proficiencies", record.tools),
      own,
      { modifiers: [], selections: [selection({ name: "Levels", min: 1, max: null, multiselect: true, sequential: true, options: levels })] },
    ),
  });
}
