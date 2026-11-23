// The key scheme of the 2024 content format (docs/design/2024-content-format.md,
// section 4). A record has a key that is unique for its record type in its
// pack. A reference to a record is the pack id, a colon, and the key:
// "srd52:fireball".

/** Lowercase letters, digits, and single hyphens between them. */
export const KEY_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A pack id, a colon, and a key. */
export const REFERENCE_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The id of the built-in SRD 5.2.1 pack. */
export const SRD_PACK = "srd52";
/** The id of the SRD 5.2.1 monsters pack, which loads on demand. */
export const SRD_MONSTERS_PACK = "srd52-monsters";

export function isKey(value: string): boolean {
  return KEY_PATTERN.test(value);
}

export function isReference(value: string): boolean {
  return REFERENCE_PATTERN.test(value);
}

export interface ParsedReference {
  pack: string;
  key: string;
}

/** The pack id and the key of a reference. Throws for a value that is not a reference. */
export function parseReference(reference: string): ParsedReference {
  if (!isReference(reference)) throw new Error(`"${reference}" is not a reference: write it as pack:key`);
  const at = reference.indexOf(":");
  return { pack: reference.slice(0, at), key: reference.slice(at + 1) };
}

export function referenceTo(pack: string, key: string): string {
  return `${pack}:${key}`;
}

/**
 * A key from a name, for a record that has no upstream `index` (Eldritch
 * Invocations, Metamagic options, and the variants that upstream divides
 * into trait records). Lowercase, without apostrophes, and with one hyphen
 * for each run of other characters. "Thieves' Tools" gives "thieves-tools".
 */
export function keyFromName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
