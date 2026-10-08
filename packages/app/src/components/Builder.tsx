// The builder (ORC-55): the open character's selections as steps of option
// cards, beside its sheet as a live preview. Each pick is an engine mutation
// through useCharacter's update, so it autosaves.
import { useId, useState } from "react";
import { remainingByStep, unfilled, useBuilderSteps, type BuilderOption, type BuilderSelection } from "../engine/builder.ts";
import { engine } from "../engine/engine.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { AbilityScores } from "./AbilityScores.tsx";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { Classes, HitPoints, Improvements } from "./Classes.tsx";

export function Builder() {
  const { selections, sheet } = useOpenCharacter();
  const homebrew = useHomebrew((state) => state.homebrew);
  const steps = useBuilderSteps(selections, homebrew);
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
            {step.selections.map((selection) =>
              selection.key === "ability-scores" ? (
                <AbilityScores key={selection.key} selection={selection} />
              ) : (
                <Selection key={selection.key} selection={selection} />
              ),
            )}
          </>
        )}
      </section>
      <section aria-label="Preview" className="border-t border-black pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
        {sheet && <CharacterSheet sheet={sheet} />}
      </section>
    </div>
  );
}

/**
 * A selection's option cards, then the selections its selected options open.
 * A sequential one, such as levels, shows only the latter. The classes, hit
 * points and ability score improvements have their own controls.
 */
function Selection({ selection }: { selection: BuilderSelection }) {
  if (selection.key === "hit-points" && selection.requireValue) return <HitPoints selection={selection} />;
  if (selection.key === "asi") return <Improvements selection={selection} />;
  return <Options selection={selection} />;
}

function Options({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const homebrew = useHomebrew((state) => state.homebrew);
  const [error, setError] = useState<string | null>(null);
  const { actualPath, remaining } = selection;
  const isClass = actualPath.length === 1 && actualPath[0] === "class";

  function pick(option: BuilderOption) {
    if (option.selected && !selection.multiselect) return;
    setError(null);
    try {
      useCharacter.getState().update((e) => {
        const opts = { homebrew };
        if (option.selected) return engine().deselect(e, actualPath, option.key, opts);
        return engine().select(e, actualPath, option.key, opts);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  // Classes in the entity's order, as their rows.
  const opened = (isClass ? selection.selected.map((key) => selection.options.find((o) => o.key === key)!) : selection.options).filter(
    (o) => o.selected && o.selections.length > 0,
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="font-bold">
        {selection.name}
        {remaining !== 0 && (
          <span className="ml-2 font-normal">{remaining > 0 ? `(${remaining} to choose)` : `(${-remaining} too many)`}</span>
        )}
      </h3>
      {error && <p role="alert">{error}</p>}
      {isClass ? (
        <Classes selection={selection} />
      ) : (
        !selection.sequential && (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {selection.options.map((option) => (
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
        )
      )}
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
