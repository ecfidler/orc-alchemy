// The check of a form's record that the homebrew frames share: the My
// Content page (HomebrewBuilder.tsx) and the Customize dialog
// (CustomizeDialog.tsx). The record is checked by its type's validator at
// each change, and the problems of fields that the form does not show are
// listed at the top.
import { useMemo } from "react";
import { OPTION_PACK, sameRecord } from "../../engine/content.ts";
import { engine } from "../../engine/engine.ts";
import { type BuilderType, type ItemRecord, type Problem, problemText } from "./fields.tsx";

export interface CheckedRecord {
  /** The validator's problems, then those of check. */
  problems: Problem[];
  /** The item as the validator returned it, the one to save. */
  item: ItemRecord;
  /** True when there are no problems, so the item can be saved. */
  ok: boolean;
  /** True when the record is not the same as initial (sameRecord), so a close or a navigation asks first. */
  changed: boolean;
}

/**
 * Checks the record with the builder's validator. With optionPack, the
 * validator gets the record with that option source. check gives more
 * problems with the validated item; give a stable function (useCallback),
 * so the check runs only when the record changes.
 */
export function useCheckedRecord(
  builder: BuilderType,
  record: ItemRecord,
  initial: ItemRecord,
  { optionPack, check }: { optionPack?: string; check?: (item: ItemRecord) => Problem[] } = {},
): CheckedRecord {
  const { validator } = builder;
  const { problems, item } = useMemo(() => {
    const { problems, item } = engine().validate[validator](optionPack === undefined ? record : { ...record, [OPTION_PACK]: optionPack });
    return { problems: [...problems, ...(check?.(item as ItemRecord) ?? [])], item: item as ItemRecord };
  }, [validator, record, optionPack, check]);
  const changed = useMemo(() => !sameRecord(record, initial), [record, initial]);
  return { problems, item, ok: problems.length === 0, changed };
}

/** The problems of the fields that the form does not show (not in fields), as a list named "Problems". Nothing when there are none. */
export function FormProblems({ problems, fields }: { problems: Problem[]; fields: string[] }) {
  const others = problems.filter((p) => !fields.includes(String(p.path[0])));
  if (others.length === 0) return null;
  return (
    <ul aria-label="Problems" className="text-danger">
      {others.map((problem, i) => (
        <li key={i}>{problemText(problem.path.join(" "), problem)}</li>
      ))}
    </ul>
  );
}
