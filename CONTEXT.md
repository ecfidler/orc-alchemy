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
A tilted yellow note that sits above a box and marks something the user must
act on, for example a choice left in the builder. It never covers the box's
content.
_Avoid_: Sticky, callout, badge

**Alert note**:
A flat note across the top of a page that tells the user about the app's
state: yellow when the user must act, red when something failed, blue for
information.
_Avoid_: Banner, toast, callout

**Use bubble**:
The blue outline around a feature with limited uses, holding one circle for
each use and the rest type that restores them.
_Avoid_: Pill, chip, tracker
