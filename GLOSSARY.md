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
rest that restores them.
_Avoid_: Pill, chip, tracker, spent-ability bubble

**Uses**:
How many times a feature can be used before a rest restores it: an amount
and a rest. The amount is fixed, or it scales with the character. In place
of a rest, the uses can come back each day or each turn.
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
The part of a character that changes during play: prepared spells, spent
slots, and later hit points and feature uses. The builder does not set it.
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
