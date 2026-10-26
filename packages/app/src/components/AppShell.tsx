import { AlertNote, AlertNotes, FlagTab, FlagTabs, Shell, type FlagColor } from "@orc-alchemy/ui";
import { Link, Outlet, useLocation } from "react-router";
import { useStorage } from "../storage/characters.ts";

/** The flag tabs. Each tab is current on the paths that start with one of its prefixes. */
const TABS: { label: string; to: string; color: FlagColor; current: (path: string) => boolean }[] = [
  {
    label: "Characters",
    to: "/",
    color: "yellow",
    current: (path) => path === "/" || path.startsWith("/sheet/") || path.startsWith("/build/"),
  },
  { label: "Import", to: "/import", color: "blue", current: (path) => path === "/import" || path.startsWith("/import/") },
  { label: "My Content", to: "/content", color: "green", current: (path) => path === "/content" || path.startsWith("/content/") },
  { label: "Preferences", to: "/preferences", color: "orange", current: (path) => path === "/preferences" },
];

export function AppShell() {
  const { inMemory, failed, outdated } = useStorage();
  const { pathname } = useLocation();
  return (
    <Shell
      logo={
        <Link to="/" aria-label="Alchemy 5e" className="inline-flex items-center gap-2.5 text-ink no-underline">
          <img src="/potion-16.png" width={32} height={32} alt="" className="block [image-rendering:pixelated]" />
          <span className="text-xl leading-none font-[560] tracking-[-0.01em] whitespace-nowrap">
            Alchemy
            <small className="ml-1 align-[3px] font-sans text-[10px] font-semibold tracking-[0.1em] text-ink-muted">5E</small>
          </span>
        </Link>
      }
      nav={
        <FlagTabs label="Main">
          {TABS.map((tab) => (
            <FlagTab key={tab.to} color={tab.color} current={tab.current(pathname)} render={<Link to={tab.to} />}>
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
            <b>Alchemy 5e was updated in another tab.</b> Reload this page to keep saving.{" "}
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
