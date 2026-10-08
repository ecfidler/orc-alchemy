// The Description step (ORC-61): the free-form character values, as the old
// builder's Description tab. Each one is a value of the strict entity, and
// setValue writes it. Text is stored as typed, so "" stays "" (quirk R4).
// XP is an int (quirk R5).
import type { Engine, StrictEntity } from "./engine.ts";

export interface DescriptionField {
  /** The value key, without its namespace. */
  key: string;
  label: string;
  kind: "text" | "number" | "textarea" | "url";
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
  { key: "image-url", label: "Image URL", kind: "url" },
  { key: "faction-name", label: "Faction Name", kind: "text" },
  { key: "faction-image-url", label: "Faction Image URL", kind: "url" },
  { key: "description", label: "Description/Backstory", kind: "textarea" },
];

type Strict = { "~:orcpub.entity.strict/values"?: Record<string, unknown> };

/** A value as text: "" when it is not set, and XP as its number. */
export function storedValue(entity: StrictEntity, key: string): string {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as Strict;
  const stored = strict["~:orcpub.entity.strict/values"]?.[`~:orcpub.dnd.e5.character/${key}`];
  return typeof stored === "string" || typeof stored === "number" ? String(stored) : "";
}

/**
 * Writes a value as typed. For XP, a blank or non-numeric text removes the
 * value, and a number is stored as an int.
 */
export function setDescription(e: Engine, entity: StrictEntity, key: string, text: string) {
  if (key !== "xps") return e.setValue(entity, key, text);
  const n = Number(text);
  return e.setValue(entity, key, text.trim() === "" || !Number.isFinite(n) ? null : Math.trunc(n));
}
