---
type: Report
title: The 2024 engine spike
description: "Results of the ORC-95 spike: a TypeScript port of the generic core, a 2024 Fighter slice on it, an estimate for the full SRD 5.2.1 ruleset, and answers on the facade and the engine model."
tags: [rules-2024, engine, spike]
status: stable
generated: { by: claude-code/agent, at: 2026-11-16T04:20:00Z }
sources:
  - id: orc-95
    resource: https://linear.app/orc-alchemy/issue/ORC-95
    title: "ORC-95: Spike: port the generic core to TypeScript and build a 2024 Fighter slice"
  - id: rules-report
    resource: 2024-rules-support.md
    title: Supporting the 2024 rules
  - id: rules-delta
    resource: ../kb/srd-5.2-rules-delta.md
    title: SRD 5.2 rules delta for a character builder
  - id: dmv-types
    resource: https://github.com/ecfidler/orcpub/blob/pubdoor/engine-js/types/index.d.ts
    title: "@pubdoor/dmv 0.4.0 types/index.d.ts"
  - id: charnik
    resource: https://github.com/FernDragonborn/charnik/tree/main/src/lib/rules
    title: Charnik src/lib/rules
  - id: 5e-bits
    resource: https://github.com/5e-bits/5e-srd-api/tree/main/packages/5e-database/src/2024/en
    title: 5e-bits 2024 data
---

# The 2024 engine spike

> Status: written 2026-11-16 for ORC-95. The findings feed the decision
> ORC-220 (the engine model and the facade) and the decision ORC-96 (the
> content format). The owner makes both decisions. This report gives a
> recommendation for each question, not a decision.

## Summary

The spike ported the generic core of the Dungeon Master's Vault engine to
TypeScript and built a 2024 Fighter on the port, from level 1 to level 5.
The code is the workspace package `packages/engine`. Its tests check
hand-computed values at levels 1, 3, and 5.

The three answers that ORC-95 asks for:

1. **Estimate.** The full SRD 5.2.1 ruleset is about 9,000 to 10,000 lines
   of TypeScript that a person or an agent writes, in a range of 7,000 to
   12,000. Spell records and tests are extra. Classes are about half of it.
   That is the same order of size as the 2014 Clojure. The gain is not
   fewer lines. The gain is typed content and no ClojureScript compiler.
2. **Facade.** The shape `evaluate(entity, { rules })` to
   `{ built, selections }` describes a second engine without strain, and
   `AvailableSelection` fits unchanged. The shared sheet type
   `BuiltCharacter` does not. It is the 2014 accessor list with 2014 names
   and 2014 key namespaces. The recommendation is that each engine returns
   its own typed sheet, and that the app's own `Sheet` type stays the
   edition-neutral contract.
3. **Engine model.** Keep all three parts: the strict entity as the
   character format, a template of selections and options, and modifiers
   with declared dependencies. Every rule in the slice fits the model. The
   spike found six changes to make in the 2024 engine. *Part 3* lists them.

## What the spike built

| Part | Files | Lines |
|---|---|---|
| Core | `src/core/entity.ts`, `template.ts`, `modifiers.ts`, `build.ts` | 353 |
| 2024 sheet | `src/rules2024/sheet.ts` | 202 |
| 2024 content | `src/rules2024/content/` (6 files) and `template.ts` | 561 |
| Facade | `src/rules2024/evaluate.ts` | 177 |
| Tests | 3 files, 67 tests | 622 |

Lines are code lines: no blank lines and no comment lines.

**The core** has no rules content. `core.test.ts` tests it on a template of
a wagon with cargo. It ports these semantics from the fork:

- The strict entity and the walk over its chosen options
  (`entity.cljc:274-300`).
- Selections and options with the defaults of `selection-cfg` and
  `option-cfg` (`template.cljc:37-87`).
- The active selections for an entity, and `ref` selections that pool
  their counts and options (`entity.cljc:423-480`).
- Prerequisites on options and on selections (`entity.cljc:482-494`,
  `:749-759`).
- Modifiers, deferred modifiers, conditions, and the fold in dependency
  order (`entity.cljc:597-621`, `modifiers.cljc`, `entity_spec.cljc`).
- The count of choices that a selection still needs
  (`entity.cljc:711-747`).

**The slice** is a Fighter from level 1 to level 5 with the Champion
subclass, the Dwarf species, and the Soldier background. It has:

- The background's ability score choice: +2 and +1, or +1 to all three.
- The background's Origin feat, Savage Attacker, as a fixed grant.
- The Fighting Style feat as a feat choice limited to one category.
- Weapon Mastery as a `ref` pool: 3 kinds at level 1 and 4 at level 4.
- The Ability Score Improvement feat at level 4, or another feat that the
  character qualifies for.
- 8 of the 17 feats, all 38 weapons, and all 12 armors.
- Fixed or rolled Hit Points for each level.

**The facade** is `evaluate(entity, { rules: "2024" })`. Its types come from
`@pubdoor/dmv` 0.4.0, as a development dependency for types only.

### How the values were checked

Each expected number in `fighter.test.ts` has its arithmetic in a comment.
The rules behind the arithmetic come from `docs/kb/srd-5.2-rules-delta.md`,
which cites SRD 5.2.1 pages. The spike could not read the SRD PDF, because
this environment blocks `dndbeyond.com`. As a second source, the spike
compared the slice content with the 5e-bits 2024 data: the Fighter features
and their levels, the Dwarf traits, the Soldier background, the 8 feats,
the 12 armors, and the 38 weapons.

The comparison found two differences in the weapons table:

- **Trident.** 5e-bits has 1d6 damage. The slice has 1d8, as the rules
  delta records from SRD 5.2.1 p91. The 5e-bits value is the 2014 value.
- **Sling.** 5e-bits has Piercing damage. The slice has Bludgeoning, which
  is also the SRD 5.1 value. This one is not verified against the PDF.

5e-bits also lists Hide Armor in its light armor category. These are
inputs for ORC-219: the 5e-bits data needs a check against the SRD.

## Part 1: the estimate for the full SRD 5.2.1 ruleset

The full ruleset is 12 classes, 12 subclasses, 9 species, 4 backgrounds,
17 feats, and 339 spells. The table scales what the spike measured. Each
estimate is a judgment from one slice, not a count.

| Part | Measured in the spike | Estimate for the full ruleset | Basis |
|---|---|---|---|
| Core | 353 | 500 to 700 | Add the merge of homebrew into the template, and a cache for the build. |
| Facade and mutations | 177, `evaluate` only | 1,500 to 2,500 | The 2014 facade has 26 functions in 2,751 lines of ClojureScript: `evaluate`, 15 mutations, `autofill`, and the import, export, and homebrew functions. The 2024 facade does not need the `.orcbrew` import. |
| Sheet base | 202 for 42 keys | 700 to 1,000 | Add spellcasting, multiclass rules, equipment, speeds, and senses. The 2014 base and its accessors are `template_base.cljc` (332 lines) and `character.cljc` (885 lines). |
| Classes and subclasses | 136 for 5 levels of one class | 3,000 to 6,000 | See below. |
| Species | 38 for the Dwarf | 400 to 800 | Six of the nine species have a lineage or ancestry choice. Three have spells. |
| Backgrounds | 66 | About 90 | 55 lines are shared. A background is about 8 lines of data. |
| Feats | 168 for 8 feats | 300 to 400 | About 60 lines are shared. Magic Initiate and one Epic Boon need spells. |
| Equipment tables | 106 | 400 to 600 | Add gear, tools, packs, and the starting equipment packages. |
| **Code total** | **1,293** | **About 7,000 to 12,000** | |
| Spell records | 0 | 339 records | Data, not code. Generate them from source data (ORC-219), then correct them. `spells.cljc` is 4,229 lines for the 2014 set. |
| Tests | 622 | About half of the code size or more | The slice has one test line for each two code lines. |

**Classes.** The Fighter content is 136 lines. About half of them are the
class frame: proficiencies, the skill choice, the level helper, and the
Weapon Mastery pool. The other lines hold 9 features and 5 choices. A full
Fighter with the Champion has 8 more features and 7 more feat choices, so
it is about 250 lines.
The Fighter is the simplest class. A spellcaster adds a spell list and a
slot table. Some classes add large option lists: Eldritch Invocations,
Metamagic, and the Wild Shape forms. Thus the estimate is 250 to 500 lines
for each class with its subclass.

**Comparison with 2014.** The 2014 rules in Clojure are `classes.cljc`
(3,147 lines), `options.cljc` (3,492 lines), `template.cljc` (1,573 lines),
`template_base.cljc`, and `character.cljc`. With the facade, that is about
12,000 lines, and the spells are extra. The TypeScript estimate is the same
order of size.

**What decides the cost.** Three things matter more than the line counts:

1. **Checking the numbers.** The slice content took less time to write
   than its expected values took to compute and to compare with a source.
   The 14 golden characters planned for E1 are a large part of the work.
2. **What the spike did not reach.** The spike has no spellcasting, no
   multiclass rules, no starting equipment packages, no mutations, and no
   homebrew. Spellcasting is the largest of these.
3. **Rules that need a new idea.** The rules report lists them: Wild Shape
   with beast data, replacement on level-up, and prerequisites that name
   another option.

**For the E1 tickets (ORC-221).** One class with its subclass and its
golden character is one piece of work of about 400 lines of content and
350 lines of tests. A ticket that holds four classes, as ORC-230 outlines,
is large. The spike supports one class for each ticket after the first.

The spike took one working session. The timebox was two weeks.

## Part 2: the facade

The question is whether the edition-neutral facade from ORC-16 and ORC-24
describes a second engine without strain. The spike typed its `evaluate`
against the 0.4.0 types to find out.

### What fits

- **The call.** `evaluate(entity, { rules })` returns
  `{ built, selections }`. The slice has the same shape.
- **`AvailableSelection`.** The slice fills every field with the documented
  meaning: `key`, `name`, `path`, `actualPath`, `min`, `max`, `remaining`,
  `optionCount`, `selected`, `ref`, `multiselect`, `sequential`, and
  `requireValue`. No field is missing for 2024.
- **Paths.** A choice in the 2024 entity has the same address as in 2014: a
  selection's `actualPath` and an option key. The mutation signatures, for
  example `select(entity, path, optionKey)`, can thus stay. The spike did
  not build mutations, so this is not tested.

### What strains

`BuiltCharacter` has 55 keys. `evaluate.ts` sorts each key into one of
three groups, and the compiler checks that no key is left out.

| Group | Keys | Meaning |
|---|---|---|
| Filled with the documented meaning | 27 | Identity, abilities, saves, skills, proficiencies, Armor Class, Hit Points, speed, attacks per action, traits, feats. |
| Not in the slice | 23 | Spells, inventory, other speeds, and the action lists. The spike gives no evidence for these keys. |
| Does not fit | 5 | `race`, `subrace`, `weapon-modifiers`, `weapons`, `armor`. |

The five keys that do not fit:

- `race` and `subrace`. The 2024 rules have species and no subraces.
- `weapon-modifiers`. The value has the 2014 attack model: `standard` and
  `finesse` numbers and a `dual-wield?` flag. It has no place for a mastery
  property or for a bonus that applies to Ranged weapons only.
- `weapons` and `armor`. Each is an inventory with namespaced 2014 keys,
  for example `orcpub.dnd.e5.character.equipment/quantity`.

Four of the 27 filled keys fit only with a loss:

- **Ability keys.** `AbilityKey` is `orcpub.dnd.e5.character/str`. A 2024
  engine must write the namespace of the 2014 engine in every ability map.
- **`traits`.** `Feature.frequency` holds one amount and one unit. Second
  Wind regains one use on a Short Rest and all uses on a Long Rest. The
  type cannot say that.
- **`feats`.** The value is a list of keys. The 2024 rules need the
  category of each feat, and which feat is the Origin feat.
- **`skill-profs` and `tool-profs`.** Each maps a key to its sources, with
  `"nil"` for no source. That is the print form of a Clojure map.

Two types allow only 2014: `Rules` is `"2014"`, and `Evaluation.built` is
`Built2014`. `StrictEntity` is Transit-JSON to "treat as opaque". The 2024
entity is plain typed JSON.

### What the facade lacks for 2024

The slice returns these values in its own extension, because the shared
type has no key for them: the species, the size, the creature type, the
feats with their categories, the Weapon Mastery choices, the weapon attacks
with their mastery property, the Critical Hit range, the damage
resistances, and features with full use rules.

### Recommendation for ORC-220

1. **Keep the call and the selections as the shared contract.** Give
   `Rules` both editions. Make the result type depend on the edition. The
   app's engine folder picks the engine from the character's `rules` tag.
2. **Do not make the 2024 engine return `BuiltCharacter`.** The type is not
   neutral. It is the 2014 accessor list under a neutral name. Each engine
   returns its own typed sheet.
3. **Keep the app's `Sheet` as the neutral type.** The app already renders
   from its own `Sheet` (`packages/app/src/engine/sheet.ts`, ORC-48), and
   `toSheet` is the one adapter from the 2014 engine. The 2024 engine needs
   a second adapter. The app's `Sheet` then gains what 2024 adds: the
   mastery property, the feat category, and uses with two rest rules.
4. **Plan for the builder, not only for the sheet.** Besides `sheet.ts`,
   five files in `packages/app/src/engine` read 2014 keys: `abilities.ts`,
   `builder-choices.ts`, `equipment.ts`, `spells.ts`, and `description.ts`.
   The 2024 app milestone must give each of them a 2024 counterpart.

## Part 3: the engine model

The question is whether the 2024 engine keeps the strict entity as the
character format, a template of selections and options, and modifiers with
declared dependencies.

**The answer is yes for all three.** Every rule in the slice fits the
model without a new concept in the core:

| 2024 rule | How the model holds it |
|---|---|
| Background ability scores: +2 and +1, or +1 to three | A selection with two options. One option opens two selections. The other option carries three modifiers. |
| A background grants a feat | The background option includes the modifiers and the selections of the feat. A feat is data that several places use. |
| The Fighting Style is a feat | A feat selection limited to one category. |
| A feat, or the Ability Score Improvement feat, at level 4 | A feat selection with no category limit. Each feat option has prerequisites. |
| Weapon Mastery: 3 kinds, then 4 | Two selections with one `ref`. The core adds their counts. |
| Dwarven Toughness: +1 Hit Point for each level | A modifier of `maxHitPoints` that declares `totalLevel`. |
| Defense: +1 Armor Class in armor | A modifier of `armorClass` with a condition on `wornArmor`. |
| Second Wind: 2, 3, 4 uses by level | A feature whose uses read the class level. |
| A Constitution increase raises the Hit Points of past levels | `maxHitPoints` is a derived value. It needs no rule of its own. |
| Fixed or rolled Hit Points | A deferred modifier that reads the value of the level option. |

### The strict entity

Keep it. A character is its choices, and the sheet is computed. The port
makes three changes:

- **One form.** The Clojure engine has a strict entity and a raw entity.
  The split serves Datomic. The port has one form, and its selections are
  arrays, so the order of choices is safe. A JavaScript object does not
  keep the order of keys that look like integers.
- **Plain typed JSON.** No Transit and no namespaced keywords.
- **No edition in the entity.** The envelope carries the `rules` tag, as
  the rules report recommends.

One weakness stays from 2014: the entity is silent about a bad choice. A
choice that the template does not offer gives no modifier and no error. A
chosen option stays applied when its prerequisite fails later. The 2024
`evaluate` should return a list of such problems.

### The template of selections and options

Keep it. The spike found two places where it needs care:

- **A prerequisite that the choice itself changes.** "This feat is not
  taken already" is false for the option that the character has chosen.
  "A different ability from the other increase" must be written on both
  selections. The core must tell "can the character choose this" apart
  from "is this choice still valid". The 2014 core does not.
- **Content is code.** An option holds functions. That is fine for the
  built-in content, and a wrong key or a wrong value type is a compile
  error. Homebrew needs a data format that maps to the same constructors.
  The constructors of the slice are a first word list for that format:
  `set`, `add`, `push`, and `put` for a modifier, `grantFeat`,
  `featSelection`, and `abilityIncreaseOptions`. This is an input for
  ORC-96.

The 2024 rules that replace a choice need nothing from the model. A
Fighter replaces the Fighting Style feat on a level-up and one Weapon
Mastery on a Long Rest. Each is the same selection, chosen again. The
entity does not store a history.

### Modifiers with declared dependencies

Keep them. Explicit declaration costs little. Of the 49 modifier
constructor calls in the slice, 5 declare a dependency. The other calls
append a constant. The 12 derived values of the sheet all declare theirs.

The port adds two guards that the Clojure macros do not need:

- **A read of an undeclared key throws.** The reader that a modifier
  receives knows the declared keys. A missing declaration fails in the
  first test that runs the modifier.
- **A cycle throws and names its keys.** The Clojure sort returns nil.

The types add a third guard: a modifier of a key that the sheet does not
have, or a value of the wrong type, does not compile.

The spike considered recording each read at run time in place of a
declaration. That fails for a read inside a condition, which runs only for
some characters. The guard gives the same safety with a fixed order.

One behaviour of the model is easy to miss, and the port keeps it. A
modifier of a derived key first computes the derived value, then changes
it, and the key is a constant from then on. The dependency order makes
this safe. Defense and Dwarven Toughness both depend on it.

### An addition to consider: provenance

Charnik's rules code returns each value with a trace of its contributions,
so that the app can show why a save is +5. The modifier model can give the
same. Each modifier has an optional `name`, and the fold knows each change
to each key. The spike did not build this. It is a question for ORC-220,
because it changes what `evaluate` returns.

### Changes to make in the 2024 engine

1. One entity form, as plain typed JSON with selections as arrays.
2. Declared dependencies, with the two guards.
3. A list of problems from `evaluate`: unknown choices, and choices whose
   prerequisite fails.
4. Two meanings of a prerequisite: "can choose" and "still valid".
5. One selection for each `ref` pool in the result of `evaluate`. The 2014
   facade returns each occurrence, and the app must add the counts.
6. A data format for content that maps to the modifier constructors
   (ORC-96).

## What the port did not include

| Part of the Clojure core | Why it is not in the spike |
|---|---|
| Datomic ids and their removal (`entity.cljc:28-77`) | The new engine has no Datomic. |
| `to-strict` and `from-strict` (`entity.cljc:82-225`) | The port has one entity form. |
| Homebrew paths (`::homebrew-paths`) | Homebrew is not in the slice. |
| Plugins and the merge of selections (`entity.cljc:628-695`) | This is how 2014 homebrew enters the template. The 2024 design for it follows ORC-96. |
| Path helpers for mutations (`entity.cljc:304-417`) | The spike has no mutations. |
| The sort of selections for display (`combine-selections`) | The app owns the display order. |

## Limits of the spike

- The slice has one class, one species, and one background. It has no
  spells, no multiclass rules, and no equipment beyond worn armor and
  carried weapons.
- The class proficiencies apply for a first class only. The multiclass
  list of a class is different.
- The slice does not apply the rule for armor without training.
- The spike could not read the SRD 5.2.1 PDF. *How the values were
  checked* says what stands in for it.
- The package is a spike. The decisions ORC-220 and ORC-96 can change its
  design before the E1 build (ORC-222) starts.

## Sources

- ORC-95 and the map ORC-218 in the Linear project *2024 engine*.
- [Supporting the 2024 rules](2024-rules-support.md): the decision for
  option E and the recommendation for this spike.
- [SRD 5.2 rules delta](../kb/srd-5.2-rules-delta.md): the rules facts with
  SRD 5.2.1 page numbers.
- The fork `ecfidler/orcpub` at branch `pubdoor`:
  `src/cljc/orcpub/entity.cljc`, `template.cljc`, `modifiers.cljc`, and
  `entity_spec.cljc`, and `engine-js/types/index.d.ts` at 0.4.0.
- Charnik, `src/lib/rules/pipeline.ts` and `core.ts`, read on 2026-11-16
  as a TypeScript design reference.
- The 5e-bits 2024 data, `packages/5e-database/src/2024/en/` in
  `5e-bits/5e-srd-api`, read on 2026-11-16 as a second source for the slice
  content.
