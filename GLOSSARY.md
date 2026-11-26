# Orc Alchemy

The domain language of the Alchemy 5e app and the packages around it. It names
the concepts that the code, the docs and the Linear issues share.

## Language

**Preference**:
A choice that changes how the app looks or works for the user, for example the
theme (Light, Dark or Match System). A preference never changes a character or
content record and is never exported; once Demiplane exists, it syncs with the
user's account.
_Avoid_: Setting, option, config

**Stuck note**:
A note attached to one place on a page, such as a box on the sheet or a step
in the builder, that marks something the user must act on there. It never
hides what it marks.
_Avoid_: Sticky, callout, badge

**Alert note**:
A note at the top of a page about the app's state as a whole, for example
that saving failed or that data is not being saved.
_Avoid_: Banner, toast, callout

**Use bubble**:
The frame around a feature with limited uses, which shows its uses and the
rest that restores them. The user spends a use and gets it back there.
_Avoid_: Pill, chip, tracker, spent-ability bubble

**Uses**:
How many times a feature can be used before a rest restores it: an amount
and a rest. The amount is fixed, or it scales with the character. In place
of a rest, the uses can come back at dawn or each turn.
_Avoid_: Charges, frequency (the stored key only), limited uses

**Suggested uses**:
Uses and a type that the app reads from the text of a feature. The user
saves them or skips them; the app never saves them without the user.
_Avoid_: Auto uses, detected uses, guess

**Review uses**:
The page for one pack that lists its features with suggested uses, where
the user saves or skips them.
_Avoid_: Uses wizard, bulk edit

**Modifier**:
One group on a homebrew form that changes what the item gives, for example
Damage Resistances or Skill Proficiencies. In the class and subclass forms,
a **level modifier** is one row that gives one thing at a level. An ability
modifier is the game value, not this term.
_Avoid_: Option, property, section

**Common modifier**:
A modifier that a homebrew form always shows. The user adds the other
modifiers from the "Add a modifier" list.
_Avoid_: Default modifier, basic field

**Picker**:
A form control for some items from a long list: an add button that opens a
list in a modal, which stays open while the user picks.
_Avoid_: Multi-select, chooser, dropdown

**Token**:
One pick on a form: a small box with the name and an X that removes it. A
color or size of the theme is a "theme token", not this term.
_Avoid_: Chip (a chip holds a level number), tag, pill

**Source tag**:
A small box that only shows where a value comes from, such as "+2 Race" in
an ability box of the builder. It has no X, and the user cannot remove it.
_Avoid_: Token (a token is a pick that the user can remove)

**Spells panel**:
The popup that opens from the Spellcasting section of the character sheet.
It shows the spells of the character with their text, and the user sets
prepared spells and marks spent slots there.
_Avoid_: Spellbook, spell list, spell sheet, spells modal

**Spellbook**:
The wizard's book of known spells, and nothing else. The Spells panel is
not a spellbook, and the known spells of another class are not one.
_Avoid_: Grimoire, spell list

**Play state**:
The part of a character that changes during play, for example prepared
spells, spent slots, hit points and spent uses. The builder does not set it.
The Sheet interactivity spec lists each part.
_Avoid_: Session state, tracker, live data

**Sheet change**:
A change to the play state that the user makes from the character sheet.
It saves at once.
_Avoid_: Edit (the builder edits), quick edit, sheet edit

**Spent slot**:
A spell slot that the character has used and that a rest gives back. A
filled circle shows it, or a filled diamond for a Pact Magic slot.
_Avoid_: Used slot, expended slot, slots-used (the stored key only)

**Prepare count**:
The number of spells that a class has prepared and its limit, for example
"5 of 8 prepared".
_Avoid_: Prepared limit, spell count

**Always-prepared spell**:
A spell that a class has prepared with no choice, for example a domain or
oath spell. It is not in the prepare count.
_Avoid_: Domain spell (one kind only), free spell, bonus spell

**Cast note**:
A short note on a known spell that says how the character can cast it, for
example "at will" or "once per long rest".
_Avoid_: Qualifier (the stored key only), tag

**Cast**:
The action on a known spell that spends what the spell costs: a spell slot,
a use of a feature, or the two. A cast is a sheet change.
_Avoid_: Use (of a spell), fire, trigger

**Concentration mark**:
The record of the one spell that the character concentrates on. A cast or
the Concentrate button sets it. The user or a long rest removes it.
_Avoid_: Concentration flag, concentration tracker

**Short rest**:
The rest that gives back Pact Magic slots and the uses that recharge on a
short rest, and lets the character spend hit dice.
_Avoid_: Short break

**Long rest**:
The rest that gives back hit points, all spell slots, the uses that recharge
on a short or a long rest, and half of the hit dice.
_Avoid_: Sleep, full rest

**Dawn**:
The time when the uses with the stored unit `day` come back. It is not a
rest. It can come during a long rest.
_Avoid_: Sunrise, day, daily, each day

**Hit dice**:
The dice of a character, one for each level. The user spends a die to heal.
The record keeps the spent dice for each die size.
_Avoid_: HD, hit die pool

**Inspiration**:
The one mark that a character has or does not have. The user sets and
removes it on the sheet, and no rest changes it.
_Avoid_: Heroic inspiration (2024 only), Bardic Inspiration (a feature)

**Condition**:
One of the 14 conditions of the SRD that the user sets on the character, for
example Poisoned. Exhaustion is not a condition, but it is in the same box.
_Avoid_: Status effect, debuff, state

**Exhaustion**:
A level from 0 to 6 on the character. The app applies its effects on the
speed and the hit point maximum, and level 6 is death.
_Avoid_: Fatigue, exhaustion condition

**AC pick**:
The pair of armor and shield whose AC the sheet shows in place of the AC of
the worn armor. It does not change the equipment.
_Avoid_: AC override, equipped armor, loadout

**Step**:
One part of the character builder, for example Class or Proficiencies. The
builder has ten steps in a fixed order, and each step opens at any time.
_Avoid_: Tab, page, stage

**Step rail**:
The row of step buttons across the top of the character builder. It shows
the open step and the left mark of each step.
_Avoid_: Step bar, stepper, breadcrumb, tabs

**Left mark**:
The small yellow count of the picks that are left, on a step in the step
rail and at the heading of a selection: "2 left".
_Avoid_: Badge, "Still to do", remaining count

**Summary card**:
The narrow card at the right of a step in the character builder. It shows
the name, the class, the background, the race and the main values of the
character, and it has no control.
_Avoid_: Preview, mini sheet, sidebar

**Detail panel**:
The panel that shows the full content of the option that the player clicked
in a list, with the button that makes the pick.
_Avoid_: Preview pane, info box, tooltip

**Pick block**:
The block that takes the place of the list and the detail panel after the
main pick of the Background or Race step. Its header has the name, the left
mark, About, Customize and Change; its body has Choices and "Picked on other
steps".
_Avoid_: Card, summary (the summary card is the column at the right of a step)

**Class block**:
The block of one class on the Class step, with its level, its choices, its
hit points and its picks on other steps.
_Avoid_: Class card (a class card is the button that picks a class), class row

**Choice row**:
One choice of a class level on the Class step. It opens to show its
options, and it shows its pick when it is closed.
_Avoid_: Accordion, selection row
