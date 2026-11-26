// The summary card of the builder (ORC-341, docs/design/character-builder.md "The summary card"): a narrow card at
// the right of the step with the same lines on each step, and the button that opens the full sheet. Each line has a
// fixed height, and a value is one line that is cut with "…", so a value that comes or goes moves nothing.
import { Button } from "@orc-alchemy/ui";
import { useId } from "react";
import { modStr, type Sheet } from "../engine/sheet.ts";

/** The lines of the card, as label and value. "" is a line with no value: it keeps its place and shows nothing. */
export function summaryLines(sheet: Sheet): [string, string][] {
  // A character with no class has no level and no hit points (spec, "A character with no class").
  const classed = sheet.classes.length > 0;
  const race = sheet.race === null ? "" : sheet.subrace ? `${sheet.race} (${sheet.subrace})` : sheet.race;
  return [
    ["Class", sheet.classes.map((c) => `${c.name} ${c.level}`).join(", ")],
    ["Level", classed ? String(sheet.totalLevel) : ""],
    ["Background", sheet.background ?? ""],
    ["Race", race],
    ["Hit points", classed ? String(sheet.maxHitPoints) : ""],
    ["Armor Class", String(sheet.armorClass)],
    // With no race the engine gives a speed of 0, which is not a value.
    ["Speed", sheet.race === null || sheet.speeds.length === 0 ? "" : `${sheet.speeds[0].feet} ft.`],
  ];
}

/**
 * The summary card, a region named "Summary", and the button "Open the full sheet" below it, which calls `onOpenSheet`.
 * The card has no other control. A long name is cut with "…" on its one line, and its full text is the title.
 */
export function SummaryCard({ sheet, onOpenSheet }: { sheet: Sheet; onOpenSheet: () => void }) {
  const id = useId();
  // An empty name is no name.
  const name = sheet.name || null;
  return (
    <section aria-labelledby={`${id}-label`} className="grid grid-cols-[minmax(0,1fr)] gap-2">
      <p id={`${id}-label`} className="font-sans text-[10.5px] font-medium tracking-[0.08em] text-ink-muted uppercase">
        Summary
      </p>
      <div className="rounded-md border-[1.5px] border-rule-strong bg-paper-raised px-3.5 py-3 text-[15px]">
        <dl>
          <div className="border-b-[1.5px] border-rule-strong">
            <dt id={`${id}-name`} className="sr-only">
              Name
            </dt>
            <dd
              aria-labelledby={`${id}-name`}
              title={name ?? undefined}
              className={`h-[31px] truncate text-[24px] leading-[30px] font-medium ${name ? "" : "text-ink-muted"}`}
            >
              {name ?? "Unnamed character"}
            </dd>
          </div>
          {summaryLines(sheet).map(([label, value], i) => (
            <div key={label} className="flex h-7 items-center justify-between gap-2.5 border-b border-rule">
              <dt id={`${id}-${i}`} className="flex-none font-sans text-[11px] tracking-[0.06em] text-ink-muted uppercase">
                {label}
              </dt>
              <dd aria-labelledby={`${id}-${i}`} title={value || undefined} className="min-w-0 truncate text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
        <dl aria-label="Abilities" className="mt-2.5 grid grid-cols-3 gap-1.5">
          {sheet.abilities.map((a) => {
            const label = `${id}-${a.ability}`;
            return (
              <div key={a.ability} className="grid h-[62px] content-center border border-rule-strong text-center">
                <dt id={label} className="font-sans text-[9.5px] tracking-[0.08em] text-ink-muted">
                  {a.ability.toUpperCase()}
                </dt>
                <dd aria-labelledby={label} className="leading-tight">
                  <span className="block text-[19px] font-medium">{a.score}</span>{" "}
                  <span className="block font-sans text-[12px] text-ink-muted">{modStr(a.modifier)}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
      <Button className="w-full" onClick={onOpenSheet}>
        Open the full sheet
      </Button>
    </section>
  );
}
