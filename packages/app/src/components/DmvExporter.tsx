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
        This guide moves your homebrew, your characters and your custom magic items from Dungeon Master's Vault to this
        app. Do the steps in this order. The characters need the homebrew that they use.
      </p>

      <h2 className="mt-4 text-lg">1. Export your homebrew from Dungeon Master's Vault</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open Dungeon Master's Vault and go to My Content.</li>
        <li>Click Export All. Your browser downloads all-content.orcbrew.</li>
      </ol>
      <p className="mt-1">If you have no homebrew, go to step 2.</p>

      <h2 className="mt-4 text-lg">2. Export your characters and magic items</h2>
      <p className="mt-2">
        <a ref={link} className="border border-black px-3 py-1">
          Export from Dungeon Master's Vault
        </a>
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Drag the link above to your bookmarks bar.</li>
        <li>Open Dungeon Master's Vault and log in.</li>
        <li>Click the bookmark. When the export is done, your browser downloads dmv-export.json.</li>
      </ol>
      <p className="mt-1">
        If the bookmark shows "Log in to Dungeon Master's Vault first", log in and click it again. If you cannot use a
        bookmark, see "Without the bookmark" below.
      </p>

      <h2 className="mt-4 text-lg">3. Import the homebrew first</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open the {importPage}.</li>
        <li>In step 1, Homebrew, choose all-content.orcbrew.</li>
        <li>
          If the app asks about conflicts, choose for each one: rename, skip or replace. Rename all keeps every item.
        </li>
        <li>Read the import log. It names each item that it skipped and why.</li>
      </ol>

      <h2 className="mt-4 text-lg">4. Then import the characters</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>On the {importPage}, in step 2, Character bundle, choose dmv-export.json.</li>
        <li>The app loads your custom magic items first, then lists each character that it imported.</li>
      </ol>

      <h2 className="mt-4 text-lg">5. Check the sheets</h2>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>Open each character and compare its sheet with the sheet in Dungeon Master's Vault.</li>
        <li>Check the name, the classes and levels, the ability scores, Armor Class, Hit Points and the spells.</li>
      </ol>

      <h2 className="mt-4 text-lg">If a character has unresolved content</h2>
      <p className="mt-2">
        A character can use a race, a class, a spell or another option that the app cannot find. The import list then
        shows "Unresolved content" under the character. The sheet leaves that content out.
      </p>
      <ul className="mt-2 list-disc space-y-1 pl-6">
        <li>
          The usual cause is a homebrew pack that is not loaded. Load the pack in step 1 of the {importPage}, then click
          Check again.
        </li>
        <li>
          If the content has a new name in your packs, choose the new name next to the key and click Remap. The app
          then saves the character with the new key.
        </li>
        <li>If you do not have the content, leave it unresolved. The rest of the character still works.</li>
      </ul>

      <h2 className="mt-4 text-lg">Without the bookmark</h2>
      <p className="mt-2">You can move one character at a time from its public link. You do not have to log in.</p>
      <ol className="mt-2 list-decimal space-y-1 pl-6">
        <li>
          Open the character in Dungeon Master's Vault. Its address ends in /pages/dnd/5e/characters/ and a number.
        </li>
        <li>
          Change /pages/dnd/5e/characters/ to /dnd/5e/characters/ in the address, and open it. The page shows the
          character as text.
        </li>
        <li>
          Copy all the text. On the {importPage}, in step 3, One character, paste it and click Import pasted character.
          You can also save the text as a file and choose it there.
        </li>
      </ol>
      <p className="mt-1">This way does not move custom magic items. Import your homebrew first, as in step 3.</p>
    </>
  );
}
