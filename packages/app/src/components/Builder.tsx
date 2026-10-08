// The builder (ORC-55): the open character's selections as steps of option
// cards, beside its sheet as a live preview. Each pick is an engine mutation
// through useCharacter's update, so it autosaves.
import { useId, useState } from "react";
import { remainingByStep, unfilled, useBuilderSteps, type BuilderOption, type BuilderSelection } from "../engine/builder.ts";
import { useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { AbilityScores } from "./AbilityScores.tsx";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { Classes, Heading, HitPoints, Improvements, useMutation } from "./Classes.tsx";
import { Description } from "./Description.tsx";
import { Hands, Inventory } from "./Equipment.tsx";
import { PreparedSpells, SpellSelection } from "./Spells.tsx";

export function Builder() {
  const { selections, sheet } = useOpenCharacter();
  const homebrew = useHomebrew((state) => state.homebrew);
  // The Description step has no selections, so builderSteps does not give
  // it. Before the character loads there are no steps at all.
  const engineSteps = useBuilderSteps(selections, homebrew);
  const steps = engineSteps.length === 0 ? engineSteps : [...engineSteps, { name: "Description", selections: [] }];
  const [stepName, setStepName] = useState("Race");
  const step = steps.find((s) => s.name === stepName) ?? steps[0];
  const counts = remainingByStep(steps);
  // As the old validate-selections: starting equipment is not flagged.
  const messages = unfilled(steps)
    .filter((s) => !s.tags.includes("starting-equipment"))
    .map(({ name, remaining: n }) => {
      const noun = Math.abs(n) === 1 ? "selection" : "selections";
      return n > 0 ? `You have ${n} more '${name}' ${noun} to make.` : `You must remove ${-n} '${name}' ${noun}.`;
    });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Builder" className="space-y-4">
        <section aria-label="Still to do">
          {messages.length === 0 ? (
            <p>Every choice is made.</p>
          ) : (
            <ul className="list-disc pl-5">
              {messages.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
        </section>
        <nav aria-label="Steps">
          <ol className="flex flex-wrap gap-2">
            {steps.map((s, i) => {
              const remaining = counts[i];
              return (
                <li key={s.name}>
                  <button
                    type="button"
                    aria-current={s === step ? "step" : undefined}
                    onClick={() => setStepName(s.name)}
                    className={`border border-black px-3 py-1 ${s === step ? "bg-black text-white" : ""}`}
                  >
                    {s.name}
                    {remaining > 0 && (
                      <>
                        <span className="sr-only"> ({remaining} to do)</span>
                        <span aria-hidden="true" className="ml-2 inline-block rounded-full bg-red-700 px-2 text-sm text-white">
                          {remaining}
                        </span>
                      </>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
        {step && (
          <>
            <h2 className="text-xl font-bold">{step.name}</h2>
            {step.selections.map((selection) => {
              // A class and a background can have starting equipment with the same key.
              const key = JSON.stringify(selection.actualPath);
              if (selection.key === "ability-scores") return <AbilityScores key={key} selection={selection} />;
              if (isList(selection)) return <Inventory key={key} selection={selection} />;
              if (step.name === "Spells") return <SpellSelection key={key} selection={selection} />;
              return <Selection key={key} selection={selection} />;
            })}
            {step.name === "Spells" && <PreparedSpells />}
            {step.name === "Equipment" && <Hands lists={step.selections.filter(isList)} />}
            {step.name === "Description" && <Description />}
          </>
        )}
      </section>
      <section aria-label="Preview" className="border-t border-black pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {sheet && <CharacterSheet sheet={sheet} />}
      </section>
    </div>
  );
}

/** An inventory list, such as Armor: top-level equipment, not a starting equipment choice. */
const isList = (selection: BuilderSelection) => selection.actualPath.length === 1 && selection.tags.includes("equipment");

/**
 * A selection's option cards, then the selections its selected options open.
 * A sequential one, such as levels, shows only the latter. The classes, hit
 * points and ability score improvements have their own controls.
 */
export function Selection({ selection }: { selection: BuilderSelection }) {
  if (selection.key === "hit-points" && selection.requireValue) return <HitPoints selection={selection} />;
  if (selection.key === "asi") return <Improvements selection={selection} />;
  return <Options selection={selection} />;
}

function Options({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { actualPath } = selection;
  // The classes are rows, not cards. They stay here, not in Selection, because
  // each class's choices open below the rows as any selected option's do.
  const isClass = actualPath.length === 1 && actualPath[0] === "class";

  // Classes in the entity's order, as their rows.
  const opened = (isClass ? selection.selected.map((key) => selection.options.find((o) => o.key === key)!) : selection.options).filter(
    (o) => o.selected && o.selections.length > 0,
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {isClass ? <Classes selection={selection} /> : !selection.sequential && <OptionCards selection={selection} options={selection.options} />}
      {opened.map((option) => (
        <div key={option.key} className="ml-2 space-y-4 border-l border-black pl-4">
          <h4 className="italic">{option.name}</h4>
          {option.selections.map((child) => (
            <Selection key={JSON.stringify(child.actualPath)} selection={child} />
          ))}
        </div>
      ))}
    </section>
  );
}

/**
 * A selection's option cards, or some of them: a pick selects the option, or
 * deselects it from a multiselect. The engine's refusal shows above them.
 */
export function OptionCards({ selection, options }: { selection: BuilderSelection; options: BuilderOption[] }) {
  const [error, run] = useMutation();
  const { actualPath } = selection;

  function pick(option: BuilderOption) {
    if (option.selected && !selection.multiselect) return;
    run((e, entity, opts) =>
      option.selected ? e.deselect(entity, actualPath, option.key, opts) : e.select(entity, actualPath, option.key, opts),
    );
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              aria-pressed={option.selected}
              onClick={() => pick(option)}
              className={`h-full w-full border border-black p-2 text-left ${option.selected ? "bg-black text-white" : "hover:bg-gray-100"}`}
            >
              {option.name}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
