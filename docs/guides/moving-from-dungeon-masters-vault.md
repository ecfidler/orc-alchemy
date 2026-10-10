---
type: How-to
title: "Moving from Dungeon Master's Vault"
description: "Steps to move homebrew, characters and custom magic items from Dungeon Master's Vault to Alchemy 5e, with the fallback for one character and what to do about unresolved content."
tags: [import, homebrew, guide]
status: stable
generated: { by: claude-code/agent, at: 2026-10-10T04:08:16Z }
---

# Moving from Dungeon Master's Vault

This guide moves your homebrew, your characters and your custom magic
items from Dungeon Master's Vault to Alchemy 5e. Do the steps in this
order. The characters need the homebrew that they use.

The app shows this guide at `/import/dmv`, with the bookmark link for
step 2. Keep this copy and `packages/app/src/components/DmvExporter.tsx`
the same (ORC-68).

## 1. Export your homebrew from Dungeon Master's Vault

1. Open Dungeon Master's Vault and go to My Content.
2. Click Export All. Your browser downloads `all-content.orcbrew`.

If you have no homebrew, go to step 2.

## 2. Export your characters and magic items

1. In Alchemy 5e, open the guide page at `/import/dmv`. Drag the link
   "Export from Dungeon Master's Vault" to your bookmarks bar.
2. Open Dungeon Master's Vault and log in.
3. Click the bookmark. When the export is done, your browser downloads
   `dmv-export.json`.

If the bookmark shows "Log in to Dungeon Master's Vault first", log in
and click it again. If you cannot use a bookmark, see
[Without the bookmark](#without-the-bookmark).

## 3. Import the homebrew first

1. Open the Import page.
2. In step 1, Homebrew, choose `all-content.orcbrew`.
3. If the app asks about conflicts, choose for each one: rename, skip or
   replace. Rename all keeps every item.
4. Read the import log. It names each item that it skipped and why.

## 4. Then import the characters

1. On the Import page, in step 2, Character bundle, choose
   `dmv-export.json`.
2. The app loads your custom magic items first, then lists each character
   that it imported.

## 5. Check the sheets

1. Open each character and compare its sheet with the sheet in Dungeon
   Master's Vault.
2. Check the name, the classes and levels, the ability scores, Armor
   Class, Hit Points and the spells.

## If a character has unresolved content

A character can use a race, a class, a spell or another option that the
app cannot find. The import list then shows "Unresolved content" under
the character. The sheet leaves that content out.

- The usual cause is a homebrew pack that is not loaded. Load the pack in
  step 1 of the Import page, then click Check again.
- If the content has a new name in your packs, choose the new name next
  to the key and click Remap. The app then saves the character with the
  new key.
- If you do not have the content, leave it unresolved. The rest of the
  character still works.

## Without the bookmark

You can move one character at a time from its public link. You do not
have to log in.

1. Open the character in Dungeon Master's Vault. Its address ends in
   `/pages/dnd/5e/characters/` and a number.
2. Change `/pages/dnd/5e/characters/` to `/dnd/5e/characters/` in the
   address, and open it. The page shows the character as text.
3. Copy all the text. On the Import page, in step 3, One character, paste
   it and click Import pasted character. You can also save the text as a
   file and choose it there.

This way does not move custom magic items. Import your homebrew first, as
in step 3.
