// The Abilities step (ORC-57): the base scores, set by one of the old
// builder's four methods, and the increases the engine adds, read-only.
import { useId, useMemo, useState, type ReactNode } from "react";
import {
  POINT_BUY_COSTS,
  POINT_BUY_POINTS,
  POINT_BUY_START,
  STANDARD_SCORES,
  abilityRows,
  baseScores,
  canDecrease,
  canIncrease,
  pointsLeft,
  rollScores,
  setBaseScores,
  swapScores,
  type Method,
  type Scores,
} from "../engine/abilities.ts";
import type { BuilderSelection } from "../engine/builder.ts";
import { ABILITIES, bonusStr, type Ability } from "../engine/sheet.ts";
import { useCharacter, useOpenCharacter } from "../state/character.ts";
import { useHomebrew } from "../state/homebrew.ts";

const abbr = (ability: Ability) => ability.toUpperCase();

/** The ability-scores selection: its methods as toggles, then a table of base scores and what is added to them. */
export function AbilityScores({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { entity, built, selections } = useOpenCharacter();
  const homebrew = useHomebrew((state) => state.homebrew);
  const [error, setError] = useState<string | null>(null);
  const { method, scores } = useMemo(() => baseScores(entity!), [entity]);
  const rows = useMemo(() => abilityRows(built!, selections!), [built, selections]);

  function write(to: Method, next: Scores) {
    setError(null);
    try {
      useCharacter.getState().update((e) => setBaseScores(e, to, next, homebrew));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  function pick(to: Method) {
    if (to === method) return;
    // As the old builder: manual entry keeps the scores it has.
    const next = {
      "point-buy": () => POINT_BUY_START,
      "standard-roll": () => rollScores(),
      "standard-scores": () => STANDARD_SCORES,
      "manual-entry": () => scores,
    }[to];
    write(to, next());
  }

  const left = method === "point-buy" ? pointsLeft(scores) : null;
  const computed: [string, Scores][] = [
    ["Race", rows.race],
    ["Subrace", rows.subrace],
    ["Improvements", rows.improvements],
    ["Other", rows.other],
  ];
  function base(ability: Ability): ReactNode {
    const score = scores[ability];
    if (method === "manual-entry")
      return (
        <ManualScore
          label={`${abbr(ability)} base score`}
          min={1}
          max={30}
          score={score}
          onCommit={(n) => write(method, { ...scores, [ability]: n })}
        />
      );
    if (method === "point-buy") {
      const cost = POINT_BUY_COSTS[score];
      return (
        <Stepper
          score={score}
          note={cost === undefined ? undefined : `(${cost} pts)`}
          left={{
            label: `Decrease ${abbr(ability)}`,
            text: "−",
            disabled: !canDecrease(scores, ability),
            onClick: () => write(method, { ...scores, [ability]: score - 1 }),
          }}
          right={{
            label: `Increase ${abbr(ability)}`,
            text: "+",
            disabled: !canIncrease(scores, ability, rows.total[ability]),
            onClick: () => write(method, { ...scores, [ability]: score + 1 }),
          }}
        />
      );
    }
    if (method === "standard-scores" || method === "standard-roll")
      return (
        <Stepper
          score={score}
          left={{ label: `Move ${abbr(ability)} left`, text: "‹", onClick: () => write(method, swapScores(scores, ability, -1)) }}
          right={{ label: `Move ${abbr(ability)} right`, text: "›", onClick: () => write(method, swapScores(scores, ability, 1)) }}
        />
      );
    return score;
  }

  return (
    <section aria-labelledby={id} className="space-y-2">
      <h3 id={id} className="font-bold">
        {selection.name}
      </h3>
      {error && <p role="alert">{error}</p>}
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {selection.options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              aria-pressed={option.key === method}
              onClick={() => pick(option.key as Method)}
              className={`h-full w-full border border-black p-2 text-left ${option.key === method ? "bg-black text-white" : "hover:bg-gray-100"}`}
            >
              {option.name}
            </button>
          </li>
        ))}
      </ul>
      {method === "point-buy" && (
        <p>
          {left === null
            ? "Points left cannot be counted: a base score is outside 8 to 15."
            : left >= 0
              ? `Points left: ${left} of ${POINT_BUY_POINTS}`
              : `Points: ${-left} too many of ${POINT_BUY_POINTS}`}
        </p>
      )}
      {method === "standard-roll" && (
        <button type="button" onClick={() => write(method, rollScores())} className="border border-black px-3 py-1">
          Re-roll
        </button>
      )}
      <table aria-label="Ability scores" className="w-full text-center">
        <thead>
          <tr>
            <td />
            {ABILITIES.map((a) => (
              <th key={a} scope="col">
                {abbr(a)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="text-left">
              Base
            </th>
            {ABILITIES.map((a) => (
              <td key={a} className="py-1">
                {base(a)}
              </td>
            ))}
          </tr>
          {computed
            .filter(([, values]) => ABILITIES.some((a) => values[a] !== 0))
            .map(([name, values]) => (
              <tr key={name}>
                <th scope="row" className="text-left font-normal">
                  {name}
                </th>
                {ABILITIES.map((a) => (
                  <td key={a}>{bonusStr(values[a])}</td>
                ))}
              </tr>
            ))}
          <tr className="border-t border-black font-bold">
            <th scope="row" className="text-left">
              Total
            </th>
            {ABILITIES.map((a) => (
              <td key={a}>{rows.total[a]}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className="text-left">
              Modifier
            </th>
            {ABILITIES.map((a) => (
              <td key={a}>{bonusStr(rows.modifier[a])}</td>
            ))}
          </tr>
        </tbody>
      </table>
    </section>
  );
}

interface StepperButton {
  label: string;
  text: string;
  disabled?: boolean;
  onClick: () => void;
}

/** A base score between two buttons, such as swap left and right, with an optional note under it. */
function Stepper({ score, note, left, right }: { score: number; note?: string; left: StepperButton; right: StepperButton }) {
  const button = (b: StepperButton) => (
    <button
      type="button"
      aria-label={b.label}
      disabled={b.disabled}
      onClick={b.onClick}
      className="border border-black px-1 disabled:opacity-30"
    >
      {b.text}
    </button>
  );
  return (
    <div className="flex items-center justify-center gap-1">
      {button(left)}
      <span>
        {score}
        {note && <span className="block text-xs">{note}</span>}
      </span>
      {button(right)}
    </div>
  );
}

/**
 * A number typed in, such as a manual base score: the text can be cleared and
 * retyped, and is written only as a whole number from min to max. score is
 * null when there is none yet.
 */
export function ManualScore({
  label,
  min,
  max,
  score,
  onCommit,
}: {
  label: string;
  min: number;
  max?: number;
  score: number | null;
  onCommit: (score: number) => void;
}) {
  const [text, setText] = useState(score === null ? "" : String(score));
  const [seen, setSeen] = useState(score);
  // A score changed from elsewhere replaces the text, unless the text already says it.
  if (score !== seen) {
    setSeen(score);
    if (score === null) setText("");
    else if (Number(text) !== score) setText(String(score));
  }
  return (
    <input
      type="number"
      min={min}
      max={max}
      aria-label={label}
      value={text}
      onChange={(event) => {
        const value = event.target.value;
        setText(value);
        const n = Number(value);
        if (/^\d+$/.test(value) && n >= min && (max === undefined || n <= max) && n !== score) onCommit(n);
      }}
      className="w-14 border border-black text-center"
    />
  );
}
