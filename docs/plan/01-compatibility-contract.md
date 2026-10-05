# 01: The compatibility contract

This document defines three user-level contracts. Each states what the new
app must accept on import, what it must produce on export, and the fixtures
that prove it. Because the rules engine is the same compiled code, the new
app inherits most of the hard parts rather than reimplementing them. This
document is mostly about the cases where the old code does not already do
the right thing.

## Scope: 2014 content, and a later engine

The three contracts cover 2014 content and characters, which is
everything the old app holds. 2024 content has its own data format and key
scheme (ORC-96) and no contract with the old app, because the old app has
no 2024 rules.

The contracts hold by construction while `@pubdoor/dmv` evaluates 2014
characters. When a later engine replaces it (ORC-97), the bar for C1
mechanics fidelity and for C2 changes. Every character must import and
evaluate, and a difference report against `@pubdoor/dmv` lists every sheet
value that changed. Identical values are not required then. C3 does not
change: engine keys stay as they are, and the app qualifies the keys it
stores or routes by rules edition. See [`docs/reports/2024-rules-support.md`](../reports/2024-rules-support.md)
§Decision.

## C1. Homebrew: `.orcbrew` files in both directions

**Import.** The user exports `all-content.orcbrew` (multi-plugin) or a
single pack, `<pack>.orcbrew` (single-plugin), from the old app and imports
it into the new one. The new app must accept every file the old importer
accepts, including the ten drift forms it cleans automatically:

1. Spurious `nil nil,` pairs.
2. `:disabled? nil`.
3. Empty or nil `:option-pack` and an empty top-level pack name.
4. Trailing commas.
5. Smart quotes, dashes, non-breaking spaces, zero-width characters, and
   other Unicode.
6. Traits and selection options missing `:name`.
7. Entries missing `:name`, `:level`, or `:school`.
8. A single-plugin or multi-plugin top level.
9. `:size` as `"Medium"` or `:medium`.
10. Ability keys as `:con` or `:orcpub.dnd.e5.character/con`.

The old pipeline (`import_validation.cljs:1266-1376`) handles all ten and
is compiled into the library (doc 04). The contract is therefore to call
that pipeline rather than bypass it, and to cover each form with a fixture
so that a library upgrade cannot regress it (`fixtures/orcbrew/drift-01` to
`drift-10`). `drift-11` and `drift-12` cover the two rewrites described
below.

M0 corrected two points (`fixtures/README.md` §Findings). First, the old
importer accepted form 10 without effect: `{:con 2}` added nothing to
Constitution, while `race-ability-increases` still reported it (finding 4).
Linear decision ORC-40 chose to normalize on import, and patch D5 (doc 02)
does it. `normalize-ability-keys-in-import` in `import_validation.cljs`
rewrites a bare key such as `:con` as `:orcpub.dnd.e5.character/con` in
these places:

- `:abilities` of a race or subrace.
- `:ability-increases` and `:prereqs` of a feat.
- `[:profs :save]` of a class.
- `[:spellcasting :ability]` of a class or subclass.
- `[:value :ability]` of a `:spell` level-modifier.

Each rewrite is a `normalized-ability-key` change in the import log.
Monsters keep their bare keys.

Second, real exports start with a UTF-8 byte-order mark, so strip
`﻿` before parsing. They also carry internal key conflicts, pack names
that disagree with `:option-pack`, subclasses attached to homebrew or
absent classes, and `:skill-options` without `:choose` (finding 9). The old
importer accepts all of it. A skill choice without `:choose` let a
character pick any number of skills in the old app. Patch D5 also adds
`default-skill-choose-in-import`, which gives `:choose 1` to a
`:skill-options` or `:multiclass-skill-options` that lacks it and logs a
`defaulted-choose` change. The old builder shows 1 when `:choose` is unset.

**Mechanics fidelity.** A homebrew race, class, feat, or subclass evaluates
to the same character in both apps. This is inherited: the conversion from
orcbrew records to template options is the same code (`opt5e/race-option`,
`class-option`, `plugin-modifiers`, `level-modifier`, and the rest). Golden
characters that use homebrew content prove it (doc 02 §Golden tests).

The patch D5 rewrites are the exception. A character that uses a pack with
bare ability keys evaluates differently from the old app, because the old
engine ignored those keys and the new importer rewrites them. The golden
character `ironwrought-artificer-3` uses `duplicate-external-b`, whose race
has `:abilities {:con 2}`. It has CON 17 instead of 15, 27 maximum hit
points instead of 24, and a CON-keyed spell save DC of 13 instead of 12. In
the same way, a skill choice without `:choose` now allows one pick.

**Export.** Per-pack and all-content export produce EDN that the old app
imports without changes. The old `::e5/plugins` spec checks little of an
item: `::e5/homebrew-item` requires only that `:option-pack` is present. The
facade enforces three more rules itself:

- An item's `:key` equals its map key.
- An item's `:option-pack` is not blank.
- An item has no `nil` that the importer would remove or replace.

`validateForExport` reports each failure in the pack's `itemProblems`, and
its `filled` result repairs each one. `orcbrewToEdn` writes the homebrew as
given, so the app runs `validateForExport` first. The proof is a step in
the fork's engine CI workflow (`.github/workflows/engine.yml`).
`engine-js/scripts/write-orcbrew-exports.mjs` writes `orcbrewToEdn`'s
exports of every fixture pack, and `scripts/check-orcbrew-exports.clj`
checks each file. An all-packs export must be a valid `::e5/plugins`, and a
one-pack export a valid `::e5/plugin`. The old importer must then import
the file with no changes, skipped items, errors, or key conflicts, and must
leave the data unchanged.

**Not covered by the format.** Magic items are not an orcbrew content type
in the old app. They are stored server-side, per user. Doc 03 §Magic items
covers how a user brings them across.

Fixtures: `test/duplicate-external-a.orcbrew` and
`test/duplicate-external-b.orcbrew`, the community packs gathered in M0,
and one synthetic file per drift form.

## C2. Characters: from the old app to the new

The old app has no character export. The transfer path (doc 03) is that the
user obtains each character's strict entity from their old instance and
imports the file into the new app. There are two ways to obtain it: the
public URL `https://<old>/dnd/5e/characters/<id>`, which returns Transit
text and needs no login for a shared character, or an exporter bookmarklet
run while logged in.

**Import tolerance.** The table lists every quirk found in real saved
characters and what handles it.

| # | Quirk | Handled by |
|---|---|---|
| R1 | Equipment stored as a map `{item-kw value}` in old data rather than a vector of `{key value}`, under all seven equipment keys | Inherited: `vectorize-equipment` (`character.cljc:287`) |
| R2 | `prepared-spells-by-class` stored as a seq of records | Inherited: `update-values-from-strict` (`:307`) |
| R3 | `slots-used` and `features-used` values as vectors, and a stray `:db/id` in `features-used` | Inherited: the same function |
| R4 | An option `int-value` of `0` or a `string-value` of `""` | Preserved as `0` and `""`. The `or` in `entity.cljc:158` keeps them, because both are truthy in Clojure and ClojureScript. An earlier version of this row said they read back as nil. `fixtures/README.md` finding 3 corrected it. Fixture: `legacy/r4-zero-int-value` |
| R5 | `xps` as a string | Not inherited. The old server coerces it (`routes.clj:930`). The importer must parse it, and a blank or invalid value becomes 0 |
| R6 | `equip/quantity` as a string | Inherited on the save path (`fix-quantities`). Apply it on import too |
| R7 | Unqualified legacy keys such as `:str` and `:quantity` | Not inherited. Detection specs exist (`character.cljc:47-94`). Patch D1 (ORC-20, doc 02) re-enabled the migration (`character.cljc:121-178`), and the facade's `importCharacter` runs it |
| R8 | Selection keys that do not resolve because homebrew is not loaded | Inherited: `content_reconciliation.cljs` detects them. The UI is the new app's |
| R9 | Duplicate multi-select options with the same key | Inherited: `has-duplicate-selections?`. Tolerate them on read |
| R10 | Transit wire format with namespaced keywords | Decode with `transit-js`, or let the library decode it, which is simpler because `cognitect.transit` is already a ClojureScript dependency of the old client |

**Direction.** One way only. The old app cannot import a character file, so
the new app has no obligation to write characters the old app can read.

Fixtures: the three real Datomic entities in
`test/cljc/orcpub/dnd/e5/character_test.clj:100-113`, the M0 captures of
`GET /dnd/5e/characters/:id` for every golden character, and a synthetic
fixture per quirk from R1 to R9.

## C3. Content identity: the key namespace

Imported characters and homebrew files reference content by keyword key:
`:elf`, `:wizard`, `:acid-arrow`, `:champion`, and selection keys such as
`:martial-archetype`. Because the library is the old engine, keys and
selection structure are identical by construction. The contract is
therefore about not breaking that identity:

- Never re-derive keys in TypeScript. Read them from the engine.
- No patch to the engine source in this fork (doc 02) may touch key
  derivation (`common/name-to-kw`), the 16 explicit spell keys
  (`spells.cljc:82, 271, 300`, and the others), subclass selection keys
  (`name-to-kw subclass-title`), or `ref` paths.
- The proof is a CI test that loads every golden character and every
  fixture `.orcbrew` and asserts zero unresolved option keys.
- Four fixtures pin their unresolved keys instead (`fixtures/README.md`
  finding 17). Each lists them under `unresolved` in its `.meta.json`, and
  the test asserts exactly those. The legacy fixture `r8-unresolved-keys`
  is unresolved by design. The legacy fixtures `character-test-2` and
  `character-test-3` are real saved characters whose non-SRD content does
  not resolve against the SRD. The golden character `warlock-10-drow` is
  the `warlock_test.clj` entity. It uses non-SRD Archfey content and an old
  starting-equipment key, `:any-simple-weapon`.

## Known quirks: which side wins

| Old behavior | New app does | Why |
|---|---|---|
| Multi-plugin import skips per-item validation (`import_validation.cljs:782-794`) | Validate uniformly, in the TypeScript layer around the library call | Leniency comes from the automatic cleaning, not from skipping validation |
| A single invalid entry in localStorage wipes all homebrew on reload (`db.cljs:244-265`) | Not applicable, because storage is the new app's (doc 04). Quarantine invalid entries | Data-loss bug |
| Homebrew rename rewrites only `:class` and `:race` references (`key-reference-map`, `:1382`) | Rewrite all references, including spells' `:spell-lists`, the spell list a class or subclass uses, feats' race prerequisites, and `level-selections` types (patch D4) | Strictly better, and old files are unaffected |
| Bare ability keys such as `:con` in homebrew have no effect, and a skill choice without `:choose` has no maximum | Rewrite them on import and log each rewrite (patch D5, ORC-40, ORC-39) | An author who writes `{:con 2}` means +2 CON, and the old builder shows 1 when `:choose` is unset |
| `:boons` is missing from the import required-fields and content-type names | Add them | Half-supported type |
| The importer ignores a background's `:key` in the file and re-derives it from the name | Honor the key when it equals `name-to-kw(name)`, and warn otherwise | Preserve keys |
| The Forgotten Realms name tables in `character/random.cljc` are non-SRD | Exclude that namespace from the bundle. Provide original name lists or none | Licensing |
| Anything else that affects computed values | Match the old app exactly. It is the same code | That is the point of Option 2A |
