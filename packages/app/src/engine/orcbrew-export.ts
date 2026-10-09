// .orcbrew export (ORC-73): one pack as <pack>.orcbrew, or every pack as
// all-content.orcbrew, checked as the old app's export buttons checked them.
import type { PackExportCheck } from "@pubdoor/dmv";
import { CONTENT_TYPES } from "./content.ts";
import { engine } from "./engine.ts";

export interface OrcbrewExportOptions {
  /** The one pack to export. Without it, all packs, as all-content.orcbrew. */
  pack?: string;
  /** Pretty-print the text, as the old pretty-print export did. */
  pretty?: boolean;
  /**
   * Export even if the check fails, as the old "export anyway" did: with
   * placeholders for missing required fields, and each item problem repaired.
   */
  anyway?: boolean;
}

/** Why one pack fails the check, in words the user can read. */
export interface PackProblems {
  pack: string;
  problems: string[];
}

export type OrcbrewExportResult = { fileName: string; text: string } | { invalid: PackProblems[] };

/**
 * The .orcbrew file of the packs, or, unless anyway, the problems of each
 * pack that fails validateForExport. The packs are written as given: leave
 * out magic items, which the old app has no content type for.
 */
export function exportOrcbrew(homebrew: Record<string, object>, { pack, pretty = false, anyway = false }: OrcbrewExportOptions = {}): OrcbrewExportResult {
  const check = engine().validateForExport(homebrew, { pack });
  if (!check.valid && !anyway) {
    const invalid = Object.entries(check.packs).filter(([, result]) => !result.valid);
    return { invalid: invalid.map(([name, result]) => ({ pack: name, problems: problemsOf(result) })) };
  }
  const text = engine().orcbrewToEdn(check.valid ? homebrew : check.filled, { pack, pretty });
  return { fileName: pack === undefined ? "all-content.orcbrew" : `${pack}.orcbrew`, text };
}

const ITEM_PROBLEM_TEXT: Record<string, string> = {
  key: "its key is not its map key",
  "option-pack": "its pack name (option-pack) is blank",
  nil: "it has an empty value that the importer would remove",
};

function problemsOf(result: PackExportCheck): string[] {
  const missing = result.missingFields.flatMap(({ "content-type": type, "invalid-items": items }) =>
    items.map((item) => {
      const fields = [...item["missing-fields"]];
      if (item["traits-missing-names"] > 0) fields.push(`the name of ${item["traits-missing-names"]} traits`);
      return `${typeName(type)} ${item.name ?? item.key}: missing ${fields.join(", ")}`;
    }),
  );
  const items = result.itemProblems.map(({ "content-type": type, key, rule }) => `${typeName(type)} ${key}: ${ITEM_PROBLEM_TEXT[rule] ?? rule}`);
  return [...missing, ...items, ...result.errors];
}

/** "orcpub.dnd.e5/subclasses" as "Subclass", for a problem line. */
function typeName(type: string): string {
  const name = CONTENT_TYPES.find((t) => t.type === type.replace(/^:/, ""))?.one ?? type;
  return name.charAt(0).toUpperCase() + name.slice(1);
}
