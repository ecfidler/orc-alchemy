// The look of a prepare count (ORC-288, docs/design/spells-panel.md "The
// prepare count"). The Spells panel and the Spells step of the builder use
// it, so that the two places show the same count in the same colors.
import { type PrepareCount, prepareCountText } from "../engine/spell-prepare.ts";

/** The look of a prepare count in each state: a yellow note under the limit, green text at it, a red note over it, plain text with no limit. */
const COUNT_LOOK: Record<PrepareCount["state"], string> = {
  under: "bg-note px-2 text-note-ink",
  at: "text-success",
  over: "bg-note-red px-2 text-note-ink",
  "no-limit": "",
};

/**
 * A prepare count: "5 of 8 prepared", with the class name first when
 * `withClass`. Over the limit it says how many spells to remove. It always
 * shows: the panel decides when not to show it.
 */
export function PrepareCountText({ count, withClass }: { count: PrepareCount; withClass: boolean }) {
  return (
    <span
      data-prepare-count={count.state}
      className={`font-sans text-[13.5px] leading-5 font-semibold whitespace-nowrap max-[600px]:whitespace-normal ${COUNT_LOOK[count.state]}`}
    >
      {prepareCountText(count, withClass)}
    </span>
  );
}
