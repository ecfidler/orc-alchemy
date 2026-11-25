---
type: Reference
title: Sheet interactivity spec
description: The settled design of the play controls on the character sheet - hit points, temporary hit points and death saves, hit dice, recorded feature uses, the Rest button with Short rest, Long rest and Dawn, the Cast button of the spell view, the concentration mark, conditions, exhaustion, inspiration, the AC pick and the ability highlight - with the record of the play state and the run order of the build tickets.
tags: [design, sheet, play-state]
status: stable
generated: { by: claude-code/agent, at: 2026-11-25T00:31:24Z }
resource: https://linear.app/orc-alchemy/issue/ORC-295/map-sheet-interactivity
sources:
  - id: orc-295
    resource: https://linear.app/orc-alchemy/issue/ORC-295/map-sheet-interactivity
    title: "Map: Sheet interactivity (the decisions index)"
---

# Purpose

This document is the spec for the project "Sheet interactivity" of
Alchemy 5e. The build tickets in Linear build what it describes. It
collects the decisions of the map
[Map: Sheet interactivity](https://linear.app/orc-alchemy/issue/ORC-295/map-sheet-interactivity).[^orc-295]
Each decision is in full in the resolution comment of its Linear ticket.
This document gives the rules that the build tickets need.

The [Spells panel spec](spells-panel.md) made the first play controls:
prepared spells and spent spell slots. This project adds the other
controls that a player uses during a session. The player changes hit
points, spends uses and hit dice, takes a rest, casts a spell, and marks
conditions, all on the sheet.

The look comes from the [Theme spec](theme.md). Each change saves by the
rule [How a sheet change saves](spells-panel.md#how-a-sheet-change-saves).

When this document and a prototype disagree, this document wins. When this
document says nothing, use the prototype.

## Prototypes

The prototypes are throwaway HTML. Use them as the visual reference for
sizes, spacing and CSS.

| Prototype | File | Artifact | Use this view |
|---|---|---|---|
| Hit points | [orc-305-hit-points-prototype.html](prototypes/orc-305-hit-points-prototype.html) | [Hit Points Popup](https://claude.ai/artifact/AKZDRS7VBAZg9sFsTLAkLi) | The view that opens |
| Rest dialogs | [orc-309-rest-prototype.html](prototypes/orc-309-rest-prototype.html) | [Rest Dialogs](https://claude.ai/artifact/DP61aczNGTQgPS5pTfPH7b) | The view that opens: one Rest button with a menu, a Short rest dialog of one page |
| Cast button | [orc-311-cast-prototype.html](prototypes/orc-311-cast-prototype.html) | [Cast Button](https://claude.ai/artifact/AonZwSp9i7RY1XJPg2ULoK) | The view that opens: the split button beside the spell name |
| Sheet layout | [orc-312-sheet-layout-prototype.html](prototypes/orc-312-sheet-layout-prototype.html) | [Sheet Play Controls](https://claude.ai/artifact/XjmsSVb6fZcRapvBnG4UWo) | The view that opens: the box in the vitals panel, the use circles of today |

The Artifacts need a claude.ai sign-in. The copies here do not.

Do not copy these parts of the prototypes:

* The sheet layout prototype adds a line to the Death saves box for the
  "Dead" label. The rule [No layout shift](#no-layout-shift) wins.
* The hit points prototype is older than the Conditions and statuses
  box. The sheet layout prototype shows where that box goes.
* No prototype had a review in dark mode. Use the theme tokens, and
  attach dark screenshots to each pull request.

# Terms

`GLOSSARY.md` at the repository root defines the terms of this document:
**Play state**, **Sheet change**, **Uses**, **Use bubble**, **Short
rest**, **Long rest**, **Dawn**, **Hit dice**, **Cast**, **Concentration
mark**, **Inspiration**, **Exhaustion**, **Condition** and **AC pick**.

In this document, a **recharge group** is the unit of a feature with
uses, for example `long-rest`. The **vitals panel** is the shaded panel
at the top of the right column of the sheet.

# Scope

* This document is for a 2014 character, which the engine `@pubdoor/dmv`
  builds. A 2024 character keeps the sheet of today.
* The builder preview shows the play state, but its controls cannot
  change. The preview has no Rest button. Its Hit points box has no
  Temporary part, and it has no Death saves box (ORC-245).
* The engine does not change. Four engine gaps are in ORC-307, and this
  document names each place that waits for it.

# General rules

## No layout shift

A change to the play state must not move the other parts of the sheet or
change the size of a dialog.[^orc-309] [^orc-312]

* A box keeps the space for a mark, a caption or a tag before it shows.
* A label that comes and goes takes the place of another part. For
  example, the "Dead" label takes the place of the failure circles.
* A list in a dialog has a fixed set of rows. A row with nothing to say
  shows "No change" or "No dice spent".
* A control that cannot be used stays in its place, disabled.
* The Conditions and statuses box is the one exception. It can get one
  more line when its tokens do not fit on the lines that it has.
* A text that comes and goes, for example what the last action did,
  shows in [the status toast](#the-status-toast). The toast is over the
  page and takes no space in it.[^orc-326] Reserved space is only for a
  mark, a caption, a tag or a hint that belongs to its box.

Each build ticket checks this with a test that measures the box or the
dialog before and after the change.

## Text of a change

* A count that changes has a sign: "+2", "−1". Use the minus sign U+2212.
* A value that changes has an arrow: "20 → 24". With a maximum:
  "12 → 18 / 44".
* A section title in a dialog is large and bold (16px, weight 600). It
  is not small caps.
* Do not add text that repeats what the sheet shows beside it.

## Popups

* A small popup opens under the box that the user clicked. It has a
  title, its controls and no close button. Escape and a click outside
  close it.
* At the open, the focus goes to the first field. At the close, it goes
  back to the control that opened the popup.
* When the sheet is narrower than 720px, the popup has the width of the
  vitals panel.
* After an action, the popup closes. The status toast then says what
  changed.

## The status toast

The sheet page has one status toast.[^orc-326] It shows the text of the
last action, for example "12 damage (5 from the temporary hit points)."
A cast in the Spells panel uses the same toast.

* The toast is at the bottom centre of the screen, 16px above the bottom
  edge and above the safe area of a phone. It is over the page and takes
  no space in it, so a text that comes and goes moves nothing. The
  vitals panel has no status line and no reserved space for one.
* The text is on a plain surface: the paper, an ink border and the
  shadow of the small popup. A long text wraps. On a phone the toast
  keeps a 16px gutter on each side.
* The text hides after 6 seconds. It does not hide while the pointer or
  the focus is on the toast. The time starts again when they leave.
* The next action replaces the text and starts the time again. The same
  text twice also shows again.
* An action with nothing to say, for example a change of the death save
  circles, hides the text.
* The toast is empty when the sheet opens. A read-only sheet, for
  example the builder preview, has no toast.
* The toast is above the Spells panel and the rest dialogs, and under a
  small popup or a menu.
* It fades in and out. With `prefers-reduced-motion: reduce` it does
  not move or fade.
* The text is a polite live region that is always in the page.

# The record

The play state is in the strict entity, under keys that the app
owns.[^orc-296] The engine keeps a key that it does not know. It keeps it
through `setValue`, `evaluate`, `addLevel`, `removeLevel`, export and
import.

* `built` does not report these keys. Read them from the strict entity,
  as `packages/app/src/engine/spells.ts` reads the spent slots.
* Write with `setValue(entity, "<full key>", value)`. The key needs its
  full namespace.
* The engine removes `null` and each empty collection. It keeps `0` and
  `false`.
* The new keys are in the namespace `orc-alchemy.play`.

| State | Key | Value | Empty state |
|---|---|---|---|
| Current hit points | `orcpub.dnd.e5.character/current-hit-points` | An integer | `null`: the character has full hit points |
| Temporary hit points | `orc-alchemy.play/temp-hit-points` | An integer above 0 | `null` |
| Death saves | `orc-alchemy.play/death-saves` | `{"~:successes": 2, "~:failures": 0}` | `null` when the two counts are 0 |
| Spent hit dice | `orc-alchemy.play/hit-dice-spent` | A map of die size to count: `{"~i10": 2, "~i6": 1}` | No entry for a die with 0 spent |
| Spent uses | `orc-alchemy.play/uses-spent` | A map of recharge group to a map of feature name to count | No entry for a feature with 0 spent |
| Concentration mark | `orc-alchemy.play/concentration` | The spell key: `"~:bless"` | `null` |
| Conditions | `orc-alchemy.play/conditions` | A set of keywords: `{"~#set": ["~:poisoned", "~:prone"]}` | No key: the engine removes the empty set |
| Exhaustion | `orc-alchemy.play/exhaustion` | An integer from 1 to 6 | `null` |
| Inspiration | `orc-alchemy.play/inspiration` | `true` | `null` |
| AC pick | `orc-alchemy.play/ac-pick` | `{"~:armor": "~:chain-mail", "~:shield": null}` | `null` |

Spent spell slots stay under `orcpub.dnd.e5.spells/slots-used`, as
[The record](spells-panel.md#the-record) of the Spells panel spec says.

**Readers and writers.** One module, `packages/app/src/engine/play.ts`,
reads and writes these keys. A reader accepts a value that is not valid
and gives the empty state for it. A count above its limit reads as the
limit. A writer writes the empty state as the table says, so that the
record stays small.

**Spent uses.** The group key is the unit keyword of the feature as the
engine gives it, for example `~:orcpub.dnd.e5.units/long-rest`. A
feature with no unit uses `~:orc-alchemy.play/no-recharge`. The inner
key is the feature name as a string. The ticket that builds the module
tests this shape against the engine before other tickets use it.

**Export and import.** The play state stays in an export and shows after
an import. This needs no new work.

**The old app.** The old app ignores these keys. Its server refuses a
save that has them. Backward compatibility is not a goal.

# Hit points

The decisions are in ORC-299, and the look is in ORC-305.[^orc-299] [^orc-305]

## The box

The Hit points box has two parts, and each part is a button that fills
its part of the box.

* The left part is **Temporary**. It shows the temporary hit points, or
  nothing when there are none.
* The right part shows current / max.
* On hover and on focus, the full box gets an inset ring, and the number
  of that part gets an underline.
* At 0 hit points, the current number is red (`--caution`).
* The sheet shows the lower of the stored value and the maximum. This
  closes ORC-119. The builder does not change the stored value.

## The Hit points popup

A click on the current part opens the popup "Hit points". It has one
Amount field and three buttons: **Damage**, **Heal** and **Set HP**.
There is no keypad, no preview, and no line that repeats the hit points.
Set HP is the control that ORC-123 asked for.

If the field has no number, the popup stays open and a note says so. An
amount is a whole number of 0 or more. The user types the damage after
resistance or vulnerability. The app does not apply them.

**Damage**

1. The damage takes the temporary hit points first.
2. The damage that is left lowers the current hit points. They stop
   at 0.
3. If the hit points go to 0 and the damage that is left is equal to the
   maximum or more, the character dies at once. The app fills the three
   failure circles and shows "Dead".
4. If the hit points were 0 before the damage, the damage adds one
   failure. There is no control for a critical hit. The user adds the
   second failure on the circles.
5. If the character is Stable, the damage clears the successes and adds
   one failure.

**Heal**

* Heal always works, also from Dead. It adds to the current hit points
  and stops at the maximum.
* When the result is the maximum, the app writes `null`, which is full.
* Heal clears the two death save counts.

**Set HP** writes the amount as the current hit points. An amount above
the maximum writes `null`. An amount above 0 clears the death save
counts. Set HP does not change the temporary hit points.

**The status toast** after each action:

* "12 damage (5 from the temporary hit points)."
* "8 healed."
* "Hit points set to 20."

## The Temporary hit points popup

A click on the Temporary part opens the popup "Temporary hit points". It
has one field and the buttons **Set temp HP** and **Remove**.

* The field starts with the amount of now.
* The new amount replaces the old amount, also when it is smaller.
* An amount of 0, or Remove, takes the temporary hit points away.
* There is no "Add temp HP" button.

## The concentration note

When the character has a concentration mark, a yellow note line shows
after Damage. It gives the DC of the Constitution save: 10, or half the
damage if that is higher, rounded down. Example: "Concentration on
Bless: Constitution save, DC 10." The note has a Dismiss button.

* The note shows in [the status toast](#the-status-toast), above the
  text of the action.[^orc-326] It is a yellow sticky note with a folded
  corner. It takes no space in the sheet, so it moves nothing.
* The note does not hide with the time. It stays until Dismiss, or until
  the next action. Each action that ends the mark, for example the X of
  the mark or a long rest, is a next action.
* After Dismiss from the keyboard, the focus goes back to where it was
  before it went into the toast.
* The app does not roll the save and does not end the concentration.

* The DC comes from the full damage, also the part that the temporary
  hit points take. Damage of 0 shows no note.

## The hit point maximum

The maximum is the engine value. Exhaustion level 4 halves it (see
[Exhaustion](#exhaustion)). Each rule of this section uses the maximum
that shows.

* The app writes `null` (full) only at the engine value. At a halved
  maximum, Heal, Set HP and a rest write the number, so that the hit
  points do not come back when the level goes down.[^orc-323]

# Death saves

* The Death saves box has two groups of three slot circles, successes
  and failures. The circles can change with the rule "one more, one
  less" of the slot circles.[^orc-299]
* The circles can always change. The app does not hide them above 0 hit
  points.
* Three successes show the tag **Stable**, in green, beside the label
  "Death saves". The box keeps the space for the tag.
* Three failures show the label **Dead**, in red (see below). There is
  no second Dead tag beside the label "Death saves".
* A hover on a group gives a light fill to the circle that a click
  changes.
* Heal, a Set HP above 0, and a long rest clear the two counts.
* A click on the Dead label reverses an instant death, one failure at a
  time.
* Three successes do not change the hit points.

**The Dead label.** When the character is dead, the label "Dead" takes
the place of the failure circles, and it is a button. A click on it
clears one failure, and the circles come back. The character is dead
with three failures, or with exhaustion level 6. With exhaustion level
6, the label is not a button, and the stored counts do not change.

# Hit dice

The decisions are in ORC-300 and ORC-312.[^orc-300] [^orc-312]

* The Hit dice box is a button. It shows the dice that are left for each
  die size, as "3 / 5" with the die size "d10". A multiclass character
  has one such pair for each die size, the largest die first.
* Two classes with the same die size share one pair.
* A click opens the popup "Hit dice". It has one row for each die size.
  Each row has a Roll field, **Spend**, **Roll for me** and **Regain**.
* **Spend** takes the number that the user rolled on the die. It adds
  the Constitution modifier. The result is 0 or more. The result heals
  by the Heal rule, and one die of that size becomes spent.
* **Roll for me** rolls the die, and then does the same as Spend.
* **Regain** gives one spent die back. It does not change the hit points.
* Spend and Roll for me are disabled when no die of that size is left.
  The user can spend a die at full hit points.
* The status toast says "Hit die d10: 7 + 2 = 9 healed."

# Feature uses

The decisions are in ORC-300, and the look is in ORC-312.[^orc-300] [^orc-312]

The use bubble keeps its look of today: one blue circle for each use,
and an ink slash on a spent circle. The app now records the spent uses.

* **Circles** (8 uses or fewer): the rule is "one more, one less". A
  click on a free circle spends the first free circle from the left. A
  click on a spent circle gives the last spent one back.
* **Pools** (more than 8 uses): a minus button and a plus button change
  the number of uses left by one. A click on the number opens a popup
  with a number field and the buttons **Spend**, **Regain** and **Set**.
  Spend and Regain stop at 0 and at the maximum.
* **The count.** The record keeps one spent count for each feature name
  and recharge group. Two features with the same name and group share
  the count. Example: Channel Divinity of a cleric and a paladin. Each
  bubble shows the shared count against its own amount.
* A count above the amount reads as "all spent". The stored count stays.
* **Turn uses.** A feature with the unit `turn` has no circles. Its
  recharge tag says "Once per turn", or "2 per turn" for a larger
  amount. The SRD has nine such features, for example Sneak Attack.
* **Round, minute and hour uses**, and a feature with no unit, have
  circles. No rest clears them. The user clears them by hand.
* **Dawn.** The unit `day` has the name "Dawn" in the recharge tag of
  the bubble. The Recharges toggle of the homebrew forms says "Dawn" in
  place of "Day". The stored unit does not change. Arcane Recovery thus
  shows "Dawn".
* **Old records.** The old app keeps spent uses under
  `orcpub.dnd.e5.character/features-used`, as strings of the form
  `"<name>-<i>"`. When the app imports a character that has this key and
  no `uses-spent` key, it makes the counts from the strings one time.
  For a feature with fewer than 5 uses, the count is the number of its
  strings. For a feature with 5 uses or more, the string holds the uses
  left. The app does not change the old key and does not read it again.
* **Engine gaps (ORC-307).** Ki, Breath Weapon, Relentless Endurance and
  Font of Inspiration have no uses in the engine. They stay plain
  features until ORC-307.

# Rests

The decisions are in ORC-301, and the look is in ORC-309.[^orc-301] [^orc-309]

## The Rest button

* One **Rest** button is in the action row, before Edit. It has the moon
  icon of the pixel icon set, before its label.
* It opens a menu: **Short rest**, **Long rest** and **Dawn**. The menu
  has Dawn only when the character has one feature or more with Dawn
  uses.
* The icon is an addition to the label, as the Theme spec says for each
  icon. When the action row is narrower than 720px, the button shows the
  label only, as Save, Edit and Export do. The row stays on one line at
  390px.
* Each entry opens a dialog. A rest is a bulk action, and the dialog is
  its confirmation.

## Rules for the three dialogs

* The dialog lists what the rest changes, under the title "This rest
  will change". The list has a fixed set of rows. A row with no change
  says "No change".
* **Finish** writes all the changes as one sheet change. **Cancel**
  changes nothing.
* When the rest changes nothing, the dialog says so, and Finish works.
  The line "Nothing will change." is under the rows. When a pick can
  change whether the rest changes something, the dialog keeps the space
  of the line.
* The dialog does not change its size while the user works in it.
* Each dialog is up to 520px wide (the narrow Dialog). At 600px and less
  it fills the screen.
* After Finish, the status toast says "Short rest finished.", "Long rest
  finished." or "Dawn finished."

## Short rest

The dialog is one page with three sections.

**Spend hit dice**

* One row for each die size, with the controls of the Hit dice popup
  without Regain.
* A spent die shows as a token with only its result ("+6") and an X. The
  X takes the die back. The token line is always there. With no die, it
  says "No dice spent".
* A total line shows the hit points: "12 → 18 / 44".
* If a count is wrong after the rest, the user corrects it in the Hit
  dice popup.
* When no die is left, or the hit points are full, the controls stay in
  their place, disabled.
* The note of a roll that is not valid shows over the total line. It
  takes no space of its own (ORC-319).

**Arcane Recovery**

* The section shows when the character has the feature Arcane Recovery
  and its use is not spent.
* The user picks spent slots to get back. The sum of their levels is at
  most half the wizard level, rounded up. No slot is of 6th level or
  higher.
* Only other slots count. Pact slots come back with the rest.
* When the user picks one slot or more, Finish gives the slots back and
  spends the use.

**This rest will change**

* Hit points, with the arrow.
* Hit dice, as a signed count for each die size.
* Pact Magic slots: all come back.
* Each spent use of the groups `short-rest` and `rest`, by feature name,
  with its signed count.
* One row for each slot level that Arcane Recovery can give back, and
  one row for the use of Arcane Recovery. These rows show only with the
  Arcane Recovery section.

## Long rest

The dialog lists these changes.

* Hit points go to the maximum that applies after the rest. The app
  writes `null` only at the engine value. From exhaustion level 4, it
  writes the halved number. See
  [The hit point maximum](#the-hit-point-maximum).
* Temporary hit points go to 0.
* All spell slots come back, Pact Magic slots also.
* Each spent use of the groups `short-rest`, `rest` and `long-rest`
  comes back.
* Spent hit dice come back, up to half the total number of hit dice, and
  at least 1. The largest die comes back first.
* The death save counts clear.
* The concentration mark clears.

Two checkboxes can show, and each is on at the start.

* **Ate and drank** shows when the exhaustion level is above 0. When it
  is on, the level goes down by 1. The hit points then go to the
  maximum that applies after that change. The "Hit points" row shows
  that maximum. When the checkbox changes it, the row stays and says "No
  change" in the state that does not heal.[^orc-323]
* **Dawn came during the rest** shows when the character has Dawn uses.
  The dialog then has the Dawn list (see [Dawn](#dawn)). When the
  checkbox is off, the list stays in its place and its fields are
  disabled, so the dialog keeps its size.

The list has one row for each value that changes, in the order above.
The rows are "Hit points" ("9 → 32 / 32"), "Temporary hit points"
("4 → 0"), one row for each slot level and for the Pact Magic slots, one
row for each use by feature name, one row for each die size ("+2"),
"Death saves" and "Concentration" ("cleared"), and "Exhaustion"
("2 → 1", or "No change" when "Ate and drank" is off). The Dawn list is
under the checkboxes, with the title "At dawn". It has no rows in the
list "This rest will change".

A long rest does not change inspiration, the conditions, or the uses of
the groups `round`, `minute` and `hour`. The dialog has no note and no block
for a character at 0 hit points.

## Dawn

Dawn is the time when the uses of the group `day` come back. Many magic
items give back a rolled number of charges, so the app asks for each
number.

* The dialog lists each feature with Dawn uses, with a number field for
  the uses that come back.
* Each field starts at the spent count, thus all uses come back.
* The field stops at the spent count.
* A feature with no spent use shows "No change" and has no field.
* In the Dawn dialog, these rows are the list "This rest will change".

# Casting a spell

The decisions are in ORC-302, and the look is in ORC-311.[^orc-302] [^orc-311]

The **Cast** button is in the spell view of the Spells panel. The sheet
and the list of the panel have no Cast button. The spell view stays a
shared part: the panel gives it the cast control as its owner, as it
gives the prepare line.

## Where the control is

* The control is beside the spell name, on the right. When the name
  block is too narrow, the control goes under the name.
* The Cast button has the sparkles icon of the pixel icon set, before
  its label. The icon is an addition to the label.
* A hint line is under the control. It is always there, so the name
  block keeps its height. It is the one line of the control: what a
  cast did shows in [the status toast](#the-status-toast).[^orc-326]
* A spell that the character cannot cast now has no control. An
  unprepared spell of a class that prepares is such a spell.
* A cantrip, a spell with the cast note "at will", and a ritual cast
  have no Cast button. There is no "Cast as a ritual" control.

## A cast with a spell slot

* The control is a split button. The main part, **Cast**, spends one
  slot of the level of the spell. The arrow part opens the menu "Cast at
  a higher level".
* The hint says which slot Cast spends: "1st-level slot · 3 left".
* When no slot of the spell level is left, Cast is disabled and the menu
  still works. The hint says "No 1st-level slot left. Pick a higher
  level."
* When no slot of the spell level or higher is left, the button says
  "No slots left" in place of "Cast", and its two parts are disabled.
  With the menu, the hint says "Each slot that can cast this spell is
  spent." With no menu, it says "3rd-level slot · none left".
* The app never spends a slot of a higher level without a choice of the
  user.
* When the character has only one slot level that can cast the spell,
  the control is a plain Cast button with no arrow part.

**The menu.** Each entry has three columns: the level ("3rd level"), the
calculated amount with a sign ("+2d6", "+1 dart"), and the slots left
("2 left"). A level with no slot left is disabled and says "none left".
A level that the character has no slots for is not in the menu.

**Pact Magic slots**

* A character with pact slots and other slots: Cast spends an other
  slot. The menu has an entry for the pact slots, "Pact (2nd)", when the
  pact slot level is the spell level or higher.
* A warlock with no other slots: Cast spends a pact slot. There is no
  menu, because a pact slot has one level. The hint says "Pact slot
  (5th) · 2 left · +4d10 at 5th level".

**The calculated amount.** The app reads the amount from the "At Higher
Levels" text of the spell record when the text says "for each slot level
above". The amount for a level is the amount of the text times the
number of levels above the base level. The base level is the ordinal
after "above" in the text, for example 2 for "above 2nd". If the text
has no ordinal there, the base level is the spell level.

* Dice multiply by the count: "1d6 for each slot level above 1st" gives
  "+2d6" at 3rd level.
* A count of things multiplies: "one more dart" gives "+2 darts".
* A number with no unit takes its unit from the words before it. "Hit
  points increase by an additional 5" and "the amount of healing
  increases by 10" count hit points: "+5 hit points". "The challenge
  rating increases by 1" gives "+1 challenge rating". If the words give
  no unit that the app knows, the menu shows the text, not a bare number.
* The SRD has 70 such spells. A pack spell with the same words gets the
  same rule.
* Of the 70 SRD spells, 65 show an amount. 5 show the text, because
  their sentence has no amount or more than one.
* For a spell with other words (21 SRD spells), the menu has no amount
  column. The "At Higher Levels" text shows at the bottom of the menu.
* A spell with no "At Higher Levels" text has entries with no amount.
* If the app cannot read an amount, it uses the text. It does not guess.

**The write.** A cast is one sheet change. It spends the slot by the
rules of [The record](spells-panel.md#the-record) of the Spells panel
spec. A click on the slot circle gives the slot back. There is no other
undo.

**The status toast** says what the cast did: "Cast Magic Missile at 2nd
level. 2nd-level slots −1 (1 left)." A cast at the spell level names no
level: "Cast Magic Missile. 1st-level slots −1 (3 left)." The toast is
over the Spells panel, so a cast moves nothing in the name block.[^orc-326]

**The focus after a cast.** A cast can disable the button that has the
focus, for example Cast after the last slot of its level. The focus
then goes to the first button of the control that is not disabled. If
all its buttons are disabled, the focus goes to the hint line, which
says why. The focus stays in the control.

**On a phone.** The menu has the full width of the panel, under the name
block.

## A spell with its own uses

Some spells come from a feature that has uses. The cast note names it.

* **Mystic Arcanum.** A spell with the cast note "uses Mystic Arcanum"
  casts with one use of the feature Mystic Arcanum. The link is the cast
  note, not a list of spell names, so a pack spell works. The app
  accepts two casts of the same spell. The hint says "Spends Mystic
  Arcanum (1 of 1 left)." With no use left, Cast is disabled, and the
  hint says "Mystic Arcanum has no use left."
* **Invocation spells.** Six spells cast with a pact slot and one use
  of an invocation. The app keeps a small table for them:

  | Spell key | Feature |
  |---|---|
  | `compulsion` | Eldritch Invocation: Bewitching Whispers |
  | `confusion` | Eldritch Invocation: Dreadful Word |
  | `polymorph` | Eldritch Invocation: Sculptor of Flesh |
  | `bestow-curse` | Eldritch Invocation: Sign of Ill Omen |
  | `bane` | Eldritch Invocation: Thief of Five Fates |
  | `conjure-elemental` | Eldritch Invocation: Minions of Chaos |

  The table applies when the known spell has a cast note that starts
  with "once per". The ticket that builds this checks each key and name
  against the engine. The hint says "Spends Thief of Five Fates (1 left)
  and a pact slot (5th, 2 left)." Cast is disabled when the use or the
  slot is not there. With no use left, the hint says "Thief of Five
  Fates has no use left." With no pact slot left, it says "No pact slot
  left."
* **A note with no link.** A spell with the cast note "uses …" or
  "once per …" that the app cannot link has no Cast button. A line says
  "This spell has its own uses (Fey Step). Spend the use on the sheet."
  The line shows only for these two notes. A spell with another cast
  note, not "at will" and not a ritual cast, has no control and no line.
* **The hint** of a cast with a use keeps the height of two lines,
  because the hint of an invocation spell wraps.
* **Race spells (ORC-307).** The engine gives no cast note for the four
  race spells of the tiefling and the drow. They cast with a slot until
  ORC-307.

A cast that spends a use changes the same count that the use bubble on
the sheet shows. The status toast names the use with the uses left, as
it names a slot: "Cast Circle of Death. Mystic Arcanum −1 (3 left)."
For an invocation spell it also names the pact slot: "Cast Bane at 5th
level. Thief of Five Fates −1 (0 left), Pact slots −1 (3 left)."

## Concentration

* When the user casts a spell that needs concentration, the app sets the
  concentration mark to that spell.
* If a mark is set for another spell, the app asks first. The dialog has
  the title "Cast Invisibility?" and the text "You concentrate on Hold
  Person. Invisibility also needs concentration, so Hold Person ends."
  The buttons are Cancel and "Cast and end Hold Person".
* A cantrip or an at-will spell that needs concentration has an outline
  **Concentrate** button in the place of the Cast control. It sets the
  mark and spends nothing. The hint says "This sets the concentration
  mark and spends nothing."
* While the mark is set for this spell, the Concentrate button is
  disabled. The hint then says "You concentrate on this spell."
* After the Concentrate button, the status toast says "Concentrating on
  Guidance."
* If the mark is set for another spell, the Concentrate button also asks
  first. The dialog has the title "Concentrate on Guidance?" and the
  text "You concentrate on Bless. Guidance also needs concentration, so
  Bless ends." The buttons are Cancel and "Concentrate and end Bless".
* The mark shows in the Conditions and statuses box as "Concentrating on
  Bless", with an X that removes it.
* A long rest clears the mark. Damage does not clear it (see
  [The concentration note](#the-concentration-note)).
* The mark stays when the spell is no longer a known spell. The token
  then shows the name that the app makes from the key.

# Conditions and statuses

The decisions are in ORC-303, and ORC-312 replaced the exhaustion
control and gave the layout.[^orc-303] [^orc-312]

## The box

One box, **Conditions and statuses**, is in the vitals panel, in a row
under the hit points. On a phone it is on the Stats tab, in the same
place. The box holds tokens in this order:

1. The concentration mark, in the bubble color, with an X.
2. The condition tokens, in the order of the menu.
3. The Unconscious token that the app adds at 0 hit points.
4. The Exhaustion token.
5. The button **+ Add condition**.

The box always shows, also when it has only the button. A read-only
sheet, such as the builder preview, shows the tokens with no X and no
button, and shows the box only when it has a token.

## Conditions

* The list is fixed: the 14 conditions of the SRD. Blinded, Charmed,
  Deafened, Frightened, Grappled, Incapacitated, Invisible, Paralyzed,
  Petrified, Poisoned, Prone, Restrained, Stunned and Unconscious. There
  are no custom conditions.
* "+ Add condition" opens a menu of the conditions that are not set,
  with Exhaustion as its last entry.
* An entry has the note "immune" when the character is immune to the
  condition with no qualifier. An immunity with a qualifier, such as
  "by elementals or fey", gives no note. The user can add it anyway.
* An entry has the note "speed 0" when the condition sets the speed
  to 0.
* A condition is a token with an X. The X removes it.
* A click on the name of a token opens a small popup with the rule text
  of the condition from the SRD, as a short list of rule points.
* **Speed 0.** Grappled, Restrained, Paralyzed, Petrified, Stunned and
  Unconscious set each speed of the sheet to 0. The Unconscious token
  that the app adds at 0 hit points does too. With two such conditions,
  the caption names the first in the order of the menu.
* **Unconscious at 0 hit points.** When the hit points are 0 and the
  character is not dead, the app shows an Unconscious token by itself.
  It has a dashed border and the note "0 hit points". It has no X, and
  it is not in the record. A Stable character keeps it.
* The user can still add Unconscious by hand, and the menu always has
  it. The token from the record then shows, with its X, in place of the
  token that the app adds.
* No rest changes the conditions.
* **The status toast** after each action: "Poisoned added.", "Poisoned
  removed.", "Concentration on Bless ended."

## Exhaustion

* Exhaustion has no control of its own. The menu entry "Exhaustion" adds
  the Exhaustion token at level 1, at the end of the tokens.
* The token has its name, six circles and an X. The circles show the
  level, with the rule "one more, one less".
* The X removes the token and sets the level to 0. A click that takes
  the level to 0 also removes the token.
* The token has no "Level n" label and no effect text.
* A hover on the token shows the effects of the six levels. The levels
  that apply are bold. A click on the name shows the same popup, for
  touch.

The app applies these effects. It rounds down to a whole number, with no
5-foot step: a speed of 25 becomes 12, and 45 hit points become 22.

| Level | Rule text | What the app does |
|---|---|---|
| 1 | Disadvantage on ability checks | Text only |
| 2 | Speed halved | Each speed shows at half |
| 3 | Disadvantage on attack rolls and saving throws | Text only |
| 4 | Hit point maximum halved | The maximum shows at half |
| 5 | Speed reduced to 0 | Each speed shows 0 |
| 6 | Death | The Death saves box shows "Dead" |

* **Level 4.** When the level goes to 4, the app writes the current hit
  points down to the new maximum, if they are higher. They do not come
  back when the level goes down.
* **Level 6.** The hit points and the death save circles do not change.
  A lower level removes the "Dead" label.
* The popup that a hover opens closes when the mouse leaves the token,
  unless a click opened it. It does not take the focus. A screen reader
  reads "(applies)" after each level that applies.[^orc-323]
* When the circles take the level to 0 with the focus on them, the focus
  goes to "+ Add condition".
* **The status toast** after each change: "Exhaustion added.",
  "Exhaustion removed.", "Exhaustion 1 → 2.". When level 4 writes the
  hit points down: "Exhaustion 3 → 4, hit points 30 → 22."

## Marks on the sheet

* **Speed.** When a condition or exhaustion changes the speed, the
  number shows the result, and a caption in red caps under it gives the
  cause: "EXHAUSTION", "RESTRAINED". With two causes, the lowest result
  shows, with the cause of that result. The caption takes the place of
  the qualifier of the speed, for example "UNARMORED".
* **Hit point maximum.** The caption under the Hit points box is
  "MAXIMUM HALVED · EXHAUSTION". It is one line at each width, centred
  on the hit points part, and it can run a few pixels past that part.
  The box keeps the space of one line for it.

# Inspiration

* The Inspiration box in the left column is a button. A click sets
  inspiration, and a second click removes it.[^orc-303]
* With inspiration, the box shows a mark. The mark is the `check` icon,
  until inspiration has an icon of its own. The box does not change its
  size.
* No rest changes inspiration.
* The button has `aria-pressed`. Its accessible name is "Inspiration".
  The mark is hidden from a screen reader, because `aria-pressed` gives
  the state.
* On a sheet with no play controls, for example the builder preview, the
  box shows the mark and is not a button.

# AC pick

The decisions are in ORC-304, and the look is in ORC-312.[^orc-304] [^orc-312]

* The Armor Class box is a button. It opens the menu "Armor class
  shows".
* The first entry is "Worn armor". It removes the AC pick. The other
  entries are the rows of the table "AC by armor": each pair of armor
  and shield, with its AC.
* A pick changes only the number in the Armor Class box. The app never
  writes `worn-armor` or `wielded-shield` from the sheet.
* The Armor Class box has no caption for the pick.
* In the table "AC by armor", the row whose AC shows has an "E" in a box and bold
  text. The worn pair has the tag "worn".
* When the pick names a pair that is not in the table, the app ignores
  it, with no message. The AC of the worn armor shows.
* Without a pick, the mark is on the worn row. When no row is worn, the
  box shows the best AC, as the old app does, and the mark is on the first
  row with that AC.
* In the menu, each entry shows its AC at the end of its line, and the
  entry that shows is checked. "Worn armor" is checked when there is no
  pick. A pick closes the menu. The status toast hides its text, because
  the number in the box shows the change.
* A pick of the row of the worn pair is a pick too. The app stores it,
  so the box keeps that pair when the worn armor changes later. The menu
  then checks that row, not "Worn armor".
* On a sheet with no play controls, for example the builder preview, the
  box is not a button. The table shows the same marks.
* There is no control for a shield in the off hand. The parity test
  keeps `off-hand-weapon: shield` as a known gap.

# Ability highlight

* Each ability box in the left column is a button.[^orc-304]
* On hover and on keyboard focus, the skills of that ability get a
  highlight in the note color. The saving throw does not, and no other
  part of the sheet does. Constitution has no skill, so it shows nothing.
* A click or a tap keeps the highlight. A second click on the same
  ability, or a click on another ability, removes it. The highlight goes
  at the second click, also while the pointer is on the box. The focus
  that a click gives does not show the highlight. Only a focus that the
  browser shows as a keyboard focus (`:focus-visible`) shows it.
* The highlight is not play state. The app does not save it.
* The highlight changes only colors, so no text moves. The line gets the
  note color as its background, 3px past its edges. The text on it is
  in the note ink, because the note stays yellow in the dark theme.
* Only the sheet with play controls has the highlight. In the builder
  preview, the ability boxes are not buttons.
* The button has `aria-pressed`. Its accessible name says what it does:
  "Strength: highlight the skills".

# Keyboard and screen reader

Each build ticket chooses the ARIA pattern that gives these results, and
its tests check them. The rules of the
[Spells panel spec](spells-panel.md#keyboard-and-screen-reader) for slot
circles apply to each group of circles here.

* Each box that opens a popup or a menu is a button with a name that
  says what it opens: "Hit points, 12 of 44", "Temporary hit points, 5",
  "Hit dice, 3 of 5 d10", "Armor class, 18".
* A group of circles is one Tab stop. The Right and Up arrow keys spend
  or add one. The Left and Down arrow keys give one back.
* A screen reader reads each group with its state: "Death save
  failures, 2 of 3", "Rage, 2 of 3 spent", "Exhaustion, level 2 of 6".
* The minus and plus buttons of a pool have the names "Spend 1 Lay on
  Hands" and "Regain 1 Lay on Hands".
* A token is a group with its name. Its X has the name "Remove
  Poisoned", "Remove Exhaustion" or "Stop concentrating on Bless".
* The effects of exhaustion are reachable from the keyboard: the name of
  the token is a button that opens the popup.
* Enter in the Amount field of the Hit points popup does nothing,
  because the popup has three actions. Enter in the Temporary hit
  points popup does Set temp HP.
* The text of the status toast is a polite live region. It is always in
  the page, also while the Spells panel is open, so a screen reader
  reads each new text, also a text that is the same as the last one.
* The concentration note has the status role and the name
  "Concentration note". Its Dismiss button is a Tab stop. The toast is
  at the end of the page, so Dismiss comes after the last control of the
  sheet.
* The Stable tag and the Dead label are in the name of the Death saves
  box.
* The Cast control is two buttons in a group. The arrow part has the
  name "Cast at a higher level" and opens a menu. A disabled Cast button
  has its hint as its description.
* A rest dialog holds the focus. At the open, the focus goes to the
  first control of the dialog. At the close, it goes back to the Rest
  button.
* A color is never the only sign. The red current number at 0 has the
  Unconscious token beside it, and each red caption says its cause.

# Changes to other specs

The changes are in the same pull request as this document.

**[Theme spec](theme.md)**

* **Action row:** the Rest button, before Edit.
* **Left column:** the ability boxes and the Inspiration box are
  buttons. The table "AC by armor" marks the row that shows.
* **Right column:** the Armor Class box is a button. The speed and the
  hit points get captions. The Hit points box has two parts. The Hit
  dice box is a button. The death save circles change. The vitals panel
  gets the Conditions and statuses box. The sheet page gets the status
  toast at the bottom of the screen (ORC-326).
* **Use bubble:** the "Look only" rule goes. The app records uses. A
  pool gets its minus and plus buttons. The unit `day` shows as "Dawn".
* **Paper patterns:** the rule "No layout shift" for play state.
* **Controls:** the split button and the small popup are new parts of
  `packages/ui`.

**[Spells panel spec](spells-panel.md)**

* The spell view gets the cast control from its owner.
* "Out of scope" no longer lists the Cast button and the rests. The
  lines on a "Long rest" button and on bulk actions point here.

**[Homebrew forms spec](homebrew-forms.md):** the Recharges toggle says
"Dawn" in place of "Day".

**`GLOSSARY.md`:** the new terms, and the entries **Uses**, **Use
bubble** and **Play state** change.

# Build order

This is the order in which the build tickets were filed. They are in the
Linear project "Sheet interactivity", milestone "Build". Linear holds
the tickets, their blocking relations and their status. When this list
and Linear disagree, Linear wins.

1. The play state module: readers and writers for the new keys
   (ORC-313).
2. Hit points: the box, the two popups and the status line (ORC-314).
   ORC-326 later moved the status line to the status toast.
   This closes ORC-119 and ORC-123.
3. Death saves: circles that change, the Stable tag, the Dead label and
   instant death (ORC-315).
4. Recorded feature uses: circles, pools, turn uses, the name "Dawn" and
   old records (ORC-316).
5. Hit dice: the box and its popup (ORC-317).
6. The Rest button and the Short rest dialog, with Arcane Recovery
   (ORC-318).
7. The Long rest dialog and the Dawn dialog (ORC-319).
8. The Cast button with spell slots, the level menu, the calculated
   amounts and the concentration mark at a cast (ORC-320).
9. Cast for spells with their own uses (ORC-321).
10. The Conditions and statuses box: conditions, the token of the
    concentration mark and the concentration note (ORC-322).
11. Exhaustion: the token and its effects (ORC-323).
12. Inspiration and the ability highlight (ORC-324).
13. The AC pick (ORC-325).

Ticket 1 is first. Tickets 2, 4, 8, 12 and 13 need only ticket 1, so
they can run at the same time. The project can run beside the 2024
engine build.

**Review:** each ticket that changes a page attaches Playwright
screenshots to its PR, light first and then dark. A ticket that changes
the phone views adds screenshots at a phone width. Each ticket has a
test for the rule [No layout shift](#no-layout-shift).

# Out of scope

* The full equipment on the sheet (ORC-121), and a change of the worn
  armor from the sheet.
* The "New round" action of the old app. Turn, round, minute and hour
  uses have no automatic clear.
* Dice rolls other than "Roll for me" for a hit die.
* A ritual cast, and cantrip growth by level in the cast control.
* Custom conditions, and the effects of a condition other than speed 0.
* The effects of exhaustion levels 1 and 3 on rolls. The sheet has no
  rolls.
* A limit of one long rest in 24 hours.
* The fit to the 2024 engine: a 2024 character has no play controls from
  this project.
* The engine gaps of ORC-307.
* Backward compatibility with the old app.

[^orc-295]: Map: Sheet interactivity, <https://linear.app/orc-alchemy/issue/ORC-295/map-sheet-interactivity>
[^orc-296]: Research: how the character record can hold the new play state, <https://linear.app/orc-alchemy/issue/ORC-296/research-how-the-character-record-can-hold-the-new-play-state>
[^orc-299]: Decide how damage, healing, temporary hit points and death saves work, <https://linear.app/orc-alchemy/issue/ORC-299/decide-how-damage-healing-temporary-hit-points-and-death-saves-work>
[^orc-300]: Decide how feature uses and hit dice are spent on the sheet, <https://linear.app/orc-alchemy/issue/ORC-300/decide-how-feature-uses-and-hit-dice-are-spent-on-the-sheet>
[^orc-301]: Decide what Short rest, Long rest and Sunrise do, <https://linear.app/orc-alchemy/issue/ORC-301/decide-what-short-rest-long-rest-and-sunrise-do>
[^orc-302]: Decide how cast and upcast work in the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-302/decide-how-cast-and-upcast-work-in-the-spells-panel>
[^orc-303]: Decide how inspiration, exhaustion and conditions work on the sheet, <https://linear.app/orc-alchemy/issue/ORC-303/decide-how-inspiration-exhaustion-and-conditions-work-on-the-sheet>
[^orc-304]: Decide the AC pick and the ability hover, <https://linear.app/orc-alchemy/issue/ORC-304/decide-the-ac-pick-and-the-ability-hover>
[^orc-305]: Prototype the hit points popup and the death save circles, <https://linear.app/orc-alchemy/issue/ORC-305/prototype-the-hit-points-popup-and-the-death-save-circles>
[^orc-309]: Prototype the Rest button and the rest dialogs, <https://linear.app/orc-alchemy/issue/ORC-309/prototype-the-rest-button-and-the-rest-dialogs>
[^orc-311]: Prototype the Cast button and the level menu in the Spells panel, <https://linear.app/orc-alchemy/issue/ORC-311/prototype-the-cast-button-and-the-level-menu-in-the-spells-panel>
[^orc-312]: Prototype the sheet layout for the new play controls, <https://linear.app/orc-alchemy/issue/ORC-312/prototype-the-sheet-layout-for-the-new-play-controls>
[^orc-323]: Exhaustion: the token and its effects on speed, hit points and death, <https://linear.app/orc-alchemy/issue/ORC-323/exhaustion-the-token-and-its-effects-on-speed-hit-points-and-death>
[^orc-326]: Status toast: move the status line and the concentration note out of the vitals panel, <https://linear.app/orc-alchemy/issue/ORC-326>
