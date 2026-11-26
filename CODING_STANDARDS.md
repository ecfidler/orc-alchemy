# Coding standards

The `standards-reviewer` agent reads this file during review. It holds the
judgement rules that no automated check can apply. A rule that a linter or
a test can check belongs in that check, not here.

- **One home for shared code.** A helper or a control that two files need
  lives in one place. In a form, use the control from `@orc-alchemy/ui`
  (the Exports list in `packages/ui/README.md`) or the helper from
  `packages/app/src/components/builders/fields.tsx` before a local copy.
- **In the app, engine code lives in `packages/app/src/engine`.** Only
  that folder of the app imports `@pubdoor/dmv`, as the header comment of
  `engine.ts` states; a test file can import a type from it. Code
  that reads or computes engine values for a component also goes there.
  The app imports `@orc-alchemy/engine`, the 2024 engine, in the same
  folder only.
- **A storage test compares the whole record.** When a change must keep a
  stored value the same, the test compares the full stored record with the
  expected record, not selected fields.
- **The spec changes in the same PR.** When a PR adds or changes a rule of
  behaviour or of look, it updates the spec in `docs/design/` that owns the
  rule.
- **No 5e words in `@orc-alchemy/ui`.** The package is generic. Rules terms
  stay in the app.
- **A test is a unit test unless it needs the browser.** A Playwright test
  is for a flow through more than one screen, for focus and keyboard
  behaviour, and for layout that jsdom cannot compute. A test of one
  component, of a text, or of a stored value is a Vitest test. Before you
  add a Playwright test, examine the unit tests for the same check.
- **No screenshot code in the repository.** A screenshot for a PR comes
  from a script outside the repository and goes to the project thread.
  `packages/app/src/e2e-rules.test.ts` enforces this rule.

## Budgets

`budgets.json` holds the limits on size and count, and `scripts/budgets.ts`
checks them in CI (ORC-362). A limit is there so that growth is a decision,
not an accident.

| Key | Limit on |
|---|---|
| `e2eTests` | the number of Playwright tests |
| `unitTestFiles` | the number of unit test files of the app |
| `unitTestFileSeconds` | the time of one unit test file in CI |
| `bundleJsKB` | the JavaScript of the built app |
| `sourceLines.max` | the lines of one TypeScript file |
| `fileKB.max` | the size of one tracked file |
| `imageFolders` | the only folders that can hold an image or a video |

- **Try to stay in the budget first.** Replace a test, move a check to a
  unit test, split a file, or load the code only when it is necessary.
- **To raise a budget, change `budgets.json` in the same PR.** In the PR
  body, give the old value, the new value and the reason. Raise a count
  to the value the PR needs plus a small margin, not to a round large
  number.
- **An exception in `sourceLines.exceptions` can only become smaller.**
  When a PR makes such a file shorter, it lowers the number. When the file
  is at or below `sourceLines.max`, the PR removes the exception. Do not
  add a new exception: split the file.
- **A new entry in `fileKB.exceptions` is for vendored or generated data
  only.**
