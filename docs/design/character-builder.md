---
type: Reference
title: Character builder spec
description: The settled design of the character builder of Alchemy 5e - ten steps on a step rail, marks for the picks that are left, the summary card, the control for each kind of selection, the Name, Class, Background, Race, Abilities and Proficiencies steps, the question before a change removes picks, what a 2024 builder changes, and the run order of the build tickets.
tags: [design, builder]
status: stable
generated: { by: claude-code/agent, at: 2026-11-27T05:23:26Z }
resource: https://linear.app/orc-alchemy/issue/ORC-327/map-character-creation
sources:
  - id: orc-327
    resource: https://linear.app/orc-alchemy/issue/ORC-327/map-character-creation
    title: "Map: Character creation (the decisions index)"
---

# Purpose

This document is the spec for the project "Character creation" of
Alchemy 5e. The build tickets in Linear build what it describes. It
collects the decisions of the map
[Map: Character creation](https://linear.app/orc-alchemy/issue/ORC-327/map-character-creation).[^orc-327]
Each decision is in full in the resolution comment of its Linear ticket.
This document gives the rules that the build tickets need.

The builder of today is a row of step buttons, one grid of option cards
for each selection, and the full sheet beside them. This project makes
the builder a stepper in a new order. It uses the controls and the rules
of the [Homebrew forms spec](homebrew-forms.md). No part of the page
moves when a pick changes.

The look comes from the [Theme spec](theme.md).

When this document and a prototype disagree, this document wins. When this
document says nothing, use the prototype.

## Prototypes

The prototypes are throwaway HTML. Use them as the visual reference for
sizes, spacing and CSS.

| Prototype | File | Artifact | Use this view |
|---|---|---|---|
| Stepper | [orc-330-stepper-prototype.html](prototypes/orc-330-stepper-prototype.html) | [Stepper](https://claude.ai/artifact/S7XmF7v6eDW6p4ajEr6v9Y) | Variant D, which opens |
| Ability scores | [orc-331-ability-scores-prototype.html](prototypes/orc-331-ability-scores-prototype.html) | [Ability Scores](https://claude.ai/artifact/7yMJdHoN2zGcvSNkuWxhEn) | Variant C, which opens |
| Class step | [orc-336-class-step-prototype.html](prototypes/orc-336-class-step-prototype.html) | [Class Step](https://claude.ai/artifact/Vks5RhidhXGkAwNgTDvqE6) | Variant D, which opens, with "After a pick, the row stays open" |
| Race and Background | [orc-338-list-panel-prototype.html](prototypes/orc-338-list-panel-prototype.html) | [Race and Background List](https://claude.ai/artifact/Nffs7tRwhjH4Z9J3wQERBT) | Variant B, which opens |

The Artifacts need a claude.ai sign-in. The copies here do not.

Do not copy these parts of the prototypes:

* The stepper prototype is older than the Proficiencies step. It shows
  nine steps, and its summary card has fewer lines than
  [The summary card](#the-summary-card).
* The "Add a class" dialog of the Class step prototype shows the detail
  of a class in a panel beside the cards. See
  [A second class](#a-second-class).
* The rules data of each prototype is a small sample. The races and the
  backgrounds of "Vale of Ash" are invented.
* The prototypes draw the pixel icons from a copy of the data. Use
  `PixelIcon` of `packages/ui`.

# Terms

`GLOSSARY.md` at the repository root defines the terms of this document:
**Step**, **Step rail**, **Left mark**, **Summary card**, **Detail
panel**, **Class block** and **Choice row**. It also defines **Picker**,
**Token** and **Stuck note**.

In this document:

* A **selection** is one choice that the engine offers, with its options
  and its minimum and maximum number of picks.
* A **pick** is one option that the player took in a selection.
* The **main pick** of the Class, Background and Race steps is the
  class, the background or the race.
* A **modal** shows the detail of one option at the center of the page,
  over the page. A **dialog** holds controls: a list, the class cards or
  a question. The two are the ui `Dialog`.
* A **source** is the class, the background, the race or the feat that
  gives a selection.

# Scope

* This document is for a 2014 character, which the engine `@pubdoor/dmv`
  builds. [What a 2024 builder changes](#what-a-2024-builder-changes)
  lists the parts that a later 2024 builder replaces.
* The engine does not change.
* The route stays `/build/{id}`.
* The Customize dialog and the Custom Origin dialog of the
  [Homebrew forms spec](homebrew-forms.md#customize) do not change. Only
  the buttons that open them move.
* The Level up wizard is a later project.

# General rules

## No layout shift

A pick must not move the other parts of the page.[^orc-328]

* A mark, a count or a hint has a fixed place. The place is there before
  the mark shows.
* A list, a detail panel and the strip of the ability score control keep
  their size when their content changes.
* A dialog shows the detail of an option, the options of a long
  selection and each question. A dialog is over the page and takes no
  space in it.
* A text that comes and goes shows in the status toast of the
  [Sheet interactivity spec](sheet-interactivity.md#the-status-toast).
  The builder page gets the same toast.
* A control that cannot be used stays in its place, disabled.
* A part that the player opens can grow the page below the part. The
  open of a choice row and the "By level" hit points are such parts.
* The main pick of the Background and Race steps is the one exception.
  After the pick, a block takes the place of the list and the panel.

Each build ticket checks this with a test that measures the part before
and after the change.

## Marks, not sentences

The builder does not say in a sentence how many picks are left.[^orc-330]

* The "Still to do" list and the line "Every choice is made." go.
* A **left mark** is a yellow inline note with a count: "2 left". It
  shows on the step in the rail as the number only, and at the right of
  the heading of each selection.
* A selection with too many picks has a red mark, "Remove 1". The step
  in the rail shows the red mark too.
* A selection with no pick left shows a check icon and "Done".
* The three marks have the same fixed place at the right of the heading.
* The rail counts each pick one time, on the step where the player
  makes the pick.

## Text

* An option shows only its name where the player picks it. The full
  text of an option is in a detail panel or in a dialog.[^orc-332]
* Do not add text that repeats what the page shows beside it.
* A heading names the source when two sections of a step have the same
  name: "Skills: Fighter", "Skills: Half-Elf".

## A change that removes picks

A change that removes picks asks first.[^orc-333] [^orc-335]

* The question is the ui `AlertDialog`. Its title names the change:
  "Replace Half-Elf with Dwarf?", "Lower Fighter to level 3?", "Remove
  Rogue?".
* The body is the line "These picks go:" and a list. Each row has the
  step or the level at the left, and the selection and the pick at the
  right: "Proficiencies", "Skills: Perception, Stealth".
* The buttons are Cancel and the action. The table below gives the
  action of each change.
* A change that removes no pick asks nothing.
* After the action, the builder removes those picks from the entity
  before it gives the new pick to the engine. The step that had a
  removed pick shows its new count.
* There is no undo and no toast for the change.

These changes ask:

| Change | Picks that go | Title | Action |
|---|---|---|---|
| A different class in the place of a class, at each level | Each pick of the class on each step | "Replace Fighter with Rogue?" | Replace |
| A lower level | The picks of the levels that go | "Lower Fighter to level 3?" | Remove |
| Remove a class | Each pick of the class on each step | "Remove Rogue?" | Remove |
| A different background or race | Each pick of the old one on each step | "Replace Half-Elf with Dwarf?" | Replace |
| A background or a race that gives a skill, a language or a tool that the player picked for a different source | Those picks | "Change to Acolyte?" | Change |

When one change is in two rows, the dialog lists the picks of the two
rows, and the action is Replace.

The engine keeps some picks in a selection at the top of the
character, such as the languages at `languages` or the Expertise at
`skill-expertise`. The option that opens the selection, such as the
High Elf or the Rogue, does not hold these picks. One rule finds the
picks that the old option accounts for:[^orc-354]

* After the change, a selection keeps as many picks as its max. The last
  picks over the max go, but only as many as the change adds over the
  max.
* A selection that the change closes, because no source of it stays,
  loses each of its picks, also when it had more picks than its max
  before the change. The engine then does not give the selection, or
  gives it with a max of 0, as the selection at `feats`.[^orc-353]
* Thus a shared selection that gets smaller asks only about the picks
  that cannot stay. A High Elf acolyte with two of its three languages
  picked keeps the two when the subrace changes, and the question asks
  nothing.
* A new option that opens the same top-level selection keeps the picks
  of the old option, and the question does not list them. A High Elf
  that becomes a Human keeps its extra language: the Human gives one
  language pick too, so the selection has a max of 1 and 1 pick. The
  engine does not record the source of a pick, so the builder cannot
  tell the two picks apart. This is the accepted behaviour.[^orc-353]
* An Expertise row names the skills, such as "Expertise: Stealth,
  Perception", not the option "Two Skills". The row names the option
  only when no skill of the option is picked.

The last row is the way out of the dead end of the research:[^orc-329]
a Cleric that has Insight and Religion, and then takes Acolyte. The
engine must never get the two picks together. The builder finds the
picks that go from the fixed proficiencies of the new option, before the
engine gets the change.

## A pick that the character cannot take

* The builder reads the prerequisites of each option. An option that the
  character cannot take shows as not available, with the reason.[^orc-332]
* An option that gives only what the character already has shows as not
  available. The reason names the source: "From Acolyte".
* On an option card, the name is dimmed and the reason is small text
  below the name. In a list or a picker, the row has the lock icon, the
  name is dimmed and the reason is small text at the right. In a detail
  panel, the reason is beside the disabled Choose button: "Not
  available. It needs the class Paladin."
* A refusal of the engine that still occurs shows in the status toast,
  as an error: on the danger red, with an X to dismiss it.[^orc-372] The
  refusals of a class level are errors too.
* The "Custom" option of the engine does not show. If an imported
  character has it, it shows, with its lists in pickers.

## A pick that is on its way

A pick must show in less than 100 ms on a desktop (ORC-369). Some picks
can take more time on a slow device, so the button of the pick shows
the pick at once.

* The button that the user clicked shows the pressed look and is
  `aria-busy` at once: an option card, a row of a list or a picker, the X
  of a token, or the Choose or Change button of a list that closes on
  the pick. The pressed look is the solid fill and a move of 1px down. It
  moves no other part of the page.
* While a pick from a picker list is on its way, the add button of the
  picker is busy too, so the busy look stays when the list closes first.
* The builder makes the pick after the next paint. The pick and the end
  of the busy state show in one render.
* A second click on the same option while its pick is on its way does
  nothing.
* A control with no busy look picks at once: the box of a spell and the
  Alignment select.
* A pick that asks first when it removes picks (the race, the subrace,
  the background, the subclass and a class choice of one pick) does not
  wait for a paint and has no busy look. It plans the change first. A
  busy look for these picks and for the spell boxes is ORC-376.

# The page

From the top, the builder page has the action row, the step rail, and
two columns: the open step at the left and the summary card at the
right.

## The action row

The action row stays as the [Theme spec](theme.md#action-row) gives it:
Back to List, the save status, Save and Done.

## The step rail

The step rail is a row across the top with one button for each
step.[^orc-330]

| # | Step | Holds |
|---|---|---|
| 1 | Name | The character name |
| 2 | Class | The classes, their levels, the choices of the levels, the hit points |
| 3 | Background | The background |
| 4 | Race | The race and its choices |
| 5 | Abilities | The ability scores |
| 6 | Proficiencies | Skills, expertise, languages and tools from each source |
| 7 | Feats | The feats |
| 8 | Spells | The spell selections and the prepared spells |
| 9 | Equipment | The starting equipment, the inventory and the hands |
| 10 | Description | Alignment and the other description fields |

* Each button shows the number and the name of the step. The open step
  has a strong underline and `aria-current="step"`. The rail is a `<nav>`
  with a list.
* The stepper is free. Each step opens at any time, and no step is
  locked.
* A step with picks left shows its left mark after its name.
* A step with no selection for this character stays in the rail,
  dimmed. It opens, and it shows one line: "This character has no feat
  to pick." or "This character has no spell to pick."
* The Spells step is not such a step when a class of the character
  prepares spells. The step then has spells to prepare.
* The rail does not wrap. When it is wider than the page, it scrolls
  sideways, and the open step scrolls into view.
* The step title is an `<h2>` with "Step 4 of 10" at its right.
* Back and Next are below the step. Next names the step that follows:
  "Next: Background". The Name step has no Back. The Description step
  has "Go to the sheet" in the place of Next.
* The `?step=` value of the URL is the step name, as today. The link of
  the Spells panel still opens Spells.

The step that opens:[^orc-333]

* A new character opens on Name.
* The Edit button of a sheet opens the first step with a left mark or a
  red mark. If no step has a mark, it opens Class.

## The summary card

A summary card takes the place of the sheet preview.[^orc-330] It is a
narrow column, 250px wide, at the right of the step. It stays in view
when the step scrolls.

The card has the same lines on each step:

| Line | Value |
|---|---|
| Name | The character name, large |
| Class | Each class with its level: "Fighter 3, Rogue 1" |
| Level | The character level |
| Background | The name |
| Race | The name, with the subrace |
| Hit points | The maximum |
| Armor Class | The value |
| Speed | The value |
| The six abilities | The total and the modifier of each, three in a row |

* A line with no value keeps its place and shows nothing at the right.
* When the character has no name, the Name line shows "Unnamed
  character", muted.
* When a value is too long for its line, the line cuts it with "…" and
  stays on one line. The `title` of the value has the full text.
* When the character has no race, the Speed line is empty.
* When the character has no class, the Level line and the Hit points
  line are empty.
* The card has no control but the button below it.
* The button "Open the full sheet" is below the card. It opens the
  sheet in a panel at the right side, over the builder. The panel shows
  the sheet as the preview of today does: the play controls cannot
  change. The panel has a Close button, and Escape and a click outside
  close it.
* When the page is narrower than 860px, the card does not show. A Sheet
  button is between Back and Next, and it opens the same panel. Under
  720px the panel has the full width.[^orc-353]
* The bound comes from a measure. Beside the app rail and the card, the
  step is 522px narrower than the page. The controls of a step need
  323px: the ability score boxes are three in a row from that width. At
  860px the step is 338px wide. From 720px to 859px, with no card, the
  step is 476px to 615px wide.[^orc-353]

# The control for each kind of selection

One rule gives the control of a selection.[^orc-332]

| The selection | Control |
|---|---|
| The class | Class cards and a modal. See [The Class step](#the-class-step). |
| The background, the race | A list with a detail panel. See [The Background and Race steps](#the-background-and-race-steps). |
| The subclass | A dialog with a list and a detail panel |
| 6 options or fewer | Option cards |
| 7 options or more, more than one pick | The ui `Picker`, with the picks as tokens |
| 7 options or more, one pick | A Choose button that opens the ui `ListModal` with the mark "Choose". After the pick, the row shows the pick and a Change button. |
| A spell selection | Its picks by level and an "Add spells" button that opens a popup with the parts of the Spells panel. See [The Spells and Equipment steps](#the-spells-and-equipment-steps). |
| An inventory list | One "Add items" button for all the lists. See [The inventory lists](#the-inventory-lists). |
| The hands, the prepared spells | As today |

* An option card shows only the name. It is a toggle, as today.
* A picker and a list have a search field above 20 options, as in the
  homebrew forms.
* In a picker, the add button is right under the heading of the
  selection, and the tokens of the picks are under the button. The line
  of the tokens keeps the place of the most picks, so a pick does not
  move the page below.[^orc-371]
* A picker whose selection has its maximum takes no more picks. Its add
  button is disabled but keeps the focus, and it shows "Remove a choice
  first." in place of the count, also as its description and tooltip.
  In its list, each option that is not picked is locked with the same
  reason, as the boxes of the "Add spells" popup. The tokens keep their
  X, and a remove enables the button again.[^orc-370]
* The selections that a pick opens are flat sections below the main
  pick. Each has its own heading and its own mark. Do not nest a block
  in a block, and do not use a rule at the left.
* A selection keeps its control when the number of its options changes
  while the step is open.

# The Name step

The Name step has one field, the character name.[^orc-333]

* The field is a ui `TextInput` with the label "Character name".
* For a new character, the field has the focus. Enter goes to the Class
  step.
* The name is optional. An empty name has no mark.
* The Description step has no name field.

# The Class step

The player picks the class, sets the level, and makes the choices of
the levels.[^orc-335] [^orc-336] All of the Class step of today is
replaced.

## A character with no class

A new character has no class.[^orc-333] The standard scores stay. It has
no class equipment.

* The Class step shows the left mark "1 left" and the class cards.
* The sheet, the summary card and the full sheet panel must show a
  character with no class. The class line is empty, the level is empty,
  and the hit points are empty.
* On the sheet, the Hit points box and the Hit dice box of a character
  with no class show no number and open no popup.
* The engine accepts a character with no class.[^orc-329]

## The class cards

* The cards use the full width of the step: 6 in a row, and 3 in a row
  when the part is narrower than 560px.
* A card shows the class icon at 32px and the name. The
  [Theme spec](theme.md#controls) has the icon of each SRD class. A class
  with no icon, for example a homebrew class, shows the name only, at
  the same card size.
* A click on a card opens the class in a modal at the center of the
  page. A click does not pick the class.
* The modal shows the description, the hit die, the saving throws, the
  armor and weapons, the number of skill picks, the subclass with its
  level, and the features table. The table has the column headings
  "Level" and "Features".
* The modal has the button "Choose {class}" with the check icon. It
  makes the pick and closes the modal.
* The content of the modal scrolls. The button is in a row at the bottom
  of the modal that does not scroll, so it stays in view. The modals of
  Change and "Add a class" have the same row.[^orc-367]
* The width of the part counts, not the width of the page, as for the
  list with a detail panel. Each card has the same size, also a card with
  no icon.[^orc-349]
* The facts and the features table come from a trial character that the
  engine builds with the class: at level 1 for the facts, and at each
  level from 1 to 20 for the table. The same rules thus give the text of
  an SRD class and of a pack class. The table shows the choices of each
  level, the features that the character has first at the level,
  "Spellcasting" or "Pact Magic" at the first level with spell slots, and
  "Extra Attack" when the number of attacks goes up. It does not show
  the spells known of each level. The table shows when it is made, after
  the facts.[^orc-349]
* The description of a pack class is the description of its record. The
  engine has no description of an SRD class, so the app has one sentence
  for each.[^orc-349]
* The facts are "Hit die", "Saving throws", "Armor, weapons", "Skills"
  and "Subclass". Skills gives the number and the options: "Two of
  Athletics, History", or "Three of your choice" when the class has all
  the skills.[^orc-349]

## The class block

After the pick, each class is a **class block**.

* The header has the icon, the name, the level control, and the ghost
  buttons About and Change.
* About opens the modal of the class, with no Choose button.
* Change opens the class cards in a dialog. A click on a card opens the
  modal of that class, with the button "Change to {class}". The new
  class starts at level 1. See
  [A change that removes picks](#a-change-that-removes-picks).
* The level control is a minus button, a number field and a plus
  button. The field takes 1 to 20. The buttons have an `aria-label`.
* The body has three sections, in this order: Choices, Hit points,
  "Also choose".
* The dialog of Change does not show the classes of the character. After
  a change, the focus goes to the Change button of the block. After
  Cancel of the question, the focus goes to the Change button of the old
  class.[^orc-349]
* A typed level counts at Enter and when the field loses the focus.
  After Enter the focus stays in the field. Up and Down in the field are
  the plus and the minus button. A number below 1 or above 20 changes
  nothing, and the status toast says "A class level is from 1 to 20."
  A higher level that the engine refuses shows its reason in the status
  toast.[^orc-349]
* Up and Down set the level from the level of the class. A typed level
  that did not count yet does not count after Up or Down, and the field
  shows the new level.[^orc-350]
* After a lower level makes the class level 1, the focus goes to the
  level field, because the minus button is then disabled. After Remove of
  a class, the focus goes to the Change button of the next block, or of
  the block before it for the last block. After Cancel of the question,
  the focus goes back to the button that asked.[^orc-350]
* The header does not move when the level or the class changes. On a
  narrow part, the level control, About and Change go to a second row
  below the name.[^orc-349]

## Choices

* Each choice of the class is a **choice row**. The rows are in groups
  by level, with "Level 3" at the left of the group. Only a level with a
  choice shows.
* A row shows the name of the choice at the left. At the right it shows
  the pick, or the left mark.
* A click on the head of a row opens or closes the row. A row with
  picks left is open when the step opens. A row with its picks made is
  closed when the step opens.
* A row stays open after a pick, until the player closes it.[^orc-336]
* An open row shows the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection).
* The subclass row has a Choose button. It opens a dialog with the
  names in a list at the left and the detail of the selected subclass at
  the right, with the button "Choose {subclass}".
* The features with no choice are not in the rows. They are in the modal
  of the class.
* A class with no choice at its levels shows one row with the text "No
  choice at this level."
* The choices of the class itself, such as the Fighting Style of a
  fighter, are at level 1. The choices that a pick in a row opens on this
  step, such as the Dragon Ancestor of a Draconic Bloodline, are rows
  after that row, at its level. A choice that two sources share, such as
  the Fighting Style of a fighter and of a Champion, is one row, at the
  first place where it shows. The hit points of a level are not a choice
  row.[^orc-350]
* The head of a row is a heading with one button in it, with
  `aria-expanded`. The focus stays on the head when the row opens or
  closes. The head shows the names of the picks only when the row has no
  pick to make or to remove; else it shows the left mark. At the right of
  the head, a small "▴" or "▾" in muted text shows if the row is open.
  It is a text, not an icon. When the part is narrower than 480px, the
  pick or the mark is on a second line of the head, at the right, and
  that line has a fixed height.[^orc-350]
* A row gets its open or closed state when it first shows: at the open
  of the step, and also when a pick or a new level adds a row while the
  step is open. After that, only a click on its head changes it.[^orc-350]
* A pick in a choice of one pick of a class, such as the subclass or
  "Ability Score Improvement or Feat", asks first when it removes picks.
  See [A change that removes picks](#a-change-that-removes-picks).[^orc-350]
* The subclass dialog shows the pick, or else the first subclass, when it
  opens. The detail of a subclass is its description and a features
  table with the column headings "Level" and "Features". The table has
  the features that a trial character with the subclass gets at each
  level and that the class does not give, and the choices that the
  subclass opens. The description of a pack subclass is the description
  of its record. The engine has no description of an SRD subclass, so the
  app has one sentence for each. The panel of the picked subclass shows
  "The subclass of this character". After "Choose {subclass}", the focus
  goes to the Change button of the row.[^orc-350]
* The subclass dialog uses the list with a detail panel. When the dialog
  is narrower than 560px, the list fills the dialog, and a click on a name
  opens the detail in a modal over it, with "Choose {subclass}".[^orc-350]

**Ability Score Improvement or Feat.** The row has two option cards,
"Ability Score Improvement" and "Feat". After the pick, the row shows
one line with a button to the step that has the pick: "Place 2 points on
the Abilities step" or "Pick the feat on the Feats step". The line shows
the left mark of that pick, or the pick. The points are placed in the
boxes of [The Abilities step](#the-abilities-step). The feat is picked
on [The Feats step](#the-feats-step).

* The line is one button. The place of the line, of a fixed height, is
  there before the pick, so that the pick does not move the rows below.
  A long text wraps to two lines in that place.[^orc-350]
* The pick of the points is the points that the player placed: "+1
  Strength, +1 Dexterity". The engine has one selection for the feats of
  all sources, so the line of a feat shows the picks and the left mark of
  that one selection.[^orc-350] When that selection has more than one pick
  in all, the line says "Pick the feats on the Feats step".[^orc-351]

## Hit points

Each class block has one Hit points section.

* A segmented toggle sets the method for all levels of the class:
  Average (the default) or By level.
* At the right, the label "Total" and the hit points of the class. The
  hit die is a separate text: "Hit die d10, and +1 from Constitution at
  each level".
* By level shows one number field for each level, with a roll button
  with the dice icon, and a "Roll all" button. Level 1 of the first
  class is the maximum of the die, and it cannot change.
* The method is not stored. The engine keeps the hit points of each
  level: the average, a roll or a typed number. The method of a class is
  Average when each level that can change has the average, and else By
  level. Average writes the average at each level. By level starts each
  field at the average, and the total does not change.[^orc-351]
* While the step is open, the block keeps the By level numbers of the
  class from before a change to Average. A change back to By level puts
  back each rolled or typed number. A level that is new since then
  starts at the average.[^orc-351]
* A new class and a new level of a class with the method Average get the
  average. A new level of a class with the method By level has an empty
  field. A level with no hit points, also of an imported character,
  shows an empty field, and the class is By level.[^orc-351]
* The left mark at the right of the title "Hit points" counts the
  levels with no hit points. It shows with By level, or when a level has
  no hit points.[^orc-351]
* A typed number counts when it is from 1 to the die. Another number
  changes nothing. Level 1 of the first class shows "max" in the place
  of the roll button.[^orc-351]
* The total of a class is the hit points of its levels, and at each
  level the Constitution modifier and the other bonuses of each level,
  such as the feat Tough. A bonus that is not for each level is in the
  total of the first class. The totals of the classes add up to the hit
  points of the sheet. With a bonus of each level other than
  Constitution, the text is "Hit die d10, +1 from Constitution and +1
  from other bonuses at each level".[^orc-351]
* The fields of By level show below the toggle, and the toggle can grow
  the page below the section. A roll or a typed number moves nothing: the
  total keeps its place at the right.[^orc-351]

## Also choose

Each class block has a list "Also choose". Until ORC-368 its heading
was "Picked on other steps".[^orc-368]

* The list has one line for each kind that the class gives: Skills,
  Expertise, Tools, Cantrip, Spells, Starting equipment. A class that
  picks cantrips, such as the Wizard, has a Cantrip line and a Spells
  line, as a race with a cantrip has a Cantrip line.[^orc-351]
* A line shows the kind, then the picks or the left mark, then the name
  of the step. The line is a button that opens that step.
* The Class step shows that the class gives Expertise. The pick is on
  the Proficiencies step.[^orc-333]
* A class that gives no pick on another step shows the line "This class
  gives no pick on another step."
* The lines of a block are the selections under its class. The points
  or the feat of an "Ability Score Improvement or Feat" row are not a
  line: the row has its own line to that step. A spell shows its name
  without its level.[^orc-351]

## A second class

* "Add a class" is a full-width dashed button below the class blocks,
  with the plus icon.
* It opens the class cards in a dialog. The cards do not show a class
  that the character has.
* A class that the character cannot take is dimmed and shows what it
  needs below its name: "Needs Str 13".
* A click on a card opens the modal of the class, with the button "Add
  {class}". This is the same modal as for the first class. The dialog
  has no panel beside the cards.
* With two or more classes, the header of each block also has Remove
  and a button that closes or opens the block. A closed block shows its
  left mark in its header.
* What a class needs is the prerequisite of the engine, with the short
  names of the abilities and with no "or higher": "Needs Wis 13 and Dex
  13". The modal of the class shows "Not available. It needs Wis 13 and
  Dex 13." beside the disabled button "Add {class}".[^orc-351]
* A class with two prerequisites joins them with "and": "Needs Str 13
  and Dex 13". A prerequisite that does not start with "Requires" shows
  its own text after them, on the card and in the modal.[^orc-351]
* A new class starts at level 1, with the method Average. After "Add
  {class}", the focus goes to the Change button of its block.[^orc-351]
* At character level 20, and when the character has each class, "Add a
  class" is disabled. The engine checks only the level of each class,
  not the character level. So the builder refuses a level that makes
  the character level more than 20: at character level 20 the plus
  button of each block is disabled, and the Up key or a typed level
  shows "A character has 20 levels at most." in the status toast and
  changes nothing. A lower level is always possible.[^orc-351]
* The button that closes or opens a block shows "▴" or "▾". It has
  `aria-expanded` and the name "Close Fighter" or "Open Fighter". Each
  block keeps its state while the step is open. With one class, the
  block is open. The left mark of a closed block counts the picks left
  in its Choices and its hit points, or shows "Done".[^orc-351]
* Remove asks first when it removes picks. See
  [A change that removes picks](#a-change-that-removes-picks). When the
  first class goes, the engine makes the next class the first class, at
  level 1: the question lists the picks of its levels that go, with the
  name of the class before the level: "Wizard level 2". Its level 1 then
  has the maximum of the die.[^orc-351]

# The Background and Race steps

The main pick of each step is a list with a detail panel.[^orc-332]
[^orc-338]

## The list and the panel

* The list is at the left, 250px wide. The **detail panel** is at the
  right. The two have the same fixed height, 440px.
* The list shows the names in the order of the alphabet. An option from
  a content pack shows the name of the pack as small text at the right.
* A list of more than 20 options has a search field at its top. The
  placeholder gives the count: "Search 42 backgrounds". A search with no
  result shows one line in the list.
* A click on a name shows the option in the panel. It does not pick the
  option. The row has `aria-current`.
* The panel shows the name, the pack, the description, the facts in a
  definition list, and the traits or the feature. For a race, the facts
  are the ability scores, the size and speed, and the languages. For a
  background, the facts are the skills, the languages or tools, and the
  equipment. The content of the panel scrolls. The row of the button
  stays at the bottom.
* The button "Choose {name}", with the check icon, makes the pick.
* Before a click on a name, the panel shows "Select a race to read
  about it."
* A race with one subrace has no Subrace choice. The panel shows the
  subrace as one of the facts. A race with more than one subrace gets a
  Subrace row in Choices.
* The list and the panel are side by side only when the part is 560px
  wide or more. A narrower part is narrow, as in
  [A narrow page](#a-narrow-page). The width of the part counts, not the
  width of the page: on a page from 860px to about 1080px, the summary
  card takes space, and the step is narrower than 560px.[^orc-347]
  [^orc-353]
* The facts of a background are Skills, Languages, Tools and Equipment,
  each only when the background gives it. A choice of the player shows
  as "Two of your choice".[^orc-347]
* A row of an option that is not available has the lock icon and a
  dimmed name. The pack stays at the right of the row. The reason is the
  description of the row, and the panel shows it beside the disabled
  Choose button. A click on the row shows the option in the
  panel.[^orc-347]
* Above the list, the heading of the selection has the left mark:
  "Background" and "1 left".[^orc-347]
* The facts of a race are Ability scores, "Size, speed", Languages,
  Skills, Tools, Weapons, Cantrip, Spells and Subrace, each only when the
  race gives it. Cantrip is a cantrip choice, such as that of the High
  Elf, and Spells is another spell choice.[^orc-355] A
  choice of the player shows after the fixed part: "Charisma +2; +1 to
  two of your choice". The ability scores show the largest first.
  Darkvision is the first trait.[^orc-348] [^orc-355]
* The pick of a race with one subrace also picks the subrace. The engine's
  Custom subrace does not count. The Subrace fact shows the name of the
  subrace with its ability scores: "Hill Dwarf: Wisdom +1". The choices,
  the proficiencies and the traits of the subrace are those of the race
  in the panel: the traits of the subrace follow those of the race. A
  character that has the race and not its one subrace, such as a
  character from before this rule, keeps the Subrace row in Choices until
  the player picks the subrace.[^orc-348] [^orc-355]
* The panel shows what the engine gives the race and the record does
  not have.[^orc-355] The source is a probe character with the race and
  its one subrace, and no other pick, so the text is correct before the
  player makes a pick. The same rule applies to a pack race.
  * A trait of the built character that the record does not have, with
    the text of the engine: the Hellish Resistance and the Infernal
    Legacy of the Tiefling.
  * An area attack, with our own text: the Breath Weapon of the
    Dragonborn. Before the pick that gives the area, the text names
    that choice: "Your Draconic Ancestry gives the area, the saving
    throw and the damage type." The text ends with the use: "The Breath
    Weapon takes an action. You can use it again after a short or long
    rest."
  * "Damage Resistance" for a choice of the race whose each option gives
    a damage resistance, such as the Draconic Ancestry, and for a damage
    type that no trait names. A trait names the resistance when its text
    has the damage type and "resist": "resistance to poison damage". The
    Breath Weapon of a copy says "fire damage", but it does not name the
    resistance.
  * "Hit Points" for the hit points for each level, such as those of the
    Hill Dwarf, when no trait says "hit point maximum".
  * A spell that comes after level 1 adds its level to the trait that
    names it: "You get Hellish Rebuke at level 3 and Darkness at level
    5." A spell that no trait names goes in a "Spells" trait. A trait
    names a spell when its text has the spell name as a whole word, in
    any case: the engine writes "You know thaumaturgy".
  * The skills, the tools and the weapons are facts.
* The app builds the text of a race one time for each content and
  keeps it. The list does not build it: a click on a name does.[^orc-355]

## After the pick

After the pick, the list and the panel close. A block takes their place,
with the look of the class block.

* The header has the name, with the pack as small text, the left mark
  of the step, and the ghost buttons About, Customize and Change.
* About opens the content of the detail panel in a modal.
* Customize opens the Customize dialog. The button text follows the
  [Homebrew forms spec](homebrew-forms.md#customize): Customize, Edit
  custom, or Edit custom origin. The line under the option cards of
  today goes.
* Change opens the list and the panel again, in the place of the block.
  The picked option has a check icon in the list and is bold. A Cancel
  button puts the block back.
* The body has the section Choices, when the option has a choice on
  this step, and the section "Also choose".
* Choices has one part for each selection, for example Subrace or
  Draconic Ancestry, with the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection).
* "Also choose" has one line for each kind: Ability scores to
  Abilities, Skills, Languages and Tools to Proficiencies, Cantrip to
  Spells, Feat to Feats, Starting equipment to Equipment. An option that
  gives no pick on another step shows one line that says so.
* A line shows the picks when no pick is left, and else the left mark.
  The Languages selection that a race and a background share is one
  selection, so its line counts the picks of all its sources. Other
  kinds of line are Expertise and Other proficiencies to Proficiencies,
  and Spells to Spells.[^orc-347]
* In the list that Change opens, the heading is "Background: Acolyte",
  with the left mark of the step and Cancel. The picked option has the
  focus. Its panel has the check icon and "The background of this
  character" in the place of the Choose button. After Cancel, the focus
  goes to the Change button.[^orc-347]
* The name in the header of the block is an `<h3>`. The titles Choices
  and "Also choose" are `<h4>`. The modal of About has a Close
  button and no Choose button.[^orc-347]

## Custom Origin

* "Custom Origin" is a fixed last row of the Race list, with the plus
  icon. It does not scroll with the list.
* Its panel says what a custom origin is, and "A custom origin is not
  saved to your homebrew content." The button "Start a custom origin"
  opens the Custom Origin dialog.
* The text of the panel is, word for word: "Make a copy of a race for
  this character. Move its ability score increases, and swap its
  languages and proficiencies for others. The copy is the race of this
  character." Then a second paragraph: "A custom origin is not saved to
  your homebrew content."[^orc-348]
* The Background list has no such row.
* The panel of the row has the name "Custom Origin" as its heading. The
  row has the `plus` icon of theme.md because it makes a new record. The
  button "Start a custom origin" has no icon, as in the prototype. After
  the save, the block of the copy has "Edit custom origin", and the
  focus goes to that button.[^orc-348]

## A narrow page

When the part of the step is narrower than 560px, the list has the full
width and a height of 400px. A tap on a name opens the detail in a modal,
with the Choose button. See [The list and the panel](#the-list-and-the-panel).

The page of the builder is narrow below 860px.[^orc-353]

* The summary card does not show, and the Sheet button between Back and
  Next opens the full sheet panel. See [The summary card](#the-summary-card).
* So the step keeps the width that its controls need. From 720px to
  859px, the app rail is at the left, and the step is 476px to 615px
  wide. At 680px and below, the app rail is a strip at the top.
* At 390px each step fits in the page: no control goes past the step, the
  rail scrolls sideways, the ability score boxes and the class cards are
  three in a row, and each modal and dialog fits in the window.

# The Abilities step

The ability score control is six boxes, one for each ability.[^orc-331]
They are six in a row on a wide control, and three in a row on a
narrower one. The last bullet of the list below gives the widths.

* The four methods are a segmented toggle above the boxes: Standard
  Scores, Standard Roll, Point Buy, Manual Entry.
* Under the toggle, a strip of fixed height holds the points that are
  left with a meter (Point Buy), a hint and the Re-roll button (Standard
  Roll), or a hint (the two others).
* Each box reads from the top:
  1. The ability name, 13.5px, weight 600, in the ink color.
  2. The base score.
  3. The increases from other sources, as source tags (see the
     [Theme spec](theme.md)): "+2 Race", "+1 Subrace", "+2 Improvement".
  4. The total and the modifier, large, on a shaded band at the bottom.
* The boxes do not move and do not change their size when the method or
  a score changes.
* The tag area of a box holds two source tags. With more sources, the
  second tag is the sum of the others, "+3 more". The full list is in
  the box for a screen reader.[^orc-345]
* The boxes are six in a row only when the control is 728px wide or
  more. Then each box has space for the point-buy buttons and for a
  "+2 Improvement" tag. So on a page narrower than about 1250px, where
  the summary card takes space, they are three in a row too.[^orc-345]
* The boxes are three in a row only when the control is 323px wide or
  more, so that each box has space for the point-buy buttons. A
  narrower control has two boxes in a row, and under 212px one box in a
  row. The points from other sources use the same widths. The summary
  card shows only on a page 860px wide or more, so the control is 323px
  wide or more on each page from 390px.[^orc-345] [^orc-353]

The base score for each method:

| Method | Control |
|---|---|
| Standard Scores, Standard Roll | A chip with a drag handle at its left. The player drags it to a different box, and the two scores swap. A click on one chip and then on a second chip does the same, for a phone and for the keyboard. The chip that the player picked up is yellow. |
| Point Buy | A minus button and a plus button around the score, with the cost of the next point below: "next: 2 pt". The limits are as today. |
| Manual Entry | A number field |

**Points from other sources.** A choice of ability score increases, for
example the two +1 of a Half-Elf or an Ability Score Improvement of a
class level, is placed on this step. Each such choice is a section below
the boxes, with the source in its heading and the left mark. The player
places a point with plus and minus buttons in the section. The point
then shows as a token in the box.
The heading of such a section is "Ability Score Improvement: Fighter 4"
for a class level, and "Ability Score Increase: Half-Elf" for a race, a
subrace or a feat.[^orc-345]

# The Proficiencies step

The Proficiencies step holds each pick of a skill, a language or a
tool.[^orc-332] [^orc-333] The Class, Background and Race steps do not
show these selections. They show a line in "Also choose".

* The step has three groups, each with a heading: Skills, Languages,
  Tools. A fourth group, "Other proficiencies", after Tools, shows only
  for a selection that gives no skill, language or tool, such as the
  armor and weapon selections of the "Custom" options. A selection that
  gives tools and languages, such as "Tool / Language Proficiencies" of
  the "Custom" background, is in Tools. A group with no selection for
  this character does not show.[^orc-346]
* A group has one section for each source, with the source in the
  heading and the left mark: "Skills: Fighter", "Languages: Acolyte".
  The sections are in the order of the steps: class, background, race,
  feat.
* Expertise is a section of the Skills group, after the skill sections:
  "Expertise: Rogue". It offers the skills in which the character is
  proficient.
* A section uses the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection).
* Under the heading of a group, one line of tokens with no X shows what
  the character has from fixed sources, with the source: "Insight
  (Acolyte)". It has the label "Already has".
* A skill, a language or a tool that the character has from a different
  source shows as not available, with the source as the reason.
* The engine merges the Languages selections of the race and the
  background into one selection. The step shows one section for the
  merged selection, with each source in the heading: "Languages:
  Acolyte, Half-Elf".
* Each section names its source, also when no other section has its
  name. Two classes are in the order of the character, and the sections
  of one class are in the order of the levels. An Expertise section of a
  class level has the level: "Expertise: Rogue 6".[^orc-346]
* A section that a pick opens is after the section of the pick. Its
  heading has its own name, then the source: the "Two Skills" of
  "Expertise: Rogue" opens "Skill Expertise: Rogue".[^orc-366]
* The group heading is an `<h3>`, and the section headings are
  `<h4>`.[^orc-346]
* The tokens of "Already has" are in the order of the names. The engine
  gives no source for a language, and for some fixed skills and tools.
  Then the source is the race, the background or the class without
  which the character does not have the item. A token with no source
  found shows the name only. An item that the character picked shows
  only when a fixed source gives it too, for example the Perception of a
  rogue who picked it and then became an elf.[^orc-346]

# The Feats step

* The step holds each feat selection of the character: from a class
  level, from a race, and from other sources.
* Each selection is a section with the source in its heading and the
  left mark, with the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection).
* Each picked feat has the Customize line of the
  [Homebrew forms spec](homebrew-forms.md#customize), below the control
  of its section.
* A feat that the character cannot take shows as not available, with
  the reason.
* The selections that a feat opens are flat sections below it. A skill,
  a language or a tool is on the Proficiencies step. An ability score is
  on the Abilities step.
* The engine has one feat selection for all sources. Its heading names
  each source, also when no other section has its name, in the order
  class, background, race, feat: "Feats: Fighter, Variant Human". A feat
  selection with no source keeps the name "Feats".[^orc-352]

# The Spells and Equipment steps

The spell selections of the Spells step have the "Add spells"
popup.[^orc-357] The inventory lists of the Equipment step have one "Add
items" list modal.[^orc-373] The hands and the prepared spells stay as
today.

* The steps get the step title, the marks and the rules of this
  document.
* A spell selection shows its heading with the left mark, the names of
  its picks, and an "Add spells" button with the `sparkles`
  icon.[^orc-357] The name of the button has the selection: "Add spells:
  Wizard Cantrips Known".
* The names of the picks are by level, A to Z in a level, in a comma
  separated list that wraps as text: "Mage Armor, Magic Missile,
  Shield". The form is the same at all widths. When the options of the
  selection have two levels or more, each level starts a line, with its
  level label in the label style in front of its names, for example
  "1ST LEVEL Alarm, Shield". The commas are not in the accessibility
  tree. With no pick, the list shows a muted "None".[^orc-357]
* The space of the names is there before the first pick, so a pick does
  not move the button and the page below. A hidden copy of text in the
  same place sets the space: the longest names of the options, as many
  as the most picks. With levels, the copy also has a line for each level
  that the picks can fill, because each level starts a line. The most
  picks are the maximum of the selection. A selection with no maximum
  keeps the space of the picks to make, and grows when the picks are
  more. The copy uses the count of characters to find the longest names,
  so the space is an estimate, and it can be some lines taller than the
  picks need.
* A name is a button that opens the popup at its spell, as a spell name on
  the sheet opens the Spells panel.
* The button opens a popup for the selection. The popup is a wide `Dialog`
  with the parts of the [Spells panel](spells-panel.md): the search, the
  list by level, the spell view, the keyboard rules and the two views of a
  narrow page. The parts are shared code, not a copy.
  * The title is the heading of the selection. The count is at its right,
    as the left mark: "2 left", "Remove 1", or a green "Done" when
    nothing is left to pick. A selection with no maximum shows the green
    "Done" when it has its minimum.
  * The list has only the options of the selection, by level, A to Z in a
    level.
  * Each row has a box at its left. The box adds the spell to the
    selection or removes it, at once, with no Save button. Space on a row
    changes its box. The name of the box is "Chosen: Fire Bolt", and the
    name of the row ends with "chosen" or "not chosen".
  * At the maximum, the box of each spell that is not picked is disabled.
    Its description is "Remove a spell first.". A selection with no
    maximum does not disable a box. In a selection of one pick that is not
    a multiselect, for example Mystic Arcanum, a box replaces the pick,
    and the box of the pick cannot change. Its description is "Pick
    another spell in its place.".
  * A spell that the character cannot take has the lock in the place of
    the box, a dimmed name, and the reason as its description. Its spell
    view says "Not available." and the reason. A refusal of the engine
    shows in the status toast.
  * The spell view has a box line under the name: "Chosen" or "Not
    chosen".
  * The footer has one "Done" button. Done, the X and Escape close the
    popup, and the focus goes back to the control that opened it.
  * A change of the count is in a polite live region: "Wizard Cantrips
    Known: 2 left".
* The selections that a picked spell opens are flat sections after the
  selection, with their own headings and marks.
* The step has no option cards, no level filter and no search for a spell
  selection.
* Eldritch Invocations stays on the Spells step. Its options are not
  spells, so it has no "Add spells" popup. It gets the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection),
  as a selection on another step does. A selection is a spell selection
  when each of its options has a spell record. The step shows its
  selections when the spell records load.
* A starting equipment selection gets the control of
  [The control for each kind of selection](#the-control-for-each-kind-of-selection).

## The inventory lists

The inventory lists are the list selections of the Equipment step:
Armor, Equipment, Magic Armor, Magic Weapons, Other Magic Items,
Treasure and Weapons, in the order of the step.

* One "Add items" button adds to all the lists.[^orc-373] It is an
  `AddButton` above the first list. The lists have no add control of
  their own.
* The button opens one `ListModal` with the title "Add items" and a
  search field. The modal has a group for each list, in the order of the
  step. A group has the items that are not in its list yet, A to Z. The
  search filters the rows of all the groups.
* A pick adds the item to the list of its group. The picks do not show
  as tokens in the modal. The item shows in its own list.
* The modal stays open after a pick, and the picked item leaves it, as
  the [Picker](homebrew-forms.md#picker) of the homebrew forms. The
  footer counts the picks since the modal opened: "2 added".
* A row is busy while its pick is on its way, and the button is busy
  until the pick shows. A second click on a busy row does nothing.
* The custom items of Equipment and Treasure stay, with the "Add custom
  item" button under their list.

# The Description step

* Alignment moves here from the Background step. It is a ui `Select`
  with the label "Alignment", and it is the first field.[^orc-332]
* The step has no name field.
* The other 18 fields stay. They use the ui `TextInput` and `TextArea`,
  with the label above the field.
* Experience Points is a `TextInput` that keeps only a whole number. At
  the blur, "12.9" becomes "12", and a text that is not a number
  removes the value. The URL fields are `TextInput`s too.[^orc-352]
* The step has "Go to the sheet" in the place of Next.
* The left mark of Alignment is at the right of its label, in a fixed
  place, and is a part of the name of the select: "Alignment, 1
  left".[^orc-352]
* The one-line fields are three in a row on a step 600px wide or more,
  and one on a narrower step, as on a phone. The width of the step
  counts, not the width of the page. A text area and a URL field have the
  full width.[^orc-352]

# Keyboard and screen reader

* The rail is a list of buttons in a `<nav>` with the label "Steps".
  The left mark of a step is part of the name of its button: "Class, 2
  picks left".
* A left mark at a heading is in the heading text for a screen reader.
* A swap of two scores works with the keyboard: Enter or Space on a
  chip picks it up, and Enter or Space on a second chip swaps the two.
  Escape puts the chip down. A live region says the result: "Strength
  14, Dexterity 15".
* A dialog and a modal get the focus at the open. At the close, the
  focus goes back to the control that opened them.
* After a pick closes the list of the Background or Race step, the
  focus goes to the Change button of the block.
* After Next or Back, the focus goes to the step title.

# What a 2024 builder changes

A builder for a 2024 character is a later project. This design avoids
parts that it could not use. A 2024 builder changes these parts:

* The Race step becomes Species. The species gives no ability score.
* The background gives the ability score increases and an origin feat.
  "Also choose" of the background then has a line to Abilities
  and a line to Feats.
* The Proficiencies step has no change. The background gives two fixed
  skills and a tool.
* The classes have Weapon Mastery choices. They are choice rows.
* The class cards and the modal use the 2024 class records. The twelve
  class icons stay.
* The subclass is at level 3 for each class.
* The Ability Score Improvement is a feat. The row "Ability Score
  Improvement or Feat" becomes one line to the Feats step.
* The steps, the rail, the marks, the summary card, the control rule
  and the question before a change removes picks stay.

# Changes to other specs

The changes are in the same pull request as this document.

**[Theme spec](theme.md)**

* **Controls:** the builder step bar becomes the step rail.
* **Icons:** the class icons are in the class cards, the modal of a
  class and the header of a class block.
* **Stuck note:** the inline notes of the builder are the left marks of
  this document.
* **Small screens:** the builder has no preview beside the steps. It
  has the summary card and the full sheet panel, and the rules of the
  builder preview apply to the panel.

**[Homebrew forms spec](homebrew-forms.md):** the Customize button of a
background and a race is in the header of the block of the Background
and Race steps. The Custom Origin entry is the last row of the Race
list.

**`GLOSSARY.md`:** the new terms.

# Build order

This is the order in which the build tickets were filed. They are in the
Linear project "Character creation", milestone "Build". Linear holds the
tickets, their blocking relations and their status. When this list and
Linear disagree, Linear wins.

1. The ten steps and the step of each selection, in the builder model
   (ORC-339).
2. The step rail, Back and Next, and the left marks (ORC-340).
3. The summary card and the full sheet panel (ORC-341).
4. The Name step, and a new character with no class (ORC-342).
5. The control rule for a selection: cards, picker or list, and an
   option that is not available (ORC-343).
6. The question before a change removes picks (ORC-344).
7. The ability score control (ORC-345).
8. The Proficiencies step (ORC-346).
9. The list with a detail panel, and the Background step (ORC-347).
10. The Race step, with Custom Origin (ORC-348).
11. Class step: the class cards, the modal and the class block
    (ORC-349).
12. Class step: the choice rows, the subclass dialog and the
    improvement or feat row (ORC-350).
13. Class step: hit points, the picks on other steps and a second class
    (ORC-351).
14. The Feats, Spells, Equipment and Description steps in the new frame
    (ORC-352).
15. The end-to-end pass, the narrow page and the docs (ORC-353).

Tickets 1 to 6 are the frame. Tickets 7 to 14 are the steps, and each
one depends only on parts of the frame.

# Out of scope

* **The Level up wizard.** It is a project of its own, after this
  builder is done.
* **A builder for 2024 characters.**
* **A redesign of the inside of the Spells and Equipment steps**, other
  than the "Add spells" popup and the inventory lists.
* **Fewer or other ability score methods.**
* **Changes to the engine `@pubdoor/dmv`.**
* **Changes to the Customize dialog and the Custom Origin dialog.**

[^orc-327]: Map: Character creation, <https://linear.app/orc-alchemy/issue/ORC-327/map-character-creation>
[^orc-328]: What the builder shows today, and where it shifts, <https://linear.app/orc-alchemy/issue/ORC-328/what-the-builder-shows-today-and-where-it-shifts>
[^orc-329]: What the new step order and the Name step touch, <https://linear.app/orc-alchemy/issue/ORC-329/what-the-new-step-order-and-the-name-step-touch>
[^orc-330]: The stepper and the place for picks that are left, <https://linear.app/orc-alchemy/issue/ORC-330/the-stepper-and-the-place-for-picks-that-are-left>
[^orc-331]: The ability score control, <https://linear.app/orc-alchemy/issue/ORC-331/the-ability-score-control>
[^orc-332]: The control for each kind of selection, <https://linear.app/orc-alchemy/issue/ORC-332/the-control-for-each-kind-of-selection>
[^orc-333]: The Name step and the start of a new character, <https://linear.app/orc-alchemy/issue/ORC-333/the-name-step-and-the-start-of-a-new-character>
[^orc-335]: What the new Class step does, <https://linear.app/orc-alchemy/issue/ORC-335/what-the-new-class-step-does>
[^orc-336]: The new Class step, <https://linear.app/orc-alchemy/issue/ORC-336/the-new-class-step>
[^orc-338]: The list with a detail panel for Race and Background, <https://linear.app/orc-alchemy/issue/ORC-338/the-list-with-a-detail-panel-for-race-and-background>
[^orc-345]: The ability score control, <https://linear.app/orc-alchemy/issue/ORC-345/the-ability-score-control>
[^orc-346]: The Proficiencies step, <https://linear.app/orc-alchemy/issue/ORC-346/the-proficiencies-step>
[^orc-347]: The list with a detail panel, and the Background step, <https://linear.app/orc-alchemy/issue/ORC-347/the-list-with-a-detail-panel-and-the-background-step>
[^orc-348]: The Race step, with Custom Origin, <https://linear.app/orc-alchemy/issue/ORC-348/the-race-step-with-custom-origin>
[^orc-349]: Class step: the class cards, the modal and the class block, <https://linear.app/orc-alchemy/issue/ORC-349/class-step-the-class-cards-the-modal-and-the-class-block>
[^orc-350]: Class step: the choice rows, the subclass dialog and the improvement or feat row, <https://linear.app/orc-alchemy/issue/ORC-350/class-step-the-choice-rows-the-subclass-dialog-and-the-improvement-or>
[^orc-351]: Class step: hit points, the picks on other steps and a second class, <https://linear.app/orc-alchemy/issue/ORC-351/class-step-hit-points-the-picks-on-other-steps-and-a-second-class>
[^orc-352]: The Feats, Spells, Equipment and Description steps in the new frame, <https://linear.app/orc-alchemy/issue/ORC-352/the-feats-spells-equipment-and-description-steps-in-the-new-frame>
[^orc-353]: Builder: the end-to-end pass, the narrow page and the docs, <https://linear.app/orc-alchemy/issue/ORC-353>
[^orc-354]: The question before a change removes picks: the picks in a top-level selection stay, <https://linear.app/orc-alchemy/issue/ORC-354/the-question-before-a-change-removes-picks-the-picks-in-a-top-level>
[^orc-355]: The race panel shows the traits that the engine gives, <https://linear.app/orc-alchemy/issue/ORC-355>
[^orc-357]: Spells step: an "Add spells" popup like the Spells panel of the sheet, <https://linear.app/orc-alchemy/issue/ORC-357>
[^orc-366]: Proficiencies step: the section that an Expertise pick opens names its source, <https://linear.app/orc-alchemy/issue/ORC-366>
[^orc-367]: Class step: the content of the class modal scrolls, and the Choose button stays in view, <https://linear.app/orc-alchemy/issue/ORC-367/class-step-the-content-of-the-class-modal-scrolls-and-the-choose>
[^orc-368]: Replace the heading "Picked on other steps", <https://linear.app/orc-alchemy/issue/ORC-368/replace-the-heading-picked-on-other-steps>
[^orc-370]: Proficiencies step: show that a selection is full before the user tries another pick, <https://linear.app/orc-alchemy/issue/ORC-370>
[^orc-371]: Proficiencies step: less space between a selection heading and its control, <https://linear.app/orc-alchemy/issue/ORC-371>
[^orc-372]: Status toast: a red look for errors, a dismiss button and a minimum width, <https://linear.app/orc-alchemy/issue/ORC-372>
[^orc-373]: Equipment step: add items with the Picker of the homebrew forms, <https://linear.app/orc-alchemy/issue/ORC-373>
