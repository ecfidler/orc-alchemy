---
type: Reference
title: Homebrew forms spec
description: The settled design of the homebrew content forms for M9 - layout, field styling, modifiers added from a list, pickers and tokens, feature uses with a sheet preview, suggested uses for imported content, engine 0.4.0, and the Customize dialog of M5.1 for feats, backgrounds and races, with the guided Custom Origin dialog.
tags: [design, homebrew, forms]
status: stable
generated: { by: claude-code/agent, at: 2026-11-16T20:45:00Z }
resource: https://linear.app/orc-alchemy/issue/ORC-180/map-improve-the-homebrew-content-forms-and-feature-uses
sources:
  - id: orc-180
    resource: https://linear.app/orc-alchemy/issue/ORC-180/map-improve-the-homebrew-content-forms-and-feature-uses
    title: "Map: improve the homebrew content forms and feature uses (the decisions index)"
  - id: builder-notes
    resource: https://linear.app/orc-alchemy/document/notes-regarding-the-content-builder-pages-88f7f6f937ac
    title: Notes regarding the content builder pages (Ethan)
---

# Purpose

This document is the spec for M9 — Homebrew forms. The M9 build tickets in
Linear build what it describes. It collects the decisions of the map
[Map: improve the homebrew content forms and feature uses](https://linear.app/orc-alchemy/issue/ORC-180/map-improve-the-homebrew-content-forms-and-feature-uses).[^orc-180]
Each decision is in full in the resolution comment of its Linear ticket.
This document gives the rules that a builder needs.

The forms are the 13 files in `packages/app/src/components/builders/`. The
look comes from the [Theme spec](theme.md): theme tokens, fonts, controls
and notes. This document adds the layout of a form and the new controls.

When this document and a prototype disagree, this document wins. When this
document says nothing, use the prototype.

M5.1 opens these forms in a dialog in the character builder, to customize
an option for one character. See [Customize](#customize).

## Prototypes

The prototypes are throwaway HTML. Use them as the visual reference for
sizes, spacing and CSS. Copies are in [`prototypes/`](prototypes/). Open a
file in a browser.

| Prototype | File | Artifact | Use this view |
|---|---|---|---|
| Form layout | [orc-184-form-layout-prototype.html](prototypes/orc-184-form-layout-prototype.html) | [Homebrew Form Layouts](https://claude.ai/artifact/Kt417K71V82UgEMwnpQub7) | Layout D with boxed fields |
| Uses | [orc-186-uses-prototype.html](prototypes/orc-186-uses-prototype.html) | [Feature Uses Prototype](https://claude.ai/artifact/NdiRExpv2NHv2AZWSfwLqu) | Variant A |
| Pickers | [orc-190-picker-prototype.html](prototypes/orc-190-picker-prototype.html) | [Homebrew Form Pickers](https://claude.ai/artifact/SExwPCKBNyjijr9Rt8oYuT) | Variant D |
| Subclass spells | [orc-191-spells-table-prototype.html](prototypes/orc-191-spells-table-prototype.html) | [Subclass Spells Table](https://claude.ai/artifact/62HnpM69BkiBjAkSJygLii) | Variant B |

The Artifacts need a claude.ai sign-in. The copies here do not.

The layout prototype is older than the picker prototype. Where it shows a
grid of checkboxes with short names, the picker rules of this document
replace the grid.[^builder-notes]

# Terms

`CONTEXT.md` at the repository root defines the terms of this document:
**Modifier**, **Common modifier**, **Picker**, **Token**, **Uses** and
**Suggested uses**.

In this document, a token is always a pick on a form. A color or size of
the theme is a "theme token". An "ability modifier" is the game value, not
a modifier of a form.

# What each form gets

| Form | Layout and styling | Add a modifier | New controls |
|---|---|---|---|
| Feat | Yes | Yes | Yes, with uses and a feature list |
| Race | Yes | Yes | Yes |
| Subrace | Yes | Yes | Yes |
| Background | Yes | No, all groups show | Yes |
| Class | Yes | No, all groups show | Yes |
| Subclass | Yes | Yes | Yes, with the spells table |
| Magic item | Yes | Yes | Yes |
| Monster | Yes | Yes | Yes |
| Spell | Yes | No | Class list picker only |
| Selection, language, invocation, boon | Yes | No | None. They have no checkboxes. |

A form must not change what it stores, except where this document says so.
A test for each form opens an imported item, saves it, and compares.

# Layout

* One column, about 720px wide.
* The order is: name, description, the base fields of the form (race: size
  and speed), then the modifiers, then Features.
* The label is above its field, in Inter caps.
* Each modifier is a section. Its title is in Inter caps on a section rule.
* Each form keeps the order of its groups of today. Features (monster:
  Actions / features) is always last. This order is the **form order**.

# Leaving a changed form

Added after M9 (ORC-211).

* A form is **changed** when its record is different from the record that
  it started with. The order of the keys does not count. A text field that
  the user empties, a checkbox that the user clears, and a list with no
  picks are the same as a field that was not set. Thus a change that the
  user reverses is not a change.
* Navigation in the app from a changed form opens a dialog: "This feat has
  changes that are not saved. Leave anyway?" with **Stay** and **Leave**.
  The text names the type of the form. A link in the navigation, the
  browser Back button and the **Cancel** link all open it.
* A reload or a close of the tab from a changed form shows the warning of
  the browser.
* **Save** does not ask. A save that fails keeps the guard on.
* The forms have no draft and no autosave.

# Field styling

* **Boxed fields:** an input or a select has a 1px ink border on
  `--paper-raised`. A text area is full width.
* **Selects:** a select is as wide as its text.
* **Add buttons:** an "Add x" button (add a spell, add a feature, add a
  modifier) is full width, with the normal button height and the text on the
  left.
* **Delete:** delete on a row or a feature card is an X button, not a text
  link.
* **Spell rows:** "Unlocks at" shows "Level 3". The spell level shows
  Cantrip, 1st, 2nd, 3rd. On a phone the spell select goes on its own line.
* **Ability score increases (race, subrace):** six boxes. A click anywhere
  in a box opens its select.

# Modifiers

A form always shows its common modifiers. The user adds the other modifiers
from a list.

## Add a modifier

* A full-width "+ Add a modifier" button is at the end of the modifiers.
  It is below a section heading, "Other modifiers", with the same rule as
  the other sections.
* The button shows examples after its label: the names of the first three
  modifiers that are not on the form, in form order, then the number of the
  others. Example: "Skill or Tool Proficiency, Languages, Weapon
  Proficiency and 11 more". If three or fewer modifiers are left, it shows
  only their names.
* The examples are small muted text on the line of the label, and "…" cuts
  text that is too long. The button keeps the height of the other buttons.
  In a button that is narrower than 520px, the examples are on a second
  line and they wrap.
* The examples are the accessible description of the button.
* When no modifier is left to add, the form shows no button and no heading.
* The button opens a modal: a title, a close X, and one list that scrolls.
  The list has the modifiers that are not on the form, in form order.
* Each row has the name, a short example and an "Add" mark.
* A click adds the modifier and closes the modal. Esc or a click outside
  closes it. On a phone the modal fills the screen.
* The modal has no search, no groups, no counts, no footer and no
  multi-select.
* An added modifier goes to its place in the form order, not to the end.
  Thus a new item and an imported item look the same.
* The new section flashes yellow once. The flash has 10px of padding and
  rounded corners.

## Remove a modifier

An added modifier has a "Remove" link on its section rule. Remove clears
the values of the modifier and shows a blue info note with Undo. A common
modifier has no Remove link.

## Imported items

An item opens with every modifier that holds a value shown. A value is a
`true`, a number that is not zero, or a string, list or set that is not
empty. A map of only `false` values is not a value. The old app stores
`false` on a second click, so such maps are frequent.

## Level modifiers

The Modifiers group of the class and subclass forms is a list of rows. Each
row has a type, a level and a value. It stays a row list, and its types are
not in the modal.

* Its full-width button reads "+ Add a level modifier".
* The type select is in order of use: Spell, Armor Proficiency, Weapon
  Proficiency, Damage Resistance, then the other types.

# Controls

Use this table to choose the control for a group.

| The group stores | Control |
|---|---|
| Some items from a list of 7 or more | Picker, with the picks as tokens |
| One number from a short list | Number toggle |
| One text value | Select |
| Some levels | Chips with an add menu |
| Some items from a fixed list of 6 or fewer, with short names | Checkboxes in one row |
| One yes-or-no value | One checkbox |
| A choice ("choose 2 of these skills") | A "Choose n" select, then a picker for the options |

## Picker

* The add button is full width, under the tokens. The text is on the left
  ("+ Add a skill"). The number of options that remain is on the right
  ("15 more").
* The button opens a modal with the list of options.
* The modal stays open after a pick. The picked item leaves the list.
* Done, the X, Esc or a click outside closes the modal. The footer shows
  the number of picks on the form.
* A list with more than about 20 options has a search field: equipment,
  spells, weapons, tools, languages and attunement limits. Shorter lists
  have none: skills, damage types and conditions.
* A long list shows its groups as small headings.

The modifier modal is not a picker. It closes on a click and has no search.

The list of one slot, such as a language of [Custom Origin](#custom-origin),
is not a picker either. It closes on a click. Its rows have a "Choose"
mark, and a list of more than 20 options has a search field.

## Token

* A token is a small box with the name and an X. The X removes the pick.
* Tokens sit on one line that wraps.
* The tokens are in the order of the picker list, not in the order of the
  clicks.
* A long pick, for example a feat sentence, wraps inside its token.
* A token can be a slot that holds one value, as in
  [Custom Origin](#custom-origin). Its name is a button that opens the
  list of the slot. A changed slot is marked, and its X puts the first
  value back.

## Number toggle

A segmented toggle: None / 1 / 2 / 3. Some groups have other numbers. Use
the numbers that the group has today.

## Chips with an add menu

Small chips, each with a number and an X, and a "+ Add" menu. The class
form already has this control for extra cantrips.

## Checkboxes that stay

* In one styled row: spell components, armor proficiency, class saving
  throws, the feat ability increase options, and the base weapon details.
* One checkbox: Ritual, Requires an attack roll, Requires attunement, and
  the feat's saving throw line.

# The forms

## Feat

Always shown: name, description, Prerequisites, Ability Increase Options,
Uses of the feat, Features. The other 14 groups are in the add list.

| Group | Control |
|---|---|
| Prerequisites and race prerequisites | One "+ Add a prerequisite" picker. The races are at the end of the list. It has search when the list has more than about 20 options. |
| Ability Increase Options | Checkbox row, with the saving throw line as one checkbox |
| Skill or Tool Proficiency, Languages, Weapon Proficiency Choice, Hit Points, Speed Bonuses, Initiative Bonuses | Number toggle |
| Armor Proficiency | Checkbox row |
| Weapon Proficiency (improvised), Medium Armor, Misc. Modifiers, Spellcasting | Picker. Each sentence is one token. |
| Damage Resistances | Picker |
| Skill Proficiency or Expertise, Tool Proficiency or Expertise | Picker |

The one prerequisite picker is always shown, because it holds the race
prerequisites, which are a common modifier. For "Uses of the feat" and
Features, see [Uses on a feat](#uses-on-a-feat).

## Race

Always shown: name, description, size, speed, Darkvision, Ability Score
Increases, Languages, Language Proficiency Choice, Damage Resistances,
Spells, Features.

Add list (10): Flying speed, Swimming speed, Armor Class, Weapon
Proficiencies, Armor Proficiency, Tool Proficiency, Damage Immunities,
Skill Proficiencies, Skill Proficiency Choice, Weapon Proficiency Choice.

| Group | Control |
|---|---|
| Armor Class | Select: Normal / 13 + DEX / Always 17 |
| Languages | Picker with search |
| Weapon Proficiencies | Picker with search. "All simple" and "All martial" are first. |
| Armor Proficiency | Checkbox row |
| Tool Proficiency | Picker with search |
| Damage Resistances, Damage Immunities | Picker |
| Skill Proficiencies | Picker |
| Skill, Language and Weapon Proficiency Choice | "Choose n" select, then a picker |

## Subrace

Always shown: name, race, size, speed, darkvision (these three default to
the race), Ability Score Increases, Spells, Features.

Add list (10): Hit Points, Damage Resistances, Damage Immunities, Saving
Throw Advantage, Weapon Proficiencies, Armor Proficiency, Tool Proficiency,
Skill Proficiencies, Skill Proficiency Choice, Languages.

The controls are those of the race form. Hit Points is a number toggle.
Saving Throw Advantage is a picker (15 conditions).

## Background

The form has no "+ Add a modifier" button. An empty background shows five
headings, each with one control.

* **Skill proficiencies:** a picker with no search.
* **Languages:** the None / 1 / 2 / 3 toggle.
* **Tool proficiencies:** "+ Add a tool proficiency" opens a list of six
  sub-selections. A click adds one and closes the list, as the modifier
  list does.
  * "Any artisan's tool", "Any musical instrument" and "Any gaming set" are
    each a token with a 1 / 2 / 3 toggle in it.
  * "Artisan's tools" is a block with its own picker (17 options, no
    search).
  * "Vehicles" (2) and "Other tools" (6) are blocks with a checkbox row.
  * A block has a label and an X. The X removes the block and its picks,
    with no confirmation.
* **Starting equipment:** the Gold field, then one "+ Add equipment" picker
  with search. Its groups are Player's choice (any 1 artisan's tool, any 1
  musical instrument), Clothing, Artisan's tools, Other tools, Holy symbols
  and Other equipment.
* **Features:** the feature list.

If a background has a tool key that no list has, keep the key on save.

## Class

The form has no "+ Add a modifier" button. All groups show.

| Group | Control |
|---|---|
| Saving throws | Checkbox row |
| Ability increase levels | Chips with "+ Add a level". A new class starts with 4, 8, 12, 16 and 19. |
| Spell list | One picker for cantrips and one for each spell level, each with search |
| Skill Proficiency Choice, Skill Expertise Choice | "Choose n" select, then a picker |
| Modifiers | The level modifier row list |

* The "Subclass title" and "Subclass description" fields have the label on
  its own line above the field.
* The Selections help names three examples: Martial Maneuvers, Fighting
  Style and Eldritch Invocations.

## Subclass

Always shown: name, class, the Spells table (paladin, cleric and warlock
only), Casts wizard spells (fighter and rogue only), Modifiers, Features.

Add list (3): Selections, Skill Proficiency Choice, Skill Expertise Choice.

**Spells table.** The section title is "Spells" for a paladin, "Domain
Spells" for a cleric and "Expanded Spells" for a warlock.

* The table has one row for each spell level, 1st to 5th.
* Each row has two spell columns, so the first and second spells line up
  down the table. The column headings carry the text; a slot has no label.
* A spell in a slot is a token.
* An empty slot shows a "+ Add a spell" button. The button opens the picker
  for that spell level, with search. The pick goes to the slot that the
  user clicked.
* The picker closes when the row has two spells. A picked spell leaves the
  list, so one spell cannot be in the two slots of a row.
* A first column shows the class level that gives the spells: paladin 3rd,
  5th, 9th, 13th, 17th; cleric 1st, 3rd, 5th, 7th, 9th. A warlock has no
  such column.
* One help sentence is under the section heading.
* Below about 520px the two slots of a row stack.
* The stored shape does not change: `{spell-level {index spell}}` in
  `:paladin-spells`, `:cleric-spells` or `:warlock-spells`. A row can hold
  zero, one or two spells.

## Magic item

Always shown: name, type, rarity, description, base weapon or armor (when it
applies), base weapon details (a new weapon only), Attunement, Item
properties.

Add list (7): Ability scores, Saving throw bonus, Speed bonus, Damage
resistances, Damage vulnerabilities, Damage immunities, Condition
immunities.

| Group | Control |
|---|---|
| Base weapon, base armor | Select: Any / Specific / New weapon. "Specific" shows a picker. |
| Base weapon details | Checkbox row |
| Requires attunement | One checkbox |
| Attunement limits | Picker with search. No picks means any creature. |
| Damage resistances, vulnerabilities and immunities; condition immunities | Picker |

## Monster

Always shown: the base fields of today (but not the four in the add list),
Saving throws, Skills, Damage
resistances, Damage immunities, Condition immunities, Languages, Actions /
features.

Add list (5): Damage vulnerabilities, Armor notes, Senses, Special traits,
Legendary actions.

The four damage and condition groups are pickers. Languages is a picker
with search.

Actions / features is the feature list, with the monster types (Other,
Action, Legendary Action). The form stores the uses of a monster feature,
but nothing reads a scaled amount on a monster: the engine resolves a
scaled amount only for the features of a character.

## Spell

Layout and styling only, with one change: the class spell lists are one
picker, and a new spell starts with no class. Components, Ritual and
"Requires an attack roll" stay checkboxes.

# Features

The feature list is shared by the race, subrace, background, class,
subclass, feat and monster forms.

* A feature is a card with a name, a type (Action, Bonus Action, Reaction,
  Other), text, and the uses control.
* "+ Add a feature" is a full-width add button.
* The X on a feature that has content opens a confirm dialog: "Delete
  "Hold Breath"?" with Cancel and Delete feature. Content is a name, text,
  uses, or a type other than Other. An empty feature is deleted at once.

# Uses

## Stored shape

Uses are the `:frequency` of a feature: `{:units <unit> :amount <amount>}`.

* The unit is always the full keyword, for example
  `:orcpub.dnd.e5.units/long-rest`.
* A fixed amount is a number.
* A scaled amount is a map with one base: an ability modifier, the
  proficiency bonus, or a level times a number. Each base takes an optional
  "+ n" and an optional minimum.
* For a class or subclass feature, the level is the level of that class. For
  any other feature, it is the character level.
* Level tables ("2 at level 1, 3 at level 3") are out of scope.

Engine 0.4.0 settles the key names of the map (ORC-192). The engine reads
the bases in this order: `:ability`, `:prof-bonus`, `:level`. A map with no
base gives the value of `:plus`, then applies `:min` if the map has it.

| Key | Value | Meaning |
|---|---|---|
| `:ability` | An ability key, bare or qualified: `:wis` or `:orcpub.dnd.e5.character/wis` | Base: the modifier of that ability |
| `:prof-bonus` | `true` | Base: the proficiency bonus |
| `:level` | `true` | Base: a level |
| `:times` | A number. The default is 1 | Multiplies the level. The engine ignores it for the other bases |
| `:plus` | A number. The default is 0 | The engine adds it to the base |
| `:min` | A number. No default | The lowest result. The engine applies it after `:plus`, and only when the map has it |

The engine turns a scaled amount into a number when it evaluates the
character. The sheet gets a plain number.

## Uses control

A segmented toggle None / Fixed / Scaled, under the label "Uses".

* **Fixed:** an "Amount" select with 1 to 20, then 25, 30, 40, 50 and 100.
* **Scaled:**
  * "Equal to": Proficiency bonus, each ability modifier, and a level. The
    level reads "<Class> level × n" in a class or subclass form, and
    "Character level × n" in other forms.
  * "n": only for a level.
  * "Plus": −3 to +5.
  * "Minimum": None, or 0 to 5. When the user picks an ability modifier, the
    form sets the minimum to 1. The user can change it.
* **Recharges:** a segmented toggle Short rest / Long rest / Day / Turn.
  * "Short or long rest" is a short rest.
  * A pack from the old app can have another unit (rest, round, minute,
    hour). The toggle then shows that unit as one more option, "(from the
    pack)", and the form saves it with no change.
  * A pack can have a short unit, for example `:short-rest`. The toggle
    shows it as its rest. The form writes the full keyword only when the
    user changes the uses.

## Preview

* The preview is under the control, with the label "Preview".
* It draws the feature as the sheet does: a use bubble with circles for 8
  uses or fewer, a pool above 8, or plain text for no uses.
* It draws the feature in the sheet section that its type gives.
* The user can click the circles and the pool. Nothing is saved.
* The example character has level 5 and 16 in the ability. The user can
  change both from the preview.
* The preview calls the same functions as the sheet to draw the feature
  and to choose its section, so the two cannot differ there.
* The app computes a scaled amount for the example character with the
  engine's rule. It does not run the engine, because one evaluation takes
  about 100 ms for each change. Two tests guard the rule: one compares it
  with the golden character of the fork, and one with an engine evaluation
  of the same feature.

For scaled uses only, one sentence is under the preview: "Uses equal 5 ×
your paladin level. A level 5 character gets 25." For an ability: "… with 16
Wisdom gets 3". No other sentence shows. The preview shows the rest, and
most users copy content from another source.

## Uses on a feat

* A "Uses of the feat" section has Type, the uses control and the preview.
  It is for the feat's own entry on the sheet. The form writes `:type` and
  `:frequency` on the feat. It is not a modifier: it comes after "+ Add a
  modifier" and before Features.
* A Features section holds a feature list, for a feat with more than one
  part. The form writes `:traits` on the feat.
* A level amount on a feat counts the character level.

## On the sheet

* The engine puts every pack feature in `built.traits`. `engine/sheet.ts`
  sorts them by type: Action to Actions, Bonus Action to Bonus Actions,
  Reaction to Reactions. A feature with no type, or with Other, stays in
  "Features, Traits, and Feats".
* A feature with 0 uses or fewer shows no bubble. It is a plain feature.
* A feature with a unit and no amount shows 1 use, as today.
* The sheet does not record spent uses. That is not part of M9.

# Suggested uses

Most imported features have no uses, because no form wrote them before M9.
The app reads the text of a feature and suggests uses and a type. It uses
fixed text rules in the browser, and no AI model. The app never saves a
suggestion without the user.

## Rules

| The text says | Suggestion |
|---|---|
| "can't use it again until you finish a long rest" | 1 / long rest |
| The same with "short or long rest" | 1 / short rest |
| "a number of times equal to your proficiency bonus … rest" | Proficiency bonus / that rest |
| "a number of times equal to your <ability> modifier … rest" | That ability modifier, minimum 1 / that rest |
| "once / twice / n times per day" | n / day |
| "use it once / twice / three times … rest" | n / that rest |

* The rules do not read "+ n" sums or level amounts.
* A rest phrase alone gives no suggestion. The text must also say "can't
  use again", "number of times", or a count (once, twice, n times).
* "Once per turn" gives no suggestion. A bubble is for uses that a rest or
  another long wait restores. The user can still set Turn by hand.
* If the text matches two rules with different results, it gives a hint,
  not a suggestion.
* A **hint** is text that names uses with no clear amount, for example
  "regain all expended uses".
* **Type:** "as an action", "as a bonus action" and "use your reaction"
  suggest a type. If the text names two types, it gives no type suggestion.
* A "+ n" sum and a level amount after "a number of times equal to" give a
  hint. A "+ n" counts anywhere later in the sentence, but not in
  parentheses, so "(a minimum of once)" is not a sum. A "- n" and "times"
  after the amount count as a sum too.

The rules also read phrases with the same meaning as the table rows. The
text is read in lower case, and ’ is the same as '.

* **Can't use again:** "can't", "cannot" or "can not", then "use it",
  "use this feature", "do so" (or a similar object) "again until you finish
  a" or "complete a" rest. Also "you must finish a <rest> before you can
  use it again".
* **Rest:** "short or long rest" and "long or short rest" are a short rest.
  "Short rest" is a short rest, and "long rest" is a long rest.
* **Number of times:** the rest can be in the same sentence or in the next
  sentence.
* **Per day:** "once", "twice", "thrice", or "n times" (n as a number or as
  a word up to ten), then "per day", "a day" or "each day".
* **Use it n times:** "use it", "use this feature", "use your <name>" or
  a similar object,
  then a count, then a rest in the same or the next sentence. A count for a
  turn, a round or a day is not this rule.
* **Type:** "use your action" and "use an action" are an action. "Use your
  bonus action" and "use a bonus action" are a bonus action. "As a
  reaction" is a reaction. A bare "bonus action" or "reaction" counts as a
  second type, so "as an action or a bonus action" gives no type.
* **Hint phrases:** "regain" or "recover" "… uses", "expended uses", and
  "per day" or "each day" with no count. They give a hint only when no rule
  matches.

Test the rules with a small test pack that has one feature for each rule
and for each case that is not read. Keep the pack in the app's test files.
Do not put it under `fixtures/`, which is a copy of the fork. Do not use a
private pack in a test. The tests of the line in the form and of the Review
uses page use the same test pack.

## In the form

When a feature has no uses and its text gives a suggestion, a yellow line
is under the uses control: The text says "…". Suggested: 1 use, short rest.
[Use this]. One click fills the control. The same line shows for a type,
when the type is Other.

* The lines are under the Uses toggles and above the preview. Uses and type
  each have their own line and their own "Use this" button.
* For a hint, the line has no button: The text says "…" It may name uses,
  but no clear amount. Set the uses by hand.
* Other is no stored type, `""` (the monster's Other) or `:other`.
* The lines show on the monster form too. A type line shows only when the
  type list of the form has that type, so a monster gets no line for a
  bonus action or a reaction.
* The line is the `NoteLine` part of `@orc-alchemy/ui`.

## Review uses page

* The import log says "N features may have uses", with a **Review uses**
  link. Each pack on My Content that has such features has the same link.
* The link opens the Review uses page for that pack.
* The page lists each feature that has no uses and whose text gives a
  suggestion or a hint. A feat is listed too, and its uses go on the feat.
* A row shows the feature under its item, the matched sentence with the
  phrase marked, and the suggestion in the uses control of the form. The
  user can change the suggestion in the row.
* Each row has a checkbox. A row with a suggestion starts checked. A row
  with only a hint shows "No suggestion" and starts unchecked. It becomes
  checked when the user fills its control.
* One toggle checks all rows or unchecks all rows.
* **Save** writes `:frequency` (and `:type`) for the checked rows to the
  stored pack. This is the same save as the form, so the sheet shows the
  bubble and an export has the uses.
* After Save, an unchecked row with a suggestion is **skipped**. The app
  remembers a skipped row in this browser and does not export it. A "Show
  skipped" switch shows the skipped rows again.
* If the user imports the pack again, the key conflict choice of today
  applies. The page adds nothing to it.

The build (ORC-207) settled these points, which the list above does not
state:

* The route is `/content/review-uses/<pack>`. A pack with no rows shows a
  short message, and a pack that is not stored says so. Both link back to
  My Content.
* The features are the `:traits` of a race, subrace, background, class,
  subclass, feat and monster, and the feat's own entry. A class or subclass
  feature is in `:traits`, with its level. A feature with only a type
  suggestion and no uses suggestion or hint gets no row.
* The rows are in the order of the content types on My Content, then by
  item key, then in the order of the features. The rows of one item are
  under its name. A row's controls are named "<Item> <Feature>", for
  example "Tidecaller Song of Courage amount". A feat's own row is
  "<Feat> Feat".
* A row shows the Type select only when the form would show a type line:
  the stored type is Other and the type list of the form has the type. It
  starts on the suggested type. The row has no preview, so a pack with
  hundreds of rows stays quick.
* Save stores the checked rows in one write, with the same build check as
  the form. An unchecked hint row is not skipped. It stays on the page.
* A row with no uses stores nothing, not even its type, and counts as
  unchecked at Save. Uses in the control check the row, and None unchecks
  it.
* A skipped row shows again with "Show skipped". It is marked "Skipped" and
  starts unchecked. If the user checks it and saves, it is not skipped
  any more.
* The skipped rows are in `localStorage` under the key `skipped-uses`, by
  pack name. A row is named by its content type, item key, the place of
  the feature and its name. Delete on My Content forgets the skipped rows
  of the pack. An import does not change them.
* The count "N features may have uses" is of the rows that are not
  skipped, so the hint rows stay in it. In the import log, each pack of the
  file that has rows gets its own line.
* The page does not ask before the user leaves it. Nothing is stored
  before Save, so the page shows the same rows again.

# Engine 0.4.0

The uses need `@pubdoor/dmv` 0.4.0, built in the fork `ecfidler/orcpub`
(ORC-192) and released by Ethan (ORC-193).

* The engine resolves a scaled amount in the path that reads pack features.
  SRD content does not use that path.
* A homebrew feat reads `:frequency` and `:type` for its own entry, and
  passes its `:traits` through the feature path. Before 0.4.0, a homebrew
  feat ignores `:traits`.
* The TypeScript types have the feature `type`. They also have
  `ScaledAmount` and `PackFrequency`, which describe the map form of
  `amount` in a pack. The built `frequency.amount` stays a number.
* The fork has a new fixture pack and a golden character with expected
  values.

A fixed amount works with engine 0.3.2 and needs no engine change. The old
Dungeon Master's Vault does not need to show the new content correctly. It
imports a scaled amount with no error, but its sheet shows the amount
incorrectly and can fail.

# Customize

Added in M5.1 (ORC-134). The builder lets the user make a copy of a
selected option for one character. The copy is stored in the character's
custom content (ORC-133), and other characters do not see it. ORC-134 does
this for feats, ORC-135 for the background, and ORC-136 for the race, with
the same parts. Where the background or the race is different, this
section says so.

## The line under the option cards

* An option card is a toggle, so it holds no other button.
* Under the cards of the selection, each selected option has one line: its
  name, then a small link button.
* The button is **Customize** for a pack item or an SRD option. It is
  **Edit custom** for a copy. For a Custom Origin copy, it is **Edit
  custom origin** (see [Custom Origin](#custom-origin)).
* Each place that picks the option shows the line. For a feat, that is the
  Feats step and the "Ability Score Improvement or Feat" choice of a class
  level. For a background, that is the Background step. For a race, that
  is the Race step.
* The copy shows in the list of cards by its name only, with no badge. The
  original stays in the list.

## The dialog

* The dialog is the ui `Dialog`. The title is "Customize {name}", or "Edit
  custom {type}" for a copy, for example "Edit custom background".
* The body is the type's form, the same form as on My Content. The form
  has no "Option source (pack)" field.
* The footer has **Cancel** and **Save** only. There is no delete button.
* The validator checks the form at each change, as on My Content. The
  problems show in the same way, and Save is disabled while there are
  problems.
* Cancel, Esc and a click outside close the dialog. If the form has
  changes, a dialog asks first: "This {type} has changes that are not
  saved. Close anyway?" with **Stay** and **Close**. The rule for a change
  is the rule of [Leaving a changed form](#leaving-a-changed-form). A
  reload or a close of the tab shows the warning of the browser.
* For a race, a short note shows above the form. It names the optional
  rule "Customizing Your Origin" of *Tasha's Cauldron of Everything*, page
  8. It tells what the rule permits: move the race's ability score
  increases to other abilities, and change its languages and proficiencies
  for others. It also tells that the skill, weapon and tool proficiencies
  are in the "+ Add a modifier" list. The note is in our own words, because
  the book is not SRD content. It is `--ink-muted` text, because it needs
  no action. Only the race has this note.
* If a save of the copy removes picks of the character, a line above the
  form names them. See [The picks that Save removes](#the-picks-that-save-removes).
* The modals of the form open above the dialog, for example "+ Add a
  modifier", the pickers (for a background, also "+ Add equipment" with
  its search) and the delete confirmation. The focus comes back into the
  dialog when they close.

## The first values

* Customize on a pack item opens a copy of the pack item. Each modifier
  that holds a value shows.
* Customize on an SRD option opens with only its name and its description.
  The form shows only the common modifiers. The engine cannot give an SRD
  option as a pack item, so the other values are not copied.
* The description of an SRD feat is the text of the character's feature
  with the feat's name: its description, or else its summary. For
  Grappler this is only the summary, "Restrain a creature you are
  grappling". If the character has no such feature, the description is
  empty.
* An SRD background is different. Its feature has another name (Acolyte
  has "Shelter the Faithful"), so the character has no feature with the
  background's name. But the engine's content list,
  `@pubdoor/dmv/content/backgrounds.json`, has each SRD background with
  the fields of a pack background. Customize on an SRD background opens
  that record: the description (`:help`), skills, languages, tools,
  equipment, gold and features. The summary of a feature becomes its
  description, because the form edits the description.
* The content list does not have each equipment choice of the SRD
  background. For example, it has no holy symbol choice for Acolyte. The
  engine's template has the choice, with a name such as "Starting
  Equipment: Holy Symbol" and its items. The copy gets each such choice
  from the template, with the name after "Starting Equipment: ". The
  engine keys the choice by its name, so the character's pick under it
  stays. Thus a copy of Acolyte with no edits keeps the Amulet on the
  sheet.
* The form has no control for the equipment choices of an SRD background.
  For Acolyte, they are Prayer Book/Wheel and Holy Symbol. They stay in
  the copy as they are.
* An SRD race is also in the engine's content list,
  `@pubdoor/dmv/content/races.json`, in a shape near that of a pack race.
  Customize on an SRD race opens that record in the race form: the
  description (`:help`), size, speed, darkvision, ability score
  increases, languages, weapon proficiencies and features. The summary of
  a feature becomes its description, as for a background.
* The list does not have all of an SRD race. The engine builds a new
  character of level 20 with the race, and the same character with no
  race. The new character has the engine's default class. The record
  gets what only the character with the race has (ORC-138, ORC-244):
  * The skill proficiencies. These are Perception for the Elf and
    Intimidation for the Half-Orc.
  * The damage resistances. These are poison for the Dwarf and fire for
    the Tiefling.
  * The spells, each with the character level that unlocks it. The
    Tiefling has Thaumaturgy at level 1, Hellish Rebuke at level 3 and
    Darkness at level 5. The unlock level is the first level at which the
    character knows the spell.
  * The features that the list does not have. These are Hellish Resistance
    and Infernal Legacy for the Tiefling. The text of a feature is its text
    at level 20, so Infernal Legacy names each of the three spells.

  Thus a copy of a Tiefling with no edits keeps the sheet.
* The list has no ability score increases for the Human. The engine gives
  the Human +1 to each ability with its variant Standard Human. Thus the
  copy of the Human opens with +1 in each of the six abilities, and a copy
  of a standard Human with no edits keeps the scores. For a Variant Human,
  the user must change the increases in the form.
* The copy of an SRD race does not have these:
  * The saving throw advantages and the immunity to magical sleep. The
    race form has no field for them. They stay as the text of a feature,
    for example Dwarven Resilience and Fey Ancestry.
  * The choices under the race, for example the subrace, the variant and
    the extra language of the Human, the tool of the Dwarf and the
    ancestry of the Dragonborn. Save removes the character's picks of
    these choices.
  * What a pick of such a choice gives, for example the breath weapon and
    the damage resistance of the Dragonborn's ancestry.
  * The subraces. A copy never has a subrace (see
    [The picks that Save removes](#the-picks-that-save-removes)).
* If the content list does not load, an alert under the lines says so,
  and the dialog does not open.
* The name is "{name} (Custom)". The user can change it.
* Edit custom opens the copy as it is stored.

## The name and the key

* The key of the copy is the key of its name, without a "-" at the start
  or the end. "Skill Expert (Custom)" gives `skill-expert-custom`.
* A background is different. The engine keys a background by the key of
  its name, and it ignores the stored key (ORC-130; quirk in
  `docs/plan/01-compatibility-contract.md`). Thus the key of a background
  copy is the key of its name, with its "-" at the start and the end
  kept. This is the key that the engine gives. "Sage (Custom)" gives
  `sage-custom-`. The copy is stored under this key, and the pick uses
  it.
* The engine keys a race by its stored key, as it keys a feat. Thus a
  race copy has the key of its name without the dashes: "Dwarf (Custom)"
  gives `dwarf-custom`.
* A name without a letter or a digit has no key. This is true for each
  type.
* The key must not be the key of another option in the character's list:
  the original, a pack item or another copy. If it is, the Name field
  shows a problem and Save is disabled. Thus a save never replaces or
  collides with another option.
* A copy that the character no longer selects does not count. Autosave
  removes it. A save before then replaces it.

## Save

Save does these steps in one change of the character, so autosave stores
them together:

1. Write the copy into the character's custom content, under its content
   type, with its key and the reserved pack name.
2. Move the character's pick from the original to the copy. The choices
   under the pick stay, for example the skill of a feat or the artisan's
   tool of a background.
3. For an edit with a new key, remove the old copy, and move the pick
   again.
4. Remove each pick under the copy that does not resolve. An example is
   a choice that the user removed from the form. Otherwise the sheet
   tells the user to load content for it. This step also removes a pick
   that does not resolve only because its pack is turned off now.
5. For a background, compare the items and the gold of the copy with
   those that the dialog opened with. The equipment choices do not count,
   because the engine does not give them as starting equipment. If the
   items or the gold changed, replace the character's background starting
   equipment with that of the copy. A new pick of a background does the
   same. If they did not change, the inventory stays as it is.

After Save, the line shows Edit custom, and its button has the focus.

## The picks that Save removes

Step 4 removes each pick under the copy that does not resolve. Before
Save, the dialog tells the user which picks these are.

* The app does a test save of the form's record as it is now, with the
  same steps as Save. The picks that the test save removes show on a line
  above the form, in `--warning` text: "Save removes these picks of the
  character: Subrace (Illuskan), Variant (Standard Human)."
* The text gives no reason, because there are two: the copy does not offer
  the choice, or the pack of the pick is turned off now.
* Each pick shows as the name of its choice and, in parentheses, the name
  of its option. A pick under a removed pick does not show.
* The line follows the form. When the dialog opens, the line is correct at
  once. After a change, the line changes when the form has not changed
  for 300 ms, so typing stays smooth. While the form has problems, the
  line stays as it was.
* Customize and Edit custom both show the line. For example, if the user
  removes the artisan's tool choice of a background copy, the line names
  the character's pick of that choice, such as Smith's Tools.
* If the test save removes no pick, the line does not show.
* A race copy never keeps a subrace pick. An SRD race has its subraces in
  the engine, and the copy does not get them. A pack subrace names its race
  by the race's key, and the copy has a new key. Thus Save removes the
  subrace pick, and the line names it. The values of the subrace, for
  example an ability score increase, go from the sheet.
* The line is the same for each type. A feat or a background copy shows
  it when the copy does not offer a choice that the character picked.
* The line follows the form after a short delay. If Save comes before
  the line shows the picks that this save removes, the first Save only
  updates the line, and the dialog stays open. The next Save saves.

## Custom Origin

Added in ORC-138. A guided dialog makes a race copy with the optional rule
"Customizing Your Origin" of *Tasha's Cauldron of Everything*. The dialog
uses our own words, because the book is not SRD content.

### The entry

* **Custom Origin** is the last entry of the race cards. It is a button,
  not a toggle, with a dashed border and the line "Move the bonuses,
  languages and proficiencies of a race".
* The entry opens the dialog. It selects nothing until Save.
* After Save, the line under the cards shows the copy, "{Base race}
  (Custom Origin)", and a button **Edit custom origin**. The button opens
  the guided dialog again, with the earlier picks.
* A Custom Origin copy has only the guided dialog. The line does not
  offer the race form for it. To edit the copy as a race form, the user
  makes a Customize copy of a race instead.

### The dialog

The dialog is one page that scrolls, in the ui `Dialog`, with the title
"Custom Origin". From the top:

1. A note in `--ink-muted` text. It names the optional rule and its book,
   and tells the user to ask the DM first. It tells what the dialog
   changes.
2. The line of the picks that Save removes, as in
   [The picks that Save removes](#the-picks-that-save-removes). For a
   Human with a subrace, it names the subrace and the variant.
3. **Base race:** a select of the races of the race list that the content
   lists have: the nine SRD races and the races of enabled packs. A copy
   is not offered. A new base race resets the picks. Under the select, a
   muted line names the choices of the race that the copy does not keep,
   for example "Subrace, Tool Proficiency" for the Dwarf.
4. **Ability bonuses:** one line for each positive bonus of the base
   race's record: the amount, a select of the abilities, then "{Race}
   gives {Ability}", or "moved from {Ability}" and a **Put back** link.
   The bonuses keep the race's amounts. A subrace's bonus is not a slot,
   and the copy does not have it. An ability that another bonus holds is
   not offered, so two bonuses never go on one ability. An ability that
   the record holds outside its bonuses, such as a negative bonus, is not
   offered either. When the race gives a bonus to
   each ability (the Human), a line says that there is nothing to move.
5. **Languages:** one token for each language of the race.
6. **Proficiencies:** one token for each skill, tool and weapon
   proficiency of the race, then a help line: a skill becomes another
   skill, and a tool another tool. A weapon can become another weapon or
   a tool.
   A section with nothing to swap says so.

A click on a token opens the list of its slot over the dialog, for one
pick. The list closes on a pick, and the focus goes back to the token.
An option that another slot holds is not offered, and nor is a value
that the record holds outside its slots. The race's own value
shows "{Race} gives this". A list of more than 20 options has a search
field. A changed token is marked, and its X, "Put back {value}", puts the
race's value back.

A choice that the race leaves to the user, such as the extra language of
the Human or the skills of the Half-Elf, is not a slot. The copy of an
SRD race does not keep such a choice. The line under Base race names it.

The footer has **Cancel** and **Save**. Save is disabled until a base race
is set and one value differs from the race's. While nothing differs, a
muted line says so. Cancel, Esc and a click outside ask first when the
dialog has changes.

### What a save writes

* The copy is the base race's record with the picks in place of the
  race's values: the ability score increases, the languages, the skill
  and tool proficiencies in `:props` and `:profs`, and the weapons. A
  weapon that becomes a tool goes into the tools. The record of an SRD
  race comes from [The first values](#the-first-values); the record of a
  pack race is its pack item.
* The name is "{Base race} (Custom Origin)". The key follows
  [The name and the key](#the-name-and-the-key): "Half-Orc (Custom
  Origin)" gives `half-orc-custom-origin`.
* The copy has one more key, `:custom-origin`, with the key of the base
  race as a keyword, for example `:half-orc`. The validator, the engine
  and the character file keep it.
* Save uses the steps of [Save](#save). The copy takes the place of the
  character's race. When the race is a copy, the copy goes, so a
  character has one copy. Without a race, Save first selects the base
  race. Thus a new base race in Edit gives a new name and key, and
  replaces the old copy.
* Edit does not store the picks apart. It compares the copy with the
  base race's record now. A value of the race that the copy has, with the
  same bonus, stays on its slot. Each other slot takes the next value of
  the copy that no slot took and that it can take. That value can be one
  that another slot of the race gives. For example, a Half-Orc copy with
  +2 Constitution and +1 Strength shows both bonuses as moved. Thus the
  picks never go out of step with the copy.
* If the base race is not in the race list now, for example because its
  pack is turned off, Edit opens with no base race and a line that says
  so.

# Build order

This is the order in which the M9 build tickets were filed. Linear holds the
tickets, their blocking relations and their status. When this list and
Linear disagree, Linear wins.

1. Pin `@pubdoor/dmv` 0.4.0 and copy the fixtures (ORC-194).
2. Layout and field styling on all 13 forms (ORC-195).
3. The picker, token and number toggle controls (ORC-196).
4. Add a modifier on the feat and race forms (ORC-197).
5. Add a modifier on the subrace, subclass, magic item and monster forms
   (ORC-198).
6. New controls on the feat, race and subrace forms (ORC-199).
7. New controls on the background form (ORC-200).
8. New controls on the class and subclass forms, with the spells table
   (ORC-201).
9. New controls on the magic item, monster and spell forms (ORC-202).
10. Sheet: features by type, and no bubble for 0 uses (ORC-203).
11. The uses control, the preview and delete with confirmation (ORC-204).
12. Feat: uses of the feat and a feature list (ORC-205).
13. Suggested uses: the rules and the line in the form (ORC-206).
14. The Review uses page (ORC-207).

Tickets 2 to 9 do not need the new engine. If the engine release is late,
move the pin to a place before ticket 10.

**Review:** each ticket that changes a page attaches Playwright screenshots
to its PR, light first and then dark.

# Out of scope for M9

* Level tables for uses. No pack in the data needs them, and a pack can
  unlock a feature at a level.
* Recording spent uses on the sheet.
* A suggestion from an AI model.
* Backward compatibility with the old app for content that has scaled uses.
* Magic items in the `.orcbrew` export. They stay out, as in M5.
* The Customize flow. M5.1 added it after M9, on these forms. See
  [Customize](#customize).

[^orc-180]: Map: improve the homebrew content forms and feature uses, <https://linear.app/orc-alchemy/issue/ORC-180/map-improve-the-homebrew-content-forms-and-feature-uses>
[^builder-notes]: Notes regarding the content builder pages, <https://linear.app/orc-alchemy/document/notes-regarding-the-content-builder-pages-88f7f6f937ac>
