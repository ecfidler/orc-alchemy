// The parts that the three rest dialogs share (ORC-318, ORC-319,
// docs/design/sheet-interactivity.md "Rules for the three dialogs"): the
// narrow dialog with Finish, a section with its large bold title, the list
// "This rest will change", and the rows of the Dawn list.
import { Button, CurrentMax, Dialog, NumberField } from "@orc-alchemy/ui";
import type { ReactNode, RefObject } from "react";
import { type DawnFields, REST_NAMES, type RestAction, type RestKind, type RestRow, type RestUse } from "../engine/rest.ts";
import type { Sheet } from "../engine/sheet.ts";

/** The props of each rest dialog. */
export interface RestDialogProps {
  open: boolean;
  sheet: Sheet;
  /** Cancel, Escape and a click outside: nothing changes. */
  onCancel: () => void;
  /** Finish: the picks of the dialog, which the owner writes as one sheet change. */
  onFinish: (action: RestAction) => void;
  /** The element that gets the focus at the close: the Rest button. */
  finalFocus?: RefObject<HTMLElement | null>;
}

/** The frame of a rest dialog: a narrow Dialog with the name of the rest as its title, and Finish after Cancel. */
export function RestDialog({
  kind,
  open,
  onCancel,
  finalFocus,
  onFinish,
  children,
}: Omit<RestDialogProps, "sheet" | "onFinish"> & { kind: RestKind; onFinish: () => void; children: ReactNode }) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      size="narrow"
      title={REST_NAMES[kind]}
      finalFocus={finalFocus}
      actions={
        <Button variant="solid" icon="check" onClick={onFinish}>
          Finish
        </Button>
      }
    >
      <div className="grid gap-5">{children}</div>
    </Dialog>
  );
}

/** A section of a rest dialog, with its large bold title. */
export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="grid content-start gap-2">
      <h3 className="font-sans text-base leading-tight font-semibold">{title}</h3>
      {children}
    </section>
  );
}

/** The class of a row of a list in a rest dialog: its name on the left, its value or control on the right, a rule under it. */
export const ROW = "flex items-center justify-between gap-3 border-b border-rule py-1";

/** The class of a quiet note in a rest dialog: "No change", "(2 spent)". */
export const NO_CHANGE = "font-sans text-sm text-ink-muted";

/** A total line of a rest dialog: its name on the left and a bold current / max on the right, with the width of `reserve` kept. */
export function TotalLine({ label, current, max, reserve }: { label: string; current: ReactNode; max: ReactNode; reserve: string | number }) {
  return (
    <p className="flex items-baseline justify-between gap-3 font-sans text-sm">
      <span>{label}</span>
      <b className="text-[15px] font-semibold tabular-nums">
        <CurrentMax current={current} max={max} reserve={reserve} />
      </b>
    </p>
  );
}

/**
 * The list "This rest will change": a fixed set of rows, each with its
 * change or "No change", or other rows as `children`. When the rest changes
 * nothing (`nothing`), a line under the rows says so. With `reserve`, the
 * line keeps its space while the rest changes something, so the dialog
 * keeps its size when the picks change it.
 */
export function RestChanges({ rows = [], nothing, reserve, children }: { rows?: RestRow[]; nothing: boolean; reserve: boolean; children?: ReactNode }) {
  return (
    <Section title="This rest will change">
      {children}
      {rows.length > 0 && (
        <ul className="grid">
          {rows.map(({ key, label, change }) => (
            <li key={key} className={ROW}>
              <span>{label}</span>
              {change === null ? (
                <span className={NO_CHANGE}>No change</span>
              ) : (
                <b className="font-sans text-[15px] font-semibold whitespace-nowrap tabular-nums">{change}</b>
              )}
            </li>
          ))}
        </ul>
      )}
      {(nothing || reserve) && <p className="text-ink-muted italic">{nothing ? "Nothing will change." : " "}</p>}
    </Section>
  );
}

/**
 * The rows of the Dawn list: each feature with Dawn uses, with a number
 * field for the uses that come back, from 0 to the spent count. A feature
 * with no spent use says "No change" and has no field. With `disabled`, the
 * rows stay in their place and the fields take no input.
 */
export function DawnRows({
  uses,
  fields,
  onChange,
  disabled = false,
}: {
  uses: RestUse[];
  fields: DawnFields;
  onChange: (fields: DawnFields) => void;
  disabled?: boolean;
}) {
  return (
    <ul className={`grid ${disabled ? "text-ink-muted" : ""}`}>
      {uses.map(({ key, name, spent }) => (
        <li key={key} className={`${ROW} min-h-10`}>
          <span>
            {name} {spent > 0 && <span className={NO_CHANGE}>({spent} spent)</span>}
          </span>
          {spent > 0 ? (
            <NumberField
              aria-label={name}
              value={fields.get(key) ?? null}
              min={0}
              max={spent}
              disabled={disabled}
              // The field stops at 0 and at the spent count.
              onValueChange={(n) => onChange(new Map(fields).set(key, n === null ? null : Math.min(spent, Math.max(0, n))))}
              className="w-14 border-[1.5px] px-2 py-0.5 text-center tabular-nums"
            />
          ) : (
            <span className={NO_CHANGE}>No change</span>
          )}
        </li>
      ))}
    </ul>
  );
}
