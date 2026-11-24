// The Long rest dialog and the Dawn dialog (ORC-319,
// docs/design/sheet-interactivity.md "Long rest" and "Dawn"). The rules are
// in engine/rest.ts.
import { Checkbox } from "@orc-alchemy/ui";
import { useState } from "react";
import {
  type DawnFields,
  dawnBack,
  dawnChangesNothing,
  dawnReserve,
  dawnStart,
  dawnUses,
  longRest,
  longRestChangesNothing,
  longRestPicks,
  longRestReserve,
  longRestRows,
} from "../engine/rest.ts";
import { DawnRows, RestChanges, RestDialog, type RestDialogProps, Section } from "./RestDialog.tsx";

/**
 * The Long rest dialog: "This rest will change", then the checkboxes "Ate
 * and drank" (with an exhaustion level above 0) and "Dawn came during the
 * rest" (with Dawn uses), each on at the start, then the Dawn list. When
 * "Dawn came during the rest" is off, the Dawn list stays in its place,
 * disabled. What the rest can change is read once, at the open, so the size
 * of the dialog stays the same. Mount it again for each open.
 */
export function LongRestDialog({ open, sheet, onCancel, onFinish, finalFocus }: RestDialogProps) {
  const [rest] = useState(() => longRest(sheet));
  const [ate, setAte] = useState(true);
  const [dawn, setDawn] = useState(true);
  const [fields, setFields] = useState<DawnFields>(() => dawnStart(rest.dawn));
  const action = { ate, dawn, back: dawnBack(fields) };
  return (
    <RestDialog kind="long" open={open} onCancel={onCancel} finalFocus={finalFocus} onFinish={() => onFinish({ kind: "long", ...action })}>
      <RestChanges rows={longRestRows(rest, action)} nothing={longRestChangesNothing(rest, action)} reserve={longRestReserve(rest)} />
      {longRestPicks(rest) && (
        <div className="grid gap-1">
          {rest.exhaustion > 0 && <Checkbox label="Ate and drank" checked={ate} onCheckedChange={setAte} />}
          {rest.dawn.length > 0 && <Checkbox label="Dawn came during the rest" checked={dawn} onCheckedChange={setDawn} />}
        </div>
      )}
      {rest.dawn.length > 0 && (
        <Section title="At dawn">
          <DawnRows uses={rest.dawn} fields={fields} onChange={setFields} disabled={!dawn} />
        </Section>
      )}
    </RestDialog>
  );
}

/**
 * The Dawn dialog: each feature with Dawn uses, with a number field for
 * the uses that come back. Each field starts at the spent count, so all
 * uses come back. Mount it again for each open.
 */
export function DawnDialog({ open, sheet, onCancel, onFinish, finalFocus }: RestDialogProps) {
  const [uses] = useState(() => dawnUses(sheet));
  const [fields, setFields] = useState<DawnFields>(() => dawnStart(uses));
  const back = dawnBack(fields);
  return (
    <RestDialog kind="dawn" open={open} onCancel={onCancel} finalFocus={finalFocus} onFinish={() => onFinish({ kind: "dawn", back })}>
      <RestChanges nothing={dawnChangesNothing(uses, back)} reserve={dawnReserve(uses)}>
        <DawnRows uses={uses} fields={fields} onChange={setFields} />
      </RestChanges>
    </RestDialog>
  );
}
