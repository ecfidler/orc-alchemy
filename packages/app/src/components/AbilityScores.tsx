// The Abilities step (ORC-57, ORC-345; docs/design/character-builder.md "The Abilities step"): six boxes, one for
// each ability. Each box reads from the top: the name, the base score that the method sets, the increases from other
// sources as tokens, and the total and the modifier on a shaded band. The four methods are a segmented toggle, with a
// strip of fixed height below it. The boxes do not move and do not change their size when the method or a score
// changes. The rules are in engine/abilities.ts; this module only renders them and calls them.
import { Button, NumberField, SegmentedToggle, Toggle } from "@orc-alchemy/ui";
import { type ReactNode, type PointerEvent as ReactPointerEvent, useId, useMemo, useRef, useState } from "react";
import {
  abilityIncreases,
  abilityRows,
  baseScores,
  canDecrease,
  canIncrease,
  foldIncreases,
  type Increase,
  increaseSectionName,
  type Method,
  nextPointCost,
  POINT_BUY_POINTS,
  POINT_BUY_START,
  pointsLeft,
  rollScores,
  type Scores,
  STANDARD_SCORES,
  setBaseScores,
  swapAbilities,
} from "../engine/abilities.ts";
import type { BuilderSelection } from "../engine/builder.ts";
import { unqualify } from "../engine/content.ts";
import { ABILITIES, ABILITY_NAMES, type Ability, bonusStr } from "../engine/sheet.ts";
import { useOpenCharacter } from "../state/character.ts";
import { Heading, useMutation } from "./Classes.tsx";

/** The two methods whose base scores are chips that swap. */
const swaps = (method: Method | null) => method === "standard-scores" || method === "standard-roll";

/** The methods in the order of the spec, which is not the order of the options (by name). */
const METHODS: Method[] = ["standard-scores", "standard-roll", "point-buy", "manual-entry"];

/** A pointer moves this far, in px, before a press on a chip is a drag and not a click. */
const DRAG_START = 5;

/** The hint in the strip, by method. */
const HINTS: Record<Method, string> = {
  "standard-scores": "Drag a score to a different box, or pick two scores to swap them.",
  "standard-roll": "Drag a score to a different box, or pick two scores to swap them.",
  "point-buy": "",
  "manual-entry": "Type each base score, from 1 to 30.",
};
const HELD_HINT = "Now pick the score to swap with. Escape puts it down.";

/** The ability-scores selection: the methods, the strip, and the six boxes. */
export function AbilityScores({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const hintId = useId();
  const { entity, built, selections } = useOpenCharacter();
  const run = useMutation();
  const { method, scores } = useMemo(() => baseScores(entity!), [entity]);
  const rows = useMemo(() => abilityRows(built!, selections!), [built, selections]);
  const increases = useMemo(() => abilityIncreases(built!, selections!, scores), [built, selections, scores]);
  // The chip that the player picked up, for a swap by two clicks or by the keyboard.
  const [held, setHeld] = useState<Ability | null>(null);
  // The text of the live region: the result of a swap, or a chip picked up or put down. `count` changes with each
  // message, so that the same text two times in a row is said again (as in SpellsPanel).
  const [announce, setAnnounce] = useState({ text: "", count: 0 });
  const setSaid = (text: string) => setAnnounce((last) => ({ text, count: last.count + 1 }));
  const drag = useChipDrag((from, to) => swap(from, to));

  const write = (to: Method, next: Scores) => run((_e, entity, opts) => setBaseScores(entity, to, next, opts));

  function pick(to: Method) {
    if (to === method) return;
    setHeld(null);
    // As the old builder: manual entry keeps the scores it has, and each other method starts again.
    const next = {
      "point-buy": () => POINT_BUY_START,
      "standard-roll": () => rollScores(),
      "standard-scores": () => STANDARD_SCORES,
      "manual-entry": () => scores,
    }[to];
    write(to, next());
  }

  function swap(a: Ability, b: Ability) {
    setHeld(null);
    if (a === b || method === null) return;
    if (write(method, swapAbilities(scores, a, b))) setSaid(`${ABILITY_NAMES[a]} ${scores[b]}, ${ABILITY_NAMES[b]} ${scores[a]}`);
  }

  function press(ability: Ability) {
    if (drag.consumeClick()) return;
    if (held === null) {
      setHeld(ability);
      setSaid(`${ABILITY_NAMES[ability]} ${scores[ability]} picked up.`);
    } else if (held === ability) {
      setHeld(null);
      setSaid(`${ABILITY_NAMES[ability]} ${scores[ability]} put down.`);
    } else swap(held, ability);
  }

  function base(ability: Ability): ReactNode {
    const score = scores[ability];
    const name = ABILITY_NAMES[ability];
    if (method === "manual-entry")
      return <BoundedNumberField label={`${name} base score`} min={1} max={30} value={score} onCommit={(n) => write(method, { ...scores, [ability]: n })} />;
    if (method === "point-buy")
      return (
        <div className="grid grid-cols-[32px_34px_32px] items-center text-center">
          <Button
            aria-label={`Decrease ${name}`}
            disabled={!canDecrease(scores, ability)}
            onClick={() => write(method, { ...scores, [ability]: score - 1 })}
            size="small"
            icon="minus"
            className="grid h-9 w-8 place-items-center"
          />
          <span className="text-[20px]">{score}</span>
          <Button
            aria-label={`Increase ${name}`}
            disabled={!canIncrease(scores, ability, rows.total[ability])}
            onClick={() => write(method, { ...scores, [ability]: score + 1 })}
            size="small"
            icon="plus"
            className="grid h-9 w-8 place-items-center"
          />
        </div>
      );
    if (swaps(method))
      return (
        <Toggle
          variant="bare"
          data-chip={ability}
          aria-label={`${name} base score ${score}`}
          aria-describedby={hintId}
          pressed={held === ability}
          onPressedChange={() => press(ability)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && held !== null) {
              e.preventDefault();
              setHeld(null);
              setSaid(`${ABILITY_NAMES[held]} ${scores[held]} put down.`);
            }
          }}
          {...drag.handlers(ability)}
          style={drag.offset(ability)}
          className={`grid h-[38px] w-[74px] cursor-grab touch-none grid-cols-[18px_1fr] items-center rounded-[4px] border-[1.5px] border-ink bg-paper-raised pr-2 text-[20px] select-none transition-[background-color,translate] duration-100 ease-out hover:bg-panel data-[pressed]:-translate-y-0.5 data-[pressed]:bg-note data-[pressed]:text-note-ink motion-reduce:transition-none motion-reduce:data-[pressed]:translate-y-0 ${drag.dragging === ability ? "relative z-10 cursor-grabbing opacity-80 shadow-md" : ""}`}
        >
          <Grip />
          <span>{score}</span>
        </Toggle>
      );
    return <span className="text-[20px]">{score}</span>;
  }

  return (
    <section aria-labelledby={id} className="@container/abilities space-y-2">
      <Heading id={id} selection={selection} />
      <SegmentedToggle
        aria-label={selection.name}
        value={method}
        options={METHODS.flatMap((key) => {
          const option = selection.options.find((o) => o.key === key);
          return option ? [[key, option.name] as const] : [];
        })}
        onValueChange={pick}
        fill
        className="grid-cols-2 @min-[560px]/abilities:grid-cols-4"
      />
      <Strip method={method} scores={scores} held={held !== null} hintId={hintId} onReroll={() => method && write(method, rollScores())} />
      {/* Six in a row only when each box has room for a "+2 Improvement" token (102px) with the 4px padding of the token
          area at each side, and so for the point-buy grid (98px): 6 × (110px + 3px of border) + 5 gaps of 10px = 728px. */}
      <div data-ability-boxes="" className="grid grid-cols-3 gap-2.5 @min-[728px]/abilities:grid-cols-6">
        {ABILITIES.map((ability) => {
          const cost = method === "point-buy" ? nextPointCost(scores, ability) : null;
          return (
            <div
              key={ability}
              role="group"
              aria-label={ABILITY_NAMES[ability]}
              data-box={ability}
              data-over={drag.over === ability ? "" : undefined}
              className="grid min-w-0 grid-rows-[auto_44px_16px_46px_auto] justify-items-center overflow-hidden rounded-md border-[1.5px] border-rule-strong bg-paper-raised data-[over]:border-ink"
            >
              <span aria-hidden="true" className="pt-2 font-sans text-[13.5px] leading-5 font-semibold text-ink">
                {ABILITY_NAMES[ability]}
              </span>
              <div className="flex items-center pt-1">{base(ability)}</div>
              <span data-next-cost="" className="font-sans text-[11.5px] leading-4 text-ink-muted">
                {method === "point-buy" && (cost === null ? (scores[ability] === 15 ? "max" : "") : `next: ${cost} pt`)}
              </span>
              <IncreaseTokens increases={increases[ability]} />
              <div className="grid w-full justify-items-center gap-[3px] border-t border-rule-strong bg-panel px-1 pt-1.5 pb-[9px] in-data-[over]:bg-note/45">
                <span data-total="" className="text-[34px] leading-[1.05] font-medium">
                  <span className="sr-only">Total </span>
                  {rows.total[ability]}
                </span>
                <span
                  data-modifier=""
                  className="rounded-full border border-rule-strong bg-paper-raised px-[9px] font-sans text-[13px] leading-5 font-semibold"
                >
                  <span className="sr-only">modifier </span>
                  {signed(rows.modifier[ability])}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p role="status" className="sr-only">
        {/* A no-break space on every second message makes the same text a new message. */}
        {announce.text}
        {announce.count > 0 && announce.count % 2 === 0 && "\u00a0"}
      </p>
    </section>
  );
}

/** The strip under the methods, of one fixed height: the points left with a meter, or a hint, and Re-roll. */
function Strip({ method, scores, held, hintId, onReroll }: { method: Method | null; scores: Scores; held: boolean; hintId: string; onReroll: () => void }) {
  const left = method === "point-buy" ? pointsLeft(scores) : null;
  let text: ReactNode = method ? HINTS[method] : "";
  if (held) text = HELD_HINT;
  if (method === "point-buy")
    text =
      left === null ? (
        <span className="font-semibold text-danger">Points cannot be counted: a base score is outside 8 to 15.</span>
      ) : left < 0 ? (
        <span className="font-semibold text-danger">
          {-left} points too many of {POINT_BUY_POINTS}
        </span>
      ) : (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>
            <b className="font-semibold text-ink">{left}</b> of {POINT_BUY_POINTS} points left
          </span>
          <Meter left={left} />
        </span>
      );
  return (
    <div data-strip="" className="flex h-16 items-center justify-between gap-3 font-sans text-[13.5px] leading-snug text-ink-muted @min-[600px]/abilities:h-12">
      <span id={hintId}>{text}</span>
      {method === "standard-roll" && (
        <Button icon="dice" onClick={onReroll} className="shrink-0 whitespace-nowrap">
          Re-roll
        </Button>
      )}
    </div>
  );
}

/** The point-buy meter: one cell for each of the 27 points, the spent ones light. */
function Meter({ left }: { left: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-grid grid-cols-[repeat(27,4px)] gap-px @min-[600px]/abilities:grid-cols-[repeat(27,6px)] @min-[600px]/abilities:gap-0.5"
    >
      {Array.from({ length: POINT_BUY_POINTS }, (_, i) => (
        <i key={i} className={`h-3 ${i < POINT_BUY_POINTS - left ? "bg-rule" : "bg-ink"}`} />
      ))}
    </span>
  );
}

/** A modifier with its sign, and a true minus sign: "+2", "0", "−1". */
const signed = (n: number) => (n < 0 ? `−${-n}` : bonusStr(n));

/** "+2 Race": an increase as its token text. */
const tokenText = ({ label, amount }: Increase) => `${signed(amount)} ${label}`;

/**
 * The increases of one ability, as tokens in an area of a fixed size: two lines of one token. More than two fold into
 * one token "+3 more" (foldIncreases). A screen reader gets the whole list.
 */
function IncreaseTokens({ increases }: { increases: Increase[] }) {
  const shown = foldIncreases(increases);
  const all = increases.map(tokenText).join(", ");
  return (
    <div data-tokens="" className="flex w-full flex-wrap content-start justify-center gap-0.5 px-1" title={shown.length < increases.length ? all : undefined}>
      {shown.map((increase) => (
        <span
          key={increase.label}
          aria-hidden="true"
          data-token=""
          className="border border-rule-strong bg-paper-raised px-[5px] font-sans text-[11.5px] leading-[18px] whitespace-nowrap text-ink"
        >
          {tokenText(increase)}
        </span>
      ))}
      {all && <span className="sr-only">{all}</span>}
    </div>
  );
}

/** The drag handle at the left of a chip: two columns of three dots, with a hairline at its right. */
function Grip() {
  return (
    <span
      aria-hidden="true"
      className="grid h-full place-items-center border-r border-rule text-ink-muted in-data-[pressed]:border-note-ink in-data-[pressed]:text-note-ink"
    >
      <svg aria-hidden="true" width="8" height="14" viewBox="0 0 8 14" fill="currentColor">
        {[2, 7, 12].flatMap((y) => [2, 6].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" />))}
      </svg>
    </span>
  );
}

/**
 * The drag of a chip to a different box, with pointer events, so that a mouse, a pen and a touch work the same. A
 * press that moves less than DRAG_START is a click. A drop on a different box calls `onDrop`; a drop outside a box, or
 * on the chip's own box, does nothing. After a drag, the click that the browser sends is not a click on the chip.
 */
function useChipDrag(onDrop: (from: Ability, to: Ability) => void) {
  const start = useRef<{ ability: Ability; pointer: number; x: number; y: number; moved: boolean; chip: HTMLElement } | null>(null);
  const [dragging, setDragging] = useState<{ ability: Ability; dx: number; dy: number } | null>(null);
  const [over, setOver] = useState<Ability | null>(null);
  const skipClick = useRef(false);

  /** The ability of the box under the point, not counting the dragged chip. */
  const boxAt = (x: number, y: number, chip: HTMLElement): Ability | null => {
    const under = document.elementsFromPoint?.(x, y).find((element) => !chip.contains(element));
    return (under?.closest<HTMLElement>("[data-box]")?.dataset.box as Ability | undefined) ?? null;
  };
  const end = () => {
    start.current = null;
    setDragging(null);
    setOver(null);
  };

  return {
    dragging: dragging?.ability ?? null,
    over,
    /** The chip's move while it is dragged, as a style. */
    offset: (ability: Ability) => (dragging?.ability === ability ? { transform: `translate(${dragging.dx}px, ${dragging.dy}px)` } : undefined),
    /** True once after a drag: the click that ends it does nothing. */
    consumeClick() {
      const skip = skipClick.current;
      skipClick.current = false;
      return skip;
    },
    handlers: (ability: Ability) => ({
      onPointerDown(e: ReactPointerEvent<HTMLElement>) {
        if (e.button !== 0) return;
        start.current = { ability, pointer: e.pointerId, x: e.clientX, y: e.clientY, moved: false, chip: e.currentTarget };
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // A pointer that the browser does not know, as a synthetic event can have: the drag works without capture.
        }
      },
      onPointerMove(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current;
        if (!s || s.pointer !== e.pointerId) return;
        const [dx, dy] = [e.clientX - s.x, e.clientY - s.y];
        if (!s.moved && Math.hypot(dx, dy) < DRAG_START) return;
        s.moved = true;
        setDragging({ ability: s.ability, dx, dy });
        const to = boxAt(e.clientX, e.clientY, s.chip);
        setOver(to !== s.ability ? to : null);
      },
      onPointerUp(e: ReactPointerEvent<HTMLElement>) {
        const s = start.current;
        if (!s || s.pointer !== e.pointerId) return;
        end();
        if (!s.moved) return;
        skipClick.current = true;
        // A touch can end with no click: the skip ends with this task.
        setTimeout(() => {
          skipClick.current = false;
        }, 0);
        const to = boxAt(e.clientX, e.clientY, s.chip);
        if (to !== null && to !== s.ability) onDrop(s.ability, to);
      },
      onPointerCancel: end,
      // The browser took the capture away, for example when the chip left the page: the drag ends with no drop.
      onLostPointerCapture(e: ReactPointerEvent<HTMLElement>) {
        if (start.current?.pointer === e.pointerId) end();
      },
    }),
  };
}

/**
 * The points of one choice of increases from a different source, such as the two +1 of a half-elf or an Ability Score
 * Improvement of a class level (spec, "Points from other sources"): a section below the boxes, with the source in its
 * heading and the left mark, and a minus and a plus button for each ability. A point then shows as a token in the box.
 * A plus that would take the total over 20, the engine's limit, is disabled.
 */
export function AbilityIncreases({ selection }: { selection: BuilderSelection }) {
  const id = useId();
  const { sheet } = useOpenCharacter();
  const run = useMutation();
  const { actualPath, max } = selection;
  const full = max !== null && selection.selected.length >= max;
  return (
    <section aria-labelledby={id} className="@container/increases space-y-2">
      <Heading id={id} selection={selection} name={increaseSectionName(selection)} />
      <ul className="grid grid-cols-3 gap-2.5 @min-[728px]/increases:grid-cols-6">
        {ABILITIES.map((ability) => {
          const name = ABILITY_NAMES[ability];
          const count = selection.selected.filter((key) => unqualify(key) === ability).length;
          const offered = selection.options.some((o) => unqualify(o.key) === ability);
          const total = sheet?.abilities.find((a) => a.ability === ability)?.score ?? 0;
          return (
            <li key={ability} role="group" aria-label={name} className="grid justify-items-center gap-1 rounded-md border border-rule bg-paper-raised py-1.5">
              <span aria-hidden="true" className="font-sans text-[13.5px] leading-5 font-semibold">
                {name}
              </span>
              <div className="grid grid-cols-[32px_34px_32px] items-center text-center">
                <Button
                  aria-label={`Decrease ${name}`}
                  disabled={count === 0}
                  onClick={() => run((e, entity, opts) => e.decreaseAbility(entity, actualPath, ability, opts))}
                  size="small"
                  icon="minus"
                  className="grid h-9 w-8 place-items-center"
                />
                <span data-count="" className="font-sans text-[15px] font-semibold">
                  +{count}
                </span>
                <Button
                  aria-label={`Increase ${name}`}
                  disabled={!offered || full || total >= 20}
                  onClick={() => run((e, entity, opts) => e.increaseAbility(entity, actualPath, ability, opts))}
                  size="small"
                  icon="plus"
                  className="grid h-9 w-8 place-items-center"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/**
 * A number typed in, such as a manual base score, hit points or a quantity:
 * the field can be cleared and retyped, and a number is written only as a
 * whole number from min to max. value is null when there is none yet.
 */
export function BoundedNumberField({
  label,
  min,
  max,
  value,
  onCommit,
}: {
  label: string;
  min: number;
  max?: number;
  value: number | null;
  onCommit: (value: number) => void;
}) {
  return (
    <NumberField
      aria-label={label}
      min={min}
      max={max}
      value={value}
      onValueChange={(n) => {
        if (n !== null && n >= min && (max === undefined || n <= max) && n !== value) onCommit(n);
      }}
      className="w-14 text-center"
    />
  );
}
