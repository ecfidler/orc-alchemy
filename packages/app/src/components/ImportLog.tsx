import type { ReactNode } from "react";
import type { LastImport } from "../state/homebrew.ts";

/** One automatic fix from the importer's log, as the engine gives it. Keywords are "ns/name" strings. */
interface Change {
  type?: string;
  path?: unknown;
  field?: unknown;
  from?: unknown;
  to?: unknown;
  description?: string;
  details?: { key?: unknown; "content-type"?: unknown; plugin?: unknown; changes?: { fields?: unknown[]; "traits-fixed"?: number; "options-fixed"?: number } }[];
}

/** The change types the old panel shows to the user, by section. Any other type goes under Advanced details. */
const SECTIONS: { types: string[]; title: (changes: Change[]) => string }[] = [
  { types: ["key-renamed"], title: (changes) => `Key renames (${changes.length})` },
  {
    types: ["filled-required-fields"],
    title: (changes) => {
      const items = changes.reduce((n, c) => n + (c.details?.length ?? 0), 0);
      return items > 0 ? `Field fixes (${items} items)` : `Field fixes (${changes.length})`;
    },
  },
  {
    types: ["string-fix", "text-normalization", "renamed-plugin-key", "normalized-ability-key", "defaulted-choose"],
    title: (changes) => `Data cleanup (${changes.length})`,
  },
];
const USER_TYPES = new Set(SECTIONS.flatMap((s) => s.types));

/** A value as the old panel printed it: strings as they are, other values as data. */
const show = (value: unknown) => (typeof value === "string" ? value : JSON.stringify(value));
/** The name part of an "ns/name" keyword string. */
const bare = (value: unknown) => show(value).replace(/^.*\//, "");

function Code({ children }: { children: ReactNode }) {
  return <code className="bg-gray-100 px-1">{children}</code>;
}

/** One change, worded as the old import log words it (views/import_log.cljs, format-change-item). */
function ChangeText({ change }: { change: Change }) {
  const { type, path, field, from, to, description } = change;
  switch (type) {
    case "renamed-plugin-key":
      return <>Renamed empty pack name <Code>{show(from)}</Code> to <Code>{show(to)}</Code></>;
    case "fixed-option-pack":
      return <>Fixed empty option-pack at <Code>{show(path)}</Code></>;
    case "removed-nil":
      return <>Removed nil <Code>{bare(field)}</Code> at <Code>{show(path)}</Code></>;
    case "replaced-nil":
      return <>Replaced <Code>{bare(field)} nil</Code> with <Code>{show(to)}</Code></>;
    case "preserved-nil":
      return <>Kept <Code>{bare(field)}</Code> nil at <Code>{show(path)}</Code></>;
    case "string-fix":
      return <>{description}</>;
    case "removed-nil-key":
      return <>Removed nil key at <Code>{show(path)}</Code></>;
    case "text-normalization":
      return <>{description ?? "Normalized Unicode characters to ASCII"}</>;
    case "filled-required-fields":
      return (
        <>
          {description ?? "Filled missing required fields with placeholders"}
          {change.details && change.details.length > 0 && (
            <ul className="ml-6 list-disc">
              {change.details.map(({ key, "content-type": contentType, plugin, changes }, i) => {
                const parts = [
                  changes?.fields?.length ? `filled ${changes.fields.map(bare).join(", ")}` : null,
                  changes?.["traits-fixed"] ? `${changes["traits-fixed"]} trait(s) named` : null,
                  changes?.["options-fixed"] ? `${changes["options-fixed"]} option(s) filled` : null,
                ].filter((p) => p !== null);
                return (
                  <li key={i}>
                    <Code>{bare(key)}</Code>
                    {contentType !== undefined && ` (${bare(contentType)})`}
                    {plugin !== undefined && ` in ${show(plugin)}`}
                    {parts.length > 0 && `: ${parts.join("; ")}`}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      );
    case "normalized-ability-key":
      return <>Rewrote ability key <Code>{show(from)}</Code> to <Code>{show(to)}</Code> at <Code>{show(path)}</Code></>;
    case "defaulted-choose":
      return <>Set skill choice to <Code>{show(to)}</Code> at <Code>{show(path)}</Code></>;
    case "key-renamed":
      return <>Renamed key <Code>{show(from)}</Code> to <Code>{show(to)}</Code></>;
    default:
      return <>{JSON.stringify(change)}</>;
  }
}

function Section({ title, open = true, children }: { title: string; open?: boolean; children: ReactNode }) {
  return (
    <details open={open} className="border-l-4 border-black pl-2">
      <summary className="cursor-pointer font-bold">{title}</summary>
      {children}
    </details>
  );
}

/**
 * The log of one homebrew import, in the sections of the old app's import
 * log panel: errors, skipped items, the automatic fixes by kind, and the
 * other changes under Advanced details, closed. It also lists the key
 * conflicts the import found.
 */
export function ImportLog({ result }: { result: LastImport }) {
  const { log, conflicts, skipped, fileName } = result;
  const changes = log.changes as Change[];
  const advanced = changes.filter((c) => !USER_TYPES.has(c.type ?? ""));
  // A parse error can give its line; its hint is already in the message.
  const errors = log.errors.map((error) => (log.line != null ? `Line ${log.line}: ${error}` : error));
  const clean = errors.length === 0 && skipped.length === 0 && changes.length === 0 && conflicts.length === 0;

  return (
    <section aria-label="Import log" className="space-y-2 border border-black p-2">
      <h3 className="font-bold">Import log: {fileName}</h3>
      <p role="status" className="whitespace-pre-line">
        {log.message}
      </p>
      {errors.length > 0 && (
        <Section title={`Errors (${errors.length})`}>
          <ul className="ml-6 list-disc">
            {errors.map((error, i) => (
              <li key={i} className="whitespace-pre-wrap">
                {error}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {skipped.length > 0 && (
        <Section title={`Skipped items (${skipped.length})`}>
          <ul className="ml-6 list-disc">
            {skipped.map(({ key, errors }, i) => (
              <li key={i} className="whitespace-pre-wrap">
                <Code>{bare(key)}</Code>: {show(errors)}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {SECTIONS.map(({ types, title }) => {
        const items = changes.filter((c) => types.includes(c.type ?? ""));
        if (items.length === 0) return null;
        return (
          <Section key={types[0]} title={title(items)}>
            <ul className="ml-6 list-disc">
              {items.map((change, i) => (
                <li key={i}>
                  <ChangeText change={change} />
                </li>
              ))}
            </ul>
          </Section>
        );
      })}
      {advanced.length > 0 && (
        <Section title={`Advanced details (${advanced.length})`} open={false}>
          <ul className="ml-6 list-disc">
            {advanced.map((change, i) => (
              <li key={i}>
                <ChangeText change={change} />
              </li>
            ))}
          </ul>
        </Section>
      )}
      {conflicts.length > 0 && (
        <Section title={`Key conflicts (${conflicts.length})`}>
          <p>More than one item uses each of these keys. The packs were loaded as they are.</p>
          <ul className="ml-6 list-disc">
            {conflicts.map((c) => (
              <li key={c.id}>
                {c["content-type-name"]} <Code>{c.key}</Code>:{" "}
                {c.type === "internal"
                  ? `used by more than one pack in this file`
                  : `${c["import-name"] ?? c.key} from ${c["import-source"]} has the key of ${c["existing-name"] ?? c.key} from ${c["existing-source"]}`}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {clean && <p>No issues found. The import completed cleanly.</p>}
    </section>
  );
}
