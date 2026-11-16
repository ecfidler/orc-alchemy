---
type: Reference
title: The 5e-bits 2024 data as a content source
description: "License, coverage, quality, and structure of the 5e-bits SRD 5.2 JSON, measured against the SRD 5.2.1 PDF, with the ways to consume it."
tags: [rules-2024, srd, engine]
status: stable
generated: { by: claude-code/agent, at: 2026-11-16T04:20:00Z }
stale_after: 2027-02-16T00:00:00Z
sources:
  - id: srd-api
    resource: https://github.com/5e-bits/5e-srd-api/tree/3b6da29a45b3b328c2409cf97a14e2507e291bf8
    title: 5e-bits/5e-srd-api at commit 3b6da29a (2026-11-14)
  - id: srd-api-faq
    resource: https://github.com/5e-bits/5e-srd-api/blob/3b6da29a45b3b328c2409cf97a14e2507e291bf8/apps/docs/docs/faq.md
    title: 5e-srd-api documentation, FAQ for the 2024 rules
  - id: srd-api-db-readme
    resource: https://github.com/5e-bits/5e-srd-api/blob/3b6da29a45b3b328c2409cf97a14e2507e291bf8/packages/5e-database/README.md
    title: 5e-srd-api, packages/5e-database/README.md
  - id: srd-521
    resource: https://www.dndbeyond.com/srd
    title: System Reference Document 5.2.1 (SRD_CC_v5.2.1.pdf)
  - id: open5e
    resource: https://github.com/open5e/open5e-api/tree/bdcddf2b5f7995c42ac89722d8da563346b6744a/data/v2/wizards-of-the-coast/srd-2024
    title: open5e/open5e-api at commit bdcddf2b (2026-11-02), srd-2024 data
---

# The 5e-bits 2024 data as a content source

**Analyzed:** 2026-11-16, for ORC-219.
**Scope:** Facts about the 5e-bits SRD 5.2 JSON, and a comparison of the ways to use it. The last section gives a recommendation for ORC-96. ORC-96 makes the decision.

## Summary

- **License.** We can use the data. The upstream documentation says that the 2024 data comes from SRD 5.2 and that SRD 5.2 has the CC-BY-4.0 license. The code and the JSON structure have the MIT license. The OGL sentence in the database README is about the 2014 data.
- **Coverage.** Each count in ORC-219 agrees with SRD 5.2.1. No record is missing.
- **Quality.** The prose is almost a copy of the SRD. I found 24 records with an error in 716 records that I compared. Most errors are in spell tables and in one spell field.
- **Structure.** Tables, proficiencies, choices, equipment, and spell headers are data. The effect of each feature, feat, and trait is prose. The engine must author these effects by hand.
- **How to consume it.** Use a one-time import script that reads a pinned upstream commit and writes our format. Upstream publishes no npm package.

## Sources and how they were read

| Source | Identity |
|---|---|
| `5e-bits/5e-srd-api` | Commit `3b6da29a45b3b328c2409cf97a14e2507e291bf8` (2026-11-14). Cloned. The data is in `packages/5e-database/src/2024/en/`. |
| SRD 5.2.1 PDF, 364 pages | The copy in `kmfarley11/ez-chars` at `docs/ext/5e2024/SRD_CC_v5.2.1.pdf`. SHA-256 `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87`. This is the same file as in [SRD 5.2 rules delta](srd-5.2-rules-delta.md). |
| `open5e/open5e-api` | Commit `bdcddf2b5f7995c42ac89722d8da563346b6744a` (2026-11-02). Sparse clone of `data/v2/wizards-of-the-coast/srd-2024`. |

**Method.** I extracted the PDF text one column at a time with `pdftotext`. Then a script compared the JSON with the text. For each spell, the script compared the level, school, class list, casting time, range, components, material, duration, and full text. For each other record type, the script looked for each sentence of the JSON prose in the PDF text. I examined each difference by hand. A difference that came from the PDF extraction, for example a word that the PDF divides at a line end, is not in the error lists.

**Not read.** The GitHub API for the upstream repositories was not available in this session. I searched the issue and pull request titles, but I could not read the issue bodies.

## 1. License

### What upstream says

- The root `LICENSE.md` and `packages/5e-database/LICENSE.md` are the MIT license.[^srd-api]
- `packages/5e-database/README.md` says: "The underlying material is released using the Open Gaming License Version 1.0a".[^srd-api-db-readme] This file came from the archived `5e-bits/5e-database` repository. The sentence is older than the 2024 data.
- The 2024 documentation has this statement in its FAQ: "The 2024 API only covers data that can be found in SRD 5.2", and "SRD 5.2 is released under the Creative Commons Attribution 4.0 International license (CC-BY-4.0)".[^srd-api-faq] Commit `fc05487` added the statement on 2026-09-20.
- The same FAQ says that the API has the MIT license and that "the underlying data accessible via the API is supported under the SRD and its license".
- A search of the issues and pull requests in both repositories for "license", "CC-BY", and "creative commons" found no other statement about the 2024 data.

### What this means for us

The JSON has two parts. Each part has its own license.

| Part | Owner | License | What we must do |
|---|---|---|---|
| Rules text and game values | Wizards of the Coast | CC-BY-4.0 | Show the SRD 5.2.1 attribution statement. |
| File structure, field names, and text that 5e-bits wrote | 5e-bits contributors | MIT | Keep the MIT copyright notice with each copy of a substantial part. |

The two licenses are compatible with an MIT project. CC-BY-4.0 has no share-alike condition.

The SRD 5.2.1 legal page gives the attribution statement:[^srd-521]

> This work includes material from the System Reference Document 5.2.1 ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode.

The legal page also says not to add other attribution to Wizards. CC-BY-4.0 section 3(a)(1)(B) tells us to indicate that we modified the material. Converted data is modified material.

Three limits apply:

- Upstream names SRD 5.2, not SRD 5.2.1, and links the 5.2 PDF. We correct the content against SRD 5.2.1, so our attribution names 5.2.1.
- Upstream does not promise that each record is in the SRD. Section 2 found no record that is outside the SRD in the types that the ticket lists.
- This is a reading of the license texts. It is not legal advice.

## 2. Coverage

The 2024 data is 25 JSON files. The counts for the types in ORC-219 agree with SRD 5.2.1.

| Type | File | Records | SRD 5.2.1 | Result |
|---|---|---|---|---|
| Classes | `5e-SRD-Classes.json` | 12 | 12 | Complete |
| Subclasses | `5e-SRD-Subclasses.json` | 12 | 12 | Complete, one for each class |
| Class levels | `5e-SRD-Levels.json` | 287 | | 240 class rows (12 × 20) and 47 subclass rows |
| Features | `5e-SRD-Features.json` | 232 | | 174 class features and 58 subclass features |
| Species | `5e-SRD-Species.json` | 9 | 9 | Complete |
| Subspecies | `5e-SRD-Subspecies.json` | 24 | | 10 Dragonborn ancestors, 3 Elf lineages, 2 Gnome lineages, 6 Goliath ancestries, 3 Tiefling legacies |
| Traits | `5e-SRD-Traits.json` | 68 | | |
| Backgrounds | `5e-SRD-Backgrounds.json` | 4 | 4 | Complete |
| Feats | `5e-SRD-Feats.json` | 17 | 17 | Complete: 4 Origin, 2 General, 4 Fighting Style, 7 Epic Boon |
| Spells | `5e-SRD-Spells.json` | 339 | 339 | Complete. The names are the same set. |
| Mastery properties | `5e-SRD-Weapon-Mastery-Properties.json` | 8 | 8 | Complete |
| Languages | `5e-SRD-Languages.json` | 19 | 19 | Complete: 10 standard, 9 rare |
| Skills | `5e-SRD-Skills.json` | 18 | 18 | Complete |
| Conditions | `5e-SRD-Conditions.json` | 15 | 15 | Complete |
| Equipment | `5e-SRD-Equipment.json` | 182 | | Not counted against the SRD |
| Magic items | `5e-SRD-Magic-Items.json` | 277 | | Not counted against the SRD |
| Monsters | `5e-SRD-Monsters.json` | 341 | | Not counted against the SRD |

The other files hold ability scores, alignments, damage types, equipment categories, magic schools, poisons, proficiencies, and weapon properties.

**Records that the SRD has and the data does not have as records:**

- The Eldritch Invocation options. They are prose in the one feature `warlock-eldritch-invocations`.
- The Metamagic options. They are prose in the one feature `sorcerer-metamagic`.
- The spells that a subclass always has prepared, for example Life Domain Spells. They are a prose table in a feature.
- The Human size choice. See section 3.

## 3. Quality

The check was larger than the sample in the ticket, because a script did the comparison. It compared all 339 spells, all 232 features, all 17 feats, all 68 traits, all 12 subclasses, all 4 backgrounds, the 15 conditions, the 8 mastery properties, the 9 species headers, the 12 class records, and the Fighter and Wizard level tables. That is 716 records and two tables. 24 records have a confirmed error.

### Results by type

| Type | Compared | Result |
|---|---|---|
| Spell header fields | 339 spells | 9 spells have a broken `range` and an empty `components`. All other fields agree. |
| Spell text | 339 spells | 324 are the same as the SRD when punctuation and spaces are ignored. 6 differ only in the order of a stat block or a table. 9 have missing or wrong content. |
| Fighter levels 1 to 20 | 20 rows | No error: proficiency bonus, features, Second Wind, Weapon Mastery. |
| Wizard levels 1 to 20 | 20 rows | No error: proficiency bonus, features, cantrips, prepared spells, spell slots. |
| Fighter and Wizard features | 36 features | No error in the feature text. |
| All features | 232 features, 1,049 sentences | 1 confirmed error. 6 more sentences did not match, and I did not confirm them by hand. |
| Class `spellcasting` text | 8 classes, 131 sentences | 3 confirmed errors. 9 more sentences did not match, and I did not confirm them by hand. |
| Backgrounds | 4 | No error: ability scores, feat, proficiencies, equipment. |
| Feats | 17, all 4 Origin feats | No error in the text. |
| Species | 9 | 1 error. |
| Traits | 68 | The text agrees where upstream copied it. See the note below the error list. |
| Subclasses | 12 | No error in the summary and description. |
| Conditions | 15 | 2 errors. |
| Mastery properties | 8 | No error. |

### Confirmed errors

| Record | Field | Data value | SRD 5.2.1 value |
|---|---|---|---|
| Spells Contagion, Divine Smite, Find Steed, Guidance, Power Word Heal, Power Word Kill, Resistance, Searing Smite, Sorcerous Burst | `range`, `components` | `range` is, for example, `"Touch Component: V, S"`. `components` is `[]`. | Range `Touch`. Components `V, S`. The SRD prints "Component:" for these nine spells, and the upstream parser did not divide the line. |
| Spell Confusion | `description` | The table has 2 rows. | The table has 4 rows. Rows 1 and 7-8 are missing. |
| Spell Divine Word | `description` | The table has 3 rows. | The table has 4 rows. The 31-40 row is missing. |
| Spell Augury | `description` | The Omens table has no "Weal" row. | Weal, for good results. |
| Spell Scrying | `description` | Each of the two tables has 1 row. | The tables have 3 rows and 3 rows. |
| Spell Creation | `description` | The Materials table has 3 rows. | The table has 5 rows. Vegetable matter and precious metals are missing. |
| Spells Prismatic Spray and Prismatic Wall | `description` | Most rows are missing, for example Red, Yellow, Blue, and Violet. | The tables have 8 rows and 7 rows. |
| Spell Control Weather | `description` | The text stops in the middle of a sentence. The three tables are missing. | |
| Spell Control Water | `description` | The text includes the end of Control Weather and its tables. | |
| Class Wizard | `spellcasting.info`, Prepared Spells | "choose two level four spells" | "choose four level 1 spells" |
| Class Wizard | `spellcasting.info`, Spellcasting Focus | "an Arcane Focus" | "an Arcane Focus or your spellbook" |
| Class Cleric | `spellcasting.info` | "oyu" | "you" |
| Feature `bard-subclass` | `description` | "The The College of Lore" | "The College of Lore" |
| Species Human | `size` | `Medium`, with no choice | Medium or Small, chosen when you select the species. The Tiefling record has this choice as `size_options`. |
| Condition Charmed | `description` | "on ability checks to interact socially with you" | "on any ability check to interact with you socially" |
| Condition Frightened | `description` | "the source of your fear" | "the source of fear" |
| Equipment Scholar's Pack | `description` | The list includes a Blanket. | The list has no Blanket. This error was found by chance. Equipment was not checked as a set. |

**Traits.** Upstream divides some SRD traits into one record for each variant, for example `draconic-breath-weapon-acid`. For these records upstream wrote new sentences, so 33 of the 68 trait records have a sentence that is not in the SRD. These sentences are upstream text, not SRD text. I found no rules error in them.

**Not checked.** Monsters, magic items, and equipment were not compared as a set. The structured fields `damage` and `attack_type` on spells were not compared.

### Upstream changes quickly

Seven fix commits changed the 2024 data on 2026-11-12 and 2026-11-13. They include a missing Fighter proficiency, wrong Rogue proficiencies, and a wrong Wizard prepared-spells value. The data that an import reads on one day is not the data of the next week. Thus each import must record the upstream commit.

## 4. Structure

The files have the shape of the API. Each record has an `index`, a `name`, and a `url`. A reference to a different record is an object with the same three keys. The data loads into MongoDB upstream.

### What is data

| Area | Fields |
|---|---|
| Class | `hit_die`, `saving_throws`, `proficiencies`, `proficiency_choices` (choose N from a list), `starting_equipment_options` (nested options with counts and money), `primary_ability`, `multi_classing` prerequisites and proficiencies, `spellcasting.spellcasting_ability`. |
| Class level | `prof_bonus`, the feature list, and `spellcasting` (cantrips, prepared spells, slots for levels 1 to 9). `class_specific` holds the other table columns: `rage_count`, `rage_damage_bonus`, `weapon_mastery`, `bardic_inspiration_die`, `channel_divinity_charges`, `wild_shape_uses`, `second_wind_uses`, `focus_points`, `martial_arts_die`, `unarmored_movement_bonus`, `favored_enemies`, `sneak_attack`, `sorcery_points`, `eldritch_invocations`. |
| Feature | `class`, `subclass`, and `level` only. |
| Background | `ability_scores`, `feat` with a note (for example `Cleric`), `proficiencies`, `proficiency_choices`, `equipment_options`. |
| Feat | `type` (`origin`, `general`, `fighting-style`, `epic-boon`), `prerequisites` (`minimum_level`, `feature_named`), `prerequisite_options`, `repeatable` as a sentence. |
| Species | `size` or `size_options`, `speed`, `type`, the trait list, the subspecies list. |
| Trait | 21 of 68 have `spells` with uses and recovery. 2 have `proficiency_choices`. 1 has `speed`. |
| Spell | `level`, `school`, `classes`, `casting_time`, `ritual`, `range`, `components`, `material`, `duration`, `concentration`. 89 spells have `damage`. 21 have `attack_type`. |
| Equipment | Weapon damage, properties, `mastery`, range, cost, weight. Armor `armor_class` (base, Dexterity bonus, maximum), `str_minimum`, `stealth_disadvantage`. |

### What is prose

- The effect of each class feature and subclass feature. For example, Second Wind is a `description` string. Its use counts are data, but its recovery rule is in the string.
- The effect of each feat. For example, the ability score increase of a General feat is in the string.
- The effect of each trait, except the spells and choices in the table above.
- The options in a feature: Eldritch Invocations, Metamagic, and the spells of a subclass.
- Spell effects: the save ability, the area, and the scaling text.
- Use counts in feature names. The SRD table says "Indomitable (two uses)", and the data says only "Indomitable".

### What the engine must author by hand

1. The rules effect of each of the 232 features, 17 feats, and 68 traits that changes a number or adds a choice on the sheet.
2. The uses and recovery of each feature that has uses, apart from the `class_specific` columns.
3. One record for each Eldritch Invocation and each Metamagic option, and the always-prepared spell lists.
4. The 2024 choices that the data does not model: the Human size, the ability score increase of a background (+2 and +1, or +1 three times), and the species choices that are in prose.

The data gives the engine the names, the levels, the tables, the proficiencies, the equipment, the spell list, and the prose to display. That is the larger part of the typing work, and the smaller part of the rules work.

## 5. How to consume it

| Option | How it works | For | Against |
|---|---|---|---|
| A. One-time import script, commit the output | A script reads an upstream checkout at a pinned commit and writes files in our format. We commit the output and the commit hash. After the import, our files are the source. | Our format has no upstream shape in it. Corrections are plain edits. The build has no network step. | An upstream fix after the import does not arrive automatically. |
| B. Committed snapshot of the upstream JSON, convert at build | We commit the 25 files as they are, and a build step converts them. | The diff against a new upstream commit is easy to read. | We keep about 3 MB of files in a shape that we do not use, 1.3 MB of it monsters. Each correction needs a patch layer on top of the snapshot. |
| C. npm dependency | Not possible. `packages/5e-database/package.json` has `"private": true`, and the npm registry has no `5e-database` package. | | |
| D. Git reference (submodule or fetch at build) | The build reads the upstream repository at a pinned commit. | No upstream file in our repository. | The build needs the network and Git. The upstream repository was moved once already, on 2026-10-02. Corrections need a patch layer. |

Option A fits the data. Section 3 shows that the engine must correct records, and section 4 shows that the engine must add rules to most records by hand. After that work, our files differ from upstream in almost each record, and a second automatic import has little value. Option A can keep one thing from option B: the import script stays in the repository, so a later run against a newer commit can print a difference report for a person to read.

In each case, record the upstream repository, the commit hash, and the date in a file next to the data. Keep the upstream `index` of each record, so that a later comparison can match records.

## 6. Other sources

| Source | Coverage | Shape | License statement | Notes |
|---|---|---|---|---|
| 5e-bits 2024 | Complete for the ticket list | API-shaped JSON, one file for each type | FAQ names SRD 5.2 and CC-BY-4.0. Code is MIT. | Subspecies are records. Level tables are data. |
| Open5e `srd-2024`[^open5e] | 339 spells, 17 feats, 4 backgrounds, 9 species, 24 class rows (classes and subclasses), 352 class features, 331 creatures | Django fixtures: a list of `model`, `pk`, and `fields`. Keys have a document prefix, for example `srd-2024_acolyte`. | The document record lists `cc-by-40`. The code has a "Modified MIT License". | Feat and background benefits are child rows of prose. Level tables are `ClassFeatureItem` rows (1,812). No subspecies rows. Spells have `SpellCastingOption` rows for higher-level casting. Quality was not measured. |
| By hand from the PDF | What we type | Our format from the start | CC-BY-4.0 only | No third-party notice. The cost is high: 339 spells and 232 features of prose, and typing errors of our own. |

Open5e is a possible second source to check a value against. Its fixture shape is further from our needs than the 5e-bits shape, and it has no subspecies records. Authoring by hand gives up text that needs no work for about 95 percent of the spells (321 of 339 have no confirmed error).

## Recommendation for ORC-96

1. **Use the 5e-bits 2024 data as the start of the built-in content.** The license permits it and the coverage is complete.
2. **Consume it with option A.** Write a one-time import script. Pin commit `3b6da29a45b3b328c2409cf97a14e2507e291bf8` or a later one. Commit only the converted files and a provenance file. ORC-224 owns this work.
3. **Do not adopt the upstream schema.** It has the shape of an API: `url` fields, reference objects, and prose effects. Design the content format for the engine, and treat the upstream files as input to a converter.
4. **Keep the upstream `index` as the start of the key scheme.** The values are lowercase words joined by hyphens. A class feature has the class as a prefix, for example `fighter-second-wind`. A subclass feature has the subclass as a prefix, for example `champion-improved-critical`. The values are unique in each file but not across files, so a key needs the record type too. ORC-96 must decide the keys for records that upstream does not have: invocations, Metamagic options, and the variants that upstream divides into trait records.
5. **Plan for two layers in the format.** One layer is display content that the import fills: names, prose, tables. The other layer is rules that we author: effects, uses, choices. The format must let a record have prose and no rules, because the rules arrive class by class in E1.
6. **Correct the known errors in the import.** Fix the 9 `range` and `components` values in the script. Fix the 9 spell tables and the other records in section 3 by hand from the SRD. Then run a comparison against the PDF text as a test, at least for spell header fields.
7. **Add the attribution with the content.** Show the SRD 5.2.1 statement in the app, and say that the data is modified. Keep the 5e-bits MIT notice in the repository next to the data.

[^srd-api]: 5e-bits/5e-srd-api at commit 3b6da29a (2026-11-14)
[^srd-api-faq]: 5e-srd-api documentation, FAQ for the 2024 rules
[^srd-api-db-readme]: 5e-srd-api, packages/5e-database/README.md
[^srd-521]: System Reference Document 5.2.1 (SRD_CC_v5.2.1.pdf)
[^open5e]: open5e/open5e-api at commit bdcddf2b (2026-11-02), srd-2024 data
