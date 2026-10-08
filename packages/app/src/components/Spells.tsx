// The Spells step (ORC-60): each spell selection's cards, with a level
// filter and a name search, and the prepared spells of each class that
// prepares. Each pick is an engine mutation, as in Options in Builder.tsx.
import { useId, useState } from "react";
import type { BuilderOption, BuilderSelection } from "../engine/builder.ts";
import { setPrepared, spellLevelOf, useSpellContent } from "../engine/spells.ts";
import type { Spellcaster } from "../engine/sheet.ts";
import { useOpenCharacter } from "../state/character.ts";
import { OptionCards, Selection } from "./Builder.tsx";
import { ordinal } from "./CharacterSheet.tsx";
import { Heading, useMutation } from "./Classes.tsx";

const levelName = (n: number) => (n === 0 ? "Cantrips" : `${ordinal(n)} level`);

/** The old list-print: "A", "A and B", "A, B, and C". */
const listPrint = (items: string[]) =>
  items.length <= 2 ? items.join(" and ") : `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;

/** A spell selection: its chosen spells, a level filter and a search, then the cards that pass them. */
export function SpellSelection({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const content = useSpellContent();
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const { actualPath, name } = selection;
  const levelOf = (option: BuilderOption) => spellLevelOf(option.key, option.name, content);
  const levels = [...new Set(selection.options.map(levelOf).filter((n) => n !== null))].sort((a, b) => a - b);
  const text = search.trim().toLowerCase();
  const shown = selection.options.filter(
    (o) => (level === "all" || levelOf(o) === Number(level)) && o.name.toLowerCase().includes(text),
  );
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
          <select
            aria-label={`Level: ${name}`}
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="border border-black p-1"
          >
            <option value="all">All levels</option>
            {levels.map((n) => (
              <option key={n} value={n}>
                {levelName(n)}
              </option>
            ))}
          </select>
        )}
        <input
          type="search"
          aria-label={`Search: ${name}`}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search"
          className="border border-black p-1"
        />
      </div>
      <OptionCards selection={selection} options={shown} />
      {chosen
        .filter((o) => o.selections.length > 0)
        .map((option) => (
          <div key={option.key} className="ml-2 space-y-4 border-l border-black pl-4">
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

/** The leveled spells each class that prepares has prepared, up to its count, as the old sheet's prepare checkboxes. A domain spell is always prepared and takes no place. */
export function PreparedSpells() {
  const { sheet } = useOpenCharacter();
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
          Except for cantrips, {listPrint(knowAll)} do not need to select known spells since they can prepare any spell
          available in their class spell lists.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {spellcasting.casters
        .filter((caster): caster is Spellcaster & { canPrepare: number } => caster.canPrepare !== null)
        .map(({ name, canPrepare }) => {
          const spells = spellcasting.byLevel
            .filter((l) => l.level > 0)
            .flatMap((l) => l.spells.filter((spell) => spell.source === name));
          const count = spells.filter((spell) => spell.prepared && !spell.alwaysPrepared).length;
          return (
            <section key={name} aria-label={`Prepared spells: ${name}`} className="space-y-2">
              <h3 className="font-bold">Prepared spells: {name}</h3>
              <p>
                {count} of {canPrepare} prepared
              </p>
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {spells.map((spell) => (
                  <li key={spell.key}>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        aria-label={`Prepared: ${spell.name}`}
                        checked={spell.prepared}
                        disabled={spell.alwaysPrepared || (!spell.prepared && count >= canPrepare)}
                        onChange={(event) => run((e, entity) => setPrepared(e, entity, name, spell.key, event.target.checked))}
                      />
                      {spell.name}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
    </>
  );
}
