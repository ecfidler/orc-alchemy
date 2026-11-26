// The values and conditions of the content format, compiled for the record
// converter in records.ts. Each compiled value knows the sheet values that it
// reads, so the engine gets the declared dependencies from them.

import type { Reader } from "../core/modifiers.ts";
import type { Prereq } from "../core/template.ts";
import type { IssuePath } from "../format/load.ts";
import type { Condition, Prerequisite, Value } from "../format/schema.ts";
import type { Built2024 } from "./built.ts";
import type { Context } from "./records.ts";
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

export type Read = (key: SheetValueName) => unknown;

/** The kind of the result of a value, as far as the converter can tell before a build. */
export type ValueKind = SheetValueKind | "unknown";

export interface Compiled<T> {
  deps: SheetValueName[];
  get: (read: Read) => T;
  kind: ValueKind;
}

export function sheetValue(context: Context, path: IssuePath, name: string): SheetValueName {
  if (!isSheetValue(name)) throw new RecordError(context.record, path, `"${name}" is not a sheet value`);
  return name;
}

export const unique = <T>(items: readonly T[]) => [...new Set(items)];

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

export function compileNumber(context: Context, value: Value, path: IssuePath): Compiled<number> {
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

export const fromReader =
  (q: Reader<Built2024>): Read =>
  (key) =>
    q(key);
export const fromBuilt =
  (built: Built2024): Read =>
  (key) =>
    built[key];

export function prerequisite(context: Context, prereq: Prerequisite, path: IssuePath): Prereq<Built2024> {
  const test = compileCondition(context, prereq.test, [...path, "test"]);
  return { label: prereq.label, canChoose: (built) => test.get(fromBuilt(built)) };
}
