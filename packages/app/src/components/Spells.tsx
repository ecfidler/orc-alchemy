// The Spells step (ORC-60): each spell selection's cards, with a level
// filter and a name search, and the prepared spells of each class that
// prepares, with the prepare rules of the Spells panel (ORC-288). Each pick
// is an engine mutation, as in Options in Builder.tsx.
import { Checkbox, Label, Select } from "@orc-alchemy/ui";
import { useId, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { listText } from "../engine/selection-control.ts";
import { ordinal } from "../engine/sheet.ts";
import { prepareCounts, prepareSpells } from "../engine/spell-prepare.ts";
import { setPrepared, spellLevelOf, useSpellContent } from "../engine/spells.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { Selection } from "./Builder.tsx";
import { PrepareCountText } from "./PrepareCount.tsx";
import { OptionCards } from "./SelectionControl.tsx";
import { HEADING_CLASSES, Heading } from "./selection-heading.tsx";
import { useMutation } from "./use-mutation.ts";

const levelName = (n: number) => (n === 0 ? "Cantrips" : `${ordinal(n)} level`);

/** The heights of 1 to 5 lines of the chosen spells on a step narrower than 560px: a line of text-sm leading-5 is 20px. */
const NARROW_HEIGHTS = ["min-h-5", "min-h-10", "min-h-15", "min-h-20", "min-h-25"];

/** The heights of 1 to 3 lines of the chosen spells on a step 560px wide or more. */
const WIDE_HEIGHTS = ["@min-[560px]/spells:min-h-5", "@min-[560px]/spells:min-h-10", "@min-[560px]/spells:min-h-15"];

/**
 * The classes of the height that the chosen spells keep: the lines that the most picks take, with about 2 names on a
 * line of a narrow step (up to 5 lines) and 4 on a wide step (up to 3 lines). A selection with no maximum keeps 3
 * lines, so that a pick does not start a new line.
 */
export function chosenHeight(max: number | null): string {
  const lines = (perLine: number, most: number) => (max === null ? 3 : Math.min(most, Math.max(1, Math.ceil(max / perLine))));
  return `${NARROW_HEIGHTS[lines(2, NARROW_HEIGHTS.length) - 1]} ${WIDE_HEIGHTS[lines(4, WIDE_HEIGHTS.length) - 1]}`;
}

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
    <section aria-labelledby={id} className="@container/spells space-y-2">
      <Heading id={id} selection={selection} />
      {/* The chosen spells, also those that the filter hides. The line keeps the place of the lines that the most picks
      take (chosenHeight), so a pick does not move the filter and the cards (ORC-352). */}
      <div className={`flex items-baseline gap-3 ${chosenHeight(selection.max)}`}>
        <Label>Chosen</Label>
        <ul aria-label={`Chosen: ${name}`} className="flex flex-wrap gap-x-3 text-sm leading-5">
          {chosen.map((o) => (
            <li key={o.key}>{o.name}</li>
          ))}
        </ul>
      </div>
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
  const run = useMutation();
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
          Except for cantrips, {listText(knowAll, { serialComma: true })} do not need to select known spells since they can prepare any spell available in their
          class spell lists.
        </p>
      )}
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
