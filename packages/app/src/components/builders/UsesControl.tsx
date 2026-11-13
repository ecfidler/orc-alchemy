// The uses control of a homebrew feature and its preview (ORC-204,
// docs/design/homebrew-forms.md, "Uses control" and "Preview"): variant A of
// the uses prototype. The control reads the stored :frequency and writes it
// only on a change by the user (uses.ts). The preview draws the feature with
// the sheet's own functions: toSheetFeature, sectionOf and FeatureGroup, the
// way the sheet draws the feature that the engine builds.
import { FieldLabel, Label, SegmentedToggle, Select, type SelectOption } from "@orc-alchemy/ui";
import { useState, type ReactNode } from "react";
import { untag } from "../../engine/content.ts";
import { ABILITIES, sectionOf, toSheetFeature } from "../../engine/sheet.ts";
import { FeatureGroup } from "../CharacterSheet.tsx";
import {
  ABILITY_NAMES,
  amountOf,
  baseOf,
  builtFrequency,
  exampleNumbers,
  FIXED_AMOUNTS,
  MINIMUMS,
  PLUSES,
  plusText,
  rechargeOptions,
  scaledNumber,
  TIMES,
  unitName,
  USES_KINDS,
  usesKind,
  usesSentence,
  withBase,
  withFixed,
  withKind,
  withScaledNumber,
  withUnit,
} from "./uses.ts";

/** The example character's level and ability score when the preview opens. */
export const EXAMPLE_LEVEL = 5;
export const EXAMPLE_SCORE = 16;

/** The levels and the ability scores that the example character can have. */
const LEVELS = Array.from({ length: 20 }, (_, i) => i + 1);
const SCORES = Array.from({ length: 30 }, (_, i) => i + 1);

/** The options of the numbers, and the stored number when it is none of them, so a stored value shows as it is. */
function numberOptions(values: number[], stored: unknown, text: (n: number) => string = String): SelectOption<number>[] {
  const all = typeof stored === "number" && !values.includes(stored) ? [...values, stored].sort((a, b) => a - b) : values;
  return all.map((n) => [n, text(n)]);
}

/** A label above a control that has its own name, such as a toggle group: the label is only shown. */
function LabelAbove({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ui-field-label">
      <span aria-hidden className="ui-label">
        {label}
      </span>
      {children}
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

export interface UsesFeature {
  name: unknown;
  description: unknown;
  type: unknown;
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
  frequency,
  onChange,
  feature,
  levelName,
}: {
  name: string;
  frequency: unknown;
  onChange: (frequency: Record<string, unknown> | undefined) => void;
  feature: UsesFeature;
  levelName: string | null;
}) {
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
      <div className="flex flex-wrap items-end gap-x-[14px] gap-y-[10px]">
        <LabelAbove label="Uses">
          <SegmentedToggle aria-label={`${name} uses`} options={USES_KINDS} value={kind} onValueChange={(next) => onChange(withKind(frequency, next))} />
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
                value={scaledNumber(frequency, "times") ?? 1}
                options={numberOptions(TIMES, scaledNumber(frequency, "times"))}
                onSelect={(n) => onChange(withScaledNumber(frequency, "times", n))}
              />
            )}
            <LabelledSelect
              label="Plus"
              name={`${name} plus`}
              value={scaledNumber(frequency, "plus") ?? 0}
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
        <LabelAbove label="Recharges">
          <SegmentedToggle aria-label={`${name} recharges`} options={rechargeOptions(frequency)} value={unitName(frequency) ?? null} onValueChange={(unit) => onChange(withUnit(frequency, unit))} />
        </LabelAbove>
      )}
      <UsesPreview name={name} frequency={frequency} feature={feature} levelName={levelName} />
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
export function UsesPreview({ name, frequency, feature, levelName }: { name: string; frequency: unknown; feature: UsesFeature; levelName: string | null }) {
  const [level, setLevel] = useState(EXAMPLE_LEVEL);
  const [score, setScore] = useState(EXAMPLE_SCORE);
  const scaled = usesKind(frequency) === "scaled";
  const base = baseOf(frequency);
  const ability = base !== undefined && base in ABILITY_NAMES ? ABILITY_NAMES[base as keyof typeof ABILITY_NAMES] : null;
  const type = feature.type === undefined || feature.type === "" ? undefined : untag(feature.type);
  const sheetFeature = toSheetFeature({
    name: String(feature.name ?? ""),
    description: String(feature.description ?? ""),
    type,
    frequency: builtFrequency(frequency, exampleNumbers(level, score)),
  });
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
        <FeatureGroup section={sectionOf(type)} items={[sheetFeature]} />
      </div>
      {scaled && (
        <p aria-live="polite" className="text-[14.5px] text-ink-muted">
          {usesSentence(frequency, levelName, level, score)}
        </p>
      )}
    </div>
  );
}
