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
  tab and alert note styles (`src/shell.css`), the button, split button and
  toggle styles (`src/button.css`), the fieldset and field styles (`src/field.css`), the
  flash (`src/flash.css`), the checkbox and radio styles
  (`src/check.css`), the number field styles (`src/number-field.css`), the
  alert dialog, modal dialog and small popup styles (`src/dialog.css`),
  the select, combobox, autocomplete and menu styles (`src/select.css`),
  the list modal, token, picker, number toggle, segmented toggle and chips styles
  (`src/picker.css`),
  the paper pattern, stuck note, note line and use bubble styles
  (`src/paper.css`), and the tabs styles (`src/tabs.css`).
- `.`: the components and hooks.
  - `Button`: Base UI Button with `variant` ("ghost", "solid", "link",
    "plain" or "bare"),
    `size` ("small", "normal" or "large") and `type` ("button" or
    "submit"). A ghost button with `aria-current` shows as solid. For a
    button that is on or off, use `Toggle`. A plain button has the look of
    the text around it, with a line under a mouse, for example a name in a
    list that opens more; like a link button it has no size. A bare button
    has no look of its own and no size: its `className` draws it all, for
    example a part of a box that opens a popup. For the other variants,
    `className` is for layout and spacing; colors and borders come from the
    variant. It gives a ref.
    `icon` is the name of a pixel icon to show before the text. A button
    with an icon and no text needs an `aria-label`.
    Styles: `src/button.css`.
  - `ButtonLink`: a link with the look of a button. Like `FlagTab`, it
    takes the link element as `render`. It takes `className` and `icon` as
    `Button` does. Its variant is "ghost" or "solid".
  - `ListRow`: a row of a list as a button (Base UI Button), the full
    width, flat, with a hairline under it. It is a grid of two columns:
    the content, then an optional part at the end, for example a mark or
    tags. Under a mouse or the focus it has the panel fill. With
    `aria-current` it has the ink fill, paper text and a paper focus ring,
    as a current ghost button is solid. The rows of `ListModal` are
    ListRows. It gives a ref. `className` is for layout and spacing, for
    example the padding. Styles: `src/picker.css`.
  - `Toggle`: Base UI Toggle, a button that is on or off. It has the
    ghost button look and is solid while it is pressed. On its own it
    takes `pressed` and `onPressedChange`. It takes `className` as
    `Button` does. `variant="bare"` has no look of its own, pressed or
    not, as a bare `Button`: its `className` draws it all. Styles:
    `src/button.css`.
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
    `toBeChecked()`. `tabIndex={-1}` takes the box out of the Tab order,
    for a box that a key on another control also changes, for example
    Space on a row of a list that is one Tab stop; a mouse and a screen
    reader still reach it. Styles: `src/check.css`.
  - `LockIcon`: a closed lock, the `lock` pixel icon with no space after
    it, for a value that cannot change. It has `aria-hidden`
    and does not shrink in a flex row, so put a text beside it.
  - `PixelIcon`: a pixel icon, 16px, drawn as an SVG in the text color,
    for the start of the text of a button or a link. `name` is "pencil",
    "x", "check", "download", "moon", "sparkles", "external", "left",
    "plus", "minus", "trash", "import", "dice", "save", "lock", "up" or
    "down"
    (`PixelIconName`). It has `aria-hidden`. `docs/design/theme.md`,
    "Icons", gives the one use of each icon. In a `Button` or a
    `ButtonLink`, use `icon`. Styles: `src/button.css`.
    `className` is for layout.
  - `NumberField`: Base UI NumberField, for a whole number. Its role is
    textbox. It is controlled by `value` (a number, or null when it is
    empty) and `onValueChange`, which gets the number after each change.
    A typed number outside `min` and `max` still reaches `onValueChange`,
    so the app decides what to keep; the limits stop only the Up and Down
    arrow keys. It shows numbers with no grouping. Put it in a label, or
    give it an `aria-label`. With `disabled`, it takes no input and has the
    look of a disabled button: muted text and a `--rule-strong` border.
    Styles: `src/number-field.css`.
  - `AmountField` and `useAmount()`: a NumberField for an amount of 0 or
    more, with its state. `useAmount(initial)` gives the state: `value`,
    `onValueChange`, `note`, and `submit(act)`, which gives the amount to
    `act` when the field has a number of 0 or more and else sets `note` to
    `AMOUNT_NOTE` ("Type a number of 0 or more."). A change removes the
    note. `AmountField` takes the state as `amount`. Its `label`, "Amount"
    by default, shows above the field; with `showLabel={false}` it is only
    the name of the field. Its text is selected at the focus, so a typed
    number replaces it. Styles: `src/number-field.css`.
  - `NoteSpace`: the space of the note of a form, a polite status line
    with one `NoteLine` for its `note`, or empty for null. It keeps the
    height of a note line, so a popup keeps its size when the note comes
    or goes. Styles: `src/paper.css`.
  - `selectOnFocus`: an `onFocus` handler for an element around a field.
    It selects the text of the field at the focus, so a typed number
    replaces it. `AmountField` has it already.
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
    name. `look="section"` shows the legend as a section title on a rule;
    `look="block"` is a part of a section, for example a part the user
    added, with a rule on its left, a plain bold legend and an X `action`.
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
    `src/flash.css`.
  - `useConfirm()`: the themed stand-in for `window.confirm`. It returns
    `[confirm, dialog]`. Render `dialog` in the component, and call
    `await confirm(question, action, cancel)`: it is true when the user
    picks the action button, and false on the cancel button or Escape.
    `action` is the button text, "OK" by default. `cancel` is the text of
    the button that says no, "Cancel" by default. The cancel button has
    the focus when the dialog opens.
  - `AlertDialog`: the dialog that `useConfirm()` shows. The owner sets
    `open`, and closes it from `onAnswer`. Styles: `src/dialog.css`.
  - `Dialog`: Base UI Dialog, a modal with a `title`, a body (`children`)
    that scrolls, and a footer: Cancel, then the owner's `actions`. It is
    up to 720px wide, and at 600px and less it fills the screen. When it
    opens, the focus goes to the first control of the body (any control
    that takes the focus). If the body shows its controls later, for
    example after it reads data, the first one gets the focus when it
    shows, unless the focus is in the body already. Cancel, Escape and a
    click outside call `onOpenChange(false)`; the dialog stays open until
    the owner sets `open` to false, so the owner can ask first. A
    ListModal, an AlertDialog or a Dialog that the body opens shows above
    it, Escape and a click outside close only that one, and the focus
    comes back into the dialog. When it closes, the focus goes to
    `finalFocus` (a ref, or a function that runs at the close), or else
    back to where it was before it opened. `initialFocus` (a ref, or a
    function that runs at the open) gives the focus to another element at
    the open. With `size="narrow"` it is up to 520px wide, for a short
    form or list; at 600px and less it fills the screen too. With
    `size="wide"` it is up to 1100px wide. The owner can
    then give a `header` in place of the title row: the `title` does not
    show, and it still names the dialog. `footer={false}` removes the
    footer and does not take `actions`, and an X named "Close" at the end
    of the header row closes the dialog. In that dialog, the focus goes to
    the first control of the body when the body has one; else the X gets
    the focus. At 600px and less the X is 44px. When `initialFocus` gives
    null or its ref is empty, the focus goes as by default, also to a
    control that the body shows later. The backdrop is the list modal's
    ink wash. A wide dialog with `fill` is the height of the window less
    its margin, and its body has no padding and no scroll of its own:
    the body is a flex column, and the owner lays out its parts and sets
    which of them scroll, for example two panes that scroll apart.
    Styles: `src/dialog.css`.
  - `SmallPopup`: Base UI Popover, a small panel under a box, with a
    `title` and its controls (`children`), and no close button. The owner
    gives the opener as `trigger`, a `Button` element whose name says
    what it opens, and controls `open` and `onOpenChange`. A click on the
    trigger opens it; a second click, Escape and a click outside close it.
    At the open, the focus goes to the first field of the popup (else its
    first control); at the close, it goes back to the trigger. The owner
    closes it after an action. It opens under `anchor`, by default the
    trigger, for example under the box that holds two triggers. With
    `widthOf`, it has the width and the left edge of that element, for
    example the panel that holds the box on a narrow page. It is 320px
    wide by default. It is not modal. With `takeFocus={false}`, the open
    and the close move no focus, for a popup that a mouse over its box
    opens. Styles: `src/dialog.css`.
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
    of actions. A pick of one of its `items` calls `onPick`. `icon` shows
    a pixel icon before the label, as on `Button`. `buttonRef` gives a ref
    to the button, for example to give the focus back to it when a dialog
    that an item opened closes. An item (`MenuItem`) is
    `[value, text, note?]`: the note is short, in small muted type at the
    end of its line, and a part of the item's name.
  - Combobox, Autocomplete and Menu take their list styles from
    `src/select.css`. Menu takes `className` for its button.
  - `SplitButton`: a `Button` with an arrow part that opens a Base UI
    Menu. The two parts are buttons in a group (`aria-label` names it).
    The main part shows `children` (and `icon`), calls `onClick`, and
    takes `disabled` and `aria-describedby`, for example a hint under the
    control. The arrow part is named `menuLabel`, which is also the title
    and the name of the menu, and takes `menuDisabled`. Each of its
    `items` is `{ value, label, detail?, aside?, disabled? }`, in up to
    three columns that line up: the label, the detail in bold (the column
    shows only when an item has one), and the aside, muted, at the end. A
    pick calls `onPick` with the value. `menuNote` shows at the bottom of
    the menu and describes it. The menu opens under the control, at its
    end; with `widthOf`, it opens under that element with its width. With
    no items it is a plain Button. `menuLabel` is required when the owner
    gives `items`, also null; without `items` the control takes no menu
    props. `variant` is "solid" (the default) or
    "ghost". Styles: `src/button.css`.
  - `ListModal`: Base UI Dialog with a title, a close X and one list of
    `items` that scrolls. Each item is `{ value, label, example?, group? }`.
    Each row is a button named by its `label` and described by its
    `example`, with a mark: "Add", or the text of `mark`, for example
    "Choose". The owner sets `open` and gets
    `onOpenChange`. The X, Escape and a click outside close it. At 600px
    and less it fills the screen. By default a pick calls `onPick` and
    closes the modal. With `stayOpen`, it stays open: the caller takes the
    picked item out of `items`, and the focus goes to the next row. Then
    the footer shows `picked` as a polite status and Done. The text is
    "3 picked", or what `pickedText(n)` gives, for example "3 on the
    form". In either mode, `search` adds a search field that filters by
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
    "Remove {label}" (or "Remove {name}", or `removeName` whole) that
    calls `onRemove`. Without `onRemove` it has no X. A long label wraps
    inside it. Its `children` are a small control after the label, for
    example a small NumberToggle. `marked` gives a thicker border, a
    note-yellow bar on the left and semibold text, for example for a
    changed value; say so in a name too. The label has one of three
    modes, and props of two modes together are a type error:
    - Plain: a text.
    - `onOpen`: a button named `openName` (or the label), with an
      optional muted `openHint` such as "Change", for a slot that holds
      one value. The button opens a list for a new value.
    - `popup` (the props of a `SmallPopup` but the trigger and the
      anchor): a button named `openName` (or the label) that opens a
      SmallPopup under the token. The owner controls `open`. With
      `popupOnHover` too, a mouse over the token opens that popup with no
      focus move, and the mouse leaving the token closes it, unless a
      click opened it. A press on the token's other controls keeps it
      open; a touch does not open it.

    `note` is a short muted text after the label, a part of the token's
    text. `look` is "plain" (the default), "dashed" (a dashed border, for
    a token that the app adds by itself) or "bubble" (the `--bubble` fill
    and an `--info` border). With `groupName`, the token is a group with
    that name. `size="small"` gives 13px semibold sans text and the
    height of the Chips add button, for a row of status tokens in a box.
    SlotCircles that change, as a child, draw 15px circles with a 24px
    tap area, so the row fits in the token.
  - `Tokens`: tokens on one line that wraps. After an X removes its token,
    the focus goes to the next X, or else to the first button after the
    tokens. When the X goes and its token stays, the focus goes to the
    token's label button.
  - `AddButton`: a wide ghost button, "+ {label}" on the left, and
    "{remaining} more" on the right, which describes the button. With
    `detail`, it shows that text after the label in place of the count,
    and the text describes the button. It gives a ref.
  - `Picker`: some `value`s from a long list of `options` (ListModal
    items). The picks show as Tokens in the order of `options`, then an
    AddButton opens a ListModal with `stayOpen`, and `search` and
    `pickedText` when the app gives them. `onValueChange` gets the new
    list: a pick goes at the end, and a value that is no option stays.
  - `SegmentedToggle`: a segmented toggle on ToggleGroup for one of
    `options` (`[value, label]` pairs), for example None / Fixed / Scaled.
    A `value` that is no option presses no segment. `size="small"` fits in
    a token. Name it with `aria-label` or `aria-labelledby`.
  - `NumberToggle`: a SegmentedToggle for one of `values` (numbers, and
    null for "None"). `size="small"` fits in a token. Name it with
    `aria-label` or `aria-labelledby`.
  - `Chips`: number chips from low to high, each a Token, and a
    "+ {addLabel}" Menu of the `options` that are not on a chip. `name`
    gives a number's name for the X and the menu, for example "Row 4".
  - `AddChip`: a dashed token-size button, "+ {label}", with the look of
    the Chips add menu, for one empty slot that the caller fills, for
    example from a ListModal. The "+" is not a part of its name.
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
      `action` is a small control at the end of the label row, for
      example a button that opens more. It is not a part of the box's
      name, so give it its own name.
    - `SmallBox`: a small `value` in a cell, with the label beside it.
    - `StatBox`: a box with its label, a large `value` and an `oval` that
      hangs from the bottom edge. The label names the oval and the value
      together, the oval first. `name` names them when the label is short.
    - `toggle` (`BoxToggleProps`) on `SmallBox` or `StatBox` makes the
      whole box one bare `Toggle`, with the props of a Toggle:
      `pressed`, `onPressedChange`, `aria-label`, and the pointer and
      focus events. The box keeps its look and its size. Under a mouse it
      has an inset ring. A small box is named by its label, and its value
      shows the state, so give a mark in the value `aria-hidden`. A stat
      box is named by `aria-label`, else by `name` or the label. The oval
      and the value describe it. A pressed stat box has the inset ring and
      an ink label.
    - `ShadedPanel`: a shaded area that groups boxes.
    - `SectionRule`: a section title on a rule, a heading of `level` 2
      (or 3 or 4).
    - `SlotCircles`: `count` plain circles; the first `marked` fill solid
      in `color` ("ink", "success", "caution" or "info"). A `marked` above
      `count` marks them all. `mark="slash"` keeps a marked circle empty,
      with a muted outline and an ink slash across it. `size="small"`
      draws 12px circles closer together. `shape="diamond"` draws each
      circle as a diamond of the same size, with the same rules, to set
      one group apart from others. Without `onChange` it takes no clicks,
      and it is an image named "{label}: {marked} of {count}". With
      `onChange(marked)`, the user changes it by the rule "one more, one
      less": a click on an empty circle gives `marked + 1`, and a click on
      a marked circle gives `marked - 1`. The owner sets the new `marked`.
      Its circles are drawn at 17px (15px without `onChange`), each with a
      28px tap area, and under a mouse the circle that a click changes
      shows a light fill. The group is a slider and one Tab stop: Right
      and Up give one more, Left and Down one less, and nothing goes past
      0 or `count`. A screen reader reads "{label}, {valueText}" and the
      new value after a change. `valueText(marked, count)` gives the
      state, "{marked} of {count}" by default; the app passes "2 of 4
      spent". A click keeps the focus on the group.
      `orientation="vertical"` puts the circles in a column, the first at
      the top, with the same keys. With `onChange`, `copy` makes a copy of
      a group that is a Tab stop in another place: it is hidden from a
      screen reader and is not a Tab stop, and a click changes it and does
      not move the focus.
    - `CurrentMax`: `current`, then "/ `max`" at the same size in the
      muted ink. With `reserve`, for example the largest value, the current
      value keeps the width of that text, at its right end, so the pair
      does not move when the value changes.
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
  - `NoteLine`: a flat yellow line of text in the flow of a form, for
    something the user can act on there, such as a suggestion. It is not
    tilted and has no shadow. `action` (`label`, `onClick`, and `name`
    when the label alone does not say what it acts on) adds a link button
    at the end of the line. Styles: `src/paper.css`.
  - `UseBubble`: the outline around something with limited uses: a
    `title`, its text, a `tag` in the top right, and one circle for each
    of its `uses`, or a `pool` with a large left / max. It is a group
    named by its title. `spent` gives the spent uses; a count above the
    uses reads as all spent. With every use spent, the outline is dashed
    and the text is muted. Without `onSpentChange`, it shows the spent
    uses and takes no clicks. With `onSpentChange(spent)`, the owner
    stores the count and sets the new `spent`: the circles are
    `SlotCircles` with the slash mark and the rule "one more, one less",
    one Tab stop that a screen reader reads as "{title}, 2 of 3 spent"; a
    pool gets a minus button ("Spend 1 {title}") and a plus button
    ("Regain 1 {title}"), and a click on its number opens a `SmallPopup`
    with an `AmountField` and Spend, Regain and Set. Spend and Regain stop
    at 0 and at the maximum, and Set gives the uses left. The number is a
    `CurrentMax` that keeps the width of its largest value, so the pool
    keeps its size. With neither `uses` nor `pool`, the bubble has no
    circles.
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
    The preference is a stored value (below).
  - `storedValue(key, { parse, serialize, fallback })`: a value of this
    browser in one `localStorage` key, for example the theme or a fold
    that stays on the device. Make one at the top level of a module. It
    has `read()`, `write(value)` and `subscribe(listener)`. `parse` gets
    the stored text, or `null`, and gives the value; `serialize` gives the
    text, or `null` to remove the key. Use a string, a number or a boolean
    as the value. When the storage cannot be read, `read()` gives
    `fallback`. When a write fails, the value stays in memory, and
    `read()` gives it until a write works or another tab changes the key.
    A change of the key in another tab tells the listeners.
  - `useStoredValue(store, serverValue)`: `[value, setValue]` of a stored
    value for a component.
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
