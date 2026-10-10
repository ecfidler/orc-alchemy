import { useEffect, useRef } from "react";
import { Link } from "react-router";
import source from "@orc-alchemy/exporter-bookmarklet/bookmarklet.js?raw";

/** The exporter bookmarklet as a javascript: URL. */
const bookmarkletHref = "javascript:" + encodeURIComponent(source);

/**
 * The guide to moving from Dungeon Master's Vault (ORC-68), with the
 * exporter bookmarklet (ORC-66): it downloads every character and custom
 * magic item as one dmv-export bundle, for step 2 of the Import page. The
 * repository copy is docs/guides/moving-from-dungeon-masters-vault.md; keep
 * the two the same.
 */
export function DmvExporter() {
  const link = useRef<HTMLAnchorElement>(null);
  // React warns on a javascript: href in JSX, so set it on the element.
  useEffect(() => link.current?.setAttribute("href", bookmarkletHref), []);
  const importPage = (
    <Link to="/import" className="underline">
      Import page
    </Link>
  );

  return (
    <>
      <h1 className="text-xl">Moving from Dungeon Master's Vault</h1>
      <p className="mt-2">
        This guide moves your homebrew, your characters and your custom magic items from Dungeon Master's Vault to
        Alchemy 5e. Do the steps in this order. The characters need the homebrew that they use.
      </p>

      <h2 className="mt-4 text-lg">1. Export your homebrew from Dungeon Master's Vault</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open Dungeon Master's Vault.</li>
        <li>Go to My Content.</li>
        <li>Click Export All. Your browser downloads all-content.orcbrew.</li>
      </ol>
      <p className="mt-1">If you have no homebrew, go to step 2.</p>
      <p className="mt-1">
        If Dungeon Master's Vault shows "Cannot export all plugins - some contain invalid data", export each pack on
        its own. In My Content, click the pack. Then click Export. Do this for each pack.
      </p>

      <h2 className="mt-4 text-lg">2. Export your characters and magic items</h2>
      <p className="mt-2">
        <a ref={link} className="border border-black px-3 py-1">
          Export from Dungeon Master's Vault
        </a>
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Drag the link above to your bookmarks bar.</li>
        <li>Open Dungeon Master's Vault.</li>
        <li>Log in.</li>
        <li>Click the bookmark. When the export is done, your browser downloads dmv-export.json.</li>
      </ol>
      <p className="mt-1">
        If the bookmark shows "Log in to Dungeon Master's Vault first", log in. Then click the bookmark again. If you
        cannot use a bookmark, see "Without the bookmark" below.
      </p>

      <h2 className="mt-4 text-lg">3. Import the homebrew first</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open the {importPage}.</li>
        <li>
          In step 1 of the Import page, Homebrew, choose all-content.orcbrew. If you exported each pack on its own,
          choose each file in turn.
        </li>
        <li>
          If the app shows key conflicts, choose rename or skip for each conflict. If the conflict is with a loaded
          pack, you can also choose replace. To keep every item, click Rename all.
        </li>
        <li>Click Apply and import.</li>
        <li>Read the import log. It names each item that it skipped and why.</li>
      </ol>

      <h2 className="mt-4 text-lg">4. Then import the characters</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>In step 2 of the {importPage}, Character bundle, choose dmv-export.json.</li>
        <li>The app loads your custom magic items first, then lists each character that it imported.</li>
      </ol>

      <h2 className="mt-4 text-lg">5. Check the sheets</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open each character.</li>
        <li>Compare its sheet with the sheet in Dungeon Master's Vault.</li>
        <li>Check the name, the classes and levels, the ability scores, Armor Class, Hit Points and the spells.</li>
      </ol>

      <h2 className="mt-4 text-lg">If a character has unresolved content</h2>
      <p className="mt-2">
        A character can use a race, a class, a spell or another option that the app cannot find. The Imported
        characters section then shows "Unresolved content" under the character. The sheet leaves that content out.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          The usual cause is a homebrew pack that is not loaded. Load the pack in step 1 of the {importPage}. Then
          click Check again.
        </li>
        <li>
          If the app suggests a new key, choose it. Then click Remap. The app saves the character with the new key.
        </li>
        <li>If you do not have the content, leave it unresolved. The rest of the character still works.</li>
      </ul>

      <h2 className="mt-4 text-lg">Without the bookmark</h2>
      <p className="mt-2">You can move one character at a time from its public link.</p>
      <p className="mt-1">This way does not move custom magic items. Import your homebrew first.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open Dungeon Master's Vault.</li>
        <li>Log in.</li>
        <li>In Character List, click open next to the character.</li>
        <li>Click View. The address now ends in /pages/dnd/5e/characters/ and a number.</li>
        <li>In the address, change /pages/dnd/5e/characters/ to /dnd/5e/characters/.</li>
        <li>Open the new address. Your browser downloads a file with no extension.</li>
        <li>In step 3 of the {importPage}, One character, choose that file.</li>
      </ol>
    </>
  );
}
