// The uses control of a homebrew feature and its preview (ORC-204,
// docs/design/homebrew-forms.md, "Uses control" and "Preview"): variant A of
// the uses prototype. The control reads the stored :frequency and writes it
// only on a change by the user (uses.ts). The preview gets the feature as the
// sheet shows it from previewFeature (engine/uses-preview.ts), and draws it
// with the sheet's FeatureGroup.
import { FieldLabel, Label, SegmentedToggle, Select, type SelectOption } from "@orc-alchemy/ui";
import { useId, useState, type ReactNode } from "react";
import { ABILITIES, ABILITY_NAMES } from "../../engine/sheet.ts";
import { exampleNumbers, previewFeature } from "../../engine/uses-preview.ts";
import { FeatureGroup } from "../CharacterSheet.tsx";
import { EXAMPLE_LEVEL, EXAMPLE_SCORE, usesSentence } from "./uses-example.ts";
import {
  amountOf,
  baseAbility,
  baseOf,
  FIXED_AMOUNTS,
  MINIMUMS,
  NUMBER_DEFAULTS,
  PLUSES,
  plusText,
  rechargeOptions,
  scaledNumber,
  TIMES,
  unitName,
  USES_KINDS,
  usesKind,
  withBase,
  withFixed,
  withKind,
  withScaledNumber,
  withUnit,
} from "./uses.ts";

/** The levels and the ability scores that the example character can have. */
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const SCORES = Array.from({ length: 30 }, (_, i) => i + 1);

/** The options of the numbers, and the stored number when it is none of them, so a stored value shows as it is. */
function numberOptions(values: number[], stored: unknown, text: (n: number) => string = String): SelectOption<number>[] {
  const all = typeof stored === "number" && !values.includes(stored) ? [...values, stored].sort((a, b) => a - b) : values;
  return all.map((n) => [n, text(n)]);
}

/**
 * A visible label above a control that is not a form field, such as a
 * toggle group. The control is named by `prefix` (the hidden name of the
 * feature, such as "Feature 2") and the label: "Feature 2 Uses".
 */
function LabelAbove({ label, prefix, children }: { label: string; prefix: string; children: (labelledBy: string) => ReactNode }) {
  const id = useId();
  return (
    // The label's weight is that of a FieldLabel, as on the selects beside it.
    <div className="grid content-start justify-items-start gap-[3px] [&>.ui-label]:font-medium">
      <Label id={id}>{label}</Label>
      {children(`${prefix} ${id}`)}
    </div>
  );
}

/** A select with its label above it. name is its accessible name, which holds the label's words. */
function LabelledSelect<T>({ label, name, value, options, onSelect }: { label: string; name: string; value: unknown; options: readonly SelectOption<T>[]; onSelect: (value: T) => void }) {
  return (
    <FieldLabel label={label}>
      <Select<T> aria-label={name} value={value as T} options={options} onValueChange={onSelect} placeholder="-" />
    </FieldLabel>
  );
}

/**
 * The Uses toggle (None / Fixed / Scaled) with its fields, the Recharges
 * toggle, the preview, and for scaled uses one sentence. name is the
 * feature's name for the controls, such as "Feature 2". levelName is the
 * class of a class or subclass form, whose level a level amount counts; in
 * other forms it is null, and a level is the character level. onChange gets
 * the frequency to store, or undefined for no uses.
 */
export function UsesControl({
  name,
  onChange,
  feature,
  levelName,
}: {
  name: string;
  onChange: (frequency: Record<string, unknown> | undefined) => void;
  /** The stored feature: its :frequency, and the rest for the preview. */
  feature: Record<string, unknown>;
  levelName: string | null;
}) {
  const nameId = useId();
  const frequency = feature["~:frequency"];
  const kind = usesKind(frequency);
  const base = baseOf(frequency);
  const levelLabel = `${levelName ?? "Character"} level × n`;
  const baseOptions: SelectOption<string>[] = [
    ["prof", "Proficiency bonus"],
    ...ABILITIES.map((ability): [string, string] => [ability, `${ABILITY_NAMES[ability]} modifier`]),
    ["level", levelLabel],
  ];
  if (base !== undefined && !baseOptions.some(([value]) => value === base)) baseOptions.push([base, base]);
  return (
    <div className="grid gap-2 border-t border-dashed border-rule-strong pt-[10px]">
      <span id={nameId} hidden>
        {name}
      </span>
      <div className="flex flex-wrap items-end gap-x-[14px] gap-y-[10px]">
        <LabelAbove label="Uses" prefix={nameId}>
          {(labelledBy) => <SegmentedToggle aria-labelledby={labelledBy} options={USES_KINDS} value={kind} onValueChange={(next) => onChange(withKind(frequency, next))} />}
        </LabelAbove>
        {kind === "fixed" && (
          <LabelledSelect
            label="Amount"
            name={`${name} amount`}
            // No amount is 1 use, as the sheet shows it.
            value={amountOf(frequency) ?? 1}
            options={numberOptions(FIXED_AMOUNTS, amountOf(frequency))}
            onSelect={(n) => onChange(withFixed(frequency, n))}
          />
        )}
        {kind === "scaled" && (
          <>
            <LabelledSelect label="Equal to" name={`${name} equal to`} value={base ?? null} options={baseOptions} onSelect={(next) => onChange(withBase(frequency, next))} />
            {base === "level" && (
              <LabelledSelect
                label="n"
                name={`${name} n`}
                value={scaledNumber(frequency, "times") ?? NUMBER_DEFAULTS.times}
                options={numberOptions(TIMES, scaledNumber(frequency, "times"))}
                onSelect={(n) => onChange(withScaledNumber(frequency, "times", n))}
              />
            )}
            <LabelledSelect
              label="Plus"
              name={`${name} plus`}
              value={scaledNumber(frequency, "plus") ?? NUMBER_DEFAULTS.plus}
              options={numberOptions(PLUSES, scaledNumber(frequency, "plus"), plusText)}
              onSelect={(n) => onChange(withScaledNumber(frequency, "plus", n))}
            />
            <LabelledSelect<number | null>
              label="Minimum"
              name={`${name} minimum`}
              value={scaledNumber(frequency, "min") ?? null}
              options={[[null, "None"], ...numberOptions(MINIMUMS, scaledNumber(frequency, "min"))]}
              onSelect={(n) => onChange(withScaledNumber(frequency, "min", n ?? undefined))}
            />
          </>
        )}
      </div>
      {kind !== "none" && (
        <LabelAbove label="Recharges" prefix={nameId}>
          {(labelledBy) => (
            <SegmentedToggle aria-labelledby={labelledBy} options={rechargeOptions(frequency)} value={unitName(frequency) ?? null} onValueChange={(unit) => onChange(withUnit(frequency, unit))} />
          )}
        </LabelAbove>
      )}
      <UsesPreview name={name} feature={feature} levelName={levelName} />
    </div>
  );
}

/**
 * The feature as the sheet draws it, in the sheet section of its type, for
 * an example character. Its use bubble takes clicks, and nothing is saved.
 * For scaled uses the user can change the example's level and, for an
 * ability, its score; one sentence under the preview says how the amount is
 * worked out.
 */
export function UsesPreview({ name, feature, levelName }: { name: string; feature: Record<string, unknown>; levelName: string | null }) {
  const [level, setLevel] = useState(EXAMPLE_LEVEL);
  const [score, setScore] = useState(EXAMPLE_SCORE);
  const frequency = feature["~:frequency"];
  const scaled = usesKind(frequency) === "scaled";
  const known = baseAbility(frequency);
  const ability = known && ABILITY_NAMES[known];
  const shown = previewFeature(feature, exampleNumbers(level, score));
  return (
    <div className="grid gap-[6px]">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Label>Preview</Label>
        {scaled && (
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-xs text-ink-muted">
            Example: level
            <Select aria-label={`${name} example level`} value={level} options={LEVELS.map((n) => [n, String(n)])} onValueChange={setLevel} className="text-xs" />
            {ability && (
              <>
                <span aria-hidden>·</span> {ability}
                <Select aria-label={`${name} example ${ability} score`} value={score} options={SCORES.map((n) => [n, String(n)])} onValueChange={setScore} className="text-xs" />
              </>
            )}
          </span>
        )}
      </div>
      <div role="group" aria-label={`${name} preview`} className="grid border-[1.5px] border-ink bg-paper px-3 pt-2 pb-3">
        <FeatureGroup section={shown.section} items={[shown.feature]} />
      </div>
      {scaled && (
        <p aria-live="polite" className="text-[14.5px] text-ink-muted">
          {usesSentence(frequency, levelName, level, score)}
        </p>
      )}
    </div>
  );
}
