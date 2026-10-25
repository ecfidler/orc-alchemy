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
