// The Spells step (ORC-60): the SRD spell levels for the level filter, and
// the prepared spells, read from and written to the strict entity. Only this
// file knows their Transit keys.
import { useEffect, useState } from "react";
import type { Engine, StrictEntity } from "./engine.ts";

const BY_CLASS = "~:orcpub.dnd.e5.character/prepared-spells-by-class";
const CLASS_NAME = "~:orcpub.dnd.e5.character/class-name";
const PREPARED = "~:orcpub.dnd.e5.character/prepared-spells";

export type SpellContent = Map<string, { level: number; school: string }>;

let loading: Promise<SpellContent> | undefined;
let loaded: SpellContent | undefined;

/** Loads the SRD spells once, as their own chunk, as spell key to level and school. */
export function loadSpellContent(): Promise<SpellContent> {
  loading ??= import("@pubdoor/dmv/content/spells.json").then(
    (mod) => (loaded = new Map(mod.default.map((spell) => [spell.key, { level: spell.level, school: spell.school }]))),
  );
  return loading;
}

/** The SRD spells; null until they load. */
export function useSpellContent(): SpellContent | null {
  const [content, setContent] = useState(loaded ?? null);
  useEffect(() => {
    if (content === null) loadSpellContent().then(setContent, console.error);
  }, [content]);
  return content;
}

/**
 * A spell's level: from the SRD content, or else from a "N - " prefix of
 * its option name, such as "1 - Alarm". A homebrew spell can have neither;
 * its level is then null.
 */
export function spellLevelOf(key: string, name: string, content: SpellContent | null): number | null {
  const level = content?.get(key)?.level;
  if (level !== undefined) return level;
  const prefix = /^(\d) - /.exec(name);
  return prefix ? Number(prefix[1]) : null;
}

/**
 * The entity's prepared-spells-by-class, as class name to spell keys. built
 * has it as null, so this reads the strict entity's verbose Transit-JSON:
 * [{ "~:…/class-name": "Wizard", "~:…/prepared-spells": { "~#set": ["~:alarm", …] } }].
 */
export function preparedSpells(entity: StrictEntity): Record<string, Set<string>> {
  const strict = (typeof entity === "string" ? JSON.parse(entity) : entity) as {
    "~:orcpub.entity.strict/values"?: Record<string, unknown>;
  };
  const byClass = (strict["~:orcpub.entity.strict/values"]?.[BY_CLASS] ?? []) as Record<string, unknown>[];
  return Object.fromEntries(
    byClass.map((entry) => {
      const spells = entry[PREPARED] as { "~#set"?: string[] } | undefined;
      return [entry[CLASS_NAME] as string, new Set((spells?.["~#set"] ?? []).map((key) => key.replace(/^~:/, "")))];
    }),
  );
}

/**
 * Prepares a class's spell, or stops preparing it. setValue cannot write the
 * stored list of records, but it takes a map of class name to a set and
 * stores that as the list. The value replaces the list, so this writes every
 * class.
 */
export function setPrepared(e: Engine, entity: StrictEntity, className: string, spellKey: string, prepared: boolean) {
  const byClass = preparedSpells(entity);
  const spells = (byClass[className] ??= new Set());
  if (prepared) spells.add(spellKey);
  else spells.delete(spellKey);
  const value = Object.fromEntries(Object.entries(byClass).map(([name, keys]) => [name, { "~#set": [...keys].map((key) => `~:${key}`) }]));
  return e.setValue(entity, "prepared-spells-by-class", value);
}
