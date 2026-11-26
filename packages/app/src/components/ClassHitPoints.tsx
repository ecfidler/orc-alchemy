// The section Hit points of a class block (ORC-351, docs/design/character-builder.md "Hit points"): the toggle Average or
// By level, the hit die as a text, and "Total" with the hit points of the class. By level shows a number field for each
// level with a roll button, and Roll all. Level 1 of the first class has the maximum of the die and cannot change. The
// rules and the writes are in engine/classes.ts.
import { Button, NumberField, PixelIcon, SegmentedToggle } from "@orc-alchemy/ui";
import { useId, useRef } from "react";
import { type ClassHitPoints, type ClassHitPointsMethod, changeableLevels, hitDieText, type LevelHitPoints } from "../engine/classes.ts";
import { BoundedNumberField } from "./AbilityScores.tsx";
import { BlockSection } from "./MainPick.tsx";

const METHODS: [ClassHitPointsMethod, string][] = [
  ["average", "Average"],
  ["by-level", "By level"],
];

interface ClassHitPointsProps {
  /** The name of the class, for the names of the controls: "Fighter level 2 hit points". */
  name: string;
  hp: ClassHitPoints;
  /** The method that shows: the stored one, or the one that the player set for a class with no level that can change. */
  method: ClassHitPointsMethod;
  /**
   * Sets the method. For By level, `kept` are the levels from before the last change to Average, while the section
   * shows: their rolled or typed numbers come back (setHitPointsMethod).
   */
  onMethod: (method: ClassHitPointsMethod, kept?: LevelHitPoints[]) => void;
  /** Rolls the die for the levels: one level, or each level that can change for Roll all. */
  onRoll: (levels: number[]) => void;
  /** Writes a typed number for the level at the path. */
  onType: (path: string[], value: number) => void;
}

/**
 * The Hit points section. The mark at the right of its title shows the levels with no hit points; in Average it has no
 * mark when no level is left. A roll or a typed number changes only the numbers: the total keeps its place at the right.
 * The section keeps the By level numbers from before a change to Average, so that a change back to By level puts them
 * back.
 */
export function ClassHitPointsSection({ name, hp, method, onMethod, onRoll, onType }: ClassHitPointsProps) {
  const totalId = useId();
  const byLevel = method === "by-level";
  // The levels from before the last change to Average.
  const kept = useRef<LevelHitPoints[] | undefined>(undefined);
  const change = (to: ClassHitPointsMethod) => {
    if (to === "average") kept.current = byLevel ? hp.levels : kept.current;
    onMethod(to, to === "by-level" ? kept.current : undefined);
  };
  return (
    <BlockSection title="Hit points" mark={byLevel || hp.left > 0 ? hp.left : null}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-rule-strong py-2">
        <SegmentedToggle aria-label={`${name} hit point method`} value={method} options={METHODS} onValueChange={change} />
        {byLevel && (
          <Button size="small" icon="dice" disabled={changeableLevels(hp).length === 0} onClick={() => onRoll(changeableLevels(hp))}>
            Roll all
          </Button>
        )}
        <span className="font-sans text-[12.5px] text-ink-muted">{hitDieText(hp)}</span>
        <span role="group" aria-labelledby={totalId} className="ml-auto inline-flex items-baseline gap-1.5">
          <span id={totalId} className="font-sans text-[12px] tracking-[0.06em] text-ink-muted uppercase">
            Total
          </span>
          <b data-hit-points-total="" className="min-w-[3ch] text-right text-[22px] leading-none font-semibold tabular-nums">
            {hp.total}
          </b>
        </span>
      </div>
      {byLevel && (
        <ul aria-label={`${name} hit points by level`} className="grid grid-cols-[repeat(auto-fill,minmax(92px,1fr))] gap-1.5 pt-2.5 pb-0.5">
          {hp.levels.map(({ level, path, value }) => (
            <li key={level} className="grid grid-cols-[minmax(0,1fr)_30px] border border-rule-strong">
              <span aria-hidden="true" className="col-span-2 px-1.5 pt-0.5 font-sans text-[10.5px] tracking-[0.06em] text-ink-muted uppercase">
                Level {level}
              </span>
              {path === null ? (
                <>
                  <NumberField
                    aria-label={`${name} level ${level} hit points`}
                    value={value}
                    disabled
                    onValueChange={() => {}}
                    className="w-full min-w-0 border-0 bg-transparent px-1.5 pb-0.5 text-[18px]"
                  />
                  <span className="grid place-items-center border-l border-rule font-sans text-[10px] text-ink-muted">max</span>
                </>
              ) : (
                <>
                  <BoundedNumberField
                    label={`${name} level ${level} hit points`}
                    min={1}
                    max={hp.die}
                    value={value}
                    onCommit={(n) => onType(path, n)}
                    className="w-full min-w-0 border-0 bg-transparent px-1.5 pb-0.5 text-[18px]"
                  />
                  <Button
                    variant="bare"
                    aria-label={`Roll ${name} level ${level}`}
                    onClick={() => onRoll([level])}
                    className="grid place-items-center border-l border-rule hover:bg-panel"
                  >
                    <PixelIcon name="dice" className="me-0" />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </BlockSection>
  );
}
