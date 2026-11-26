// The heading of a selection (ORC-58, ORC-340): its name and its left mark, and the hidden comma that a screen reader
// reads after a name with a mark.
import { LeftMark } from "@orc-alchemy/ui";
import type { BuilderSelection } from "../engine/builder.ts";
import { useSectionLevel, useSectionName } from "./builder-context.tsx";

/**
 * A comma for a screen reader after a name that a mark or a value follows: "Languages, 2 left". It is in the line, so
 * no space comes before it, and it does not show.
 */
export const Comma = () => <span className="text-[1px] opacity-0">,</span>;

/**
 * A selection's name and its left mark at the right (docs/design/character-builder.md, "Marks, not sentences"): "2
 * left", "Remove 1" or "Done". The mark has a fixed place, so a pick does not move the heading or change its size.
 * The mark is a part of the heading text: "Languages, 2 left". `mark={false}` gives the heading with no mark, for a
 * part that is no selection with picks, such as an inventory list. When the open step has another section of the same
 * name, the name has the sources of the selection (spec, "Text"). `name` replaces the name, for a section that names
 * its source in its own way, such as "Ability Score Improvement: Fighter 4". The heading is an h3, or an h4 under a
 * group heading (useSectionLevel).
 */
export function Heading({ id, selection, mark = true, name: own }: { id: string; selection: BuilderSelection; mark?: boolean; name?: string }) {
  // On a step with two sections of one name, the name has the source: "Skill Proficiency: Fighter".
  const sectionName = useSectionName(selection);
  const name = own ?? sectionName;
  const H = useSectionLevel() === 4 ? "h4" : "h3";
  return (
    <H id={id} className={HEADING_CLASSES}>
      <span className="min-w-0">
        {name}
        {mark && <Comma />}
      </span>
      {mark && <LeftMark left={selection.remaining} />}
    </H>
  );
}

/** The classes of a selection heading: the name at the left, and the mark, when it has one, at the right. */
export const HEADING_CLASSES = "flex items-center gap-3 font-sans text-[15px] font-bold leading-6";
