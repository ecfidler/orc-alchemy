// The plug-in seam of the homebrew builder (HomebrewBuilder.tsx): what a
// type's form gets, and what it gives the frame. It is in its own file so a
// form and the frame do not import each other.
import type { ComponentType } from "react";
import type { ContentType, Engine, ValidationProblem } from "../../engine/engine.ts";

/**
 * One item as the form edits it: verbose Transit-JSON, as a stored pack has
 * its items, so the key "~:name" is the field :name and the value "~:wizard"
 * is the keyword :wizard. The validators take this form and return it.
 */
export type ItemRecord = Record<string, unknown>;

/** A validator's problem, or one that the frame adds, with its own text. */
export type Problem = ValidationProblem | { path: (string | number)[]; text: string };

export interface FormProps {
  record: ItemRecord;
  /** Replaces the record. */
  onChange: (record: ItemRecord) => void;
  /** The problems with the record. Show them with FieldProblems. */
  problems: Problem[];
}

/** One content type that has a form: stored in a pack, or in a store of its own. */
export type BuilderType = BuilderBase & (InPack | OutsidePacks);

interface InPack {
  /** The pack content type the item is stored under. */
  contentType: ContentType;
  save?: never;
  load?: never;
  check?: never;
}

/** A type stored outside packs, such as the custom magic items. The frame shows no option source. */
interface OutsidePacks {
  contentType?: never;
  /**
   * Stores the item as the validator returned it. storedKey is the key of
   * the item that was edited, or undefined for a new item.
   */
  save: (item: object, storedKey?: string) => Promise<void>;
  /** The stored item with the key, or undefined. */
  load: (key: string) => ItemRecord | undefined;
  /** More problems with the item, as validated, that stop its save. storedKey is as for save. */
  check?: (item: object, storedKey?: string) => Problem[];
}

interface BuilderBase {
  /** The validator for the type. */
  validator: keyof Engine["validate"];
  /** The name of one item, such as "spell", for the UI. */
  one: string;
  /** The record of a new item. */
  empty: ItemRecord;
  /**
   * The top-level fields, without the "~:", that Form shows problems for.
   * The frame lists the problems of the other fields at the top.
   */
  fields: string[];
  Form: ComponentType<FormProps>;
}

export const DAMAGE_TYPES = ["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"];
export const CONDITIONS = ["Blinded", "Charmed", "Deafened", "Exhausted", "Frightened", "Grappled", "Incapacitated", "Invisible", "Paralyzed", "Petrified", "Poisoned", "Prone", "Restrained", "Stunned", "Unconscious"];

/** A key as a title, such as "very-rare" to "Very Rare". */
export const title = (key: string) => key.split("-").map((word) => word[0].toUpperCase() + word.slice(1)).join(" ");
/** A name as a key, such as "Lawful Good" to "lawful-good". */
export const nameToKey = (name: string) => name.toLowerCase().replace(/\W+/g, "-");

/** The text of one problem with the field labelled label. */
export function problemText(label: string, problem: Problem): string {
  if ("text" in problem) return problem.text;
  const { reason, pred } = problem;
  if (reason === "missing") return `${label} is required.`;
  if (reason === "duplicate") return `${label} has two options with the same name.`;
  if (pred.includes("starts-with-letter")) return `${label} must start with a letter.`;
  return `${label} is not valid.`;
}

/** The problems of one top-level field, as text, under its control. */
export function FieldProblems({ problems, field, label }: { problems: Problem[]; field: string; label: string }) {
  const found = problems.filter((p) => p.path[0] === field);
  if (found.length === 0) return null;
  return (
    <ul aria-label={`Problems: ${label}`} className="text-red-700">
      {found.map((problem, i) => (
        <li key={i}>{problemText(label, problem)}</li>
      ))}
    </ul>
  );
}
