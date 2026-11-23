// Loading a pack for the 2024 engine. The loader of the content format
// checks the schema and the hook names. Then this file converts each record
// with the converter of the engine, which checks what the schema cannot: the
// names and kinds of sheet values, the traits that `uses` names, the
// arguments of a hook, and the feats that a record grants. A record that
// fails loses its effects, or, if it still fails, the record is dropped.
// Each change gets an issue, so one bad record does not stop the pack.

import type { Option } from "../core/template.ts";
import { referenceTo } from "../format/keys.ts";
import { type LoadIssue, type LoadResult, loadPack } from "../format/load.ts";
import type { AnyRecord, Pack, RecordType } from "../format/schema.ts";
import type { Built2024 } from "./built.ts";
import { HOOKS } from "./hooks/index.ts";
import { backgroundOption, type Content, featOption, RecordError, speciesOption, subclassOption } from "./records.ts";

export interface ContentPackOptions {
  /** The loaded packs that this pack refers to, for example the built-in pack `srd52` for a homebrew pack. */
  packs?: readonly Pack[];
}

/** The converter of each record type that the engine converts now. Classes come with ORC-225 and ORC-230. */
const CONVERTERS: Partial<Record<RecordType, (content: Content, reference: string, record: never) => Option<Built2024>>> = {
  species: speciesOption,
  backgrounds: backgroundOption,
  feats: featOption,
  subclasses: subclassOption,
};

/** Reads a pack file that `JSON.parse` gave, for the 2024 engine. */
export function loadContentPack(input: unknown, options: ContentPackOptions = {}): LoadResult {
  const loaded = loadPack(input, { hooks: new Set(HOOKS.keys()) });
  if (!loaded.pack) return loaded;
  const { pack, issues } = checkRules(loaded.pack, options.packs ?? []);
  return { pack, issues: [...loaded.issues, ...issues] };
}

interface Failure {
  type: RecordType;
  index: number;
  reference: string;
  error: RecordError;
}

/** The record without its rules layer: its effects, and for a subclass also the effects of its levels. */
function displayOnly(record: AnyRecord): AnyRecord {
  const display: Record<string, unknown> = { ...record };
  delete display.effects;
  delete display.levels;
  return display as AnyRecord;
}

const hasRules = (record: AnyRecord) => "effects" in record || "levels" in record;

/**
 * Converts each record of `pack` until none fails. An error in the record
 * itself is fixed first. An error in a feat that the record grants waits
 * for the fix of that feat, so that a record loses its effects only when
 * the cause is still there.
 */
function checkRules(input: Pack, others: readonly Pack[]): { pack: Pack; issues: LoadIssue[] } {
  let pack = input;
  const issues: LoadIssue[] = [];
  for (;;) {
    const failures = convertAll(pack, others);
    if (failures.length === 0) return { pack, issues };
    const own = failures.filter((f) => f.error.record === f.reference);
    // Fix one record at a time: a fix can change the result for the others.
    const failure = own[0] ?? failures[0];
    pack = fix(pack, failure, issues);
  }
}

function convertAll(pack: Pack, others: readonly Pack[]): Failure[] {
  const content: Content = { packs: [...others.filter((p) => p.pack.id !== pack.pack.id), pack] };
  const failures: Failure[] = [];
  for (const [type, convert] of Object.entries(CONVERTERS) as [RecordType, NonNullable<(typeof CONVERTERS)[RecordType]>][]) {
    (pack[type] as AnyRecord[]).forEach((record, index) => {
      const reference = referenceTo(pack.pack.id, record.key);
      try {
        convert(content, reference, record as never);
      } catch (error) {
        if (!(error instanceof RecordError)) throw error;
        failures.push({ type, index, reference, error });
      }
    });
  }
  return failures;
}

function fix(pack: Pack, { type, index, reference, error }: Failure, issues: LoadIssue[]): Pack {
  const records = [...(pack[type] as AnyRecord[])];
  const record = records[index];
  const inOwnRules = error.record === reference && (error.path[0] === "effects" || error.path[0] === "levels");
  const inGrantedFeat = error.record !== reference;
  if (hasRules(record) && (inOwnRules || inGrantedFeat)) {
    records[index] = displayOnly(record);
    issues.push({
      path: [type, index, ...(inGrantedFeat ? ["effects"] : error.path)],
      message: `${error.message}, so the record loads without its effects`,
      dropped: "effects",
    });
  } else {
    records.splice(index, 1);
    issues.push({ path: [type, index, ...error.path], message: `${error.message}, so the record does not load`, dropped: "record" });
  }
  return { ...pack, [type]: records };
}
