// The Spells step (ORC-60): each spell selection's cards, with a level
// filter and a name search, and the prepared spells of each class that
// prepares, with the prepare rules of the Spells panel (ORC-288). Each pick
// is an engine mutation, as in Options in Builder.tsx.
import { Checkbox, Select } from "@orc-alchemy/ui";
import { useId, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { ordinal } from "../engine/sheet.ts";
import { prepareCounts, prepareSpells } from "../engine/spell-prepare.ts";
import { setPrepared, spellLevelOf, useSpellContent } from "../engine/spells.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { OptionCards, Selection } from "./Builder.tsx";
import { HEADING_CLASSES, Heading, useMutation } from "./Classes.tsx";
import { PrepareCountText } from "./PrepareCount.tsx";

const levelName = (n: number) => (n === 0 ? "Cantrips" : `${ordinal(n)} level`);

/** The old list-print: "A", "A and B", "A, B, and C". */
const listPrint = (items: string[]) => (items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`);

/** A spell selection: its chosen spells, a level filter and a search, then the cards that pass them. */
export function SpellSelection({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const content = useSpellContent();
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const { name } = selection;
  const levelOf = (option: BuilderOption) => spellLevelOf(option.key, option.name, content);
  const levels = [...new Set(selection.options.map(levelOf).filter((n) => n !== null))].sort((a, b) => a - b);
  const text = search.trim().toLowerCase();
  const shown = selection.options.filter((o) => (level === "all" || levelOf(o) === Number(level)) && o.name.toLowerCase().includes(text));
  const chosen = selection.options.filter((o) => o.selected);

  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {chosen.length > 0 && (
        <ul aria-label={`Chosen: ${name}`} className="flex flex-wrap gap-x-3 text-sm">
          {chosen.map((o) => (
            <li key={o.key}>{o.name}</li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        {levels.length > 1 && (
          <Select
            aria-label={`Level: ${name}`}
            value={level}
            options={[["all", "All levels"], ...levels.map((n): [string, string] => [String(n), levelName(n)])]}
            onValueChange={setLevel}
          />
        )}
        <input
          type="search"
          aria-label={`Search: ${name}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="border border-ink p-1"
        />
      </div>
      <OptionCards selection={selection} options={shown} />
      {chosen
        .filter((o) => o.selections.length > 0)
        .map((option) => (
          <div key={option.key} className="ml-2 space-y-4 border-l border-rule-strong pl-4">
            <h4 className="italic">{option.name}</h4>
            {option.selections.map((child) =>
              child.tags.includes("spells") ? (
                <SpellSelection key={JSON.stringify(child.actualPath)} selection={child} />
              ) : (
                <Selection key={JSON.stringify(child.actualPath)} selection={child} />
              ),
            )}
          </div>
        ))}
    </section>
  );
}

/**
 * The leveled spells of each class that prepares, with a box each, and the
 * prepare count of the class (ORC-288, docs/design/spells-panel.md
 * "Preparing spells"): the rules of the Spells panel. Nothing stops the user
 * at the limit; over it, the count says how many spells to remove. An
 * always-prepared spell, for example a domain spell, has a filled box that
 * cannot change, and it is not in the count. A class with no known limit
 * prepares with no limit.
 */
export function PreparedSpells() {
  const { sheet } = useOpenCharacter();
  const lookup = useSpellLookup();
  const [error, run] = useMutation();
  const spellcasting = sheet?.spellcasting;
  if (!spellcasting) return null;
  // As the old known-mode-info: those classes know their whole spell list.
  const knowAll = Object.entries(spellcasting.knownModes)
    .filter(([, mode]) => mode === "all")
    .map(([className]) => `${className}s`);
  return (
    <>
      {knowAll.length > 0 && (
        <p>
          Except for cantrips, {listPrint(knowAll)} do not need to select known spells since they can prepare any spell available in their class spell lists.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {prepareCounts(spellcasting, sheet.classes).map((count) => {
        const name = count.className;
        return (
          <section key={name} aria-label={`Prepared spells: ${name}`} className="space-y-2">
            <h3 className={HEADING_CLASSES}>Prepared spells: {name}</h3>
            <p>
              <PrepareCountText count={count} withClass={false} />
            </p>
            {/* The boxes wait for the spell records, so that they show the names of the records at once, as the panel does. */}
            {lookup && (
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {prepareSpells(spellcasting, name, lookup).map((spell) => (
                  <li key={spell.key}>
                    <Checkbox
                      label={spell.name}
                      name={`Prepared: ${spell.name}`}
                      checked={spell.prepared}
                      disabled={spell.kind === "always"}
                      onCheckedChange={(on) => run((e, entity) => setPrepared(e, entity, name, spell.key, on))}
                      className="gap-2"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </>
  );
}
