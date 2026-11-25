---
type: Reference
title: Theme spec
description: The settled look of Alchemy 5e for M8 - tokens, type, light and dark, the shared UI package, controls, paper patterns, notes, the app shell, Home, Preferences, and the character sheet (layout F).
tags: [design, theme]
status: stable
generated: { by: claude-code/agent, at: 2026-11-24T23:53:55Z }
resource: https://linear.app/orc-alchemy/issue/ORC-102/map-settle-the-app-theme
sources:
  - id: orc-102
    resource: https://linear.app/orc-alchemy/issue/ORC-102/map-settle-the-app-theme
    title: "Map: settle the app theme (the decisions index)"
  - id: theme-notes
    resource: https://linear.app/orc-alchemy/document/alchemy-theme-notes-ef04deb34a0a
    title: Alchemy Theme Notes (Ethan)
---

# Purpose

This document is the theme spec for M8 — Theme. The M8 build tickets in
Linear build what it describes. It collects the decisions of the map
[Map: settle the app theme](https://linear.app/orc-alchemy/issue/ORC-102/map-settle-the-app-theme).[^orc-102]
Each decision is in full in the resolution comment of its Linear ticket.
This document gives the values and rules that a builder needs.

When this document and a prototype disagree, this document wins. When this
document says nothing, use the prototype.

## Prototypes

The prototypes are throwaway HTML. Use them as the visual reference for
sizes, spacing and CSS. Copies are in [`prototypes/`](prototypes/). Open a
file in a browser.

| Prototype | File | Artifact | Use this view |
|---|---|---|---|
| Palette | [orc-144-palette-prototype.html](prototypes/orc-144-palette-prototype.html) | [Alchemy Palette Swatches](https://claude.ai/artifact/ESwYfMN2qURiqBNCuTe5sZ) | Variant C, "Highlighter" |
| Character sheet | [orc-145-sheet-prototype.html](prototypes/orc-145-sheet-prototype.html) | [Alchemy Sheet Layouts](https://claude.ai/artifact/394mSv1c8D6qJY7jjsFPav) | Layout F (the bar button switches between the paladin 5 and cleric 9 examples) |
| Stuck note and use bubble | [orc-146-marks-prototype.html](prototypes/orc-146-marks-prototype.html) | [Alchemy Sheet Marks](https://claude.ai/artifact/E2xXzitQ9JoXw7VutfQLS2) | Note A, bubble D |
| App shell | [orc-147-shell-prototype.html](prototypes/orc-147-shell-prototype.html) | [Alchemy App Shell](https://claude.ai/artifact/46sfqc3KY9SqxHbZr8Kgx7) | Shell C, "Binder" |
| Home page | [orc-150-landing-prototype.html](prototypes/orc-150-landing-prototype.html) | [Alchemy Landing Page](https://claude.ai/artifact/3qz3VfuLZNxQFXZu1v9VJU) | Variant C |

The Artifacts need a claude.ai sign-in. The copies here do not.

Where two prototypes give different values for one token, the later
decision wins. For example, `--note-shadow` comes from the shell prototype
(ORC-147), not from the ORC-146 prototype.

# The motif

The motif is **Paper**.[^theme-notes] The app must feel like a physical
character sheet, but it does not copy paper literally. Graphite-dark text on
a slightly yellow off-white page, bold marker accents, a yellow note for
things the user must act on, and a subtle grain.

# Tokens

All colors are **role tokens**: the name says what the color does, not what
it looks like. The package declares the raw values as CSS variables on
`:root` and maps them to Tailwind utilities with `@theme inline` (see
[Light and dark](#light-and-dark)). The package's own components use only
role tokens.

## Palette

The contrast target is WCAG 2.2 AA: 4.5 : 1 for text, 3 : 1 for field
borders and marks. Every text pair passes in both modes.

| Token | Role | Light | Dark | Contrast on page (light / dark) |
|---|---|---|---|---|
| `--paper` | Page | #FFFCF5 | #000000 | — |
| `--paper-raised` | Raised boxes (stat boxes) | #FFFFFF | #0A0A0A | — |
| `--ink` | Body text | #222222 | #FFFFFF | 15.53 / 21.00 |
| `--ink-muted` | Labels, secondary text, the max of a current / max pair | #595959 | #ADADAD | 6.84 / 9.36 |
| `--rule` | Hairlines (decoration only) | #E3DECE | #222222 | — |
| `--rule-strong` | Box borders and disabled field borders (an active field's border is `--ink`) | #8A8578 | #6B6B6B | 3.59 / 3.94 |
| `--danger` | Errors, "failed" (red) | #C2271D | #FF5C52 | 5.69 / 6.90 |
| `--success` | Saved, death-save successes (green) | #1F7A3A | #4ED07A | 5.25 / 10.63 |
| `--info` | Use bubbles, focus ring (blue). Links stay `--ink` with an underline (Ethan, ORC-170) | #1E5FB4 | #5EA2FF | 6.12 / 8.09 |
| `--warning` | Warning text (yellow) | #7F6200 | #FFD93D | 5.62 / 15.24 |
| `--caution` | A bad mark that is not an error, for example death-save failures (orange) | #B85A00 | #FF9A3D | 4.55 / 9.94 |
| `--note` | Stuck note and alert note fill (yellow) | #FFE45C | #FFE45C | — |
| `--note-red` | Alert note fill, "failed" | #FFB3A8 | #FF9C8F | — |
| `--note-blue` | Alert note fill, information | #A9CCFF | #9CC4FF | — |
| `--note-ink` | Text on any note | #222222 | #000000 | 12.50 / 16.50 on `--note` |
| `--note-shadow` | Note shadow | rgba(60, 45, 0, .20) | rgba(255, 255, 255, .10) | — |
| `--margin-rule` | The shell's red margin rule | #C2271D | #FF5C52 | — |
| `--flag-yellow` | Characters tab | #FFE45C | #FFE45C | — |
| `--flag-blue` | Import tab | #7FB6FF | #7FB6FF | — |
| `--flag-green` | My Content tab | #7EE08F | #7EE08F | — |
| `--flag-orange` | Preferences tab | #FFAE5C | #FFAE5C | — |
| `--flag-ink` | Text on a flag tab | #222222 | #000000 | — |
| `--stain` | Mug stain ring | #8C5A2B | #C8915A | — |
| `--stain-wash` | Mug stain fill | #A87442 | #C8915A | — |
| `--stain-op` | Mug stain opacity | .55 | .62 | — |

The accent meanings are provisional. Ethan can change them later. Red is
never a tab color, so red always means "failed".

## Derived tokens

| Token | Value |
|---|---|
| `--panel` | `color-mix(in srgb, var(--ink) 6%, var(--paper))` (the shaded panel) |
| `--bubble` | `color-mix(in srgb, var(--info) 12%, var(--paper-raised))`; dark 18% |
| `--note-edge` | `color-mix(in srgb, var(--note) 70%, #000)`; dark 75% (the folded corner) |
| `--note-ink-muted` | `color-mix(in srgb, var(--note-ink) 72%, var(--note))` (muted text on a note, for example a skill with no proficiency in the ability highlight); 5.60 / 8.19 on `--note` |
| `--grain-opacity` | .05; dark .07 |

## Contrast test

The package has a unit test that computes the contrast of each text pair in
the table above, in both modes, and fails below 4.5 : 1 (3 : 1 for
`--rule-strong` and `--caution` as a mark). When you add a text token, add a
row to the test.

# Type and texture

* **Newsreader** at weight 450 for body text, headings and values. Use
  tabular lining digits for numbers. Body size 17px, line height 1.5.
* **Inter** for labels: 10.5px, uppercase, 0.08em letter spacing,
  `--ink-muted`. Sheet ability labels (STR, DEX...) are 13px.
* Self-host both fonts with `@fontsource-variable/newsreader` and
  `@fontsource-variable/inter`. `theme.css` loads them. Use Newsreader's
  files with the optical-size axis and set `font-optical-sizing: auto`, as
  the prototypes do. The app makes no
  third-party font request.
* **Grain:** an SVG noise layer over the page, fixed, with no pointer
  events, at `--grain-opacity`. The sheet prototype has the SVG.
* **Focus:** `:focus-visible` gets a 2px `--info` outline with a 2px offset.
  On a note or a flag tab, the outline is `--note-ink` or `--ink`.

# Light and dark

* Light is the paper page. Dark is OLED black and white: `--paper` is pure
  black, and the accents shift to suit the black page. The stuck notes, the
  alert notes and the flag tabs stay bright in dark mode, with black text.
* The app **follows the system theme** by default. A stored override in
  `localStorage` key `theme` (`"light"` or `"dark"`) sets
  `data-theme` on `<html>`. Match System removes the key. It does not store
  the word "system".
* `theme.css` has a two-branch `dark` custom variant: it matches
  `[data-theme=dark]`, and `prefers-color-scheme: dark` when the page is not
  `[data-theme=light]`. The dark values are written twice (media query and
  attribute), because plain CSS cannot share one block between them.
* Set `color-scheme` in each mode, so that scrollbars and native controls
  match.
* The package exports a classic inline **head script** that applies the
  stored override before first paint, and a `useThemePreference()` hook.
  The hook writes the key, sets or removes `data-theme`, and listens for the
  `storage` event so that other open tabs change at once.
* The UI package owns the `theme` key. The app never writes it directly.

# The shared UI package

The package is `@orc-alchemy/ui` at `packages/ui` (ORC-148). It is private
and source-only: it ships TypeScript and CSS, with no build step. React is a
peer dependency.

* **Exports:** `./theme.css`, `.` (the components), `./testing` (the
  test helpers for Vitest) and `./testing/playwright` (the test helpers for
  Playwright).
* **`theme.css`** holds the tokens, the `dark` variant, the fonts, the
  grain, the body defaults and `@source "./src";`. The `@source` line is
  in the package's file, so the app's Tailwind build finds the package's
  classes with no setup.
* **The app's CSS** is `@import "tailwindcss";` then
  `@import "@orc-alchemy/ui/theme.css";`.
* **Rule:** the package has no 5e words. It never imports `@pubdoor/dmv` or
  app state. The 5e sheet parts (ability block, hit point row, skills, the 5e
  lists in `builders/fields.tsx`) stay in the app.
* **Base UI stays inside the package.** The app imports controls only from
  `@orc-alchemy/ui`, never from `@base-ui/react`. `@base-ui/react` moves from
  the app's dependencies to the package's.
* **Tailwind's default colors** are removed from the app with
  `--color-*: initial` in its CSS (ORC-170). Only the role tokens make
  color utilities.
* **Note:** ORC-148 assumes that Demiplane's web pages become a sibling
  workspace package that uses this package. If they go to another
  repository, publishing the package is Demiplane work.

# Controls

One component for each control, with simple props, for example
`<Select value options onValueChange />` (ORC-152). The prop names follow
Base UI, and a label around the control names it.

| Today | Becomes |
|---|---|
| 15 checkboxes, the `Checks` group | Checkbox (square marks) |
| The radio group in `ConflictResolution` | Radio |
| `ValueChecks` ("one number or none") | Checkbox, same look as the old app |
| 12 native selects, and the `Select` in `builders/fields.tsx` (37 call sites) | Select |
| "Add an item" (Equipment) | Combobox (type to filter) |
| "Add an extra cantrip at level" (ClassForm) | Menu |
| 6 number inputs | NumberField (its role is textbox, so 2 e2e queries change) |
| 7 `window.confirm` calls | AlertDialog through one shared `confirm()` hook |
| Buttons | Button |
| The three `aria-pressed` groups | Toggle and ToggleGroup |
| Fieldsets, `FieldProblems` | Fieldset, Field |
| The one `<datalist>` input | Autocomplete |

The homebrew forms (ORC-195) add these parts. The
[Homebrew forms spec](homebrew-forms.md) gives their look.

* **FieldLabel:** a label above its control, in Inter caps.
* **TextInput** and **TextArea:** boxed text fields. TextArea stays a native
  textarea.
* **SelectBox:** a select that fills a box, with its label at the top.
* **XButton:** a square X button with no text. Its `aria-label` names it.
* **Button `wide`** and **Fieldset `look="section"`:** a full-width button
  with the text on the left, and a section title in Inter caps, with a rule
  after it.
* **Button `plain`** (ORC-285): a button with the look of the text around
  it: its font and color, no box. A mouse over it underlines its text. Use
  it for a name in a list that opens more.
* **ListRow** (ORC-285): a row of a list as a button, the full width,
  flat, with a hairline under it, and an optional part at its end. It has
  the panel fill under a mouse or the focus. While it is current
  (`aria-current`) it has the ink fill and paper text, and its focus ring
  is paper, inside the row. The rows of the ListModal are ListRows.
* **Fieldset `action`:** a small control at the end of the section rule,
  for example the "Remove" link of an added modifier (ORC-197). It is not a
  part of the section's name.
* **Fieldset `look="block"`:** a group inside a section, with a rule on
  its left side and a bold title in the body font (ORC-200). An `action`
  stays on the title row.
* **Flash (`ui-flash`):** a part that the user just added flashes once in
  the note yellow (`--note`), 10px past its edges, with rounded corners.

The picker controls (ORC-196) replace the groups of checkboxes on the
homebrew forms. They have no game words: the app gives the lists.

* **ListModal:** a modal with a title, a close X and one list that scrolls.
  Each row is a button with a name, an optional short example and an "Add"
  mark. The app can set another mark, for example "Choose". Esc or a click
  outside closes it. At 600px and less it fills the screen. By default a
  pick closes it. With `stayOpen`, it stays open, and its footer shows the
  number of picks and Done. The app can set the footer text, for example
  "3 on the form". Either mode can have a search field (ORC-138). Rows
  with a group show under a small heading; the modifier list gives no
  groups. The owner sets `open`, so a caller can open and close it itself,
  for example for one slot of a table. Its backdrop is a 40% ink wash, as
  in the prototypes.
* **Dialog:** a modal for a form or other content, added for Customize
  (ORC-134). It has a title, a body that scrolls, and a footer. The footer
  shows Cancel, then the owner's actions, for example a solid Save. It is
  up to 720px wide. At 600px and less it fills the screen. Its backdrop is
  the ListModal's 40% ink wash. When it opens, the focus goes to the first
  control of the body. If the body shows its controls later, the first
  control gets the focus when it shows. Cancel, Esc and a click outside
  ask the owner to close it, so the owner can ask first. A ListModal, an
  AlertDialog or another Dialog that the body opens shows above it. Esc
  and a click outside then close only the top one, and the focus comes
  back into the Dialog. With `size="narrow"` it is up to 520px wide, for
  a short form or list such as the rest dialogs (ORC-319). With
  `size="wide"` it is up to 1100px wide, for
  the Spells panel (ORC-270). The owner can then give its own header in
  place of the title row; the title still names the dialog for a screen
  reader. The footer is optional. A wide Dialog with no footer closes
  with an X in its header, 44px at 600px and less (ORC-284). When it
  opens, the focus goes to the first control of the body if there is
  one, else to the X. The owner can also set the control that gets the
  focus when it opens. With `fill`, a wide Dialog is the height of the
  window less its 16px margins, and its body has no padding and no
  scroll: the owner lays it out, for example as two panes that scroll
  apart (ORC-285).
* **Token** and **Tokens:** a pick as a small box with its name and an X
  named "Remove {name}". Tokens sit on one line that wraps, and a long name
  wraps inside its token. A token can hold a small control. A token can
  have a short muted note after its name, a dashed border (a token that
  the app adds by itself) or the `--bubble` fill with an `--info` border.
  Its name can be a button that opens a small popup under it. A small
  token has 13px semibold Inter text (ORC-322). The popup can also open
  when a mouse is over the token, with no focus move, and it closes when
  the mouse leaves, unless a click opened it. Slot circles in a token are
  15px, with a 24px tap area (ORC-323).
* **Token for a slot** (ORC-138): the name is a button with a small muted
  "Change" after it, and opens a list for a new value. A marked token has
  a 1.5px border, a 4px `--note` bar on its left and semibold text. Its X
  can have another name, for example "Put back {first value}". When the X
  goes and the token stays, the focus goes to the token's name button.
* **AddButton:** a `wide` button, "+ Add a part" on the left and the number
  of options that remain ("15 more") on the right. With `detail`, the
  button shows that text after the label in place of the count: small and
  muted, cut with "…", and on a second line that wraps in a button that is
  narrower than 520px.
* **Picker:** Tokens, in the order of the options, then an AddButton that
  opens a ListModal with `stayOpen`.
* **SegmentedToggle:** a segmented toggle for a short list of words, for
  example None / Fixed / Scaled, on ToggleGroup. The options are a prop.
* **NumberToggle:** a SegmentedToggle of numbers, for example
  None / 1 / 2 / 3. The numbers are a prop.
* **Chips:** number chips with an X, and a "+ Add" Menu. `AddChip` is the same dashed "+" button alone, for an empty slot.
* **Menu:** an item can have a short note in small muted type at the end
  of its line, for example "immune" (ORC-322). An optional title in bold
  goes over the items and names the list. A menu that picks one of its
  items has radio items, and the checked item is bold. The trigger is a
  ghost button, or a bare button that has no look of its own, for
  example the Armor Class box of the sheet (ORC-325).
* **SplitButton** (ORC-320): a Button and an arrow part that touch, in a
  group. The main part does the usual action and can show a pixel icon.
  The arrow part has a down mark, a 1px line of the paper color on its
  left, and opens a menu. The menu has a bold title, then items in up to
  three columns that line up: the label, a bold value, and a muted note at
  the end. A disabled item is muted. An optional note in small muted text
  is at the bottom. The menu has the `--paper-raised` fill, a 1px ink
  border and the note shadow, as a popup. It opens under the control, at
  its end; the owner can give it the width of another part, for example
  the full width of the panel on a phone. The two parts disable apart.
  With no items it is a plain Button. The Cast control of the Spells panel
  uses it.

**Test helpers** for these: `pickFromPicker` and `removeToken`, for Vitest
and for Playwright.

Every Select, Combobox and NumberField in the app is boxed, not only in the
homebrew forms: a 1px ink border on `--paper-raised`.

These stay native and get the theme through Tailwind: the two `<details>`
disclosures (style them with the `open:` variant), the builder step bar
(stays `<nav>` with `aria-current`; only its buttons become Button), file
inputs and links.

**Test helpers** at `@orc-alchemy/ui/testing`: "pick an option" for Vitest,
"pick an option" for Playwright, and "answer the confirm dialog". The
`.checked` reads become `toBeChecked()`.

**Icons.** The app uses text labels. A drawn icon is only an addition to a
text: it is an SVG in the package, in the text color (`currentColor`), with
`aria-hidden`, so the text names the control or the label. It is not an
emoji. The first icon is the lock, `LockIcon`, for a value that
cannot change, for example an always-prepared spell in the
[Spells panel](spells-panel.md#the-prepare-control) (ORC-287).

**Pixel icons** (ORC-272). A button or a link can show one pixel icon
before its text. The art is from Ethan's sprite sheet: a grid of 16 by 16
pixels, a shape of 2-pixel blocks, an edge of 1 pixel above the shape, and
a shadow of 1 pixel below it. `PixelIcon` in the package draws an icon at
16px, so each pixel of the art is one CSS pixel. The shape has the text
color, the edge has 75 percent of it, and the shadow has 25 percent of it.
Thus one drawing is correct on paper, in dark mode, and in a solid button.
The rows of each icon are in `packages/ui/src/Icon.tsx`. `Button` and
`ButtonLink` take the name of an icon in `icon`.

| Icon | Use |
| --- | --- |
| `pencil` | A control that opens the builder, a Customize dialog, or a homebrew form: a place where content changes. |
| `check` | A control that confirms and closes: Save or Done of a dialog, of a homebrew form or of the builder, and the action of a confirm dialog. Also the mark of the Inspiration box, until inspiration has an icon of its own (ORC-324). |
| `x` | A control that closes and does not keep the changes: Cancel. |
| `sparkles` | A control for spellcasting: All spells, Prepare spells, and the Cast button of a spell (ORC-320). |
| `external` | A link that opens a page of another site: Send feedback. |
| `download` | A control that writes a file to the device: each Export button. |
| `moon` | Only the Rest button of the character sheet (ORC-318). |
| `left` | A control that goes back: Back to List and each "Back to" link. |
| `plus` | A control that makes a new record or adds to a list: New character, the "New" links of My Content, each "Add" button, and a button that increases a number. |
| `minus` | A button that decreases a number. |
| `trash` | A control that deletes a record or removes an item from a list: Delete and Remove. |
| `import` | A control that reads a file or pasted text into the app: the Import links and buttons. |
| `dice` | A control that makes a random result: Random character and Re-roll. |
| `save` | The Save button of the action row, which writes the character and closes nothing. |
| `lock` | A value that cannot change. `LockIcon` draws it with no space after it. |
| `up`, `down` | No use at this time. They are for a control that moves or sorts. |

A confirm dialog shows the check and the x only when its cancel text is
"Cancel". With another text, for example "Stay", the action can be the one
that drops the changes, so the two buttons have no icon.

A button that shows only an icon, for example the plus and the minus
beside a level, has an `aria-label`.

Do not use an icon for a second meaning. A control without a row in this
table has no icon.

**Split button and popup.** The
[Sheet interactivity spec](sheet-interactivity.md) adds two parts. A split
button is a Button with an arrow part that opens a Menu (the Cast control,
built as SplitButton in ORC-320).
A popup is a small panel under the box that opens it, with a title and its
controls (hit points, hit dice, a pool).

**A box out of the Tab order.** A Checkbox can take `tabIndex={-1}` when a
key on another control changes it, for example Space on a row of a list
that is one Tab stop. A mouse and a screen reader still reach it.

# Paper patterns

These patterns are in the package. They have no game meaning.

* **Framed box:** a value in a box with its label under it, in Inter caps.
  A small control can be at the end of the label row, on its rule, for
  example a button that opens more (ORC-285).
* **Small box:** a small value and label box.
* **Stat box:** a box with a large value and a hanging oval for a second
  value. The app's ability block uses it.
* **Shaded panel:** a `--panel` area that groups related boxes.
* **Square marks:** filled squares for "has it" (proficiency), drawn by the
  Checkbox.
* **Section rule:** a section title on a rule.
* **Slot circles:** a row of plain circles. A marked circle fills solid.
  The color is a prop (spell slots `--ink`, death-save successes
  `--success`, failures `--caution`).
  With a change handler, the user can change the group (ORC-270). A click
  on an empty circle fills the first empty circle from the left, and a
  click on a filled circle clears the last filled one. Thus the filled
  circles are always together on the left. A circle that can change
  has a 17px drawing and a tap area of 28px or more. A circle that cannot
  change has a 15px drawing. The group is one Tab stop,
  and the arrow keys change it. With the diamond form, each circle is a
  diamond, for Pact Magic slots. A group can be a column, with the first
  circle at the top, for the columns of the Spell slots block. A copy of
  a group takes clicks only: it is not a Tab stop, and a screen reader
  does not see it (the level headings of the Spells panel). The
  [Spells panel spec](spells-panel.md#spent-spell-slots) has the full
  rules.
* **No layout shift:** a change to the play state does not move the other
  parts of the sheet or change the size of a dialog. A box keeps the space
  for a mark, a caption or a tag before it shows. See
  [No layout shift](sheet-interactivity.md#no-layout-shift).
* **Current / max:** current at full size, then `/ max` at the same size in
  `--ink-muted`, with no label. Use it for every current / max pair: hit
  points and feature pools.
* **Stuck note** and **use bubble**: see [Notes and bubbles](#notes-and-bubbles).

# Notes and bubbles

## Stuck note

A tilted yellow note above a box (ORC-146). `--note` fill, `--note-ink`
text, about 2° tilt, a folded bottom-right corner, a soft shadow. It stays
the same yellow in dark mode.

* **Placement rule (hard):** the note takes its own space above the box it
  marks. It overlaps only the box's top border. It must never cover the
  box's content.
* **Where it goes:** only where the user must act. Unresolved content on
  the sheet, and key conflicts before import.
* **Inline note:** a small form of the note, in the line of text. The line
  grows to fit it, so it covers nothing. The builder step bar shows its
  count of choices left as an inline note. A selection with choices left
  has "n to choose" as an inline note in its heading. Too many choices
  picked is a red (`--note-red`) inline note, on the step bar and in the
  heading (Ethan, on PR #65).
* Information that needs no action, such as an import-log warning, stays as
  `--warning` text.

## Alert note

A flat note at the full width of the page column, above the page content
(ORC-147). It is not rotated. It has a folded bottom-right corner and a
small shadow. Inter 13.5px, weight 500. The color gives the meaning:

| Color | Meaning | Examples |
|---|---|---|
| `--note` (yellow) | You must act | "Not saving" (Export them now), "Updated in another tab" (Reload this page) |
| `--note-red` | Something failed | "Save failed" (Try again) |
| `--note-blue` | Information | An import summary |

Only blue alert notes have a dismiss button.

## Note line

A flat yellow line in the flow of a form, for something that the user can
act on there (ORC-206). `--note` fill, `--note-ink` text, Inter 13.5px. It
is not tilted, and it has no corner and no shadow. A link button at its
end is its action. The homebrew forms show suggested uses on it.

## Use bubble

The outline around a limited-use feature (ORC-146).

* `--info` outline, `--bubble` fill, a large radius.
* One clickable circle for each use, after the feature name. A spent circle
  gets an ink slash.
* The rest type ("Long rest", "Short rest") in small caps in the top right.
  A 2024 feature can have two rules, or a rest that gives back fewer than
  all uses. The tag then names each rest, with the number of uses in
  parentheses when it is not all: "Short rest (1), Long rest" (ORC-238).
* A pool (for example Lay on Hands) shows its number large under the rest
  type, as current / max.
* More than 8 uses show as a pool. A feature with 0 uses or fewer has no
  bubble. It is a plain feature.
* When all uses are spent, the outline becomes dashed `--ink-muted` and the
  text greys. There is no cross-out.
* When the bubble is 380px wide or less, no column is kept free for the
  rest type (ORC-176). The name and the text use the full width, and the
  circles and the rest type share the line under the name.
* **Recorded.** The app records spent uses. A click on a circle is a sheet
  change. A pool has a minus button and a plus button beside its number,
  and a click on the number opens a popup. A feature with the unit `turn`
  has no circles, and the unit `day` shows as "Dawn". The
  [Sheet interactivity spec](sheet-interactivity.md#feature-uses) has the
  rules.

# App shell

Shell C, "Binder" (ORC-147). The package has a generic `Shell` with slots
for the logo, the navigation and the content. The app fills the slots.

* **Rail:** a 200px left margin rail holds the logo and the nav. A double
  `--margin-rule` line (1.5px, then a 1px line at 45%) separates it from the
  page. No punch holes.
* **Flag tabs:** each tab is stuck to the margin rule. It has a pale body
  (55% of its color on white) and a solid end at the rule. The current page
  tab sticks out further, is solid all over and has a small shadow. Hover
  moves a tab out a little. The shape is a flat flag. Labels are Inter caps,
  13.5px, weight 600, in `--flag-ink`.
* **Tab colors:** Characters `--flag-yellow`, Import `--flag-blue`, My
  Content `--flag-green`, Preferences `--flag-orange`.
* **Home** has no tab. The rail logo links to `/`. On Home no tab is current.
* **Storage alerts** become alert notes at the top of the page column.
* **Feedback link (beta only):** a build with a feedback form shows "Send
  feedback" after the logo (ORC-293). It is an Inter link, 12px, weight 600,
  in `--ink-muted` with an underline. It opens the form in a new tab. In the
  rail it sits under the logo. In the top strip it sits at the right end of
  the logo row. A build without a form has no link.

## Logo

The logo is the potion only. Ethan drew it as 16 × 16 pixel art. The
current art is the outlined bottle (ORC-208, `logo-swirl/bottle.png` in the
project files). Copy it into `packages/app/public/`. Render every size as a
whole power-of-two scale with nearest-neighbor scaling
(`image-rendering: pixelated`).

| Slot | Size | Scale | Swirl |
|---|---|---|---|
| Browser tab favicon | 16, 32 | 1×, 2× | No |
| Rail header mark | 32 | 2× | Yes |
| Home page title row | 64 | 4× | Yes |
| Home screen and install icon | 256, 512 | 16×, 32× | No |

The liquid swirls in the rail mark and in the Home title row (ORC-208,
variant B, "Soft spiral"). The rules are:

* The swirl is `potion-swirl.png`, a row of twelve 16 × 16 frames. CSS shows
  one whole frame at a time, and one loop takes 2.4 seconds.
* Only the liquid changes. A faint light arm in the shape of a spiral turns
  through the liquid, on top of the shading of the art. It makes a pixel
  lighter or darker by 10 of 255 at most. The glass, the highlights and the
  cork do not change.
* Under `prefers-reduced-motion: reduce`, the logo does not move and shows
  the art as drawn.
* `packages/app/scripts/potion-swirl.py` makes the frames from
  `potion-16.png`.

The ingot and the lead-to-gold animation are not in M8.

# Home page

Variant C (ORC-150). `/` is always Home, inside the shell. The character
list moves to `/characters`, and the Characters tab links there.

One column, top to bottom:

1. The title row: the potion at 64px on the same line as the "Alchemy 5E"
   wordmark, `clamp(52px, 10vw, 84px)`.
2. The tagline: "Build and play your D&D 5e character sheets."
3. The buttons: New character (solid), Random character, Import from
   Dungeon Master's Vault.
4. Three facts, as a list with square marks: build step by step or roll a
   random character; import characters and content from Dungeon Master's
   Vault; no account necessary, export at any time.
5. The beta note: the line "Welcome to the Beta!" in the tagline style,
   then a second list with square marks. Its four lines say:
   * Many features are in progress.
   * A community hub for updates comes later.
   * Characters and content stay only in this browser, so export them when
     necessary.
   * Make a random character to see the character sheet.

   The note has no condition. Every build shows it.
6. Recent characters: the three most recent, in the character-list row
   style, then a link "All characters (n)". With no characters, an empty
   note says "Characters you make or import show here."

**Mug stain:** one coffee ring, about 240px, to the right of the facts and
over the top of Recent characters. It is behind the page content and never
blocks a control. Ship the prototype's SVG as one replaceable file. Ethan
will draw the real stain.

# Preferences page

ORC-149.

* Route `/preferences`, linked from the orange Preferences tab.
* The heading "Appearance" has one Select: Light, Dark, Match System.
  Match System is the default. A change applies at once. There is no Save
  button.
* Later options get their own headings below "Appearance".
* "Experimental" is the last heading (ORC-308). It holds features that
  are not finished, under the note "Features that are not finished. They
  can change or break." Its one option is the checkbox "2024 rules
  preview". While it is checked, the link "Open the 2024 rules preview"
  goes to `/dev/2024`. The section stays until the 2024 rules are a
  normal part of the app.
* The page uses `useThemePreference()` and `usePreview2024()`. It does
  not touch `localStorage` itself. Another open tab changes at once, with
  no alert note.
* `/account` stays free for Demiplane.
* In M8 the choice is stored in this browser only. When Demiplane comes, it
  also syncs with the user's account. The `localStorage` copy stays,
  because the head script must read it before first paint.
* Preferences are never exported, in an `.orcbrew` file or a DMV export.

# Character sheet

Layout F (ORC-145, ORC-153). Two columns at about 1 : 2, max width 960px.
Labels are under values. Under 720px, the sections go in tabs (see Small
screens and motion).

## Action row

One row of buttons above the sheet header (ORC-174). The builder has the
same row.

* On the left, "Back to List", a ghost button. It always goes to
  `/characters`. When the row is narrower than 720px, it shows "Back". Its
  accessible name stays "Back to List".
* When the row is narrower than 720px, "Unsaved changes" shows "Unsaved".
  Screen readers still read "Unsaved changes". The whole row stays on one
  line at 390px.
* On the right, from left to right: the save status in muted text ("Saved"
  or "Unsaved changes"), then a ghost Save button. Save is the same size as
  the other buttons, and shows only while there are unsaved changes.
* A sheet change saves at once, so the status stays "Saved" and Save does
  not show. If the save fails, the status is "Unsaved changes" and Save
  shows. See [How a sheet change saves](spells-panel.md#how-a-sheet-change-saves).
* The page actions come after Save. On the sheet, they are a Rest button
  with the moon icon, a solid Edit (to the builder) and a ghost Export.
  Rest opens a menu with Short rest, Long rest and Dawn. Narrower than
  720px, the buttons after the save status (Save, Rest, Edit and Export)
  show their labels only, so that the row stays on one line at 390px
  (ORC-318). See the
  [Sheet interactivity spec](sheet-interactivity.md#rests). In the
  builder, there is a solid Done (to the sheet).
* Back to List, Edit and Done are links with the look of buttons
  (`ButtonLink`). Export is a button.
* When unsaved changes come back from a draft, a blue info note under the
  row says so.
* Why an export failed shows as an alert line under the row, not in it,
  so the row keeps its one line (ORC-137). In the character list, it shows
  on a line under the character's row, after Export and Delete.

## Header

* A name box with the height of one line at the largest name size. A long
  name gets smaller to fit on one line. When the name is small enough that
  two lines fit in the box, it can wrap to two lines. The box does not grow.
* A details box with class & level, background and race. Background and
  race get the width of their values, up to a fifth of the sheet each. Class
  gets the rest (ORC-176). Each value stays on one line and truncates with an
  ellipsis when there is no more space. A hover shows the whole value.

## Left column

The left column is at least 320px wide.

* Six ability boxes, labelled STR, DEX, CON, INT, WIS, CHA (13px Inter caps,
  10px between label and modifier). Each box is 10 : 9. The score is in the
  oval. Each box is a button that highlights the skills of its ability.
* Inspiration and proficiency bonus. The Inspiration box is a button, and
  it shows a mark when the character has inspiration.
* Saving throws and skills, one line each, with square proficiency marks.
  Expertise is a ring around the filled square, as on the paper sheet, with
  "Expertise" as its accessible name. There is no "expertise" text tag
  (ORC-176). The ability tag after a skill is small Inter caps. There is no
  underline under a bonus.
* Passive perception.
* **Equipment**, with one **Gold** box floated in its top-right corner. The
  Gold box shows all coins (`cp`, `sp`, `ep`, `gp`, `pp` treasure items)
  converted to gold pieces. The gear lines wrap beside it, then run the full
  width under it. Other treasure stays in the list.
* **Other proficiencies & languages.**
* **Defenses** (resistances and immunities), shown only when the character
  has any.
* **AC by armor**, a table of the AC with each armor the character has. The
  row whose AC shows in the Armor Class box has an "E" in a box and bold text, and
  the worn pair has the tag "worn".

The [Sheet interactivity spec](sheet-interactivity.md) has the rules for
the ability highlight, inspiration and the AC pick.

## Right column

* A shaded panel with AC (in a shield shape), initiative and speed, each
  sized to its content (at least 96px) and spaced evenly. Each label is at
  the bottom of its box, so a taller box does not move the other labels.
* Speed: only the first speed's number is large ("60 ft."). Its qualifier
  ("UNARMORED") is small Inter caps under it. Other speeds (armored, swim,
  fly) are small lines under that (ORC-176).
* The AC box is a button that opens the menu "Armor class shows" (the AC
  pick).
* A caption in red caps under the speed gives the cause when a condition
  or exhaustion changes it.
* Hit points: temporary on the left, then current / max on the right. Each
  part is a button that opens a popup. When the record has no current HP,
  show the max as the current value. At 0, the current number is
  `--caution`. The caption "MAXIMUM HALVED · EXHAUSTION" shows under the
  box at exhaustion level 4, in a space of one line that the box keeps.
  The caption does not wrap. Where the part is narrow, it runs into the
  padding on both sides, and in a vitals panel narrower than 330px its
  letter spacing is 0.03em.
* Hit dice: a button with the dice left for each die size ("3 / 5" and
  "d10") and the "Hit dice" label. It opens a popup.
* Death saves: two rows of three slot circles, successes `--success` and
  failures `--caution`. The "Death saves" label is at the bottom, and the
  two rows fill the space above it. The circles change. A Stable tag
  shows beside the label, and a Dead label takes the place of the
  failure circles.
* **Conditions and statuses**, a box in a row under the hit points. It holds
  tokens for the concentration mark, the conditions and exhaustion, and
  the button "+ Add condition".
* A status line with a reserved height says what the last action changed.
  The [Sheet interactivity spec](sheet-interactivity.md) has the rules for
  each control of this panel.
* **Attacks**, as a table. Attack cantrips such as Sacred Flame stay in it.
  The numbers do not wrap. A 2024 attack shows its damage dice and damage
  type ("2d6+5 Slashing") in a "Damage" column, and its mastery property
  as a tag after the weapon name. The note on damage dice then does not
  show (ORC-238).
* **Spellcasting** (see below).
* **Features & traits.** Each feature's name is on its own line above its
  text. Limited-use features sit in a use bubble. A pack feature goes to
  Actions, Bonus Actions or Reactions by its type. A feature of a 2024
  feat has the feat category after its name, in small `--ink-muted` Inter
  ("Origin feat"). When the feature name is not the feat name, the feat
  name comes first ("Grappler, General feat") (ORC-238). See
  [Homebrew forms spec, "On the sheet"](homebrew-forms.md#on-the-sheet).
* **Notes.**

## Spellcasting

One **Spellcasting** section for every spell source: classes, races and
feats together. 5e gives a multiclass caster one shared set of slots, so the
sheet shows one set.

The [Spells panel spec](spells-panel.md) (ORC-270) adds the Spells panel,
which opens from this section. It also gives the full rules for spent
slots, Pact Magic slots, spell names and the cast note. The items below
that name it are a summary.

* **All spells:** a small "All spells" button is at the end of the section
  rule, the label row at the bottom of the section. It opens the Spells
  panel. Each spell name is a button with the
  look of plain text, and opens the panel at that spell. The builder
  preview has neither.

* **The boxes:** a shaded row of large boxes in the style of the AC row:
  spell save DC, spell attack and spellcasting ability. Sources with the
  same DC, attack and ability share one row (ORC-176). When there is more
  than one row, or a row has more than one source, a small label on the row
  gives the source names ("Tiefling · Warlock"). A screen reader reads
  "Tiefling and Warlock". When the sheet is narrower than 720px, the ability
  box label is "Ability". Its accessible name stays "Spellcasting ability".
* **Cantrip-only sources:** a source that is not a class and knows only
  cantrips (for example a High Elf's cantrip) has no boxes and no tags. It
  is one line under the boxes: "Mending (High Elf, INT, DC 14, +6)". When
  the character has no other spells, the section is only that line.
* **The table** has three columns:
  * **Level:** a large ordinal. The word "Cantrips" is smaller. Cantrips are
    the first row.
  * **Slots:** the slot circles on one line, left-aligned. No circles for
    cantrips. When the sheet is narrower than 720px, there is no Slots
    column. The circles are under the ordinal, and the spells get the width.
    A filled circle is a spent slot, and the user can change the circles
    (see Slot circles in Paper patterns). The change saves at once. In the
    builder preview, the circles cannot change.
  * **Prepared spells:** comma-separated, A to Z.
* **Pact Magic slots:** the engine puts Warlock Pact Magic slots in the
  same slot list (a Warlock 10 has two 5th-level slots there). The sheet
  shows them apart. A pact slot is a diamond, not a circle, and a filled
  diamond is a spent slot. The diamonds are in the row of their slot
  level, after the circles of that level. There is no "Pact" row and no
  "Pact" label. A warlock with no other caster class has only diamonds in
  that row. When the sheet is narrower than 720px, the diamonds are under
  the circles, under the ordinal.
* **Spell names:** the name of a spell comes from its record. The name
  that the app makes from the key stays only for a spell with no record.
  A cast note, for example "at will", is in parentheses after the name:
  "Detect Magic (at will)". The note "Domain" does not show.
* **Which spells:** for a class that prepares, only prepared spells
  (always-prepared domain and oath spells included, with no tag). For a
  source that does not prepare (a sorcerer, a bard, a race), all known
  spells, and the column title is "Known spells". Unprepared spellbook
  spells are not on the sheet.
* **More than one source** (ORC-179): the column title is "Spells". Only
  sources with spells in the table count. A cantrip-only race line does not
  count.
  * The **main source** is the source with the most spells in the table.
    Its spells have no mark. On a tie, a class wins over a race or feat.
    Then the higher class level wins, then the class taken first, then A
    to Z.
  * With **2 or 3 sources**, the second source gets † and the third gets ‡.
    The mark is a muted superscript right after the spell name, before the
    comma: "Hellish Rebuke†, Hex". A screen reader reads the source name.
  * The **key** is on the caster row label, after the source name:
    "Tiefling †", or "Tiefling † · Warlock" on a joined row. There is no
    legend line. A source on a joined row keeps its mark.
  * With **4 or more sources**, every source but the main one gets a small
    Inter-caps source tag after each spell name. A source with no caster
    row label also gets a tag, because it has no place for the key. The
    symbols then go to the sources that remain.
  * A tag stays on the line of the last word of its spell name.
  * The list can wrap between spells and inside a long name. The page does
    not scroll sideways.
* The sheet does not show how many spells the character can prepare.

## Not on the sheet in M8

Player name, XP, alignment, portrait, faction, physical details, and
personality traits, ideals, bonds and flaws. The data stays in the record
and in exports. Only the sheet stops showing it.

# Small screens and motion

The phone layout of the character sheet is ORC-173. These rules apply:

* When the sheet is narrower than 720px, its sections go in four tabs. At
  720px and wider, the sheet is layout F.
* The action row and the sheet header are above the tabs, and scroll
  away. The tab row sticks to the top of the page.
* The tabs, in order:
  1. **Stats:** AC, initiative and speed, hit points, hit dice and death
     saves, Conditions and statuses, then Attacks, then the ability
     column (abilities, inspiration, proficiency bonus, saving throws,
     skills, passive perception).
  2. **Spells:** Spellcasting.
  3. **Features:** Features & traits.
  4. **More:** Equipment (with the Gold box), Other proficiencies &
     languages, Defenses, AC by armor and Notes.
* A tab with nothing in it does not show. A non-caster has no Spells tab.
* The sheet always opens on Stats. The app does not remember the tab, and
  the tab is not in the URL.
* The tabs are flag tabs in a row on a rule, yellow, blue, green and
  orange, and the current tab is taller (`Tabs` in `@orc-alchemy/ui`).
  After a switch with the row stuck, the page scrolls back so the new tab
  starts under the row. There are no swipe gestures.
* The builder preview has no tabs. It keeps one long column.
* In one column, the AC, initiative and speed boxes share the width, up to
  112px each.
* When the sheet is narrower than 720px, the attacks table has no
  "Proficient?" column. A weapon that is not proficient gets a "not
  proficient" tag after its name. The attack column is "To hit" and shows
  "+11". The off-hand modifier is a small line under the damage modifier.
* These narrow rules (attacks, spell slots, the "Ability" label) apply in
  the builder preview too. The preview does not use tabs.
* At 680px and below, the shell rail becomes a top strip with the margin
  rule along its bottom. The tabs stand in a row on the rule, and the
  current tab is taller.
* Under `prefers-reduced-motion: reduce`, the flag tabs do not move on hover.
* Under `prefers-reduced-motion: reduce`, the potion does not swirl (see
  Logo).
* Under `prefers-reduced-motion: reduce`, an added section does not flash
  (`ui-flash`).

# Build order

This is the order in which the M8 build tickets were filed. Linear holds the
tickets, their blocking relations and their status. When this list and
Linear disagree, Linear wins.

1. Create `@orc-alchemy/ui` (ORC-155).
2. App shell (ORC-156).
3. Home page (ORC-157).
4. Button (ORC-158).
5. Fieldset and Field (ORC-159).
6. Toggle and ToggleGroup (ORC-160).
7. Checkbox and Radio (ORC-161).
8. NumberField (ORC-162).
9. AlertDialog and `confirm()` (ORC-163).
10. Select, Combobox, Menu and Autocomplete (ORC-164).
11. Preferences page (ORC-165).
12. Paper patterns in the package (ORC-166).
13. Sheet layout F, without spells (ORC-167).
14. Sheet Spellcasting section (ORC-168).
15. Stuck notes where the user must act (ORC-169).
16. Palette clean-up (ORC-170).

**Review:** each ticket that changes a page attaches Playwright screenshots
of the page in light and dark to its PR. CI has no screenshot comparison
tests, because font rendering differs between machines.

# Out of scope for M8

* Recording spent uses, and choosing prepared spells from the sheet. Both
  change the character record, so they are features, not styling. The
  [Spells panel spec](spells-panel.md) now covers prepared spells and
  spent spell slots, and the
  [Sheet interactivity spec](sheet-interactivity.md) covers spent uses.
* A page-by-page layout redesign of the builder, homebrew forms, import and
  export pages. It needs its own prototypes. M8 gives these pages the
  tokens, fonts, controls and notes only.
* The lead-to-gold animation. It needs art and a reduced-motion plan first.
* An icon set. The app uses text labels. A few drawn icons go with a text,
  as [Controls](#controls) says.
* A print stylesheet. The sheet layout comes first, and printing is a
  separate feature.
* Where personality and notes go. Ethan will decide later, perhaps on a
  notes page.
* Making the logo and art. Ethan will provide them.
* The domain name. It is hosting, not theme.
* Demiplane's own pages. Demiplane designs them, with this package.

[^orc-102]: Map: settle the app theme, <https://linear.app/orc-alchemy/issue/ORC-102/map-settle-the-app-theme>
[^theme-notes]: Alchemy Theme Notes, <https://linear.app/orc-alchemy/document/alchemy-theme-notes-ef04deb34a0a>
