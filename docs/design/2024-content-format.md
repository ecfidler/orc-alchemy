---
type: Reference
title: 2024 content format
description: The 2024 content format - JSON packs, two layers in each record, rules as data with named hooks, the record types and their fields, the value forms and conditions, the loader, the key scheme, the source data, attribution, and monsters - with an example species, background, feat, and spell.
tags: [rules-2024, engine, content-format, design]
status: stable
generated: { by: claude-code/agent, at: 2026-11-23T05:15:00Z }
resource: https://linear.app/orc-alchemy/issue/ORC-96
sources:
  - id: orc-96
    resource: https://linear.app/orc-alchemy/issue/ORC-96
    title: "ORC-96: Decision: the 2024 content format and key scheme"
  - id: spike
    resource: ../reports/2024-engine-spike.md
    title: The 2024 engine spike
  - id: 5e-bits
    resource: ../kb/5e-bits-2024-data.md
    title: The 5e-bits 2024 data as a content source
  - id: rules-delta
    resource: ../kb/srd-5.2-rules-delta.md
    title: SRD 5.2 rules delta for a character builder
  - id: orc-224
    resource: https://linear.app/orc-alchemy/issue/ORC-224
    title: "ORC-224: Import the SRD 5.2.1 data, with attribution"
---

# Purpose

This document records the decisions of ORC-96 for the format of 2024
content.[^orc-96] The owner made the decisions on 2026-11-16, in the
project thread "Settle the 2024 engine decisions". The engine decisions
that it builds on are in ORC-220 and in
[The 2024 engine spike](../reports/2024-engine-spike.md).[^spike]

ORC-223 built the schema, the loader, and the validation in
`packages/engine/src/format/`, and set the final field names in this
document. The schema in `schema.ts` is the authority for each field. A test
loads each example record of this document, so the examples and the schema
agree. The [2024 engine spec](2024-engine.md) is the spec of the engine.
The seven decisions do not change without the owner.

`.orcbrew` stays the format of 2014 content. This format is for 2024
content only.

# The decisions

| # | Subject | Decision |
|---|---|---|
| 1 | File format | JSON. Built-in content and homebrew use the same format. A pack is one file. |
| 2 | Layers | Each record has a display layer and a rules layer. A record is valid without the rules layer. |
| 3 | Rules | The rules layer is data. A record names a hook for a rule that data cannot hold. Homebrew can use a hook but cannot define one. |
| 4 | Keys | A reference is a pack id and a slug, for example `srd52:fireball`. |
| 5 | Source data | A one-time import script converts the 5e-bits 2024 data at a pinned commit. |
| 6 | Attribution | An About page shows the two SRD statements. The built-in pack carries the SRD 5.2.1 statement. |
| 7 | Monsters | A monster is a record type. The SRD 5.2.1 monsters are a separate pack that loads on demand. |

# 1. The pack file

A pack is one JSON file. The built-in SRD 5.2.1 content is a pack like any
other, so the homebrew forms can make each thing that the built-in content
uses. The old app has compiled code for built-in content and EDN for
homebrew. This format removes that split.

A pack has an envelope and one list for each record type.

```json
{
  "format": "alchemy-content",
  "version": 1,
  "rules": "2024",
  "pack": {
    "id": "srd52",
    "name": "SRD 5.2.1",
    "license": "CC-BY-4.0",
    "attribution": "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.",
    "modified": true
  },
  "species": [],
  "backgrounds": [],
  "feats": [],
  "spells": []
}
```

| Field | Rule |
|---|---|
| `format` | Always `alchemy-content`. |
| `version` | An integer. It starts at 1. It increases when a change to the format breaks an older reader. |
| `rules` | Always `"2024"` for now. A 2024 character loads only packs with `"2024"`. |
| `pack.id` | The first part of each reference to a record of this pack. See *The key scheme*. |
| `pack.attribution` | The statement that the license of the content requires. It is optional for homebrew. |
| `pack.modified` | `true` when the content differs from its source. CC-BY-4.0 requires that we say so. |

The record types are `classes`, `subclasses`, `species`, `backgrounds`,
`feats`, `spells`, `equipment`, and `monsters`, and the reference data
`abilities`, `skills`, `languages`, `conditions`, `damageTypes`,
`weaponMasteries`, and `weaponProperties` (ORC-224). A list that is empty can be
left out. To make a complete pack, put each record in the list of its
type. ORC-223 adds a type when the content needs one, for example for
Eldritch Invocations and Metamagic options.

## The schema and the version

One schema, written in TypeScript in `packages/engine/src/format/schema.ts`,
validates a pack and gives the types of the records. The built-in content,
the homebrew forms, and the import of a pack file all use that schema. The
library is Zod 4 (ORC-223). The types come from the schema, each issue has
the path of the bad value, and Zod can write a JSON Schema for the forms.

The loader reads the `version` of a pack before it reads the records.

- If the version is the current one, the loader validates the pack.
- If the version is older, the loader upgrades the pack one version at a
  time, then validates it.
- If the version is newer, the loader refuses the pack and says that the
  app is too old for it.

A record that fails validation does not stop the pack (decided in
ORC-223). The loader keeps the other records and reports the bad record. The
loader returns the pack and a list of issues. Each issue has the path of the
bad value in the file, for example `["feats", 2, "effects", 0, "add"]`, a
message, and what the loader did:

| `dropped` | When |
|---|---|
| `pack` | The file is not a pack, its envelope is not valid, or its version is newer. The loader returns no pack. |
| `record` | A record is not valid, or a second record of the same type has the same key. The loader drops the record. |
| `effects` | A record calls a hook that the engine does not have, or the rules of the record do not convert (see below). The record keeps its display layer and loses its rules layer: `effects`, and `levels` for a class or a subclass. |
| `none` | A field at the top of the pack that is not a record type: the loader skips it. Or a reference that does not resolve (`checkReferences`): the loader keeps the record. |

The loader checks the references of one pack against the packs that load
with it (`checkReferences`). A homebrew pack loads with the built-in pack,
so its references to `srd52` resolve.

The engine loads a pack with `loadContentPack`. After the schema, it
converts each record with the converter of the engine. The converter finds
the errors that the schema cannot find:

- a sheet value that does not exist, or a value of the wrong kind, for
  example a string in an `add`;
- a `uses` on a trait that the record does not have;
- a hook with arguments that are not valid;
- a `uses` in an option of a `selection` (the uses of a trait apply
  whatever the character chooses);
- a `grantFeat` to a feat that is not loaded, or feats that grant each
  other in a loop.

A record with such an error in its effects loses its effects. A record that
still does not convert, for example a background whose Origin feat is not
loaded, is dropped. Then `loadContentPack` checks the references of the
pack. Give it the packs that the pack refers to.

## Names

- A field name and a sheet value use camel case, for example
  `castingTime` and `maxHitPoints`.
- A key, a pack id, a hook name, and a value from a fixed list use
  lowercase words with hyphens, for example `long-rest`.

# 2. Two layers in each record

Each record has two layers.

- **The display layer** has the name, the prose, and the tables. The prose
  of each trait of a species and of each benefit of a feat is in this
  layer, in the `traits` list. The import from 5e-bits fills the layer.
- **The rules layer** has the effects, the uses, and the choices. We write
  it. It is the `effects` field of the record.

A record is valid with a display layer and no `effects` field. The engine
then shows the record with all its prose and applies no effect. The sheet
shows each trait as a feature. This rule matters because the rules
arrive class by class in E1, and the display data arrives in one import.

Some facts are typed fields of the record, not entries in `effects`. A spell
has `level` and `school`. A background has `abilityScores`, `feat`, and
`skills`. The engine knows what each typed field does. For example, the
engine makes the ability score choice of a background (+2 and +1, or +1 to
all three) from `abilityScores`. A homebrew background thus gets the same
choice with no rule of its own. A typed field can hold a choice, written
`{ "choose": 1, "from": ... }`. The `selection` effect uses the same shape
for its count and its options.

## The record types and their typed fields

Every record has `key`, `name`, and the optional fields `source`
(`{ "index": "..." }`), `description`, `traits`, and `effects`. A trait is
`{ "key", "name", "text" }`. The typed fields of each type:

| Type | Typed fields |
|---|---|
| `classes` | `hitDie` (6, 8, 10, or 12), `savingThrows` (two abilities), `skills` (a choice of skill keys), and the optional `primaryAbility` (a list of abilities, or a choice of them), `weaponProficiencies`, `armorTraining`, `tools`, `startingEquipment`, `features`, `table`, and `levels`. |
| `subclasses` | `class` (a reference), and the optional `summary`, `features`, and `levels`. |
| `species` | `creatureType`, `size` (a size, or a choice of sizes), and `speed` in feet. |
| `backgrounds` | `abilityScores` (three abilities), `feat` (a reference), `skills` (two skill keys), `tool` (a reference, or a choice), and the optional `featSpellList` (for Magic Initiate, the class whose spell list the feat uses) and `startingEquipment`. |
| `feats` | `category` (`origin`, `general`, `fighting-style`, or `epic-boon`), `repeatable`, and the optional `prerequisites`. |
| `spells` | `level` (0 to 9), `school`, `classes` (references), `castingTime`, `ritual`, `range`, `components`, `duration`, `concentration`, and the optional `higherLevels`. |
| `equipment` | `category`, for example `weapon` or `gaming-set`, and the optional `cost` (gp), `weight` (lb), `weapon`, `armor`, and `contents` (the items in a pack, as in starting equipment). A `weapon` has `category`, `ranged`, `damage`, `properties`, `mastery`, and the optional `range` and `versatile` (the damage with two hands). |
| `abilities`, `skills`, `languages`, `conditions`, `damageTypes`, `weaponMasteries`, `weaponProperties` | Reference data: `key`, `name`, and the optional `source` and `description`. A skill also has `ability`, and a language has `rare`. The key of an ability is `str` to `cha`, and the key of a mastery property is one of the eight in the SRD. |
| `monsters` | `size`, `creatureType`, `challengeRating`, `armorClass`, `hitPoints`, `speed` (feet for each kind), and `abilities`. ORC-236 adds the rest. |

A feature of a class or a subclass is a trait with a `level`. The `levels`
field is a list of `{ "level": 3, "effects": [...] }`: the effects that the
class or the subclass gives from that class level. The `table` field of a
class is display data: one row for each class level, with
`proficiencyBonus`, `features` (the feature keys of that level), the
optional `columns` (for example `{ "rage-count": 2 }`), and the optional
`spellcasting` (`cantrips`, `preparedSpells`, and `slots`, nine numbers).

A choice in a typed field is `{ "choose": 1, "from": [...] }`. For a tool,
`from` can also be `{ "category": "gaming-set" }`: the equipment records of
that category. An item of starting equipment or of a pack is
`{ "item": ..., "quantity": 1 }`. The item is a reference, or
`{ "chosen": "tool" }` (the tool that the character chose in that typed
field), or `{ "category": "holy-symbol" }` (one item of that category).

# 3. Rules as data, with named hooks

The `effects` field holds a list of effects. Each effect is data that maps
to one constructor of the engine. The word list starts from the
constructors of the spike.[^spike] It leaves out `put`, which the Fighter
slice did not need in data. It has `selection` in place of the two
constructors that make feat and ability choices. It adds `uses` and
`hook`.

| Effect | Meaning |
|---|---|
| `set` | Give a sheet value. |
| `add` | Add a number to a sheet value. |
| `push` | Add an item to a list on the sheet, for example a resistance or a proficiency. |
| `uses` | Give uses and their recovery to a trait of the record. |
| `grantFeat` | Give a feat with its effects and its choices. |
| `selection` | Add a choice with a count and a list of options. Each option has its own effects. |
| `hook` | Call a named rule of the engine with arguments. |

The fields of each effect:

| Effect | Fields |
|---|---|
| `set`, `add`, `push` | The field `set`, `add`, or `push` names the sheet value, for example `{ "add": "initiative", "value": ... }`. `when` is an optional condition. |
| `uses` | `{ "uses": { "trait": "stonecunning", "amount": ..., "recover": [{ "on": "long-rest", "amount": "all" }] } }`. `on` is `short-rest` or `long-rest`, and `amount` is a number or `"all"`. |
| `grantFeat` | `{ "grantFeat": "srd52:alert" }`. |
| `selection` | `{ "selection": { "key": "boost", "name": "Boost", "choose": 1, "from": [options] } }`. An option has `key`, `name`, and optional `effects` and `prerequisites`. |
| `hook` | `{ "hook": "spell-slots", "args": { ... } }`. |

Each effect can have a `name`. The name is the label of the effect in the
contributions that `evaluate` returns (ORC-220). Without a name, the label
is the name of the record or the option. The engine checks each sheet value
name against the values of the built character: `add` needs a number, and
`push` needs a list.

The engine gets the declared dependencies of an effect from its reads, so a
pack does not write them.

## Value forms

Keep the value forms few. If the format gets loops or free arithmetic, it
becomes a programming language. A rule that needs those is a hook. The
format has four value forms:

| Form | Example | Meaning |
|---|---|---|
| A constant | `120`, `"poison"`, `true` | The value. |
| `read` | `{ "read": "proficiencyBonus" }`, `{ "read": "abilityModifiers", "entry": "con" }` | A sheet value. With `entry`, one entry of a sheet value that is a record. |
| `sum` | `{ "sum": [{ "read": "abilityModifiers", "entry": "cha" }, 0], "min": 1 }` | The sum of numbers, and not less than `min`. |
| `steps` | `{ "steps": [[1, 2], [4, 3], [10, 4]], "by": { "read": "classLevels", "entry": "srd52:fighter" } }` | The value of the highest step whose number is at most `by`. Below the first step, 0. |

## Conditions

A condition is the `when` of an effect, or the `test` of a prerequisite.
A prerequisite is `{ "label": "Strength 13+", "test": condition }`. A feat
has `prerequisites`, and so does an option of a `selection`.

| Condition | Meaning |
|---|---|
| `{ "has": "wornArmor" }` | The sheet value is not empty. |
| `{ "has": "features", "item": "srd52:fighter/fighting-style" }` | The list has the item, or an item with that `key`. |
| `{ "atLeast": [a, b] }` | Value a is at least value b. |
| `{ "equals": [a, b] }` | The two values are equal. |
| `{ "not": c }`, `{ "any": [c, ...] }`, `{ "all": [c, ...] }` | Not, or, and. |

The engine adds "not taken already" to a feat that is not repeatable. A
pack does not write it.

## Hooks

A hook is a rule that is a calculation, not a value. It is a TypeScript
function in the engine with a name and typed arguments. A record calls it
by name:

```json
{ "hook": "spell-slots", "args": { "progression": "half" } }
```

The engine has no hook yet (ORC-223). The registry is in
`packages/engine/src/rules2024/hooks/`. Each hook has a name, a schema for
its arguments, and a test. The ticket that adds a hook moves it from this
list of probable hooks to a list of real hooks here. The probable hooks are
a judgment from the spike and from the 2014 code, not a measured list. The
Armor Class hook comes with ORC-225.

- Spell slots: the multiclass slot table, and Pact Magic.
- Armor Class: the best of the formulas that apply, then the shield.
- Wild Shape forms: a list from monster data by Challenge Rating and level.
- Martial Arts: the larger of the weapon die and the Monk die.

The rules for hooks:

1. Only the engine defines a hook. A pack cannot carry code. A shared pack
   would otherwise run the code of another person in the browser.
2. Any pack can call a hook, with its own arguments. A homebrew class can
   thus say "spell slots, half caster" and get the built-in rule.
3. If a pack names a hook that the engine does not have, the loader reports
   the record. The display layer of the record still loads.
4. If homebrew needs a new calculation, add a hook or an effect word to the
   engine. Each pack can then use it.

The cost is that homebrew cannot add a new calculation by itself, for
example a class that uses spell points in place of slots. The owner
accepted that cost.

# 4. The key scheme

A record has a `key` that is unique for its record type in its pack. A
reference to a record is the pack id, a colon, and the key.

| Reference | Record |
|---|---|
| `srd52:fireball` | The spell Fireball of the built-in pack. |
| `srd52:fighter` | The class Fighter of the built-in pack. |
| `hb-7k2m9x:fireball` | A spell with the same key in a homebrew pack. |

The rules for keys:

1. A key has lowercase letters, digits, and hyphens only.
2. A key of the built-in pack starts from the `index` value of the 5e-bits
   record, for example `fighter`.[^5e-bits] The record keeps the upstream
   `index` in `source`, so that a later comparison can match records.
3. The field of a reference gives the record type. `feat` in a background
   refers to a feat. Thus `srd52:shield` can be a spell and also an item of
   equipment without a collision.
4. Do not change a key after a release. A saved character refers to its
   choices by reference.
5. The built-in pack has the id `srd52`. The monsters pack has the id
   `srd52-monsters`.
6. A homebrew pack gets an id when the app creates it. The id does not
   change when the user changes the name of the pack.
7. Always write the full reference, also for a record in the same pack.
8. A trait is not a record. Its key is unique in its record only. An effect
   of the same record refers to the trait by that key.

A 2024 reference cannot collide with a 2014 key. A 2014 key has no pack
prefix. A character has one edition, from the `rules` tag on its envelope,
and loads only the content of that edition.

A feature of a class or a subclass, a trait of a species, and a benefit of
a feat take their key from their name, without the class name:
`srd52:fighter/second-wind`, not `fighter-second-wind`. When two features of
one class have the same name, each key gets the level, for example
`ability-score-improvement-4`.

Three kinds of record have no upstream `index`: Eldritch Invocations,
Metamagic options, and the variants that upstream divides into trait
records.[^5e-bits] Their key comes from the name (`keyFromName` in
`packages/engine/src/format/keys.ts`): lowercase, without apostrophes or
accents, and one hyphen for each run of other characters. "Elven Lineage:
Drow" gives `elven-lineage-drow`.

# 5. The source data

The built-in pack starts from the 5e-bits 2024 data.[^5e-bits] Two
scripts in `packages/engine/scripts/` made it for ORC-224.[^orc-224]

| Script | Reads | Writes |
|---|---|---|
| `import-srd.ts` | A checkout of `5e-bits/5e-srd-api` at the pinned commit. The data is in `packages/5e-database/src/2024/en/`. | `content/srd52.json`, `content/srd52.provenance.json` (the repository, the commit, and the commit date), and `content/NOTICE-5e-bits.md`. |
| `extract-srd-text.ts` | The SRD 5.2.1 PDF, with `pdftotext`. | `src/srd52/fixtures/srd-5.2.1-text.json`: the header of each spell, and the weapon and armor tables of p91 and p92. |

1. The import runs one time. After that, our files are the source. The
   rules tickets and the class tickets add the rules layer (`effects` and
   `levels`) to `srd52.json` by hand, and they correct errors there.
2. Until a ticket edits `srd52.json`, `--check` compares a new run with
   the committed files. The output has no run date, so the same commit
   gives the same files.
3. The script refuses a checkout at a different commit. We do not commit
   the upstream JSON or the PDF.
4. `scripts/srd-corrections.ts` corrects the upstream errors. Each
   correction names its SRD page. A correction stops the import if upstream
   no longer has the known error. It checks a phrase in the text, the wrong
   value of a field, or the SHA-256 of a whole text.
5. `src/srd52/srd52.test.ts` compares the pack with the PDF text: the
   record counts, the spell header fields, and the weapon and armor tables.
   It also checks the page of each correction of a class, a spell, a weapon,
   or an armor. The test stays valid after the rules tickets edit the pack.
6. The import joins a line break inside a sentence, a copy error in the
   upstream text.
7. A spell keeps `castingTime` and `duration` without the flags. The SRD
   prints "1 minute or Ritual" and "Concentration, up to 1 minute". The
   record has `castingTime: "1 minute"` with `ritual: true`, and
   `duration: "up to 1 minute"` with `concentration: true`.

To compare a newer upstream commit with our pack:

1. Change the pin in `import-srd.ts`.
2. In `packages/engine`, run `bun run import-srd <checkout>`.
3. Read `git diff content/`. It shows each difference, and also the rules
   layer that the run removes.
4. Copy the changes that you want into `srd52.json`, and discard the run.

The import leaves out these upstream data:

- Subspecies. The SRD gives each lineage table in the trait text, and the
  choice is rules work (ORC-226). The two Dragonborn traits that upstream
  has only on the subspecies are corrections.
- The multiclass prerequisites (ORC-234) and the spellcasting ability
  (ORC-229).
- The kind of ammunition of a weapon ("Bolt"), and "unless mounted" on the
  Two-Handed property of the Lance. The format has no field for them.

# 6. Attribution

SRD 5.2.1 requires the statement in the pack example above, and it permits
no other attribution to Wizards of the Coast.[^rules-delta]

- The app gets an About page. The page shows the statement of the
  CC-BY-4.0 edition of SRD 5.1 and the SRD 5.2.1 statement, and it says that the data is modified.
- The built-in pack carries the SRD 5.2.1 statement in `pack.attribution`.
- The MIT notice of 5e-bits is in a file next to the built-in packs in the
  repository.

# 7. Monsters

A monster is a record type, `monsters`, in this format. The SRD 5.2.1
monsters are a separate pack file with the id `srd52-monsters`. The app
loads that file only when a feature needs it, for example the Wild Shape
forms. The file is thus not part of the first load.

The work is last in E1, in ORC-236.

# Example records

Each block is one complete record of the pack `srd52`. The values come
from the spike and from the rules delta. They were not compared with the
SRD 5.2.1 PDF for this document, and the prose is shortened. The import
(ORC-224) gives the real values.

## A species

```json
{
  "key": "dwarf",
  "name": "Dwarf",
  "source": { "index": "dwarf" },
  "creatureType": "humanoid",
  "size": "medium",
  "speed": 30,
  "description": "Dwarves were raised from the earth in the elder days by a deity of the forge.",
  "traits": [
    { "key": "darkvision", "name": "Darkvision", "text": "You have Darkvision with a range of 120 feet." },
    {
      "key": "dwarven-resilience",
      "name": "Dwarven Resilience",
      "text": "You have Resistance to Poison damage. You have Advantage on saving throws to avoid or end the Poisoned condition."
    },
    {
      "key": "dwarven-toughness",
      "name": "Dwarven Toughness",
      "text": "Your Hit Point maximum increases by 1, and by 1 again whenever you gain a level."
    },
    {
      "key": "stonecunning",
      "name": "Stonecunning",
      "text": "As a Bonus Action, you gain Tremorsense with a range of 60 feet for 10 minutes. You must be on or touching a stone surface."
    }
  ],
  "effects": [
    { "set": "darkvision", "value": 120 },
    { "push": "resistances", "value": "poison" },
    { "add": "maxHitPoints", "value": { "read": "totalLevel" }, "name": "Dwarven Toughness" },
    {
      "uses": {
        "trait": "stonecunning",
        "amount": { "read": "proficiencyBonus" },
        "recover": [{ "on": "long-rest", "amount": "all" }]
      }
    }
  ]
}
```

Without the `effects` field, this record still shows the four traits with
their text.

`recover` is a list because a 2024 feature can have two rules. Second Wind
has `{ "on": "short-rest", "amount": 1 }` and
`{ "on": "long-rest", "amount": "all" }`.

## A background

```json
{
  "key": "soldier",
  "name": "Soldier",
  "source": { "index": "soldier" },
  "description": "You began training for war as soon as you reached adulthood.",
  "abilityScores": ["str", "dex", "con"],
  "feat": "srd52:savage-attacker",
  "skills": ["athletics", "intimidation"],
  "tool": { "choose": 1, "from": { "category": "gaming-set" } },
  "startingEquipment": [
    {
      "items": [
        { "item": "srd52:spear", "quantity": 1 },
        { "item": { "chosen": "tool" }, "quantity": 1 },
        { "item": "srd52:shortbow", "quantity": 1 },
        { "item": "srd52:arrows", "quantity": 20 },
        { "item": "srd52:healers-kit", "quantity": 1 },
        { "item": "srd52:quiver", "quantity": 1 },
        { "item": "srd52:clothes-travelers", "quantity": 1 }
      ],
      "gold": 14
    },
    { "gold": 50 }
  ]
}
```

This record has no `effects` field. Each fact is a typed field, and the
engine knows the rule for each field. `{ "chosen": "tool" }` is the tool
that the character chose in the `tool` field.

## A feat

```json
{
  "key": "alert",
  "name": "Alert",
  "source": { "index": "alert" },
  "category": "origin",
  "repeatable": false,
  "description": "You gain the following benefits.",
  "traits": [
    {
      "key": "initiative-proficiency",
      "name": "Initiative Proficiency",
      "text": "When you roll Initiative, you can add your Proficiency Bonus to the roll."
    },
    {
      "key": "initiative-swap",
      "name": "Initiative Swap",
      "text": "After you roll Initiative, you can swap your Initiative with one willing ally in the same combat."
    }
  ],
  "effects": [{ "add": "initiative", "value": { "read": "proficiencyBonus" }, "name": "Alert" }]
}
```

## A spell

```json
{
  "key": "fireball",
  "name": "Fireball",
  "source": { "index": "fireball" },
  "level": 3,
  "school": "evocation",
  "classes": ["srd52:sorcerer", "srd52:wizard"],
  "castingTime": "action",
  "ritual": false,
  "range": "150 feet",
  "components": { "verbal": true, "somatic": true, "material": "a ball of bat guano and sulfur" },
  "duration": "instantaneous",
  "concentration": false,
  "description": "A bright streak flashes from you to a point you choose within range and then blossoms with a low roar into a fiery explosion.",
  "higherLevels": "The damage increases by 1d6 for each spell slot level above 3."
}
```

A spell has no `effects` field. The sheet shows a spell and does not compute
its effect.

# Related documents

- [The 2024 engine spike](../reports/2024-engine-spike.md): the engine
  model and the constructors that the effects map to.
- [The 5e-bits 2024 data as a content source](../kb/5e-bits-2024-data.md):
  what the source data has, and its errors.
- [SRD 5.2 rules delta](../kb/srd-5.2-rules-delta.md): the rules facts and
  the license.
- [Supporting the 2024 rules](../reports/2024-rules-support.md): the
  decision for option E.

[^orc-96]: ORC-96: Decision: the 2024 content format and key scheme
[^spike]: The 2024 engine spike
[^5e-bits]: The 5e-bits 2024 data as a content source
[^rules-delta]: SRD 5.2 rules delta for a character builder
[^orc-224]: ORC-224: Import the SRD 5.2.1 data, with attribution
