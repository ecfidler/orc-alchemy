// The Class step (ORC-58): the classes and their levels, as the old builder's
// class rows, and the hit points and ability score improvements each level
// asks for. Each change is an engine mutation, as in Selection. It also holds
// useMutation and Heading, which Options in Builder.tsx uses for each selection.
import { useId, useMemo, useState } from "react";
import type { BuilderSelection } from "../engine/builder.ts";
import { averageHitPoints, rollHitPoints, storedHitPoints, type HitPointsMethod } from "../engine/classes.ts";
import { engine, type Engine, type Homebrew, type StrictEntity } from "../engine/engine.ts";
import { ABILITIES, unqualify } from "../engine/sheet.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";
import { NumberField } from "./AbilityScores.tsx";

const MAX_LEVEL = 20;

type Mutation = (e: Engine, entity: StrictEntity, options: { homebrew?: Homebrew }) => StrictEntity;

/** An engine mutation with the loaded homebrew; its error, if it throws, for the alert. */
export function useMutation(): [error: string | null, run: (mutate: Mutation) => void] {
  const homebrew = useHomebrew((state) => state.homebrew);
  const [error, setError] = useState<string | null>(null);
  function run(mutate: Mutation) {
    setError(null);
    try {
      useCharacter.getState().update((entity) => mutate(engine(), entity, { homebrew }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }
  return [error, run];
}

const button = "border border-black px-2 disabled:opacity-30";

/** The class selection: a row per class, in the entity's order, with its level, and a class to add. */
export function Classes({ selection }: { selection: BuilderSelection }) {
  const [error, run] = useMutation();
  const [adding, setAdding] = useState("");
  const option = (key: string) => selection.options.find((o) => o.key === key)!;
  const levelOf = (key: string) => option(key).selections.find((s) => s.key === "levels")?.selected.length ?? 1;
  const free = selection.options.filter((o) => !o.selected);
  const toAdd = free.find((o) => o.key === adding) ?? free[0];

  function replace(index: number, from: string, to: string) {
    const [old, next, levels] = [option(from).name, option(to).name, levelOf(from)];
    if (
      levels > 1 &&
      !window.confirm(
        `Replace ${old} with ${next}? ${old}'s ${levels} levels and their choices are removed, and ${next} starts at level 1. This cannot be undone.`,
      )
    )
      return;
    run((e, entity, opts) => e.setClass(entity, index, to, opts));
  }

  function remove(index: number, key: string) {
    // Removing the first class makes the next one first, at level 1.
    const next = selection.selected[1];
    if (index === 0 && next !== undefined && levelOf(next) > 1) {
      const name = option(next).name;
      const message = `Remove ${option(key).name}? ${name} becomes the first class and returns to level 1, and its other levels and their choices are removed. This cannot be undone.`;
      if (!window.confirm(message)) return;
    }
    run((e, entity, opts) => e.removeClass(entity, key, opts));
  }

  return (
    <>
      {error && <p role="alert">{error}</p>}
      <ol className="space-y-2">
        {selection.selected.map((key, i) => {
          const { name } = option(key);
          const level = levelOf(key);
          return (
            <li key={key} className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`Class ${i + 1}`}
                value={key}
                onChange={(event) => replace(i, key, event.target.value)}
                className="border border-black p-1"
              >
                {[option(key), ...free].map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.name}
                  </option>
                ))}
              </select>
              <span>Level</span>
              <button
                type="button"
                aria-label={`Remove a ${name} level`}
                disabled={level <= 1}
                onClick={() => run((e, entity, opts) => e.removeLevel(entity, key, opts))}
                className={button}
              >
                −
              </button>
              <span>{level}</span>
              <button
                type="button"
                aria-label={`Add a ${name} level`}
                disabled={level >= MAX_LEVEL}
                onClick={() => run((e, entity, opts) => e.addLevel(entity, key, opts))}
                className={button}
              >
                +
              </button>
              <button type="button" disabled={selection.selected.length === 1} onClick={() => remove(i, key)} className={button}>
                Remove {name}
              </button>
            </li>
          );
        })}
      </ol>
      {toAdd && (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Add a class"
            value={toAdd.key}
            onChange={(event) => setAdding(event.target.value)}
            className="border border-black p-1"
          >
            {free.map((o) => (
              <option key={o.key} value={o.key}>
                {o.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => run((e, entity, opts) => e.addClass(entity, toAdd.key, opts))} className={button}>
            Add class
          </button>
        </div>
      )}
    </>
  );
}

/** A selection's name and its picks to make or remove. */
export function Heading({ id, selection }: { id: string; selection: BuilderSelection }) {
  const { remaining } = selection;
  return (
    <h3 id={id} className="font-bold">
      {selection.name}
      {remaining !== 0 && (
        <span className="ml-2 font-normal">{remaining > 0 ? `(${remaining} to choose)` : `(${-remaining} too many)`}</span>
      )}
    </h3>
  );
}

/** A level's hit points: the average or a roll of the class's hit die, or a number typed in. */
export function HitPoints({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity, sheet } = useOpenCharacter();
  const [error, run] = useMutation();
  const { actualPath } = selection;
  // The path is ["class", <class>, "levels", <level>, "hit-points"].
  const die = sheet?.classes.find((c) => c.key === actualPath[1])?.hitDie ?? 0;
  const stored = useMemo(() => storedHitPoints(entity!, actualPath), [entity, actualPath]);
  const write = (method: HitPointsMethod, n: number) => run((e, entity, opts) => e.setField(entity, [...actualPath, method], n, opts));
  const toggle = (method: HitPointsMethod, text: string, n: () => number) => (
    <button
      type="button"
      aria-pressed={stored?.method === method}
      onClick={() => write(method, n())}
      className={`border border-black px-3 py-1 ${stored?.method === method ? "bg-black text-white" : "hover:bg-gray-100"}`}
    >
      {text}
    </button>
  );
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {error && <p role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {toggle("average", `Average (${averageHitPoints(die)})`, () => averageHitPoints(die))}
        {toggle("roll", `Roll (1d${die})`, () => rollHitPoints(die))}
        <NumberField label="Hit points" min={1} score={stored?.value ?? null} onCommit={(n) => write("manual-entry", n)} />
      </div>
    </section>
  );
}

/** An ability score improvement, such as at fighter level 4 or the half-elf's: picks of each ability, up and down. */
export function Improvements({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { sheet } = useOpenCharacter();
  const [error, run] = useMutation();
  const { actualPath, max } = selection;
  const full = max !== null && selection.selected.length >= max;
  return (
    <section aria-labelledby={id} className="space-y-2">
      <Heading id={id} selection={selection} />
      {error && <p role="alert">{error}</p>}
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {ABILITIES.map((ability) => {
          const abbr = ability.toUpperCase();
          const count = selection.selected.filter((key) => unqualify(key) === ability).length;
          const offered = selection.options.some((o) => unqualify(o.key) === ability);
          const total = sheet?.abilities.find((a) => a.ability === ability)?.score ?? 0;
          return (
            <li key={ability} className="text-center">
              <div>{abbr}</div>
              <div className="flex items-center justify-center gap-1">
                <button
                  type="button"
                  aria-label={`Decrease ${abbr}`}
                  disabled={count === 0}
                  onClick={() => run((e, entity, opts) => e.decreaseAbility(entity, actualPath, ability, opts))}
                  className={button}
                >
                  −
                </button>
                <span>+{count}</span>
                <button
                  type="button"
                  aria-label={`Increase ${abbr}`}
                  disabled={!offered || full || total >= 20}
                  onClick={() => run((e, entity, opts) => e.increaseAbility(entity, actualPath, ability, opts))}
                  className={button}
                >
                  +
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
