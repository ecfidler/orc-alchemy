---
type: Reference
title: Theme spec
description: The settled look of Alchemy 5e for M8 - tokens, type, light and dark, the shared UI package, controls, paper patterns, notes, the app shell, Home, Preferences, and the character sheet (layout F).
tags: [design, theme]
status: stable
generated: { by: claude-code/agent, at: 2026-10-29T22:55:00Z }
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

These stay native and get the theme through Tailwind: the two `<details>`
disclosures (style them with the `open:` variant), the builder step bar
(stays `<nav>` with `aria-current`; only its buttons become Button), file
inputs, textareas and links.

**Test helpers** at `@orc-alchemy/ui/testing`: "pick an option" for Vitest,
"pick an option" for Playwright, and "answer the confirm dialog". The
`.checked` reads become `toBeChecked()`.

# Paper patterns

These patterns are in the package. They have no game meaning.

* **Framed box:** a value in a box with its label under it, in Inter caps.
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

## Use bubble

The outline around a limited-use feature (ORC-146).

* `--info` outline, `--bubble` fill, a large radius.
* One clickable circle for each use, after the feature name. A spent circle
  gets an ink slash.
* The rest type ("Long rest", "Short rest") in small caps in the top right.
* A pool (for example Lay on Hands) shows its number large under the rest
  type, as current / max.
* When all uses are spent, the outline becomes dashed `--ink-muted` and the
  text greys. There is no cross-out.
* **Look only.** The app does not record uses. A click changes the circles
  on the page only, until the page reloads.

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

## Logo

The logo is the potion only. Ethan drew it as 16 × 16 pixel art
(`assets/pixil-frame-0.png` in the project files). Copy it into
`packages/app/public/`. Render every size as a whole power-of-two scale with
nearest-neighbor scaling (`image-rendering: pixelated`).

| Slot | Size | Scale |
|---|---|---|
| Browser tab favicon | 16, 32 | 1×, 2× |
| Rail header mark | 32 | 2× |
| Home page title row | 64 | 4× |
| Home screen and install icon | 256, 512 | 16×, 32× |

The ingot and the lead-to-gold animation are not in M8.

# Home page

Variant C (ORC-150). `/` is always Home, inside the shell. The character
list moves to `/characters`, and the Characters tab links there.

One column, top to bottom:

1. The title row: the potion at 64px on the same line as the "Alchemy 5E"
   wordmark, `clamp(52px, 10vw, 84px)`.
2. The tagline: "Build and keep your D&D 5e characters. Everything stays in
   this browser."
3. The buttons: New character (solid), Random character, Import from
   Dungeon Master's Vault.
4. Three facts, as a list with square marks: build step by step or roll a
   random character; bring in characters and homebrew from Dungeon Master's
   Vault (.orcbrew); works without an account, export any time.
5. Recent characters: the three most recent, in the character-list row
   style, then a link "All characters (n)". With no characters, an empty
   note says "Characters you make or import show here."

**Mug stain:** one coffee ring, about 240px, to the right of the facts and
over the top of Recent characters. It is behind the content and never
blocks a control. Ship the prototype's SVG as one replaceable file. Ethan
will draw the real stain.

# Preferences page

ORC-149.

* Route `/preferences`, linked from the orange Preferences tab.
* One heading, "Appearance", with one Select: Light, Dark, Match System.
  Match System is the default. A change applies at once. There is no Save
  button.
* Later options get their own headings below "Appearance".
* The page uses `useThemePreference()`. It does not touch `localStorage`
  itself. Another open tab changes at once, with no alert note.
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
* The page actions come after Save. On the sheet, they are a solid Edit (to
  the builder) and a ghost Export. In the builder, there is a solid Done (to
  the sheet).
* Back to List, Edit and Done are links with the look of buttons
  (`ButtonLink`). Export is a button.
* When unsaved changes come back from a draft, a blue info note under the
  row says so.

## Header

* A name box that fits the name.
* A details box with class & level (twice the width of the others),
  background and race.

## Left column

The left column is at least 320px wide.

* Six ability boxes, labelled STR, DEX, CON, INT, WIS, CHA (13px Inter caps,
  10px between label and modifier). Each box is 10 : 9. The score is in the
  oval.
* Inspiration (an empty box) and proficiency bonus.
* Saving throws and skills, one line each, with square proficiency marks.
  The ability tag after a skill is small Inter caps. There is no underline
  under a bonus.
* Passive perception.
* **Equipment**, with one **Gold** box floated in its top-right corner. The
  Gold box shows all coins (`cp`, `sp`, `ep`, `gp`, `pp` treasure items)
  converted to gold pieces. The gear lines wrap beside it, then run the full
  width under it. Other treasure stays in the list.

## Right column

* A shaded panel with AC (in a shield shape), initiative and speed, each
  sized to its content (at least 96px) and spaced evenly.
* Hit points: temporary on the left, then current / max on the right. The
  sheet model has no temporary HP, so that box is empty. When the record has
  no current HP, show the max as the current value, as the sheet does
  today.
* Hit dice: the value and the "Hit dice" label only.
* Death saves: two rows of three slot circles, successes `--success` and
  failures `--caution`. The "Death saves" label is at the bottom, and the
  two rows fill the space above it. The app records no death saves, so the
  circles are empty.
* **Attacks**, as a table. Attack cantrips such as Sacred Flame stay in it.
* **Spellcasting** (see below).
* **Features & traits.** Each feature's name is on its own line above its
  text. Limited-use features sit in a use bubble.
* **Other proficiencies & languages.**
* **Defenses** (resistances and immunities), shown only when the character
  has any.

## Spellcasting

One **Spellcasting** section for every spell source: classes, races and
feats together. 5e gives a multiclass caster one shared set of slots, so the
sheet shows one set.

**Known limit:** the engine puts Warlock Pact Magic slots in the same slot
list (a Warlock 10 has two 5th-level slots there). The sheet shows the list
as the engine reports it. It does not split Pact Magic slots out.

* **The boxes:** a shaded row of large boxes in the style of the AC row:
  spell save DC, spell attack and spellcasting ability. A character with
  more than one source gets one row for each source, with the source name
  as a small label on the row.
* **The table** has three columns:
  * **Level:** a large ordinal. The word "Cantrips" is smaller. Cantrips are
    the first row.
  * **Slots:** the slot circles on one line, left-aligned. No circles for
    cantrips.
  * **Prepared spells:** comma-separated, A to Z.
* **Which spells:** for a class that prepares, only prepared spells
  (always-prepared domain and oath spells included, with no tag). For a
  source that does not prepare (a sorcerer, a bard, a race), all known
  spells, and the column title is "Known spells". Unprepared spellbook
  spells are not on the sheet.
* **More than one source:** each spell gets a small Inter-caps source tag
  after its name, and the column title is "Spells". With one source there
  are no tags.
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
     saves, then Attacks, then the ability column (abilities, inspiration,
     proficiency bonus, saving throws, skills, passive perception).
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
* At 680px and below, the shell rail becomes a top strip with the margin
  rule along its bottom. The tabs stand in a row on the rule, and the
  current tab is taller.
* Under `prefers-reduced-motion: reduce`, the flag tabs do not move on hover.

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
  change the character record, so they are features, not styling.
* A page-by-page layout redesign of the builder, homebrew forms, import and
  export pages. It needs its own prototypes. M8 gives these pages the
  tokens, fonts, controls and notes only.
* Motion and the lead-to-gold animation. They need art and a reduced-motion
  plan first.
* An icon set. The app uses text labels, and no M8 decision needs icons.
* A print stylesheet. The sheet layout comes first, and printing is a
  separate feature.
* Where personality and notes go. Ethan will decide later, perhaps on a
  notes page.
* Making the logo and art. Ethan will provide them.
* The domain name. It is hosting, not theme.
* Demiplane's own pages. Demiplane designs them, with this package.

[^orc-102]: Map: settle the app theme, <https://linear.app/orc-alchemy/issue/ORC-102/map-settle-the-app-theme>
[^theme-notes]: Alchemy Theme Notes, <https://linear.app/orc-alchemy/document/alchemy-theme-notes-ef04deb34a0a>
