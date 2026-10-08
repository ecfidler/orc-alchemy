// The Description step (ORC-61): the free-form character values, as the old
// builder's Description tab. Each one is a value of the strict entity, and
// setValue writes it. Text is stored as typed, so "" stays "". XP is an
// int, and a blank XP removes the value. (The import rule R5 differs: there
// a blank XP becomes 0.)
import type { Engine, StrictEntity } from "./engine.ts";

export interface DescriptionField {
  /** The value key, without its namespace. */
  key: string;
  label: string;
  kind: "text" | "number" | "textarea" | "url";
  /** The alt text of the image a url field shows. */
  alt?: string;
}

/** The fields in the old builder's order. */
export const DESCRIPTION_FIELDS: DescriptionField[] = [
  { key: "character-name", label: "Character Name", kind: "text" },
  { key: "player-name", label: "Player Name", kind: "text" },
  { key: "xps", label: "Experience Points", kind: "number" },
  { key: "age", label: "Age", kind: "text" },
  { key: "sex", label: "Sex", kind: "text" },
  { key: "height", label: "Height", kind: "text" },
  { key: "weight", label: "Weight", kind: "text" },
  { key: "hair", label: "Hair Color", kind: "text" },
  { key: "eyes", label: "Eye Color", kind: "text" },
  { key: "skin", label: "Skin Color", kind: "text" },
  { key: "personality-trait-1", label: "Personality Trait 1", kind: "textarea" },
  { key: "personality-trait-2", label: "Personality Trait 2", kind: "textarea" },
  { key: "ideals", label: "Ideals", kind: "textarea" },
  { key: "bonds", label: "Bonds", kind: "textarea" },
  { key: "flaws", label: "Flaws", kind: "textarea" },
  { key: "image-url", label: "Image URL", kind: "url", alt: "Portrait" },
  { key: "faction-name", label: "Faction Name", kind: "text" },
  { key: "faction-image-url", label: "Faction Image URL", kind: "url", alt: "Faction image" },
  { key: "description", label: "Description/Backstory", kind: "textarea" },
];

type Strict = { "~:orcpub.entity.strict/values"?: Record<string, unknown> };

/** A value as text: "" when it is not set, and XP as its number. */
export function storedValue(entity: StrictEntity, key: string): string {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as Strict;
  const stored = strict["~:orcpub.entity.strict/values"]?.[`~:orcpub.dnd.e5.character/${key}`];
  return typeof stored === "string" || typeof stored === "number" ? String(stored) : "";
}

/** The text as it is stored: as typed, but XP as its int, or "" when blank or not a number. */
export function normalized(key: string, text: string): string {
  if (key !== "xps") return text;
  const n = Number(text);
  return text.trim() === "" || !Number.isFinite(n) ? "" : String(Math.trunc(n));
}

/** Writes a value as typed. For XP, a blank or non-numeric text removes the value, and a number is stored as an int. */
export function setDescription(e: Engine, entity: StrictEntity, key: string, text: string) {
  const value = normalized(key, text);
  return e.setValue(entity, key, key === "xps" ? (value === "" ? null : Number(value)) : value);
}
