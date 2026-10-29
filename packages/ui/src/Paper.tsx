import { useId, type ReactNode } from "react";

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
export function FramedBox({ label, children, className, labelId }: { label: ReactNode; children: ReactNode; className?: string; labelId?: string }) {
  const ownId = useId();
  const grouped = labelId === undefined;
  const id = labelId ?? ownId;
  return (
    <div
      role={grouped ? "group" : undefined}
      aria-labelledby={grouped ? id : undefined}
      className={className ? `ui-framed-box ${className}` : "ui-framed-box"}
    >
      {children}
      <Label id={id}>{label}</Label>
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

/**
 * A row of `count` plain circles. The first `marked` circles fill solid in
 * `color`; a `marked` above `count` marks them all. It shows a count and
 * takes no clicks; its name is "{label}: {marked} of {count}".
 */
export function SlotCircles({ label, count, marked: markedProp = 0, color = "ink" }: { label: string; count: number; marked?: number; color?: CircleColor }) {
  const marked = Math.min(markedProp, count);
  return (
    <span role="img" aria-label={`${label}: ${marked} of ${count}`} className="ui-slot-circles" data-color={color}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className="ui-slot-circle" data-marked={i < marked ? "" : undefined} />
      ))}
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
