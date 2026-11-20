---
type: Reference
title: 2024 engine spec
description: The spec of the 2024 rules engine in packages/engine - the engine model, the facade, the seam to the app, the content format and pipeline, the test strategy with golden characters, and the run order of the E1 build tickets.
tags: [rules-2024, engine, design]
status: stable
generated: { by: claude-code/agent, at: 2026-11-20T15:25:00Z }
resource: https://linear.app/orc-alchemy/issue/ORC-218/map-plan-the-2024-engine
sources:
  - id: orc-218
    resource: https://linear.app/orc-alchemy/issue/ORC-218/map-plan-the-2024-engine
    title: "ORC-218: Map: plan the 2024 engine (the decisions index)"
  - id: spike
    resource: ../reports/2024-engine-spike.md
    title: The 2024 engine spike
  - id: format
    resource: 2024-content-format.md
    title: 2024 content format
  - id: rules-report
    resource: ../reports/2024-rules-support.md
    title: Supporting the 2024 rules
---

# Purpose

This document is the spec for the Linear project *2024 engine build*, which
was milestone *E1 — 2024 engine* before 2026-11-20. In this document, E1,
E2 and "milestone" keep those older names: each one is a Linear project
now. The E1 build tickets build what it describes. It
collects the decisions of the map ORC-218.[^orc-218] Each decision is in
full in the comment of its Linear ticket: ORC-220 for the engine model and
the facade, and ORC-96 for the content format.

When this document and the spike report disagree, this document wins. When
this document and a Linear decision comment disagree, the comment wins, and
this document has an error.

# Scope

The engine computes a 2024 character from its choices. It is the workspace
package `packages/engine` (`@orc-alchemy/engine`) in orc-alchemy. It is
TypeScript and it is not published to npm.

In scope for E1:

- The generic core, the 2024 rules, and the facade.
- The content format, its loader, and the built-in SRD 5.2.1 content.
- Homebrew content in the same format, on the engine side.
- One app ticket: a 2024 character on the sheet behind a developer flag.

Not in scope for E1:

- The 2024 builder, the edition choice, content browse, and the 2024
  homebrew forms. They are a later milestone of Alchemy 5e.
- 2014 rules on this engine. That is milestone *E2 — 2014 port* (ORC-97).
  The rules report gives the reason for the order.[^rules-report]
- Content that is not in SRD 5.2.1. A user enters it as homebrew.
- A conversion of a 2014 character or of an `.orcbrew` file to 2024.

# Package layout

| Folder | Contents |
|---|---|
| `src/core/` | The generic core. It has no rules content. |
| `src/rules2024/` | The 2024 rules: the built character, the template, the hooks, and the facade. |
| `src/format/` | The schema of the content format, the loader, and the validation. |
| `content/` | The built-in packs as JSON, the provenance file, and the license notices. |
| `scripts/` | The import script for the 5e-bits data. |

The folders `src/core/` and `src/rules2024/` are the decision of ORC-220.
The other three folders are the choice of this document. E2 adds
`src/rules2014/`. If the engine is published to npm later, split the
package then.

# The engine model

The engine keeps the model of the Dungeon Master's Vault engine, in three
parts.[^spike]

1. **The entity.** A character is its choices. The entity is a tree of
   selections and chosen options, with a small set of free values such as
   the name. All other values are computed.
2. **The template.** The template is the tree of selections and options
   that the rules offer. An option carries modifiers and can open more
   selections. A `ref` selection pools its count and its options with the
   other selections of the same `ref`.
3. **Modifiers.** A modifier changes one sheet value, which is a value of
   the built character. A modifier and a derived sheet value declare the
   sheet values that they read. The engine applies them in dependency
   order.

## Changes from the 2014 engine

1. **One entity form.** The entity is plain typed JSON. Selections are
   arrays, so the order of choices is safe. The entity has no Transit, no
   namespaced keywords, and no edition. The envelope of the character
   carries the `rules` tag.
2. **Guards on dependencies.** A read of a sheet value that is not
   declared throws. A cycle throws and names its sheet values.
3. **Problems.** `evaluate` returns a list of problems: a choice that the
   template does not offer, and a choice whose prerequisite fails.
4. **Two meanings of a prerequisite.** "Can the character choose this" and
   "is this choice still valid" are different tests.
5. **One selection for each `ref` pool** in the result of `evaluate`.
6. **Content is data.** See *Content*.

A build is repeatable. Ties between unrelated sheet values break by first
use.

# The facade

The facade is the set of functions that the app calls. It copies the shape
of the `@pubdoor/dmv` facade where the shape is neutral.

## `evaluate`

```ts
evaluate(entity, { rules: "2024", packs }): {
  built: Built2024;
  selections: AvailableSelection[];
  problems: Problem[];
  contributions: Contributions;
}
```

| Part | Rule |
|---|---|
| `entity` | The 2024 entity. |
| `packs` | The homebrew packs of the user. The built-in pack `srd52` is always present. The pack `srd52-monsters` loads on demand. |
| `built` | The typed built character of the 2024 engine. It is not `BuiltCharacter` of `@pubdoor/dmv`. Its names are 2024 names, for example `species`. |
| `selections` | The same `AvailableSelection` type as the 2014 facade, with one entry for each `ref` pool. |
| `problems` | See *Changes from the 2014 engine*, item 3. Each problem has the path of the choice and a reason. |
| `contributions` | For each sheet value that modifiers change, the list of changes with the `name` and the source of each. The app uses it to show why a value is what it is. |

## The other functions

- **Mutations.** The functions that change an entity take a path and an
  option key, as in the 2014 facade. Each returns a new entity.
- **`autofill`.** It completes each open selection of an entity, as the
  2014 `autofill` does. It takes a seed and the packs, so the result is
  repeatable. It goes back when a choice leaves a selection with nothing
  to pick. It does not change a choice that the entity already has. The
  app uses it for a random character.
- **Content lists.** The app reads the loaded records by type, for
  browse and for the builder.
- **Packs.** Load, validate, and upgrade a pack file. See *Content*.

The 2024 engine has no `.orcbrew` function.

## What `Built2024` adds to the 2014 values

- The species, the size, and the creature type.
- Feats with their categories, and the Origin feat.
- The Weapon Mastery choices, and the mastery property on each attack.
- The Critical Hit range and the damage resistances.
- Features with uses that can recover on two rests.

# The seam to the app

- The folder `packages/app/src/engine` picks the engine from the `rules`
  tag on the envelope of the character. A missing tag is `"2014"`.
- The app renders from its own `Sheet` type. There is one `Sheet` for both
  editions. It gains optional 2024 values.
- `toSheet` adapts the 2014 engine. A second adapter in the same folder
  adapts `Built2024`.
- The files of that folder that read 2014 keys need a 2024 counterpart:
  `abilities.ts`, `builder-choices.ts`, `equipment.ts`, `spells.ts`, and
  `description.ts`. That work is in the Alchemy 5e milestone, not in E1.

# Content

The [2024 content format](2024-content-format.md) is the spec of the
format.[^format] Its status is `draft` until ORC-223 makes the schema. In
short:

- A pack is one JSON file. Built-in content and homebrew use one format.
- A record has a display layer and an `effects` field. It is valid without
  effects.
- Effects are data. A record names a hook for a rule that data cannot
  hold. Only the engine defines a hook.
- A reference is `pack:key`, for example `srd52:fireball`.

## Hooks

A hook is a function in `src/rules2024/hooks/` with a name and typed
arguments. If an effect cannot hold a rule, add a hook. Each hook has a
test of its own. The format doc has a list of probable hooks. The ticket
that adds a hook puts the real hook in that list.

## The content pipeline

The format doc, section *The source data*, gives the pipeline: a one-time
import from the 5e-bits data, corrections, and a comparison test. After
the import, we write the `effects` of each record by hand, class by class.

# Test strategy

The 2024 rules have no oracle. The tests are thus in four groups.

| Group | What it proves |
|---|---|
| Core tests | The core, on a template with no rules content. |
| Format tests | The schema, the loader, the upgrade of a version, and each example record of the format doc. |
| Content tests | The comparison of the built-in packs with the SRD text. Each built-in record loads with no problem. |
| Golden characters | The rules. Each character has expected values that a person or an agent computed by hand from SRD 5.2.1. |

## Golden characters

- There are 14: one for each of the 12 classes, and two multiclass.
- Each class ticket writes the character of its class and makes it pass.
- Do not copy an expected value from the output of the engine.

This document adds two rules that no Linear decision has:

- A golden character has checks at three levels or more, and one of them
  is level 20.
- Each expected number has its arithmetic and its SRD 5.2.1 page in a
  comment.

# Proof for E1

E1 is done when:

1. Each SRD 5.2.1 class builds from level 1 to level 20 with its subclass.
2. The 14 golden characters pass.
3. A homebrew pack with one record of each type loads and changes a
   character. This check is how this document reads "homebrew on the
   engine side is in scope".
4. The app shows a 2024 character on the sheet behind the developer flag.

# Run order

The owner approved this order on 2026-11-16 (ORC-221). Each class is one
ticket, with its subclass and its golden character.

1. The engine package: core, facade, problems, contributions, CI (ORC-222).
2. The content format: schema, loader, keys (ORC-223).
3. The content import (ORC-224).
4. The base character rules (ORC-225).
5. Species (ORC-226), then backgrounds and feats (ORC-227), then equipment
   (ORC-228).
6. The golden harness (ORC-237), then the Fighter (ORC-230).
7. The app ticket: a 2024 character on the sheet behind a developer flag
   (ORC-238). Each later class is then visible on a sheet.
8. Barbarian (ORC-250), Monk (ORC-251), Rogue (ORC-252).
9. Spellcasting (ORC-229).
10. Cleric (ORC-232), Druid (ORC-253), Wizard (ORC-254), Bard (ORC-233),
    Sorcerer (ORC-255), Warlock (ORC-256), Paladin (ORC-231), Ranger
    (ORC-257).
11. Multiclassing, with the two multiclass golden characters (ORC-234).
12. Homebrew on the engine side (ORC-235).
13. Monsters and the Wild Shape forms (ORC-236).

Linear has the tickets and their blocking relations. When Linear and this
list disagree about the order, Linear wins.

# After E1

The 2024 app work is a milestone of Alchemy 5e. It comes after E1 and
before the 2014 port (E2), because E2 changes nothing that a user sees.
Its scope:

- The edition choice on a new character.
- The 2024 builder.
- The 2024 values on the sheet, and the display of contributions.
- Content browse for 2024 content.
- The 2024 homebrew forms, with the import and export of a pack.
- The About page with the two SRD statements.

The milestone gets its tickets when E1 is under way.

Magic items and attunement in the engine (ORC-258) are also after E1.
That work goes with this milestone, and E1 ends without it.

[^orc-218]: ORC-218: Map: plan the 2024 engine (the decisions index)
[^spike]: The 2024 engine spike
[^rules-report]: Supporting the 2024 rules
[^format]: 2024 content format
