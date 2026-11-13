# Coding standards

The `standards-reviewer` agent reads this file during review. It holds the
judgement rules that no automated check can apply. A rule that a linter or
a test can check belongs in that check, not here.

- **One home for shared code.** A helper or a control that two files need
  lives in one place. In a form, use the control from `@orc-alchemy/ui`
  (the Exports list in `packages/ui/README.md`) or the helper from
  `packages/app/src/components/builders/fields.tsx` before a local copy.
- **Engine code lives in `packages/app/src/engine`.** Only that folder
  imports `@pubdoor/dmv`, as the header comment of `engine.ts` states; a
  test file can import a type from it. Code
  that reads or computes engine values for a component also goes there.
- **A storage test compares the whole record.** When a change must keep a
  stored value the same, the test compares the full stored record with the
  expected record, not selected fields.
- **The spec changes in the same PR.** When a PR adds or changes a rule of
  behaviour or of look, it updates the spec in `docs/design/` that owns the
  rule.
- **No 5e words in `@orc-alchemy/ui`.** The package is generic. Rules terms
  stay in the app.
