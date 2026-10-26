import { cloneElement, type ReactElement, type ReactNode } from "react";

/**
 * The binder shell: a margin rail with the logo and the navigation, then the
 * page column. At 680px and below the rail is a strip along the top.
 */
export function Shell({ logo, nav, children }: { logo: ReactNode; nav: ReactNode; children: ReactNode }) {
  return (
    <div className="ui-shell">
      <aside className="ui-shell-rail">
        {logo}
        {nav}
      </aside>
      <main className="ui-shell-main">{children}</main>
    </div>
  );
}

export function FlagTabs({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav aria-label={label} className="ui-flag-tabs">
      {children}
    </nav>
  );
}

export type FlagColor = "yellow" | "blue" | "green" | "orange";

/**
 * A flag tab. `render` is the link element, for example the router's link;
 * the tab adds its look, its text and `aria-current` to it.
 */
export function FlagTab({
  color,
  current,
  render,
  children,
}: {
  color: FlagColor;
  current: boolean;
  render: ReactElement<{ className?: string }>;
  children: ReactNode;
}) {
  return cloneElement(
    render,
    {
      className: "ui-flag-tab",
      "data-flag": color,
      "aria-current": current ? "page" : undefined,
    } as { className: string },
    children,
  );
}
