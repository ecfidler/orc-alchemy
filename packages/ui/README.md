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
  tab and alert note styles (`src/shell.css`), the button styles
  (`src/button.css`), and the fieldset and field styles (`src/field.css`).
- `.`: the components and hooks.
  - `Button`: Base UI Button with `variant` ("ghost", "solid" or "link"),
    `size` ("small", "normal" or "large") and `type` ("button" or
    "submit"). A ghost button with `aria-current` shows as solid. One with
    `aria-pressed` does too, until the pressed groups move to Toggle
    (ORC-160). `className` is for layout and spacing; colors and borders
    come from the variant. Styles: `src/button.css`.
  - `ButtonLink`: a link with the look of a button. Like `FlagTab`, it
    takes the link element as `render`. It takes `className` as `Button`
    does.
  - `Fieldset`: Base UI Fieldset, a group named by its `legend`, or by
    `label` when the legend is not the right name.
  - `Field`: Base UI Field. It shows its `errors` after its children, as
    a list named "Problems: {label}", and is invalid while it has some. A
    Base UI control in it gets the list as its description. Styles:
    `src/field.css`.
  - `Shell`, `FlagTabs` and `FlagTab`: the binder shell with its margin rail
    and flag tabs. `FlagTab` takes the link element as `render`, so the app
    gives it its router's link.
  - `AlertNotes` and `AlertNote`: flat notes at the top of the page column.
  - `useThemePreference()`, `themeHeadScript` and `THEME_STORAGE_KEY`.
- `./testing`: test helpers (none yet).

## Rules

- No 5e words. The package never imports `@pubdoor/dmv` or app state.
- Apps import controls from this package, never from `@base-ui/react`.
- When you add a text color token, add its pairs to `src/theme.test.ts`.
