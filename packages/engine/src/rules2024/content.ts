// The loaded content that the converter and the hooks read: the packs, by
// record type and reference.

import { parseReference, referenceTo } from "../format/keys.ts";
import type { Pack, Records, RecordType } from "../format/schema.ts";
import type { HookRegistry } from "./hooks/hook.ts";

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
