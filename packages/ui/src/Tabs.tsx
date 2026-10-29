import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { useRef, type ReactNode } from "react";
import type { FlagColor } from "./Shell.tsx";

export type Tab = { value: string; label: string; color: FlagColor; content: ReactNode };

/**
 * Flag tabs that switch panels, with Base UI Tabs inside. The tab row stands
 * on a rule and sticks to the top of the page; the current tab is taller.
 * The first tab is open at first. Left and Right, Home and End move between
 * the tabs. After a switch with the row stuck, the page scrolls back so the
 * new panel starts under the row.
 */
export function Tabs({ label, tabs }: { label: string; tabs: Tab[] }) {
  const root = useRef<HTMLDivElement>(null);
  return (
    <BaseTabs.Root
      ref={root}
      defaultValue={tabs[0]?.value}
      onValueChange={() => {
        if (root.current && root.current.getBoundingClientRect().top < 0) root.current.scrollIntoView({ block: "start" });
      }}
      className="ui-tabs"
    >
      <BaseTabs.List aria-label={label} className="ui-tabs-list">
        {tabs.map((tab) => (
          <BaseTabs.Tab key={tab.value} value={tab.value} data-flag={tab.color} className="ui-tab">
            {tab.label}
          </BaseTabs.Tab>
        ))}
      </BaseTabs.List>
      {tabs.map((tab) => (
        <BaseTabs.Panel key={tab.value} value={tab.value} className="ui-tabs-panel">
          {tab.content}
        </BaseTabs.Panel>
      ))}
    </BaseTabs.Root>
  );
}
