// Small parts that more than one section of the character sheet uses: the ability abbreviation, the tag, and the row box.
import { Label, Menu, type MenuProps } from "@orc-alchemy/ui";
import type { ReactNode } from "react";
import type { Ability } from "../engine/sheet.ts";

export const abbr = (ability: Ability) => ability.toUpperCase();

/** Small Inter caps text after a line's text. */
export function Tag({ children }: { children: ReactNode }) {
  return <span className="ml-1 font-sans text-[9.5px] font-normal tracking-[0.04em] text-ink-muted uppercase">{children}</span>;
}

/** A menu that a RowBox opens: the box is its button, named `name`. */
export type RowBoxMenu = Pick<MenuProps<string>, "title" | "items" | "checked" | "onPick"> & { name: string };

/**
 * A box in the AC row: a large value, its label at the bottom, so a taller
 * box in the row does not move the other labels. It fits its content, at
 * least 96px. On a narrow sheet the boxes share the width, up to 112px each,
 * and `shortLabel` replaces a label too long for that width.
 */
export function RowBox({
  label,
  shortLabel,
  shield = false,
  menu,
  children,
}: {
  label: string;
  shortLabel?: string;
  shield?: boolean;
  /**
   * With it, the box is a bare button that opens the menu. On a hover, on the keyboard focus or while the menu is open,
   * it gets an inset ring. The ring is in place of the focus outline, as on the Hit points and Hit dice boxes.
   */
  menu?: RowBoxMenu;
  children: ReactNode;
}) {
  const box = `grid min-w-24 flex-[0_0_auto] grid-rows-[1fr_auto] border-[1.5px] border-rule-strong bg-paper-raised px-3.5 py-2 text-center @max-[719px]:max-w-28 @max-[719px]:min-w-0 @max-[719px]:flex-[1_1_0] @max-[719px]:px-1.5 ${
    shield ? "rounded-[8px_8px_50%_50%/8px_8px_34%_34%] pb-3.5" : "rounded-md"
  }`;
  const value = "self-center text-[26px] leading-[1.1] font-medium tabular-nums";
  // The wrapper is a grid, so a label on two lines keeps the line height of the label.
  const boxLabel = (
    <span aria-hidden className="grid">
      <Label>{shortLabel ? <ShortWhenNarrow text={label} short={shortLabel} /> : label}</Label>
    </span>
  );
  if (menu)
    return (
      <Menu
        variant="bare"
        label={menu.name}
        title={menu.title}
        items={menu.items}
        checked={menu.checked}
        onPick={menu.onPick}
        className={`${box} cursor-pointer outline-none hover:shadow-[inset_0_0_0_2px_var(--ink)] focus-visible:shadow-[inset_0_0_0_2px_var(--ink)] data-[popup-open]:shadow-[inset_0_0_0_2px_var(--ink)]`}
      >
        <span className={value}>{children}</span>
        {boxLabel}
      </Menu>
    );
  return (
    <div className={box}>
      {/* The group has the label as its name, so the visible label is not read twice. */}
      <span role="group" aria-label={label} className={value}>
        {children}
      </span>
      {boxLabel}
    </div>
  );
}

/** Text that shows `short` in its place when the sheet is narrower than 720px. */
export function ShortWhenNarrow({ text, short }: { text: string; short: string }) {
  return (
    <>
      <span className="@max-[719px]:hidden">{text}</span>
      <span className="@min-[720px]:hidden">{short}</span>
    </>
  );
}
