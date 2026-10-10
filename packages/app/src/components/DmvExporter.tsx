import { useEffect, useRef } from "react";
import { Link } from "react-router";
import source from "@orc-alchemy/exporter-bookmarklet/bookmarklet.js?raw";

/** The exporter bookmarklet as a javascript: URL. */
const bookmarkletHref = "javascript:" + encodeURIComponent(source);

/**
 * The page that gives the exporter bookmarklet (ORC-66): it downloads every
 * character and custom magic item from Dungeon Master's Vault as one
 * dmv-export bundle, for step 2 of the Import page.
 */
export function DmvExporter() {
  const link = useRef<HTMLAnchorElement>(null);
  // React warns on a javascript: href in JSX, so set it on the element.
  useEffect(() => link.current?.setAttribute("href", bookmarkletHref), []);

  return (
    <>
      <h1 className="text-xl">Import from Dungeon Master's Vault</h1>
      <p className="mt-2">
        The exporter downloads all your characters and custom magic items from Dungeon Master's Vault as one file,
        dmv-export.json.
      </p>
      <p className="mt-4">
        <a ref={link} className="border border-black px-3 py-1">
          Export from Dungeon Master's Vault
        </a>
      </p>
      <ol className="mt-4 list-decimal space-y-1 pl-6">
        <li>Drag the link above to your bookmarks bar.</li>
        <li>Open Dungeon Master's Vault and log in.</li>
        <li>Click the bookmark. When the export is done, your browser downloads dmv-export.json.</li>
        <li>
          Import dmv-export.json in step 2 of the{" "}
          <Link to="/import" className="underline">
            Import page
          </Link>
          .
        </li>
      </ol>
    </>
  );
}
