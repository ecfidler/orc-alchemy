// The lines of suggested uses and a suggested type under the uses control
// (ORC-206, docs/design/homebrew-forms.md, "Suggested uses", "In the form").
// A line only shows what the text says. Nothing is stored until the user
// presses "Use this". A line shows while the feature has no uses, or while
// its type is Other.
import { Button } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import { untag } from "../../engine/content.ts";
import { ABILITY_NAMES } from "../../engine/sheet.ts";
import type { Options } from "./fields.tsx";
import { readFeatureText, type SuggestedRest, type SuggestedUses, type TextMatch } from "./suggested-uses.ts";
import { suggestedFrequency } from "./uses.ts";

const REST_TEXT: Record<SuggestedRest, string> = { "short-rest": "short rest", "long-rest": "long rest", day: "each day" };

/** The suggested uses in words: "1 use, short rest", "Proficiency bonus uses, long rest", "Wisdom modifier uses (minimum 1), long rest". */
export function suggestedUsesText({ amount, rest }: SuggestedUses): string {
  const uses =
    amount.kind === "fixed"
      ? `${amount.n} ${amount.n === 1 ? "use" : "uses"}`
      : amount.kind === "prof"
        ? "Proficiency bonus uses"
        : `${ABILITY_NAMES[amount.ability]} modifier uses (minimum 1)`;
  return `${uses}, ${REST_TEXT[rest]}`;
}

/** Whether a stored type is Other: no type, "" (the monster's Other) or :other. */
export const isOtherType = (type: unknown) => untag(type) === "" || untag(type) === "other";

/** One yellow line: what the text says, the suggestion, and its button when there is one. A quote that ends a sentence gets no second period. */
function Line({ match, children, action }: { match: TextMatch; children: ReactNode; action?: ReactNode }) {
  return (
    <p className="bg-note px-3 py-[7px] font-sans text-[13.5px] leading-[1.4] text-note-ink [&_.ui-button]:font-bold [&_.ui-button]:text-note-ink">
      The text says {"\u201c"}
      {match.quote}
      {/[.!?]$/.test(match.quote) ? "\u201d" : "\u201d."} {children} {action}
    </p>
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
  const text = feature["~:description"];
  const reading = typeof text === "string" ? readFeatureText(text) : null;
  if (reading === null) return null;
  const { uses, type } = reading;
  const showUses = uses !== null && feature["~:frequency"] === undefined;
  const typeOption = type && isOtherType(feature["~:type"]) ? types.find(([value]) => typeof value === "string" && untag(value) === type.type) : undefined;
  if (!showUses && !typeOption) return null;
  return (
    <div className="grid gap-[6px]">
      {showUses &&
        (uses.kind === "suggestion" ? (
          <Line
            match={uses.match}
            action={
              <Button variant="link" aria-label={`${name} uses: Use this`} onClick={() => onUses(suggestedFrequency(uses.uses))}>
                Use this
              </Button>
            }
          >
            Suggested: {suggestedUsesText(uses.uses)}.
          </Line>
        ) : (
          <Line match={uses.match}>It may name uses, but no clear amount. Set the uses by hand.</Line>
        ))}
      {type && typeOption && (
        <Line
          match={type.match}
          action={
            <Button variant="link" aria-label={`${name} type: Use this`} onClick={() => onType(typeOption[0])}>
              Use this
            </Button>
          }
        >
          Suggested type: {typeOption[1]}.
        </Line>
      )}
    </div>
  );
}
