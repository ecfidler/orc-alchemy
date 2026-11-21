// The spell view (ORC-284, docs/design/spells-panel.md "The spell view"):
// the text of one spell from its record. It knows nothing of the Spells
// panel, so the Browse pages (ORC-87) can use it too. The owner gives a line
// under the name block, for example the prepare line of the panel.
import { Label } from "@orc-alchemy/ui";
import { type ReactNode, useId } from "react";
import type { SpellRecordResult } from "../engine/spell-records.ts";
import { componentsLine, descriptionParts, durationParts, levelLine } from "../engine/spell-text.ts";

export type SpellViewProps = {
  /** The name to show when there is no record: the name that the app makes from the key. */
  name: string;
  /** The record from the spell lookup; undefined when the spell has none. */
  spell: SpellRecordResult | undefined;
  /** The cast note of the known spell, for example "at will". */
  castNote?: string | null;
  /** The owner's line, under the name block and above the facts. */
  children?: ReactNode;
};

/** A word in a small box, in Inter caps, for example "Ritual" or "Concentration". */
export function BoxTag({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-block border border-rule-strong px-[5px] align-[2px] font-sans text-[10px] leading-[1.6] font-semibold tracking-[0.06em] whitespace-nowrap text-ink-muted not-italic uppercase ${className}`}
    >
      {children}
    </span>
  );
}

/** A fact of the grid: its label in Inter caps above its value. */
function Fact({ label, wide = false, children }: { label: string; wide?: boolean; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${wide ? "col-span-full" : ""}`}>
      <dt>
        <Label>{label}</Label>
      </dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

/** A small line of the name block. */
const smallLine = "mt-1.5 font-sans text-[12.5px] text-ink-muted";

/** A material text longer than this takes the full width of the grid. */
const WIDE_COMPONENTS = 28;

/**
 * One spell: the name, the level line with the Ritual tag, "From {pack}"
 * for a pack spell, the cast note, the owner's line, the facts and the
 * description. A field with no value has no line. With no record, the view
 * shows the name, the cast note, the owner's line and "The app has no text
 * for this spell." The view is a region named by the spell name.
 */
export function SpellView({ name, spell, castNote, children }: SpellViewProps) {
  const headingId = useId();
  const record = spell?.record;
  const components = componentsLine(record?.components);
  const duration = record?.duration ? durationParts(record.duration) : null;
  const text = record?.description ? descriptionParts(record.description) : null;
  const hasFacts = Boolean(record?.["casting-time"] || record?.range || duration || components);
  const note = castNote?.trim();
  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <h3 id={headingId} className="text-[26px] leading-[1.15] font-semibold text-balance break-words">
        {record?.name ?? name}
      </h3>
      {record && (
        <p className="mt-0.5 italic">
          {levelLine(record)}
          {record.ritual && <BoxTag className="ml-2">Ritual</BoxTag>}
        </p>
      )}
      {spell && spell.from !== "SRD" && <p className={smallLine}>From {spell.from.pack}</p>}
      {note && <p className={smallLine}>{note.charAt(0).toUpperCase() + note.slice(1)}</p>}
      {children && <div className="mt-2.5">{children}</div>}
      {record === undefined && <p className="mt-3">The app has no text for this spell.</p>}
      {hasFacts && (
        <dl className="my-3 grid grid-cols-2 gap-x-[18px] gap-y-2 border-y border-rule-strong py-2.5">
          {record?.["casting-time"] && <Fact label="Casting time">{record["casting-time"]}</Fact>}
          {record?.range && <Fact label="Range">{record.range}</Fact>}
          {duration && (
            <Fact label="Duration">
              {duration.concentration && <BoxTag>Concentration</BoxTag>}
              {duration.concentration && duration.rest && " "}
              {duration.rest}
            </Fact>
          )}
          {components && (
            <Fact label="Components" wide={(record?.components?.["material-component"]?.length ?? 0) > WIDE_COMPONENTS}>
              {components}
            </Fact>
          )}
        </dl>
      )}
      {text && (
        <div className={`max-w-[56ch] ${hasFacts ? "" : "mt-3"}`}>
          {text.paragraphs.map((paragraph, i) => (
            <Paragraph key={i} first={i === 0} text={paragraph} />
          ))}
          {text.higherLevels && (
            <div className="mt-[0.8em] border-t border-rule pt-[0.7em]">
              <p>
                <b className="font-semibold">At Higher Levels.</b> {text.higherLevels[0]}
              </p>
              {text.higherLevels.slice(1).map((paragraph, i) => (
                <Paragraph key={i} first={false} text={paragraph} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/** A paragraph of the description. A line that starts with a bullet hangs it in the margin. */
function Paragraph({ text, first }: { text: string; first: boolean }) {
  const bullet = text.startsWith("•");
  return <p className={`${first ? "" : "mt-[0.55em]"} ${bullet ? "-indent-[1.1em] pl-[1.1em]" : ""}`}>{text}</p>;
}
