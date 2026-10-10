---
type: How-to
title: "Moving from Dungeon Master's Vault"
description: "Steps to move homebrew, characters and custom magic items from Dungeon Master's Vault to Alchemy 5e."
tags: [import, homebrew, guide]
status: stable
generated: { by: claude-code/agent, at: 2026-10-10T04:16:27Z }
---

# Moving from Dungeon Master's Vault

<!-- Maintainer note: Alchemy 5e shows this guide at /import/dmv, with the
bookmark link for step 2. Keep this copy and
packages/app/src/components/DmvExporter.tsx the same (ORC-68). -->

This guide moves your homebrew, your characters and your custom magic
items from Dungeon Master's Vault to Alchemy 5e. Do the steps in this
order. The characters need the homebrew that they use.

## 1. Export your homebrew from Dungeon Master's Vault

1. Open Dungeon Master's Vault.
2. Go to My Content.
3. Click Export All. Your browser downloads `all-content.orcbrew`.

If you have no homebrew, go to step 2.

If Dungeon Master's Vault shows "Cannot export all plugins - some contain
invalid data", export each pack on its own. In My Content, click the
pack. Then click Export. Do this for each pack.

## 2. Export your characters and magic items

1. In Alchemy 5e, open the guide page at `/import/dmv`. Drag the link
   "Export from Dungeon Master's Vault" to your bookmarks bar.
2. Open Dungeon Master's Vault.
3. Log in.
4. Click the bookmark. When the export is done, your browser downloads
   `dmv-export.json`.

If the bookmark shows "Log in to Dungeon Master's Vault first", log in.
Then click the bookmark again. If you cannot use a bookmark, see
[Without the bookmark](#without-the-bookmark).

## 3. Import the homebrew first

1. Open the Import page.
2. In step 1 of the Import page, Homebrew, choose `all-content.orcbrew`.
   If you exported each pack on its own, choose each file in turn.
3. If the app shows key conflicts, choose rename or skip for each
   conflict. If the conflict is with a loaded pack, you can also choose
   replace. To keep every item, click Rename all.
4. Click Apply and import.
5. Read the import log. It names each item that it skipped and why.

## 4. Then import the characters

1. In step 2 of the Import page, Character bundle, choose
   `dmv-export.json`.
2. The app loads your custom magic items first, then lists each character
   that it imported.

## 5. Check the sheets

1. Open each character.
2. Compare its sheet with the sheet in Dungeon Master's Vault.
3. Check the name, the classes and levels, the ability scores, Armor
   Class, Hit Points and the spells.

## If a character has unresolved content

A character can use a race, a class, a spell or another option that the
app cannot find. The Imported characters section then shows "Unresolved
content" under the character. The sheet leaves that content out.

- The usual cause is a homebrew pack that is not loaded. Load the pack in
  step 1 of the Import page. Then click Check again.
- If the app suggests a new key, choose it. Then click Remap. The app
  saves the character with the new key.
- If you do not have the content, leave it unresolved. The rest of the
  character still works.

## Without the bookmark

You can move one character at a time from its public link.

This way does not move custom magic items. Import your homebrew first.

1. Open Dungeon Master's Vault.
2. Log in.
3. In Character List, click open next to the character.
4. Click View. The address now ends in `/pages/dnd/5e/characters/` and a
   number.
5. In the address, change `/pages/dnd/5e/characters/` to
   `/dnd/5e/characters/`.
6. Open the new address. Your browser downloads a file with no extension.
7. In step 3 of the Import page, One character, choose that file.
