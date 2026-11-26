// The builder (ORC-55): the open character's selections as steps of option
// cards, beside its sheet as a live preview. Each pick is an engine mutation
// through useCharacter's update, so it autosaves.
import { Button, NoteCount, Toggle, ToggleGroup } from "@orc-alchemy/ui";
import { useId, useState } from "react";
import { type BuilderOption, type BuilderSelection, remainingByStep, type StepName, unfilled, useBuilderSteps } from "../engine/builder.ts";
import { useOpenCharacter } from "../state/character.ts";
import { AbilityScores } from "./AbilityScores.tsx";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { Classes, Heading, HitPoints, Improvements, useMutation } from "./Classes.tsx";
import { CustomizeLines, customizableFor } from "./CustomizeDialog.tsx";
import { useCustomOrigin } from "./CustomOriginDialog.tsx";
import { Description } from "./Description.tsx";
import { Hands, Inventory } from "./Equipment.tsx";
import { PreparedSpells, SpellSelection } from "./Spells.tsx";

/** The name of the builder's Spells step, for example for a link to it (`/build/{id}?step=Spells`). */
export const SPELLS_STEP: StepName = "Spells";

/**
 * `step`: the name of the step that shows first, for example `SPELLS_STEP`. The Race step by default, until the step
 * rail sets which step opens (ORC-340, ORC-342). It is read only
 * at the start: a later change of step does not change it, so the URL keeps its `?step=` and a reload goes back to
 * that step. A name that is not a step gives the first step.
 */
export function Builder({ step: firstStep = "Race" }: { step?: string }) {
  const { selections, sheet, content } = useOpenCharacter();
  // The ten steps, with Name and Description. Before the character loads there are no steps at all.
  const steps = useBuilderSteps(selections, content);
  const [stepName, setStepName] = useState(firstStep);
  const step = steps.find((s) => s.name === stepName) ?? steps[0];
  const counts = remainingByStep(steps);
  // As the old validate-selections: starting equipment is not flagged.
  const messages = unfilled(steps)
    .filter((s) => !s.tags.includes("starting-equipment"))
    .map(({ name, remaining: n }) => {
      const noun = Math.abs(n) === 1 ? "selection" : "selections";
      return n > 0
        ? { text: `You have ${n} more '${name}' ${noun} to make.`, tooMany: false }
        : { text: `You must remove ${-n} '${name}' ${noun}.`, tooMany: true };
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
                <li key={i} className={message.tooMany ? "text-danger" : undefined}>
                  {message.text}
                </li>
              ))}
            </ul>
          )}
        </section>
        <nav aria-label="Steps">
          <ol className="flex flex-wrap gap-2">
            {steps.map((s, i) => {
              const { toDo, tooMany } = counts[i];
              // Picks to make are a yellow note count; picks to remove are a red one.
              return (
                <li key={s.name}>
                  <Button aria-current={s === step ? "step" : undefined} onClick={() => setStepName(s.name)}>
                    {s.name}
                    {toDo > 0 && (
                      <>
                        <span className="sr-only"> ({toDo} to do)</span>
                        <NoteCount>{toDo}</NoteCount>
                      </>
                    )}
                    {tooMany > 0 && (
                      <>
                        <span className="sr-only"> ({tooMany} too many)</span>
                        <NoteCount tone="failed">{tooMany} too many</NoteCount>
                      </>
                    )}
                  </Button>
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
              if (step.name === SPELLS_STEP) return <SpellSelection key={key} selection={selection} />;
              return <Selection key={key} selection={selection} />;
            })}
            {step.name === "Name" && <p>The character name is on the Description step.</p>}
            {step.name === SPELLS_STEP && <PreparedSpells />}
            {step.name === "Equipment" && <Hands lists={step.selections.filter(isList)} />}
            {step.name === "Description" && <Description />}
          </>
        )}
      </section>
      <section aria-label="Preview" className="border-t border-rule-strong pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {sheet && <CharacterSheet sheet={sheet} preview />}
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
  // A feat, a background or a race has a Customize line under the cards (ORC-134, ORC-135, ORC-136).
  const customizable = customizableFor(selection);
  // The race has the Custom Origin entry after its cards (ORC-138).
  const origin = useCustomOrigin(selection);

  // Classes in the entity's order, as their rows.
  const opened = (isClass ? selection.selected.map((key) => selection.options.find((o) => o.key === key)!) : selection.options).filter(
    (o) => o.selected && o.selections.length > 0,
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {isClass ? <Classes selection={selection} /> : !selection.sequential && <OptionCards selection={selection} options={selection.options} />}
      {origin?.card}
      {customizable && <CustomizeLines selection={selection} customizable={customizable} guided={origin?.guided} />}
      {origin?.dialog}
      {opened.map((option) => (
        <div key={option.key} className="ml-2 space-y-4 border-l border-rule-strong pl-4">
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
    run((e, entity, opts) => (option.selected ? e.deselect(entity, actualPath, option.key, opts) : e.select(entity, actualPath, option.key, opts)));
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ToggleGroup
        aria-label={selection.name}
        value={options.filter((option) => option.selected).map((option) => option.key)}
        multiple={selection.multiselect}
        className="grid grid-cols-2 gap-2 sm:grid-cols-3"
      >
        {options.map((option) => (
          <Toggle key={option.key} value={option.key} onPressedChange={() => pick(option)} className="h-full w-full p-2 text-left">
            {option.name}
          </Toggle>
        ))}
      </ToggleGroup>
    </>
  );
}
