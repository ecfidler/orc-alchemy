// A test helper: a Transit-encoded value, as the app stores a pack item, as the EDN text of an .orcbrew file. The test
// packs of the engine tests, the component tests and the e2e specs use it.

/** A Transit-encoded value as EDN text: "~:x" is the keyword :x, { "~#set": [...] } is a set. */
export function toEdn(value: unknown): string {
  if (typeof value === "string") return value.startsWith("~:") ? `:${value.slice(2)}` : JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "nil";
  if (Array.isArray(value)) return `[${value.map(toEdn).join(" ")}]`;
  const map = value as Record<string, unknown>;
  if (Array.isArray(map["~#set"])) return `#{${map["~#set"].map(toEdn).join(" ")}}`;
  return `{${Object.entries(map)
    .map(([k, v]) => `${toEdn(k)} ${toEdn(v)}`)
    .join("\n ")}}`;
}
