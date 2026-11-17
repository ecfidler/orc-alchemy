---
type: Reference
title: 2024 content format
description: The decisions for the 2024 content format - JSON packs, two layers in each record, rules as data with named hooks, the key scheme, the source data, attribution, and monsters - with an example species, background, feat, and spell.
tags: [rules-2024, engine, content-format, design]
status: draft
generated: { by: claude-code/agent, at: 2026-11-17T03:45:00Z }
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
---

# Purpose

This document records the decisions of ORC-96 for the format of 2024
content.[^orc-96] The owner made the decisions on 2026-11-16, in the
project thread "Settle the 2024 engine decisions". The engine decisions
that it builds on are in ORC-220 and in
[The 2024 engine spike](../reports/2024-engine-spike.md).[^spike]

The status is `draft` because the document gives the decisions and a first
shape. ORC-221 writes the engine spec, and ORC-223 builds the schema, the
loader, and the validation. The field names in the examples can change in
that work. The seven decisions do not change without the owner.

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
`feats`, `spells`, `equipment`, and `monsters`. A list that is empty can be
left out. To make a complete pack, put each record in the list of its
type. ORC-223 adds a type when the content needs one, for example for
Eldritch Invocations and Metamagic options.

## The schema and the version

One schema, written in TypeScript in `packages/engine`, validates a pack
and gives the types of the records. The built-in content, the homebrew
forms, and the import of a pack file all use that schema. ORC-223 selects
the schema library.

The loader reads the `version` of a pack before it reads the records.

- If the version is the current one, the loader validates the pack.
- If the version is older, the loader upgrades the pack one version at a
  time, then validates it.
- If the version is newer, the loader refuses the pack and says that the
  app is too old for it.

A proposal for ORC-223, not a decision: a record that fails validation
does not stop the pack. The loader keeps the other records and reports the
bad record.

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

A value in an effect is a constant, or a read of a sheet value, written
`{ "read": "proficiencyBonus" }`. The engine gets the declared
dependencies of an effect from its reads, so a pack does not write them.
An effect can have a `name`. The name is the label of the effect in the
contributions that `evaluate` returns (ORC-220). An effect can have a condition, for example "the character wears armor",
and an option can have prerequisites. ORC-223 defines the full list of
value forms and conditions.

Keep the value forms few. If the format gets loops or free arithmetic, it
becomes a programming language. A rule that needs those is a hook.

## Hooks

A hook is a rule that is a calculation, not a value. It is a TypeScript
function in the engine with a name and typed arguments. A record calls it
by name:

```json
{ "hook": "spell-slots", "args": { "progression": "half" } }
```

These rules are probable hooks. The list is a judgment from the spike and
from the 2014 code, not a measured list.

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

Three kinds of record have no upstream `index`: Eldritch Invocations,
Metamagic options, and the variants that upstream divides into trait
records.[^5e-bits] ORC-223 gives them keys by the same rules.

# 5. The source data

The built-in pack starts from the 5e-bits 2024 data.[^5e-bits]

1. A script reads `5e-bits/5e-srd-api` at a pinned commit and writes packs
   in this format. It runs one time. After that, our files are the source.
2. We commit the packs, the script, and a provenance file. The provenance
   file has the upstream repository, the commit, and the date.
3. The script corrects the errors that ORC-219 and the spike found.
4. A test compares the spell header fields and the weapon and armor tables
   with the SRD 5.2.1 text.
5. A later run of the script against a newer commit can print a difference
   report.

ORC-224 is the build ticket.

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
        { "item": "srd52:arrow", "quantity": 20 },
        { "item": "srd52:healers-kit", "quantity": 1 },
        { "item": "srd52:quiver", "quantity": 1 },
        { "item": "srd52:travelers-clothes", "quantity": 1 }
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
