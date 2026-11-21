---
type: Reference
title: Spells panel spec
description: The settled design of the Spells panel on the character sheet - the popup with the spell list and the spell text, prepared spells, spent spell slots in the panel and on the sheet, Pact Magic slots, how a sheet change saves, the spell records, and the run order of the build tickets.
tags: [design, sheet, spells]
status: stable
generated: { by: claude-code/agent, at: 2026-11-20T22:00:00Z }
resource: https://linear.app/orc-alchemy/issue/ORC-262/map-the-spells-panel
sources:
  - id: orc-262
    resource: https://linear.app/orc-alchemy/issue/ORC-262/map-the-spells-panel
    title: "Map: the Spells panel (the decisions index)"
---

# Purpose

This document is the spec for the project "Spells panel" of Alchemy 5e. The
build tickets in Linear build what it describes. It collects the decisions
of the map
[Map: the Spells panel](https://linear.app/orc-alchemy/issue/ORC-262/map-the-spells-panel).[^orc-262]
Each decision is in full in the resolution comment of its Linear ticket.
This document gives the rules that the build tickets need.

The Spells panel is a popup that opens from the character sheet. It shows
the spells of the character with their text and the spellcasting numbers.
The user sets the prepared spells there and marks the spent spell slots.
This is the first project that lets the user change the character from the
sheet.

The look comes from the [Theme spec](theme.md): theme tokens, fonts,
controls and notes. This document adds the panel, and it changes the
Spellcasting section of the sheet.

When this document and a prototype disagree, this document wins. When this
document says nothing, use the prototype.

## Prototypes

The prototypes are throwaway HTML. Use them as the visual reference for
sizes, spacing and CSS.

| Prototype | File | Artifact | Use this view |
|---|---|---|---|
| Controls | [orc-269-spells-panel-controls-prototype.html](prototypes/orc-269-spells-panel-controls-prototype.html) | [Spells Panel Controls](https://claude.ai/artifact/QtmGErU1rVTfWoPaw8o6b1) | The view that opens: prepare control A, Pact slots 2, order A to Z |
| Form and layout | No copy | [Spells Panel Prototype](https://claude.ai/artifact/Hgs4V3kx3c59MA1tBmAMxy#d) | Variant D |

The Artifacts need a claude.ai sign-in. The copy here does not. The
controls prototype has the layout of variant D with the later decisions,
so it is the main reference.

The prototypes are older than the last decisions. They do not show the
search field, the source tags, the header for more than one source, or
the cast note. This document gives those rules in words.

# Terms

`GLOSSARY.md` at the repository root defines the terms of this document:
**Spells panel**, **Spellbook**, **Play state**, **Sheet change**,
**Spent slot**, **Prepare count**, **Always-prepared spell** and
**Cast note**.

In this document, a **source** is a class, race or feat that gives the
character spells. A **class that prepares** is a class such as the cleric
or the wizard, where the user chooses the prepared spells each day.

# How a sheet change saves

This rule is for each sheet change, which is each change to the play
state from the sheet. It is not only for the Spells panel. The later
projects (hit points, rests, equipment, feature uses) use the same
rule.[^orc-265]

* A sheet change goes through `update` of the open character
  (`useCharacter` in `packages/app/src/state/character.ts`). Thus it gets
  the draft, the save and the save status with no new storage work.
* A sheet change saves at once. The record saves about 500 ms after the
  last sheet change, so that quick clicks go in one save. The builder
  keeps its delay of 7.5 seconds (`AUTOSAVE_DELAY_MS`).
* If builder changes of the same character are pending, they go in the
  same save.
* The save status in the action row stays "Saved" during a sheet change.
  The Save button shows only after a failed save.
* The app has no undo for a sheet change. A second click reverses a
  single change. A bulk action asks for confirmation before it runs. This
  project has no bulk action.
* A failed save keeps the change on the screen and in the draft. The
  alert note of today shows at the top of the app, the status is "Not
  saved", and the Save button shows. See [A failed save](#a-failed-save)
  for the panel.
* Each save writes the full character. If the character is open in two
  tabs, the tab that saves last wins. This is a known limit. The sync of
  the Backend project covers it later.

# Spell records

The panel and the sheet show data from the spell record of each known
spell.[^orc-264] [^orc-275]

## The lookup

One module gives the record for a spell key. It has no knowledge of the
panel, so the Browse pages (ORC-87) can use it later.

* The SRD records are in `@pubdoor/dmv/content/spells.json`. The app loads
  that file as its own chunk. `packages/app/src/engine/spells.ts` loads it
  today and keeps only the level. The lookup keeps the full record.
* The homebrew records are in the packs (`packages/app/src/state/homebrew.ts`).
* If a key has more than one record, the lookup uses the engine rule. A
  pack wins over the SRD. If two enabled packs have the key, the last
  enabled pack wins.
* The result says which pack the record is from, or that it is from the
  SRD.
* A known spell can have no record, for example `tsunami`. The lookup
  then gives no record, and the caller uses the name that the app makes
  from the key.

The sheet loads the spell chunk when the character knows a spell. Until
the chunk loads, the Spellcasting section shows its levels and slots, and
no spell names. Thus a wrong name never shows.

## Spell names

The sheet and the panel take the name of a spell from its record. Today
`sheet.ts` makes the name from the key, which is wrong for 48 SRD spells.
The name from the key stays only for a spell with no record.

## The cast note

A known spell can have a **cast note**: the `qualifier` of the spell in
`built["spells-known"]`, for example "at will", "once per long rest" or
"ritual only". The sheet model drops it today. Add it to `KnownSpell`.

* The note "Domain" does not show, in the panel or on the sheet. The
  "Always prepared" label says the same.
* On the sheet, the cast note is in parentheses after the spell name:
  "Detect Magic (at will)".
* The panel rules are in [The list](#the-list) and
  [The spell view](#the-spell-view).

## Missing data

* The panel shows what there is. A field with no value has no line in the
  spell view.
* A spell with no record stays in the list, with the name from its key.
  Its spell view says "The app has no text for this spell." The user can
  still prepare it.
* The importer gives level 0 and the school "unknown" to a pack spell
  that has none. When the school is "unknown", the spell view shows only
  the level.
* The SRD data has 11 known errors. The PubDoor ticket
  [Correct 11 SRD spells in the engine data](https://linear.app/orc-alchemy/issue/ORC-277/correct-11-srd-spells-in-the-engine-data)
  corrects them. This project does not wait for it.

# The panel

The panel is a popup over the sheet, in two panes.[^orc-267] The list of
spells by level is on the left. The text of one spell is on the right.

## Ways in

* The Spellcasting section of the sheet has an "All spells" button at the
  end of its section rule. It opens the panel at the top of the list.
* Each spell name on the sheet is a button with the look of plain text.
  It opens the panel at that spell. This includes the cantrips and the
  line of a cantrip-only source.
* The panel is not in the URL. A reload shows the sheet.
* The builder preview has no panel. It has no "All spells" button, its
  spell names are plain text, and its slot circles cannot change.

## The frame

The panel is a `Dialog` of `@orc-alchemy/ui` with the new wide size (see
[Changes to the theme spec](#changes-to-the-theme-spec)).

* It is up to 1100px wide. The panel sets its height to the height of the
  window, less a margin. At 600px and less it fills the screen.
* It has a header, a prepare bar, and the two panes. It has no footer.
* The X, Esc and a click outside close it. The focus then goes back to
  the control that opened it.
* A close always ends prepare mode. The panel opens with prepare mode
  off.
* While the spell chunk loads, the list shows "Loading spells…".

## The header

* The title is "Spells". Under it is the class and level of each class
  that gives spells, for example "Cleric 9" or "Cleric 5 / Warlock 3".
  The header has no character name.
* With one source, three framed boxes are on the right: Save DC, Attack
  and Ability. Each has more space above its value than the boxes of the
  sheet.
* With two or more sources, the header has one line of numbers for each
  source. The line has the source name, the save DC, the attack bonus and
  the ability. A race or feat that gives only cantrips gets a line also.
* The class and level line shows on a phone too.
* A screen reader reads each number with its full label, for example
  "Spell save DC 15", not one run of text.

No prototype shows the header for two or more sources. The build ticket
attaches screenshots of it for review.

## The prepare bar

The bar is under the header. It always shows.

* On the left is the prepare count of each class that prepares, then the
  button "Prepare spells". In prepare mode, the button is "Done". It is
  one button that changes its label. It has no pressed state.
* On the right is the link "Change known spells in the builder". It goes
  to the Spells step of the builder. It has the pencil icon of ORC-272
  before its text.
* A character with no class that prepares has no count and no button. The
  bar then has only the link.

## The list

The list has one group for each spell level. Cantrips are the first
group. A group has a heading and one row for each spell, A to Z by name.

**Which spells show**

* Outside prepare mode, the list shows the spells that the character can
  cast now:
  * the cantrips;
  * the prepared spells of each class that prepares, the always-prepared
    spells included;
  * all known spells of each other source.
* In prepare mode, the list also shows the spells that a class that
  prepares can prepare and has not prepared.
* A level with slots and no spells to show keeps its heading.
* A spell that two sources give is two rows.

**A row**

* A click on the row selects the spell and shows its text, in the two
  modes. The selected row has the ink fill.
* The spell name is first. A cast note follows it as muted text.
* When the character has two or more sources, each row has a small
  source tag in words, for example "CLERIC", in Inter caps.
* "Ritual" is a word in a box. Concentration is a "C" in a box. The "C"
  has the accessible name "Concentration".
* A long name wraps inside its row.

**A level heading**

* The heading has the level name ("Cantrips", "1st level") and the slot
  circles of the level. The pact slots of the level are at the right end
  of the heading. See [Spent spell slots](#spent-spell-slots).
* The headings stick at the top of the list while their group scrolls.

**Search**

* One search field is above the list, in the scrolling part, with the
  label "Search spells".
* It filters the rows by name as the user types, in the two modes. A
  group with no rows that match does not show.
* If no row matches, the list says "No spells match."
* There are no other filters.

## The spell view

The spell view shows one spell. It is a shared part with no knowledge of
the panel, so the Browse pages (ORC-87) can use it later. The panel adds
the prepare line to it.

From top to bottom:

1. The spell name, in the serif font.
2. An italic line with the level and the school: "1st-level enchantment",
   or "Enchantment cantrip". The Ritual tag is in this line. There is no
   "(ritual)" word.
3. A small line "From {pack name}", when the record is from a pack. The
   prototype shows "Domain spell" in this place. Do not build that line:
   the prepare line says that the spell is always prepared.
4. The cast note, as a line.
5. The prepare line. See [Preparing spells](#preparing-spells).
6. The facts in a grid of two columns: Casting time, Range, Duration and
   Components. Each label is in Inter caps above its value.
7. The description.

**Duration.** The record has no concentration flag. If `duration` starts
with the word "concentration", without regard to case, the spell needs
concentration. The word then shows as a tag in a box, "CONCENTRATION",
and the other words of the duration follow it. There is no other
Concentration tag in the spell view.

**Components.** The line is the letters V, S and M of the spell, then the
material text in parentheses: "V, S, M (a sprinkling of holy water)".

**Description.** The text is plain text with line breaks. Each line break
starts a new paragraph. The app does not read Markdown in it. A line
holds about 70 characters. The words "At Higher Levels" are in bold, and
that paragraph is set apart with a rule above it. The data has three
forms of those words:

* after a line break, with a full stop: "At Higher Levels. ";
* in the same line as the text before it, with a full stop;
* after a line break and four spaces, with a colon: "At Higher Levels: ".

If no form matches, the text shows as it is.

When no spell is selected, the pane says "Select a spell to read it." At
the open, the panel selects the first spell of the list, or the spell
that the user clicked on the sheet.

## On a phone

At 600px and less:

* The panel fills the screen. The X is 44px or more.
* The list and the spell view are two views. A tap on a row replaces the
  list with the spell view. The spell view has a "Back to the list" link
  at its top. The list is then at the same scroll position, and the
  focus goes to the row.
* The Spell slots block is at the top of the two views, because a user
  can cast a spell with a slot of a higher level.
* The panel does not scroll sideways at a width of 320px.

# Preparing spells

The rules are the same in the panel and in the Spells step of the
builder.[^orc-266] [^orc-269] One shared function answers "can the user
change this spell, and what is the count", and the two places use it.

## The prepare count

* Each class that prepares has a prepare count: "5 of 8 prepared". A
  character with two such classes has the class name first:
  "Cleric: 8 of 8 prepared".
* Always-prepared spells and cantrips are not in the count.
* A class with no known limit (`prepare-spell-count` has no value, as for
  some homebrew classes) prepares with no limit. Its line is "3 prepared",
  in plain text.
* The sheet does not show the count.

The color of the count gives its state:

| State | Outside prepare mode | In prepare mode |
|---|---|---|
| Under the limit | Yellow (`--note`) | Yellow |
| At the limit | Does not show | Green (`--success`) |
| Over the limit | Red (`--note-red`), with "Remove n spells." | The same |

## Over the limit

The user can prepare more spells than the limit. The app does not stop
the user, and it removes nothing by itself. The count is then red and
says how many spells to remove, for example "9 of 8 prepared. Remove 1
spell." This replaces the rule of the builder today, which disables the
other boxes at the limit.

## The prepare control

* The control is a square box at the left of the row, the Checkbox of the
  theme. It shows only in prepare mode. Its tap area is 28px or more.
* A spell of a class that prepares has the box. A filled box is a
  prepared spell.
* An always-prepared spell has a filled box that cannot change, and the
  label "Always prepared" with a lock icon. The label shows only in
  prepare mode. The lock icon is a drawn icon (an SVG), as the pencil icon.
* A cantrip has no box. A known spell of a source that does not prepare
  has no box, and it has the label "Known" in prepare mode.
* A spell on the lists of two classes that prepare is two rows. The user
  prepares each apart.
* The spells keep the order A to Z while the user prepares. A prepared
  spell does not move.

## The prepare line of the spell view

The prepare line is under the spell name, above the facts.

* For a spell that the user can prepare, it has the same box with
  "Prepared" or "Not prepared", then the prepare count of the class. The
  box works outside prepare mode too.
* For an always-prepared spell, it has the lock icon and "Always
  prepared. It does not count."
* A cantrip and a known spell have no prepare line.

## The write

`setPrepared` in `packages/app/src/engine/spells.ts` writes the prepared
spells. The panel uses it through `update`, so the change saves as a
sheet change.

## The builder

The Spells step of the builder keeps its prepare section. It gets the
same rules:

* The boxes are not disabled at the limit.
* The count has the same colors and the "Remove n spells." text.
* A class with no known limit gets a prepare section with no limit.

# Spent spell slots

The user marks spent spell slots in the panel and on the
sheet.[^orc-263] [^orc-268] The two places are the same control on the
same state.

## The control

* A filled circle is a spent slot, as in the theme spec.
* The rule is "one more, one less". A click on an empty circle spends one
  slot: the first empty circle from the left fills. A click on a filled
  circle gives one slot back: the last filled circle clears.
* The spent slots of a group are always together on the left. The exact
  circle that the user clicks does not matter.
* With a mouse, the circle that will change shows a light fill before
  the click.
* A circle keeps its 17px drawing. Its tap area is 28px or more.
* There is no "Clear all" button, in the panel or on the sheet. The
  later rests project adds a "Long rest" button.
* A change saves as a sheet change.

## Where the circles are

* **On the sheet:** in the Slots column of the Spellcasting section, as
  today. The circles can now change.
* **In the panel, the Spell slots block:** a shaded block with the label
  "Spell slots", fixed above the list. It does not scroll with the list.
  * With 5th-level slots or higher, the block has one column for each
    level, with the 1st level on the left and the circles going down.
    Without them, it has one row for each level.
  * The block has no total.
  * A level name in the block is a link that scrolls the list to that
    level.
  * The block folds closed with a button in its top-left corner. It
    starts open. If the user folds it, it stays folded on that device.
    The fold is a value in the local storage of the browser. It is not a
    Preference and not a part of the character.
* **In the panel, the level headings:** each heading of the list has the
  circles of its level.

## Pact Magic slots

The panel and the sheet show Pact Magic slots apart from the other slots
of the same level.

* A pact slot is a diamond, not a circle. A filled diamond is a spent
  slot. The rule "one more, one less" is the same.
* Each group of pact slots has the label "Pact", in the serif font. The
  label shows for each warlock, also for a warlock with no other caster
  class.
* On the sheet, a "Pact" row is after the level rows of the Spellcasting
  table. Its Slots cell has the diamonds, and its spells cell says the
  slot level, for example "2nd-level slots". When the sheet is narrower
  than 720px, the diamonds are under the word "Pact".
* In the Spell slots block, a "Pact" entry is after the levels, with the
  slot level beside the word ("Pact 2nd"). It works the same when the
  block shows columns.
* On the level heading of the pact slot level, the diamonds are at the
  right end of the heading, with the "Pact" label.

**The number of pact slots.** The engine adds the pact slots to the slot
total of their level and does not report them apart. The app calculates
them. If `built["pact-magic?"]` is true, the warlock level
(`built.levels.warlock["class-level"]`) gives the slots:

| Warlock level | Pact slots | Slot level |
|---|---|---|
| 1 | 1 | 1st |
| 2 | 2 | 1st |
| 3, 4 | 2 | 2nd |
| 5, 6 | 2 | 3rd |
| 7, 8 | 2 | 4th |
| 9, 10 | 2 | 5th |
| 11 to 16 | 3 | 5th |
| 17 to 20 | 4 | 5th |

For the slot level, the number of other slots is the engine total less
the pact slots. For example, a warlock 10 with sorcerer 9 has three
5th-level slots in `built`: one other slot and two pact slots.

## The record

The record does not change, and the engine does not change.

* The strict entity holds the spent slots under
  `~:orcpub.dnd.e5.spells/slots-used`. The value is a map of a level key
  (`~:orcpub.dnd.e5.spells/slots-1` to `slots-9`) to a set of slot
  positions from 0, for example `{"~#set":[0,2]}`.
* `built` has only the slot totals. Read the spent slots from the strict
  entity, with a reader beside `preparedSpells` in
  `packages/app/src/engine/spells.ts`.
* For a level with `n` other slots and `p` pact slots, positions `0` to
  `n-1` are the other slots. Positions `n` to `n+p-1` are the pact
  slots.

**Read.** The number of spent slots of a group is the number of stored
positions in the range of the group. The app shows that number of filled
circles or diamonds, together on the left. It does not show or count a position past
the number of slots. A record from the old app can have gaps, or a
vector in place of a set. The same rule reads it.

**Write.** Write with
`setValue(entity, "orcpub.dnd.e5.spells/slots-used", map)`. The key needs
its full namespace.

* The value replaces the full map, so write each level.
* Write sets, not arrays.
* For `k` spent other slots and `j` spent pact slots, write the positions
  `0` to `k-1` and `n` to `n+j-1`. Thus each write makes a clean set.
* Do not write a level with no spent slots. When no slot is spent, write
  `{}`, which removes the key.

**When the number of slots changes.** Spent slots stay spent, and new
slots are free. The builder changes nothing in the spent slots. After a
level-up changes `n`, one spent slot can change its type between pact
and other. This is a known small error.

**Export and import.** Spent slots stay in an export and show after an
import. This needs no new work.

**Tests.** Only `fixtures/legacy/r3-slots-used-vectors.strict.json` has
spent slots, and its shape is synthetic. For other tests, add spent
slots to `wizard-5` or `warlock-10-drow` with `setValue`.

# A failed save

* The alert note of today ("Saving to this browser failed. Recent changes
  may not be kept.") shows under the header of the panel, with a "Try
  again" button. The button saves again (`flushAutosave`).
* The change stays on the screen and in the draft.
* The sheet behind the panel shows the same note, the status "Not saved"
  and the Save button.
* A save that works shows nothing in the panel, and it removes the note.

# Keyboard and screen reader

These rules come from the review of variant D.[^orc-267] The tests check
the results. Each build ticket chooses the ARIA pattern that gives them.

**Focus**

* The Dialog holds the focus in the panel. Tab does not go to the sheet
  behind it.
* At the open, the focus goes to the selected row of the list, not to
  the search field. Thus a phone does not open its keyboard.
* At the close, the focus goes back to the control that opened the
  panel.
* A click on a slot circle or diamond keeps the focus on its group.
* The focus ring on the selected row is a paper outline, because the row
  has the ink fill.

**The list**

* The list is one Tab stop. The Up and Down arrow keys move between the
  rows, and Home and End go to the first and last row. The headings are
  not stops.
* At more than 600px, the row with the focus is the selected row, so the
  spell view follows the arrow keys.
* In prepare mode, Space on a row changes its box. The name of the row
  for a screen reader has the spell name, the source when it shows, and
  "prepared", "not prepared" or "always prepared".
* After "Prepare spells", "Done" or a search, the selected row scrolls
  into view if it is in the list.

**Slots**

* Each group of slot circles or diamonds is one Tab stop, not one stop
  for each circle.
* The Right and Up arrow keys spend one slot. The Left and Down arrow
  keys give one slot back.
* A screen reader reads the group with its state, for example "1st-level
  slots, 2 of 4 spent" or "Pact slots, 2nd level, 1 of 2 spent". It
  reads the new state after a change.
* The panel shows the slots of a level two times. While the Spell slots
  block is open, only its groups are Tab stops, and the circles on the
  level headings are hidden from the screen reader. While the block is
  folded, the groups on the headings are the Tab stops.
* The fold button says "Spell slots" with its open or closed state.
* The level links in the block have the names "Go to 1st level" and so
  on.

**Announcements**

* The spell view is a region with the name of the spell. When the
  selected spell changes, a polite live region says the spell name.
* A change of a prepare count is in a polite live region: "Cleric: 9 of
  8 prepared. Remove 1 spell."
* The failed-save note in the panel has the alert role.

**Motion.** Under `prefers-reduced-motion: reduce`, a jump to a level
does not scroll smoothly.

# Changes to the theme spec

This project changes [theme.md](theme.md). The change is in the same
pull request as this document.

* **Dialog:** a `wide` size, up to 1100px, for the panel. The owner can
  give its own header and can set the control that gets the focus at the
  open. The footer is optional.
* **Slot circles:** the paper pattern gets a group that can change, with
  the rule "one more, one less", and a diamond form for pact slots.
* **Spellcasting section:** the "Known limit" for Pact Magic goes. The
  section gets the "Pact" row, circles that change, the "All spells"
  button, spell names that open the panel, names from the record, and
  the cast note.
* **Out of scope for M8:** the line on prepared spells now points to
  this document.

# Build order

This is the order in which the build tickets were filed. They are in the
Linear project "Spells panel", milestone "Build". Linear holds the
tickets, their blocking relations and their status. When this list and
Linear disagree, Linear wins.

1. Spell records: the lookup, spell names from the record, and the cast
   note on the sheet (ORC-280).
2. A sheet change saves at once (ORC-281).
3. Spent spell slots on the sheet (ORC-282).
4. Pact Magic slots apart, as diamonds, on the sheet (ORC-283).
5. The wide Dialog and the spell view (ORC-284).
6. The Spells panel: the ways in, the header, the list, the search and
   the phone views (ORC-285).
7. Spell slots in the panel (ORC-286).
8. Prepared spells in the panel (ORC-287).
9. The builder gets the same prepare rules (ORC-288).
10. More than one source, and the cast note, in the panel (ORC-289).
11. A failed save in the panel (ORC-290).

Tickets 1 and 2 have no blockers and can run at the same time. The
project can run beside the 2024 engine build.

**Review:** each ticket that changes a page attaches Playwright
screenshots to its PR, light first and then dark. A ticket that changes
the phone views adds screenshots at a phone width.

# Out of scope

* Changes to the spells that the character knows: the known spells of a
  sorcerer, the spellbook of a wizard, cantrips. The builder does these.
* A Cast button that spends a slot for a spell.
* Rests, and a "Clear all" or "Long rest" button.
* Hit points, equipment and other feature uses on the sheet. These are
  later projects. They use the save rule of this document.
* Filters in the list other than the search by name.
* A Browse page for spells (ORC-87). This project only makes the spell
  view and the lookup shared parts.
* The fit to the 2024 engine: prepare counts and slots for 2024 classes.
* Corrections to the SRD spell data (ORC-277).
* Backward compatibility with the old app. Spent pact slots show as
  spent slots of their level there.

[^orc-262]: Map: the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-262/map-the-spells-panel>
[^orc-263]: Research: how the record and the engine hold spent spell slots, <https://linear.app/orc-alchemy/issue/ORC-263/research-how-the-record-and-the-engine-hold-spent-spell-slots>
[^orc-264]: Research: what the app can show for each spell, <https://linear.app/orc-alchemy/issue/ORC-264/research-what-the-app-can-show-for-each-spell>
[^orc-265]: Decide how a change on the sheet saves, <https://linear.app/orc-alchemy/issue/ORC-265/decide-how-a-change-on-the-sheet-saves>
[^orc-266]: Decide the rules for preparing spells in the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-266/decide-the-rules-for-preparing-spells-in-the-spells-panel>
[^orc-267]: Prototype the form and layout of the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-267/prototype-the-form-and-layout-of-the-spells-panel>
[^orc-268]: Decide how spent spell slots work in the panel and on the sheet, <https://linear.app/orc-alchemy/issue/ORC-268/decide-how-spent-spell-slots-work-in-the-panel-and-on-the-sheet>
[^orc-269]: Prototype the prepare control and the slot circles in the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-269/prototype-the-prepare-control-and-the-slot-circles-in-the-spells-panel>
[^orc-275]: Decide the last open details of the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-275/decide-the-last-open-details-of-the-spells-panel>
