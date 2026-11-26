// The header of the character sheet: the character name, then the class, background and race.
import { Label } from "@orc-alchemy/ui";
import { useId, useLayoutEffect, useRef } from "react";
import type { Sheet } from "../engine/sheet.ts";

/** The header of the sheet: the name box, and the box of the class, background and race. */
export function SheetHeader({ sheet }: { sheet: Sheet }) {
  const race = sheet.subrace ? `${sheet.race} (${sheet.subrace})` : sheet.race;
  const classes = sheet.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ");
  return (
    <header className="grid items-start gap-3.5 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
      <div className="grid content-end rounded-[6px_26px_26px_6px] border-[1.5px] border-rule-strong bg-paper-raised px-[18px] py-1.5">
        <Name>{sheet.name ?? "Unnamed character"}</Name>
        <Label>Character name</Label>
      </div>
      <div className="grid grid-cols-[repeat(2,minmax(0,auto))] items-end gap-x-[18px] gap-y-1.5 rounded-md border-[1.5px] border-rule-strong px-3.5 py-2 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,max-content)_minmax(0,max-content)]">
        <Detail label="Class" className="col-span-2 @min-[720px]:col-span-1" value={classes} />
        {/* Background and race take at most a fifth of the sheet each, so the class gets the space first. */}
        <Detail label="Background" className="@min-[720px]:max-w-[20cqw]" value={sheet.background} />
        <Detail label="Race" className="@min-[720px]:max-w-[20cqw]" value={race} />
      </div>
    </header>
  );
}

/**
 * The character name. The box keeps the height of one line at the largest
 * size: a long name gets smaller, and wraps to two lines only when two lines
 * fit in that height.
 */
function Name({ children }: { children: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const nameText = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = heading.current?.parentElement;
    if (!heading.current || !nameText.current || !box) return;
    const fitName = () => {
      const element = heading.current!;
      const span = nameText.current!;
      element.style.cssText = "";
      // A width of 0 is a name that is not laid out (hidden, or in jsdom).
      if (element.clientWidth === 0) return;
      const style = getComputedStyle(element);
      const largest = parseFloat(style.fontSize);
      const leading = parseFloat(style.lineHeight) / largest;
      // The space for text: one line at the largest size.
      const height = element.clientHeight - parseFloat(style.paddingBottom);
      element.style.height = `${element.offsetHeight}px`;
      // 12px is the smallest size; a longer name is cut off.
      for (let size = largest; size >= 12; size--) {
        element.style.fontSize = `${size}px`;
        const lines = 2 * size * leading <= height ? 2 : 1;
        element.style.whiteSpace = lines === 2 ? "normal" : "nowrap";
        if (span.offsetWidth <= element.clientWidth && span.offsetHeight <= lines * size * leading + 1) return;
      }
    };
    fitName();
    // The fallback font has other widths, so the name fits again when the fonts load.
    document.fonts?.ready.then(fitName);
    // The box, not the name: fitName sets the name's height, which would start the observer again.
    const observer = new ResizeObserver(fitName);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children]);
  // The name sits on the rule. A name too long for two lines at 12px keeps its start, and a hover shows all of it.
  return (
    <h1
      ref={heading}
      title={children}
      className="flex items-end-safe overflow-hidden border-b border-rule-strong pb-0.5 text-[clamp(26px,4vw,36px)] leading-[1.05] font-medium text-balance break-words whitespace-nowrap"
    >
      <span ref={nameText}>{children}</span>
    </h1>
  );
}

/** A header value on one line, truncated, with its label under it. A hover shows the whole value. */
function Detail({ label, className, value }: { label: string; className?: string; value: string | null }) {
  const id = useId();
  return (
    <div className={className ? `grid min-w-0 ${className}` : "grid min-w-0"}>
      <span role="group" aria-labelledby={id} title={value ?? undefined} className="min-h-[26px] truncate border-b border-rule-strong">
        {value}
      </span>
      <Label id={id}>{label}</Label>
    </div>
  );
}
