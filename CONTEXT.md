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
and a rest. The amount is fixed, or it scales with the character.
_Avoid_: Charges, frequency (the stored key only), limited uses

**Suggested uses**:
Uses and a type that the app reads from the text of a feature. The user
saves them or skips them; the app never saves them without the user.
_Avoid_: Auto uses, detected uses, guess

**Modifier**:
One group on a homebrew form that changes what the item gives, for example
Damage Resistances or Skill Proficiencies. In the class and subclass forms,
a **level modifier** is one row that gives one thing at a level.
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
One pick on a form: a small box with the name and an X that removes it.
_Avoid_: Chip (a chip holds a level number), tag, pill
