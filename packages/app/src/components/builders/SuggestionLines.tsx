// The lines of suggested uses and a suggested type under the uses control
// (ORC-206, docs/design/homebrew-forms.md, "Suggested uses", "In the form").
// A line only shows what the text says. Nothing is stored until the user
// presses "Use this". A line shows while the feature has no uses, or while
// its type is Other.
import { NoteLine } from "@orc-alchemy/ui";
import { ABILITY_NAMES } from "../../engine/sheet.ts";
import type { Options } from "./fields.tsx";
import { readFeatureText, suggestedTypeOption, type SuggestedUnit, type SuggestedUses, type TextMatch } from "./suggested-uses.ts";
import { suggestedFrequency, usesKind } from "./uses.ts";

const UNIT_TEXT: Record<SuggestedUnit, string> = { "short-rest": "short rest", "long-rest": "long rest", day: "each day" };

/** The suggested uses in words: "1 use, short rest", "Proficiency bonus uses, long rest", "Wisdom modifier uses (minimum 1), long rest". */
function suggestedUsesText({ amount, unit }: SuggestedUses): string {
  const uses =
    amount.kind === "fixed"
      ? `${amount.n} ${amount.n === 1 ? "use" : "uses"}`
      : amount.kind === "prof"
        ? "Proficiency bonus uses"
        : `${ABILITY_NAMES[amount.ability]} modifier uses (minimum 1)`;
  return `${uses}, ${UNIT_TEXT[unit]}`;
}

/**
 * One yellow line: what the text says, then the suggestion. With onUse it
 * ends with a "Use this" button, named by buttonName. A quote that ends a
 * sentence gets no second period.
 */
function Line({ match, text, onUse, buttonName }: { match: TextMatch; text: string; onUse?: () => void; buttonName?: string }) {
  const close = /[.!?]$/.test(match.quote) ? "”" : "”.";
  return (
    <NoteLine action={onUse && { label: "Use this", name: buttonName, onClick: onUse }}>
      The text says {"“"}
      {match.quote}
      {close} {text}
    </NoteLine>
  );
}

/**
 * The suggestion lines of a feature, from its :description. name names the
 * feature, such as "Feature 2". types is the list of the type select: a
 * suggested type that is not in it shows no line. onUses and onType get
 * the value to store.
 */
export function SuggestionLines({
  name,
  feature,
  types,
  onUses,
  onType,
}: {
  name: string;
  feature: Record<string, unknown>;
  types: Options;
  onUses: (frequency: Record<string, unknown>) => void;
  onType: (type: unknown) => void;
}) {
  const description = feature["~:description"];
  const reading = typeof description === "string" ? readFeatureText(description) : null;
  if (reading === null) return null;
  const { uses, type } = reading;
  const showUses = uses !== null && usesKind(feature["~:frequency"]) === "none";
  const typeOption = suggestedTypeOption(type, feature["~:type"], types);
  if (!showUses && !typeOption) return null;
  return (
    <div className="grid gap-[6px]">
      {showUses &&
        (uses.kind === "suggestion" ? (
          <Line match={uses.match} text={`Suggested: ${suggestedUsesText(uses.uses)}.`} onUse={() => onUses(suggestedFrequency(uses.uses))} buttonName={`${name} uses: Use this`} />
        ) : (
          <Line match={uses.match} text="It may name uses, but no clear amount. Set the uses by hand." />
        ))}
      {type && typeOption && <Line match={type.match} text={`Suggested type: ${typeOption[1]}.`} onUse={() => onType(typeOption[0])} buttonName={`${name} type: Use this`} />}
    </div>
  );
}
