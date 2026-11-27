// Loading a pack for the 2024 engine. The loader of the content format
// checks the schema and the hook names. Then this file converts each record
// with the converter of the engine, which checks what the schema cannot: the
// names and kinds of sheet values, the traits that `uses` names, the
// arguments of a hook, and the feats that a record grants. A record that
// fails loses its effects, or, if it still fails, the record is dropped.
// Each change gets an issue, so one bad record does not stop the pack.

import type { Option } from "../core/template.ts";
import { referenceTo } from "../format/keys.ts";
import { checkReferences, hasRules, type LoadIssue, type LoadResult, loadPack, withoutRules } from "../format/load.ts";
import type { AnyRecord, Pack, Records, RecordType } from "../format/schema.ts";
import type { Built2024 } from "./built.ts";
import type { Content } from "./content.ts";
import { HOOKS } from "./hooks/index.ts";
import { RecordError } from "./record-values.ts";
import { backgroundOption, classOption, featOption, speciesOption, subclassOption } from "./records.ts";

export interface ContentPackOptions {
  /** The loaded packs that this pack refers to, for example the built-in pack `srd52` for a homebrew pack. */
  packs?: readonly Pack[];
}

type Converter<T extends RecordType> = (content: Content, reference: string, record: Records[T]) => Option<Built2024>;

/** The converter of each record type that the engine converts now. */
const CONVERTERS: { [T in RecordType]?: Converter<T> } = {
  classes: classOption,
  species: speciesOption,
  backgrounds: backgroundOption,
  feats: featOption,
  subclasses: subclassOption,
};

/** Reads a pack file that `JSON.parse` gave, for the 2024 engine. */
export function loadContentPack(input: unknown, options: ContentPackOptions = {}): LoadResult {
  const loaded = loadPack(input, { hooks: new Set(HOOKS.keys()) });
  if (!loaded.pack) return loaded;
  const others = (options.packs ?? []).filter((p) => p.pack.id !== loaded.pack?.pack.id);
  const fileIndex = fileIndexes(input);
  const { pack, issues } = checkRules(loaded.pack, others, fileIndex);
  return { pack, issues: [...loaded.issues, ...issues, ...referenceIssues(pack, others, fileIndex)] };
}

/** The references of the pack that do not resolve in it and the packs it gets, with their paths in the file. */
function referenceIssues(pack: Pack, others: readonly Pack[], fileIndex: FileIndex): LoadIssue[] {
  return checkReferences([...others, pack])
    .filter((issue) => issue.path[0] === pack.pack.id)
    .map((issue) => {
      const [, type, index, ...rest] = issue.path as [string, RecordType, number, ...(string | number)[]];
      const at = fileIndex(type, (pack[type] as AnyRecord[])[index].key);
      return { ...issue, path: [type, at === -1 ? index : at, ...rest] };
    });
}

/**
 * The index of a record in the pack file, by its type and key. The loader
 * drops bad records, so the index in the loaded pack can be lower. Two
 * records with one key are a load issue, and the loader keeps the first.
 */
type FileIndex = (type: RecordType, key: string) => number;

function fileIndexes(input: unknown): FileIndex {
  const file = input as Partial<Record<RecordType, unknown>>;
  return (type, key) => {
    const records = file[type];
    return Array.isArray(records) ? records.findIndex((r) => typeof r === "object" && r !== null && (r as { key?: unknown }).key === key) : -1;
  };
}

interface Failure {
  type: RecordType;
  /** The index in the loaded pack, as it is now. */
  index: number;
  reference: string;
  error: RecordError;
}

/**
 * Converts each record of `pack` until none fails. An error in the record
 * itself is dropped first. An error in a feat that the record grants waits
 * for the drop in that feat, so that a record loses its effects only when
 * the cause is still there.
 */
function checkRules(input: Pack, others: readonly Pack[], fileIndex: FileIndex): { pack: Pack; issues: LoadIssue[] } {
  let pack = input;
  const issues: LoadIssue[] = [];
  for (;;) {
    const failures = convertAll(pack, others);
    if (failures.length === 0) return { pack, issues };
    const own = failures.filter((f) => f.error.record === f.reference);
    // One drop at a time: a drop can change the result for the other records.
    const failure = own[0] ?? failures[0];
    const at = fileIndex(failure.type, (pack[failure.type] as AnyRecord[])[failure.index].key);
    pack = dropFailedRules(pack, failure, at === -1 ? failure.index : at, issues);
  }
}

function convertAll(pack: Pack, others: readonly Pack[]): Failure[] {
  const content: Content = { packs: [...others, pack] };
  const failures: Failure[] = [];
  const check = <T extends RecordType>(type: T, convert: Converter<T>) => {
    (pack[type] as Records[T][]).forEach((record, index) => {
      const reference = referenceTo(pack.pack.id, record.key);
      try {
        convert(content, reference, record);
      } catch (error) {
        if (!(error instanceof RecordError)) throw error;
        failures.push({ type, index, reference, error });
      }
    });
  };
  for (const type of Object.keys(CONVERTERS) as RecordType[]) {
    const convert = CONVERTERS[type];
    if (convert) check(type, convert as Converter<typeof type>);
  }
  return failures;
}

/**
 * Drops the effects of the record that failed, with an issue. When the
 * error is not in its effects, or the record has no effects, drops the
 * record. `fileIndex` is the index of the record in the pack file.
 */
function dropFailedRules(pack: Pack, { type, index, reference, error }: Failure, fileIndex: number, issues: LoadIssue[]): Pack {
  const records = [...(pack[type] as AnyRecord[])];
  const record = records[index];
  const inGrantedFeat = error.record !== reference;
  const inOwnRules = !inGrantedFeat && (error.path[0] === "effects" || error.path[0] === "levels");
  // An error in a granted feat has no path in this record, so the message names the feat and its path.
  const path = inGrantedFeat ? [type, fileIndex] : [type, fileIndex, ...error.path];
  const reason = inGrantedFeat ? error.message : error.reason;
  if (hasRules(record) && (inOwnRules || inGrantedFeat)) {
    records[index] = withoutRules(record);
    issues.push({ path, message: `${reason}, so the record loads without its effects`, dropped: "effects" });
  } else {
    records.splice(index, 1);
    issues.push({ path, message: `${reason}, so the record does not load`, dropped: "record" });
  }
  return { ...pack, [type]: records };
}
