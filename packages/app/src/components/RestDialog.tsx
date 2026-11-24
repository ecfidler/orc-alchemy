// The parts that the three rest dialogs share (ORC-318, ORC-319,
// docs/design/sheet-interactivity.md "Rules for the three dialogs"): the
// narrow dialog with Finish, a section with its large bold title, the list
// "This rest will change", and the rows of the Dawn list.
import { Button, Dialog, NumberField } from "@orc-alchemy/ui";
import type { ReactNode, RefObject } from "react";
import { REST_NAMES, type RestAction, type RestKind, type RestRow, type RestUse } from "../engine/rest.ts";
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

const ROW = "flex items-center justify-between gap-3 border-b border-rule py-1";
const NO_CHANGE = "font-sans text-sm text-ink-muted";

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

/** The numbers of the Dawn list, as the key of a use to its field: null for an empty field. */
export type DawnFields = ReadonlyMap<string, number | null>;

/** The fields of the Dawn list as the picks of a rest: an empty field gives back 0. */
export const dawnBack = (fields: DawnFields) => new Map([...fields].map(([key, n]) => [key, n ?? 0]));

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
            {name} {spent > 0 && <span className="font-sans text-sm text-ink-muted">({spent} spent)</span>}
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
