# Exporter bookmarklet

A bookmarklet for the Dungeon Master's Vault site (ORC-66). It downloads
all your characters and custom magic items as `dmv-export.json`. Import
that file in step 2 of the Alchemy 5e Import page. The app's
"Import from Dungeon Master's Vault" page (`/import/dmv`) gives the
bookmark link.

The script is `bookmarklet.js`: plain browser JavaScript with no
dependencies. It reads the login token from the old app's localStorage key
`user`, and fetches `GET /dnd/5e/characters` and `GET /dnd/5e/items` with
the header `Authorization: Token <jwt>`.

## Bundle format

```json
{
  "format": "dmv-export",
  "version": 1,
  "exportedFrom": "https://dungeonmastersvault.com",
  "characters": ["<raw EDN text of GET /dnd/5e/characters>"],
  "magicItems": ["<raw EDN text of GET /dnd/5e/items>"]
}
```

The bookmarklet does not read the EDN. Each string entry is the text of
one server response, and a list response holds many values. The app reads
it with the engine's `readServerEdn`. A `characters` entry can also be one
character as an object (doc 03).

## Test

```sh
bun test
```

The test runs the script against a fake page and a fake old server.
