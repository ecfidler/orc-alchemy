---
type: Handoff
title: "M4 handoff: builder"
description: "The starting point to continue M4 on Alchemy 5e: what is merged, the run plan for the seven open issues, the decisions so far, and the traps found on the way."
tags: [handoff, builder, milestones]
status: stable
generated: { by: claude-code/agent, at: 2026-10-08T00:04:45Z }
---

# M4 handoff: builder

You are picking up M4 of project Alchemy 5e, *Builder*. Three of the ten
M4 issues are merged. Seven are open. The proof of the milestone is
ORC-65: each golden character, rebuilt from scratch in the builder, gives
an identical strict entity and identical built values. This document gives
the state of the work, the run plan, the decisions so far, and the traps
that cost time in the last session.

## 1. Read these first

1. `CLAUDE.md` at the repository root. The current milestone line says M4.
2. `.claude/skills/milestone-workflow/SKILL.md` and
   `.claude/skills/linear-issue-workflow/SKILL.md`. The last session ran the
   milestone with the first skill and each issue with the second.
3. [Plan Set 1 doc 05](../plan/plan-set-1/05-page-rebuild.md), §4.3, for
   the six builder slices.
4. The Linear comments on ORC-58 and ORC-62. They hold notes from the
   merged work for those issues.
5. The old builder, `src/cljs/orcpub/character_builder.cljs` in the fork
   (`../orcpub` next to this repository). It is the specification, not
   source to port.

## 2. State on 2026-10-08

**The engine.** The app pins `@pubdoor/dmv@0.2.0` exactly. This version
was enough for slice 1 and for the unfilled count. No engine change was
necessary.

**The branches.** There is no milestone branch. Each issue branch is cut
from `main`, and each PR targets `main`, so CI runs on each PR. The main
checkout is on `main` at `680d2f0`.

| Issue | PR | What it added |
|---|---|---|
| ORC-55 | #23 | The builder at `/build/:id`: the Race, Background, Class and Feats steps, option cards, nested selections, merged ref selections, and the sheet as a live preview. The New character button. The Build link on the sheet |
| ORC-63 and ORC-64 | #24 | The step counts ("Race (1 to do)"), the "Still to do" summary, and the Random character button |

**The code map for the builder.** All paths are under `packages/app/src/`.

| File | Job |
|---|---|
| `engine/builder.ts` | `builderSteps(selections, shape)`: joins `evaluate().selections` to the template options, nests children, merges ref selections, sorts, and groups the steps. `unfilled`, `remainingByStep`, `remainingOf`. `useBuilderSteps` |
| `components/Builder.tsx` | The summary, the step buttons, the `Selection` cards, and the preview. `pick` calls `select`, `deselect`, or `setClass` |
| `components/CharacterList.tsx` | `NewCharacter`: the New character and Random character buttons |
| `routes/routes.tsx` | `OpenCharacter` opens a stored character for `SheetPage` and `BuildPage` |
| `state/character.ts` | `useCharacter.update` applies a mutation. Each change writes a draft at once and saves the record 7.5 s later (ORC-49) |
| `e2e/builder.spec.ts` | `stepButton(page, name)` finds a step button whatever its count |

## 3. The run plan

Work the items in this order. The next item starts after the owner merges
the PR of the item before it.

| # | Issue | Notes |
|---|---|---|
| 3 | ORC-62, slice 6: save, autosave, draft recovery | Most of the logic exists (see the ORC-49 comment on the issue). It still needs the Save button, the in-app navigation guard, a notice when a draft is recovered, and the e2e test that edits, reloads, and recovers. A second comment asks for a retry when an autosave fails |
| 4 | ORC-57, slice 2: ability scores | `ability-scores` is a `requireValue` selection that the steps leave out today (`STEPS` in `builder.ts`). Add an Abilities step |
| 5 | ORC-58, slice 3: classes and levels | Replace the temporary class pick and its prompt (see §4). Hit points at level 2 and above are `requireValue` selections that show as plain cards now |
| 6 | ORC-59, slice 4a: equipment | The equipment lists are left out of the steps today. Use `addInventoryItem`, `setField`, and `addStartingEquipment` |
| 7 | ORC-60, slice 4b: spells | |
| 8 | ORC-61, slice 5: description | Free-form `::values` through `setValue` |
| 9 | ORC-65, the parity test | The finish line. See the effect of ORC-118 below |

**Related work outside M4.**

- **ORC-118 (PubDoor, in the fork).** Four golden characters are not
  complete under the merged count (see §4). This issue fixes them and the
  fixture oracle, then the fixtures are copied again. If it lands before
  ORC-65, the parity test rebuilds the corrected characters. Remove the
  golden entries from `KNOWN_UNFILLED` in `engine/builder.test.ts` then.
- **ORC-117 (PubDoor).** Option help text in `buildTemplate().shape`. Not
  on the M4 critical path.

When ORC-65 merges, close the milestone as `milestone-workflow` §4 says:
check the proof claim by claim, and name the test for each claim.

## 4. Decisions made in M4

- **Options come from the template, not from a new engine call.** For each
  selection, `builderSteps` follows the `path` through
  `buildTemplate(homebrew).shape`. Under a ref selection, the `path` of a
  child starts at the ref `actualPath`, not at its tree position. So the
  child template comes from the parent's templates. This relies on
  `evaluate` listing a parent before its children.
- **A ref selection at several positions is one node.** It is the same
  object at each position, as the old `combine-ref-selections` makes it: min
  and max are the sums, and the options are the union. It shows at every
  position. The old app showed Languages once, on a Proficiencies page. The
  owner did not ask to change this.
- **The unfilled count follows the old `validate-selections` (option A,
  decided by the owner on ORC-63).** It counts merged ref selections. The
  summary leaves out selections tagged `starting-equipment`. The step
  counts include them, as the old section headings do, and count a merged
  selection only on its first step. The summary lists the messages in step
  order.
- **The fixture oracle differs from the merged count.** `unfilledSelections`
  counts each position separately and lists only picks to make. These
  fixtures differ, and the test keeps them in `KNOWN_UNFILLED`:
  - `fighter-11` and `fighter-20`: 1 Fighting Style to make;
  - `warlock-10-drow`: 1 Feat to make;
  - `fighter-3-wizard-2`: 1 Language to remove;
  - `character-test-2`: 1 Language to remove. This one is real data: the
    Noble background is not in the SRD. It stays.
- **The class pick is temporary.** It calls `setClass(e, 0, key)`, which
  replaces the first class with the new class at level 1. When the first
  class has more than one level, or there is more than one class, it asks
  with `window.confirm` first. The owner asked for this prompt. ORC-58
  replaces both with real class and level management.
- **New and Random save at once.** Each button saves the character with
  `addCharacter`, then opens `/build/:id`. A random character has no name.

## 5. Traps

- **React Router changes the URL before it renders the new page.** After
  a click on a link, `toHaveURL` can pass while the old page is still on
  the screen. Wait for something that is only on the new page. The builder
  e2e test failed in CI on this, but not on the local machine. To test a
  fix, slow the CPU with CDP: `Emulation.setCPUThrottlingRate`, rate 6.
- **CPU load makes timing tests fail.** The builder unit tests are heavy.
  A list test that waited 1 s for a rebuild started to fail about once in
  10 runs. Run a suspect test 15 to 20 times on the branch and on `main`
  before you decide.
- **Tests share the fake IndexedDB in one file.** A record that one test
  stores is still there in the next test. Do not use the same character
  name in two tests of one file.
- **Playwright closes dialogs.** It dismisses a `confirm` that a test does
  not handle. A prompt that is not expected then blocks the action and
  nothing changes.
- **`gh pr edit` fails** with a "Projects (classic)" GraphQL error. Set the
  PR body with `gh api -X PATCH repos/ecfidler/orc-alchemy/pulls/<n> -F body=@<file>`.
- **A pipe hides a failed check.** `bun run test | grep Tests` succeeds
  even when tests fail. Read the counts before you commit.
- **Linear rewrites issue IDs in descriptions as links.** A `patch` whose
  `old_string` has an issue ID can fail. Choose an anchor without one.

## 6. Open issues from this session

| Issue | Project | State | Subject |
|---|---|---|---|
| ORC-117 | PubDoor | Backlog | Option help text in the template shape, and an optional per-option "available" flag |
| ORC-118 | PubDoor | Backlog | Fix four golden characters and make the fixture oracle count merged ref selections and picks to remove |
