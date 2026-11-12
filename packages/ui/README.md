# @orc-alchemy/ui

The shared theme and controls of the Alchemy apps. The spec is
[`docs/design/theme.md`](../../docs/design/theme.md).

The package is private and source-only: it ships TypeScript and CSS, and has
no build step. React is a peer dependency.

```bash
bun run typecheck
bun run test       # vitest
```

## Use it in an app

1. Add `"@orc-alchemy/ui": "workspace:*"` to the app's dependencies.
2. Import the theme after Tailwind in the app's CSS:

   ```css
   @import "tailwindcss";
   @import "@orc-alchemy/ui/theme.css";
   ```

3. Put a copy of `themeHeadScript` in a classic `<script>` in the `<head>`
   of the app's `index.html`, before the module script. It applies a stored
   theme before first paint. `packages/app/src/index-html.test.ts` is a
   test that keeps the copy the same.

## Exports

- `./theme.css`: the role tokens in light and dark, the `dark` variant, the
  fonts, the grain, the body defaults, the focus ring, the shell, flag
  tab and alert note styles (`src/shell.css`), the button and toggle styles
  (`src/button.css`), the fieldset and field styles (`src/field.css`), the
  checkbox and radio styles (`src/check.css`), the number field styles
  (`src/number-field.css`), the alert dialog styles (`src/dialog.css`),
  the select, combobox, autocomplete and menu styles (`src/select.css`),
  the list modal, token, picker, number toggle and chips styles
  (`src/picker.css`),
  the paper pattern, stuck note and use bubble styles
  (`src/paper.css`), and the tabs styles (`src/tabs.css`).
- `.`: the components and hooks.
  - `Button`: Base UI Button with `variant` ("ghost", "solid" or "link"),
    `size` ("small", "normal" or "large") and `type` ("button" or
    "submit"). A ghost button with `aria-current` shows as solid. For a
    button that is on or off, use `Toggle`. `className` is for layout and
    spacing; colors and borders come from the variant. Styles:
    `src/button.css`.
  - `ButtonLink`: a link with the look of a button. Like `FlagTab`, it
    takes the link element as `render`. It takes `className` as `Button`
    does.
  - `Toggle`: Base UI Toggle, a button that is on or off. It has the
    ghost button look and is solid while it is pressed. On its own it
    takes `pressed` and `onPressedChange`. It takes `className` as
    `Button` does. Styles: `src/button.css`.
  - `ToggleGroup`: Base UI ToggleGroup, a group of toggles. Name it with
    `aria-label` or `aria-labelledby`. Its `value` lists the pressed
    toggles by each toggle's `value`; the owner changes it from each
    toggle's `onPressedChange`. Only one toggle is pressed unless
    `multiple` is set. The group is one tab stop, on its first toggle:
    Left and Right, Home and End move in it, and Space or Enter presses.
  - `Checkbox`: Base UI Checkbox with a square mark: a filled square while
    it is checked. It is controlled by `checked` and `onCheckedChange`.
    Give it a visible `label`. A click on the label also checks the box.
    Without a label, give it an `aria-label`. With `label`, `name` names
    the box when the label is not the right name (it is not a form field
    name). A test finds a box by its role and name, and reads it with
    `toBeChecked()`. Styles: `src/check.css`.
  - `NumberField`: Base UI NumberField, for a whole number. Its role is
    textbox. It is controlled by `value` (a number, or null when it is
    empty) and `onValueChange`, which gets the number after each change.
    A typed number outside `min` and `max` still reaches `onValueChange`,
    so the app decides what to keep; the limits stop only the Up and Down
    arrow keys. It shows numbers with no grouping. Put it in a label, or
    give it an `aria-label`. Styles: `src/number-field.css`.
  - `RadioGroup` and `Radio`: Base UI RadioGroup and Radio. The group has a
    name (`aria-label` or `aria-labelledby`), a controlled `value`, and
    `onValueChange`. Each `Radio` has a `value` and a visible `label`. The
    group is one tab stop, and the arrow keys move the choice. Styles:
    `src/check.css`.
  - `Fieldset`: Base UI Fieldset, a group with a visible `legend`. The
    legend names the group, or `name` does when the legend is not the
    right name. The legend is a `<div>`, not a `<legend>`, so a test finds
    a group by its role and name. `errors` show at the end of the group
    and describe it. `action` is a small control at the end of the legend
    row, after the rule, for example a `variant="link"` Button that removes
    the section. It is not a part of the group's name, so give it its own
    name.
  - `Field`: Base UI Field, for one control. It shows its `errors` after
    the control, as a list named "Problems: {label}", and is invalid while
    it has some. A Base UI control in it gets the list as its description.
  - `FieldErrors`: the error list alone, for errors that belong to no
    field or group.
  - Styles for the three: `src/field.css`. A legend is semibold.
  - The `ui-flash` class: put it on a part that the user just added. The
    part flashes once in the note yellow, 10px past its edges, with
    rounded corners, and its layout does not move. With
    `prefers-reduced-motion: reduce` it does not flash. Styles:
    `src/field.css`.
  - `useConfirm()`: the themed stand-in for `window.confirm`. It returns
    `[confirm, dialog]`. Render `dialog` in the component, and call
    `await confirm(question, action)`: it is true when the user picks the
    action button, and false on Cancel or Escape. `action` is the button
    text, "OK" by default. Cancel has the focus when the dialog opens.
  - `AlertDialog`: the dialog that `useConfirm()` shows. The owner sets
    `open`, and closes it from `onAnswer`. Styles: `src/dialog.css`.
  - `Select`: Base UI Select, a pick of one value from a list. Its role is
    combobox, and its text is the picked option. It is controlled by
    `value` (null while nothing is picked) and `onValueChange`. Each of
    its `options` is a `[value, label]` pair; an option with a null value
    gives null. `placeholder` shows while nothing is picked, and also for
    a value that is not an option. Put it in a label, or give it an
    `aria-label`. Styles: `src/select.css`.
  - `Combobox`: Base UI Combobox, for an action such as "add this" from a
    long list. The user types to filter the `options`, and a pick calls
    `onPick` and clears the field. It keeps no value.
  - `Autocomplete`: Base UI Autocomplete, a text field with
    `suggestions` that it filters as the user types. The user can also
    type any other text. It is controlled by `value` and
    `onValueChange`.
  - `Menu`: Base UI Menu, a ghost button named `label` that opens a list
    of actions. A pick of one of its `items` calls `onPick`.
  - Combobox, Autocomplete and Menu take their list styles from
    `src/select.css`. Menu takes `className` for its button.
  - `ListModal`: Base UI Dialog with a title, a close X and one list of
    `items` that scrolls. Each item is `{ value, label, example?, group? }`.
    Each row is a button named by its `label` and described by its
    `example`, with an "Add" mark. The owner sets `open` and gets
    `onOpenChange`. The X, Escape and a click outside close it. At 600px
    and less it fills the screen. By default a pick calls `onPick` and
    closes the modal. With `stayOpen`, it stays open: the caller takes the
    picked item out of `items`, and the focus goes to the next row. Then
    the footer shows `picked` as a polite status and Done. The text is
    "3 picked", or what `pickedText(n)` gives, for example "3 on the
    form". In this mode, `search` adds a search field that filters by
    name, example or group.
    Rows of one `group` show under a small heading. The focus goes to the
    search field, or else to the first row, when it opens. Up and Down,
    Home and End move between the rows. When it closes, the focus goes to
    `finalFocus`, or else back to where it was before it opened.
    `finalFocus` is a ref, or a function that runs at the close, for an
    element that the pick made (the page is still inert then, so the
    function finds it with a ref or a DOM query). The backdrop is a 40%
    ink wash, as in the prototypes.
  - `Token`: a pick, a small box with its `label` and an X named
    "Remove {label}" (or "Remove {name}") that calls `onRemove`. A long
    label wraps inside it. Its `children` are a small control after the
    label, for example a small NumberToggle.
  - `Tokens`: tokens on one line that wraps. After an X removes its token,
    the focus goes to the next X, or else to the first button after the
    tokens.
  - `AddButton`: a wide ghost button, "+ {label}" on the left, and
    "{remaining} more" on the right, which describes the button. It gives
    a ref.
  - `Picker`: some `value`s from a long list of `options` (ListModal
    items). The picks show as Tokens in the order of `options`, then an
    AddButton opens a ListModal with `stayOpen`, and `search` and
    `pickedText` when the app gives them. `onValueChange` gets the new
    list: a pick goes at the end, and a value that is no option stays.
  - `NumberToggle`: a segmented toggle on ToggleGroup for one of `values`
    (numbers, and null for "None"). `size="small"` fits in a token. Name it
    with `aria-label` or `aria-labelledby`.
  - `Chips`: number chips from low to high, each a Token, and a
    "+ {addLabel}" Menu of the `options` that are not on a chip. `name`
    gives a number's name for the X and the menu, for example "Row 4".
  - `XButton` takes `size="small"` (24px), as in a token.
  - Styles for these: `src/picker.css`.
  - The paper patterns (`src/Paper.tsx`). They have no game meaning. A box
    that holds content is a group named by its label. In a box that shows
    a value, the value is the group named by the label, so a screen reader
    reads the label with the value, and a test finds the value by its
    label. `className`, where a pattern takes it, is for layout.
    - `Label`: a label in the label style (Inter caps, 10.5px, muted).
    - `FramedBox`: content in a box, with the label under it on a
      hairline. With `labelId`, the box is not a group, and the caller
      makes a value in it a group with `aria-labelledby={labelId}`.
    - `SmallBox`: a small `value` in a cell, with the label beside it.
    - `StatBox`: a box with its label, a large `value` and an `oval` that
      hangs from the bottom edge. The label names the oval and the value
      together, the oval first. `name` names them when the label is short.
    - `ShadedPanel`: a shaded area that groups boxes.
    - `SectionRule`: a section title on a rule, a heading of `level` 2
      (or 3 or 4).
    - `SlotCircles`: `count` plain circles; the first `marked` fill solid
      in `color` ("ink", "success" or "caution"). A `marked` above `count`
      marks them all. It takes no clicks. Its name is
      "{label}: {marked} of {count}".
    - `CurrentMax`: `current`, then "/ `max`" in the muted ink.
  - `StuckNote`: a tilted yellow note above its box (`children`), for
    something the user must act on. A button or link in `note` is its
    action. The note overlaps only the box's top edge. It sets the box's top
    padding to 10px, so it never covers the box's content. Do not set the
    box's top padding with a utility class: a utility beats the package's
    10px. With no `note`, the note does not show. The box keeps its place
    and its 10px top padding, so it is not mounted again when a note comes
    or goes.
    `packages/app/e2e/stuck-note.spec.ts` measures this in a browser.
  - `InlineNote`: a small tilted note in the line of text, for example
    after a heading. `tone` is "act" (yellow, the default) when the user
    must act, or "failed" (red) when something is wrong. The line grows to
    fit it, so it never covers anything.
  - `NoteCount`: an `InlineNote` that is only a mark, such as a count on a
    step button. It is hidden from screen readers, so give the count in
    words too.
  - `UseBubble`: the outline around something with limited uses: a
    `title`, its text, a `tag` in the top right, and one circle for each of
    its `uses`, or a `pool` with a large current / max. It is a group named
    by its title. A click spends a use on the page. Nothing is stored, so a
    reload resets it. With every use spent, the outline is dashed and the
    text is muted.
  - `Shell`, `FlagTabs` and `FlagTab`: the binder shell with its margin rail
    and flag tabs. `FlagTab` takes the link element as `render`, so the app
    gives it its router's link.
  - `Tabs`: flag tabs that switch panels. It takes a `label` and `tabs`, each
    `{ value, label, color, content }`. The first tab is open at first. The
    tab row sticks to the top of the page, and after a switch with the row
    stuck, the page scrolls back so the new panel starts under the row.
    Left and Right, Home and End move between the tabs. Styles:
    `src/tabs.css`.
  - `AlertNotes` and `AlertNote`: flat notes at the top of the page column.
  - `useThemePreference()`, `themeHeadScript` and `THEME_STORAGE_KEY`.
- `./testing`: test helpers for Vitest with Testing Library. An app that
  uses them installs `@testing-library/react` (an optional peer).
  - `answerConfirmDialog(answer)`: waits for the confirm dialog, clicks
    the button named `answer` (the action, or "Cancel"), waits for the
    dialog to close, and returns its question.
  - `pickOption(control, name)`: picks the option or menu item `name` (a
    string or a RegExp) in a Select, Combobox, Autocomplete or Menu.
    `control` is the combobox or the menu button. In a text field it types
    a string name first, so that the list filters to it.
  - `optionNames(control)`: opens the list, returns the names of its
    options or menu items, and closes it.
  - `pickFromPicker(button, names)`: clicks `button`, picks each of
    `names` (one name or a list, strings or RegExps) in the ListModal that
    opens, then clicks Done if the modal is still open, and waits for it
    to close. In a list with search, it types each string name first. For
    a list that closes on a click, give one name.
  - `removeToken(scope, name)`: clicks "Remove {name}" in `scope`, and
    waits for the token to go.
- `./testing/playwright`: `pickOption(control, name)`,
  `pickFromPicker(button, names)` and `removeToken(scope, name)` for
  Playwright, as above, where `control`, `button` and `scope` are
  locators. In a text field or a search field, a RegExp name clears the
  field first. An app that uses it installs `@playwright/test` (an
  optional peer). `packages/app/e2e/picker.spec.ts` runs the picker
  controls and these helpers in a browser.

## Rules

- No 5e words. The package never imports `@pubdoor/dmv` or app state.
- Apps import controls from this package, never from `@base-ui/react`.
- When you add a text color token, add its pairs to `src/theme.test.ts`.
