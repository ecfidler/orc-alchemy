// Homebrew pack storage (doc 04 §Storage): one record per pack, in the
// characters database's packs store. A stored record is read back as
// unknown, since the homebrew store checks each one before it uses it.
import type { PackFlags } from "../engine/import.ts";
import { run, write } from "./characters.ts";

export interface PackRecord extends PackFlags {
  /** The pack name. */
  id: string;
  /** .orcbrew is 2014 homebrew only (ORC-94). */
  rules: "2014";
  /** The pack's single-plugin map, as in parseOrcbrew's data. */
  plugin: object;
  updatedAt: string;
}

/** Writes the records in one transaction. */
export function savePacks(records: PackRecord[]): Promise<void> {
  return write(records.map((put) => ({ store: "packs", put })));
}

export function deletePack(id: string): Promise<void> {
  return write([{ store: "packs", delete: id }]);
}

export function listPacks(): Promise<unknown[]> {
  return run((db) => db.getAll("packs"));
}
