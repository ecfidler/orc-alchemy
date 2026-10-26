import { AlertNote, AlertNotes, FlagTab, FlagTabs, Shell, type FlagColor } from "@orc-alchemy/ui";
import { Link, Outlet, useLocation } from "react-router";
import { useStorage } from "../storage/characters.ts";

/** The flag tabs. A tab is current on its sections: each section is a path and the paths under it. Home has no tab. */
const TABS: { label: string; to: string; color: FlagColor; sections: string[] }[] = [
  { label: "Characters", to: "/characters", color: "yellow", sections: ["/characters", "/sheet", "/build"] },
  { label: "Import", to: "/import", color: "blue", sections: ["/import"] },
  { label: "My Content", to: "/content", color: "green", sections: ["/content"] },
  { label: "Preferences", to: "/preferences", color: "orange", sections: ["/preferences"] },
];

const inSection = (path: string, section: string) => path === section || path.startsWith(`${section}/`);

export function AppShell() {
  const { inMemory, failed, outdated } = useStorage();
  const { pathname } = useLocation();
  return (
    <Shell
      logo={
        <Link to="/" aria-label="Alchemy 5e" className="inline-flex items-center gap-2.5 text-ink no-underline">
          <img src="/potion-32.png" width={32} height={32} alt="" className="block [image-rendering:pixelated]" />
          <span className="text-xl leading-none font-[560] tracking-[-0.01em] whitespace-nowrap">
            Alchemy
            <small className="ml-1 align-[3px] font-sans text-[10px] font-semibold tracking-[0.1em] text-ink-muted">5E</small>
          </span>
        </Link>
      }
      nav={
        <FlagTabs label="Main">
          {TABS.map((tab) => (
            <FlagTab key={tab.to} color={tab.color} current={tab.sections.some((section) => inSection(pathname, section))} render={<Link to={tab.to} />}>
              {tab.label}
            </FlagTab>
          ))}
        </FlagTabs>
      }
    >
      <AlertNotes>
        {inMemory && (
          <AlertNote tone="act">
            <b>This browser is not letting Alchemy 5e save.</b> Your characters are kept only until you close this tab.
          </AlertNote>
        )}
        {outdated && (
          <AlertNote tone="act">
            <b>Alchemy 5e was updated in another tab.</b> Reload to keep saving.{" "}
            <button type="button" onClick={() => location.reload()}>
              Reload this page
            </button>
          </AlertNote>
        )}
        {!inMemory && !outdated && failed && (
          <AlertNote tone="failed">
            <b>Saving to this browser failed.</b> Recent changes may not be kept.
          </AlertNote>
        )}
      </AlertNotes>
      <Outlet />
    </Shell>
  );
}
