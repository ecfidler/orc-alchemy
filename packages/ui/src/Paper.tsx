import { type MouseEvent, type ReactNode, useId } from "react";

/** A label in the label style: Inter caps, small, muted. */
export function Label({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <span id={id} className="ui-label">
      {children}
    </span>
  );
}

/**
 * A box with its content and its label under it, on a hairline. It is a
 * group named by the label. With `labelId`, the label gets that id and the
 * box is not a group: the caller names one value in the box with
 * `role="group" aria-labelledby={labelId}`. `className` is for layout and
 * spacing.
 */
export function FramedBox({
  label,
  children,
  className,
  labelId,
  action,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  labelId?: string;
  /** A small control at the end of the label row, for example a button that opens more. It is not a part of the box's name, so give it its own name. */
  action?: ReactNode;
}) {
  const ownId = useId();
  const grouped = labelId === undefined;
  const id = labelId ?? ownId;
  return (
    <div role={grouped ? "group" : undefined} aria-labelledby={grouped ? id : undefined} className={className ? `ui-framed-box ${className}` : "ui-framed-box"}>
      {children}
      {action === undefined ? (
        <Label id={id}>{label}</Label>
      ) : (
        <div className="ui-framed-box-foot">
          <Label id={id}>{label}</Label>
          <span className="ui-framed-box-action">{action}</span>
        </div>
      )}
    </div>
  );
}

/** A small value in a cell, with its label beside it. The value is a group named by the label. */
export function SmallBox({ label, value }: { label: ReactNode; value: ReactNode }) {
  const id = useId();
  return (
    <div className="ui-small-box">
      <span role="group" aria-labelledby={id} className="ui-small-box-value">
        {value}
      </span>
      <Label id={id}>{label}</Label>
    </div>
  );
}

/**
 * A box with its label, a large value and a hanging oval for a second
 * value. The two values are one group named by the label, the oval first: for
 * example a score, then its modifier. `name` names them instead when the
 * label is short, for example an abbreviation.
 */
export function StatBox({ label, value, oval, name }: { label: ReactNode; value: ReactNode; oval: ReactNode; name?: string }) {
  const id = useId();
  return (
    <div className="ui-stat-box">
      <Label id={id}>{label}</Label>
      {/* The oval is placed absolutely, so it comes first here without moving. */}
      <span role="group" aria-label={name} aria-labelledby={name === undefined ? id : undefined} className="ui-stat-box-values">
        <span className="ui-stat-box-oval">{oval}</span>
        <span className="ui-stat-box-value">{value}</span>
      </span>
    </div>
  );
}

/** A shaded area that groups related boxes. `className` is for layout. */
export function ShadedPanel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `ui-panel ${className}` : "ui-panel"}>{children}</div>;
}

/** A section title on a rule. It is a heading, level 2 by default. */
export function SectionRule({ children, level = 2 }: { children: ReactNode; level?: 2 | 3 | 4 }) {
  const Heading = `h${level}` as const;
  return <Heading className="ui-section-rule">{children}</Heading>;
}

export type CircleColor = "ink" | "success" | "caution";

const defaultValueText = (marked: number, count: number) => `${marked} of ${count}`;

export interface SlotCirclesProps {
  /** What the circles count, for example "1st-level slots". */
  label: string;
  count: number;
  /** The circles that fill solid, from the left; a value above `count` marks them all. */
  marked?: number;
  color?: CircleColor;
  /** "small" draws 12px circles closer together, for a narrow column. */
  size?: "normal" | "small";
  /** "diamond" draws each circle as a diamond of the same size, to set one group apart from others. */
  shape?: "circle" | "diamond";
  /**
   * Makes the group one that the user changes. It gets the new number of
   * marked circles, always one more or one less than `marked`.
   */
  onChange?: (marked: number) => void;
  /** With `onChange`: the state that a screen reader reads after the label. "{marked} of {count}" by default. */
  valueText?: (marked: number, count: number) => string;
  /** "vertical" puts the circles in a column, the first at the top. The arrow keys stay the same. */
  orientation?: "horizontal" | "vertical";
  /**
   * With `onChange`: false makes a copy of a group that is a Tab stop in
   * another place. The copy takes clicks, but it is not a Tab stop, a click
   * does not move the focus, and a screen reader does not see it.
   */
  focusable?: boolean;
}

/**
 * A row of `count` plain circles, or diamonds with `shape="diamond"`. The
 * first `marked` circles fill solid in `color`. Without `onChange` it shows
 * a count and takes no clicks; its name is "{label}: {marked} of {count}".
 *
 * With `onChange` the user changes it, by the rule "one more, one less": a
 * click on an empty circle marks one more, and a click on a marked circle
 * marks one less, so the marked circles stay together on the left. Each
 * circle is drawn at 17px (a group that does not change draws 15px, or
 * 12px small) and has a 28px tap area. Under a mouse, the circle that a
 * click changes shows a light fill. The group is a slider and one Tab
 * stop: Right and Up mark one more, Left and Down one less. A screen
 * reader reads "{label}, {valueText}", and the new value after a change.
 * A click leaves the focus on the group. With `focusable={false}` it is a
 * copy that takes clicks only.
 */
export function SlotCircles({
  label,
  count,
  marked: markedProp = 0,
  color = "ink",
  size = "normal",
  shape = "circle",
  onChange,
  valueText = defaultValueText,
  orientation = "horizontal",
  focusable = true,
}: SlotCirclesProps) {
  const marked = Math.max(0, Math.min(markedProp, count));
  const circles = Array.from({ length: count }, (_, i) => (
    <span
      key={i}
      className="ui-slot-circle"
      data-marked={i < marked ? "" : undefined}
      // The circle that a click on an empty circle fills, and the one that a click on a marked circle clears.
      data-next={onChange && i === marked ? "" : undefined}
      data-last={onChange && i === marked - 1 ? "" : undefined}
    />
  ));
  const common = {
    className: "ui-slot-circles",
    "data-color": color,
    "data-size": size === "small" ? size : undefined,
    "data-shape": shape === "diamond" ? shape : undefined,
    "data-orientation": orientation === "vertical" ? orientation : undefined,
  };
  if (!onChange) {
    return (
      <span role="img" aria-label={`${label}: ${marked} of ${count}`} {...common}>
        {circles}
      </span>
    );
  }
  const change = (next: number) => {
    if (next >= 0 && next <= count && next !== marked) onChange(next);
  };
  const onClick = (event: MouseEvent<HTMLElement>) => {
    const circle = (event.target as Element).closest(".ui-slot-circle");
    if (!circle) return;
    // Not every browser focuses the group on a click; the focus must stay on it.
    if (focusable) event.currentTarget.focus();
    change(circle.hasAttribute("data-marked") ? marked - 1 : marked + 1);
  };
  if (!focusable) {
    return (
      // A mouse down does not move the focus: it stays where it was, for example on a row.
      <span aria-hidden data-changes="" {...common} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
        {circles}
      </span>
    );
  }
  return (
    <span
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={count}
      aria-valuenow={marked}
      aria-valuetext={valueText(marked, count)}
      aria-orientation={orientation}
      data-changes=""
      {...common}
      onKeyDown={(event) => {
        const step = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key];
        if (step === undefined) return;
        event.preventDefault();
        change(marked + step);
      }}
      onClick={onClick}
    >
      {circles}
    </span>
  );
}

/** A current value at full size, then "/ max" at the same size in the muted ink. It has no label. */
export function CurrentMax({ current, max }: { current: ReactNode; max: ReactNode }) {
  return (
    <span className="ui-current-max">
      {current}
      <span className="ui-current-max-of"> / {max}</span>
    </span>
  );
}
