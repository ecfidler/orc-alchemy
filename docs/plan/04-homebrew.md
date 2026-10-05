# 04: Homebrew

This document covers `.orcbrew` import and export through the engine
library, and the homebrew features around it. It implements contract C1.
The source of truth for the old behavior is the homebrew investigation:
`import_validation.cljs`, `spell_subs.cljs`, `events.cljs:3601-4000`,
[`docs/ORCBREW_FILE_VALIDATION.md`](https://github.com/ecfidler/orcpub/blob/26f57e07/docs/ORCBREW_FILE_VALIDATION.md), and [`docs/CONFLICT_RESOLUTION.md`](https://github.com/ecfidler/orcpub/blob/26f57e07/docs/CONFLICT_RESOLUTION.md).

## What is inherited, compiled into the library

- **Parsing.** `cljs.reader/read-string`. No JS EDN library is needed.
- **The automatic cleaning pipeline** (`validate-import`,
  `import_validation.cljs:1266-1376`), in order:
  1. Text-level fixes for `disabled? nil`, `nil nil,` pairs, and trailing
     commas.
  2. Parsing, with line-numbered errors.
  3. Unicode normalization (`:23-68`).
  4. Data cleaning: empty pack names, `:option-pack`, and `nil` handling
     per field class.
  5. Required-field placeholders.
  6. Selection-option deduplication.
  7. The bare ability-key rewrite and the skill-choice default, added by
     patch D5. Doc 01 §C1 lists where each applies.
  8. Duplicate-key detection, internal and external.
  9. Structure validation, progressive or strict.
- **The conversion to template options.** The `spell_subs.cljs` chain,
  lifted to `buildTemplate(homebrew)` (doc 02). It handles `:props` through
  `plugin-modifiers`, `:level-modifiers` through `level-modifier`,
  `:level-selections`, `:spellcasting` through `class-option`, `:traits`
  through `traits-modifiers`, attaching subclasses to classes and subraces
  to races by `:class` and `:race`, and inverting spell `:spell-lists`.
  Same code, same results.
- **Export.** `pr-str` of the plugin map, single-plugin for one pack and
  multi-plugin for all. Also the pre-export validation
  (`validate-before-export`) with the "export anyway" placeholder fill. The
  facade adds three item checks that the old spec lacks (doc 01 §Export).
- **Missing-content reconciliation** for loaded characters
  (`content_reconciliation.cljs`).

The facade exposes these as follows:

- `parseOrcbrew(text, { name?, existing?, strict? })` returns
  `{ success, data, log, conflicts, skipped }`.
- `validateForExport(homebrew, { pack? })` returns
  `{ valid, packs, filled }`. It checks one pack, or all packs without
  `pack`. `filled` is the homebrew with each problem repaired, ready to
  export anyway.
- `orcbrewToEdn(homebrew, { pack?, pretty? })` returns the `.orcbrew` text.
  With `pack`, it writes that pack as a single-plugin map. Without it, it
  writes all packs as the multi-plugin map. `pretty` pretty-prints the text
  with `pprint`.
- `renameKey(homebrew, { pack, contentType, from, to })` applies a conflict
  rename (patch D4).
- `buildTemplate(homebrew)` builds the template, and
  `reconcileMissingContent(entity, homebrew)` reports unresolved keys.

## What the new app builds in TypeScript

- **Import flow UI.** A file picker for `.orcbrew` files and an import log
  panel showing changes, errors, and skipped items, in the old
  `:import-log` shape. Progressive validation by default, with a strict
  option.
- **Conflict resolution UI** ([`docs/CONFLICT_RESOLUTION.md`](https://github.com/ecfidler/orcpub/blob/26f57e07/docs/CONFLICT_RESOLUTION.md)). Per conflict,
  the user can rename and import (the suggested key is the key plus the
  slugified source, for example `:artificer-kibbles-tasty`, from
  `generate-new-key`), skip, or replace, and there is a "rename all"
  action. Detection and suggestion come from the library. Applying the
  decision (`rename-key-in-plugin`) is patched to rewrite all references
  (doc 02, patch D4).
- **Storage.** IndexedDB, with one record per pack, keyed by name and
  holding the single-plugin map, plus enable and disable flags per pack and
  per item. Invalid entries are quarantined with a visible warning, never
  discarded wholesale. The in-memory shape passed to `buildTemplate` is the
  multi-plugin map, exactly like the old app's `:plugins`. Each pack record
  carries `"rules": "2014"` (ORC-53). `.orcbrew` is the 2014 homebrew
  format only. 2024 homebrew uses a new format that the later 2024 engine
  defines (ORC-96, [`docs/reports/2024-rules-support.md`](../reports/2024-rules-support.md)).
- **The "My Content" page.** Per pack: enable, disable, export, and delete.
  Per type: the 13 lists, with enable, edit, and delete per item (the
  `views.cljs:7485-7759` behavior).
- **Homebrew builders.** The roughly 14 per-type forms. The old app's
  builders produce plain records that per-type specs validate on save
  (`events.cljs:533-562`, with specs in `races.cljc`, `classes.cljc:28`,
  `spells.cljc:45`, `selections.cljc:25`, and the other content
  namespaces). Expose those specs through the facade as validation
  functions, and build the forms against the field tables in
  [`docs/HOMEBREW_REQUIRED_FIELDS.md`](https://github.com/ecfidler/orcpub/blob/26f57e07/docs/HOMEBREW_REQUIRED_FIELDS.md). Ship them in usage order: spell,
  monster, race and subrace, class and subclass, then the rest.
- **Magic items.** A homebrew content type in the new app. The old app
  keeps them server-side. They arrive through the exporter bundle (doc 03)
  or are authored in the item builder. `magic_items_test.clj` documents the
  conversion between the internal and external item shapes, which the
  builder reuses. On `.orcbrew` export, magic items are either omitted,
  since the old app would ignore an unknown content type anyway, or written
  to a separate new-app file. Decide at implementation time and document
  the choice in the export UI.

## Behavior details to keep

- Subrace `:speed` and `:darkvision` are deltas against the race, applied
  only when they differ (`options.cljc:1978`).
- Plugin classes skip the built-in ASI and HP selections when `:plugin?` is
  set (`level-option`). Verify whether that is intended before changing it.
- The class display name becomes `"Name (Source)"` when the source is not
  the default pack.
- Re-importing a pack over itself is not a conflict. A colliding key from a
  different source is.

## Old bugs to fix rather than replicate (from doc 01)

- `:boons` is half-supported.
- Multi-plugin import skips per-item validation.
- Rename rewrites only `:class` and `:race` references. Patch D4 fixed it.
- One bad entry wipes all homebrew.
- The background `:key` in the file is ignored.
- Bare ability keys have no effect, and a skill choice without `:choose`
  has no maximum. Patch D5 fixed both.

## Tests

- Fixture suite: `test/duplicate-external-a.orcbrew` and
  `test/duplicate-external-b.orcbrew`, the community packs, and one file
  per drift form. Each must import with the same log the old importer
  produces, captured once.
- Lossless: import, export, and import again yield an identical
  multi-plugin map.
- Old-app acceptance: every export passes the old `::e5/plugins` spec and
  imports through the old importer unchanged.
  `scripts/check-orcbrew-exports.clj` checks it as a step in the fork's
  engine CI workflow (doc 01 §Export).
- Mechanics: golden characters that use homebrew content evaluate
  identically, except where patch D5 rewrites the pack (doc 01 §C1).

## Deliverables

Linear tracks the deliverables. The engine half is PubDoor M3 (ORC-27 to
ORC-43). The minimal app-side loader and storage are Alchemy 5e M3 (ORC-52
to ORC-54). The import flow, conflict UI, reconciliation UI, My Content
page, export, builders, magic items, and the real-user acceptance run are
M5 (ORC-69 to ORC-78).
