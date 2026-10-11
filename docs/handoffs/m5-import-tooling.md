---
type: Handoff
title: "M5 handoff: import tooling and homebrew UI"
description: "The record of M5 on Alchemy 5e, closed on 2026-10-11: what merged, the ORC-78 result, the decisions, the follow-ups, and the traps."
tags: [handoff, homebrew, import, milestones]
status: stable
generated: { by: claude-code/agent, at: 2026-10-11T15:38:42Z }
---

# M5 handoff: import tooling and homebrew UI

**M5 closed on 2026-10-11.** Every M5 issue is merged. ORC-78, the
real-user acceptance, ran on the owner's data: 43 of 43 characters
imported, and each one builds to the same values as the old app's code,
except for the Hexblade subclass value on 2 characters after a conflict
choice (ORC-132, engine, left open by the owner's decision). ORC-131, found
by that run, is merged (#46). The next milestone is M6, Backend. This
document stays as the record of M5: its decisions, follow-ups and traps.

## 1. Read these first

1. `CLAUDE.md` at the repository root. The current milestone line says M6.
2. `.claude/skills/milestone-workflow/SKILL.md` and
   `.claude/skills/linear-issue-workflow/SKILL.md`.
3. [Moving from Dungeon Master's Vault](../guides/moving-from-dungeon-masters-vault.md).
   ORC-78 follows this guide.
4. Linear ORC-78, and the M5 proof in
   [doc 06](../plan/06-milestones-and-risks.md).

## 2. State on 2026-10-10

The app pins `@pubdoor/dmv@0.3.0`. `fixtures/` is a snapshot of the
fork at tag `pubdoor-v0.3.0` (57fcce84). Each issue went as one PR into
`main`, and Ethan squash-merged each one.

| Issue | PR | What it added |
|---|---|---|
| ORC-107 (app part), ORC-114 | #39 | Engine 0.3.0 pin, fixtures copy, the old server's EDN in `readCharacterFile`, plan docs corrected to EDN |
| ORC-66, ORC-67 | #40 | The exporter bookmarklet (`tools/exporter-bookmarklet/`), and the Docker test in `.github/workflows/bookmarklet-docker.yml` |
| ORC-77 | #41 | Custom magic items: a `magicItems` IndexedDB store (database version 3), bundle import, My Content section, `Content` = `{ homebrew, magicItems }` passed to every engine call |
| ORC-74, ORC-128 | #42 | The builder frame (`HomebrewBuilder.tsx`), spell, monster and magic item forms |
| ORC-75 | #43 | Race, subrace, class and subclass forms; one toolkit in `builders/fields.tsx`; `engine/builder-choices.ts` |
| ORC-76 | #44 | Background, feat, language, invocation, boon and selection forms |
| ORC-68 | #45 | The guide at `/import/dmv` and `docs/guides/` |
| ORC-131 | #46 | In an internal conflict, the last copy that is on keeps the key |

Earlier M5 work (ORC-69 to ORC-73, ORC-41, ORC-126) was merged before
this session; see the PRs #34 to #38.

## 3. ORC-78, the M5 proof

The run and its numbers are on Linear ORC-78. The inputs stay outside the
repositories: `all-content3.orcbrew` (also at `fixtures/orcbrew/private/`,
git-ignored, so the private test block runs on the owner's machine) and
`dmv-export.json` in `/home/ethan/orc-78-private/`, with `results.md`.

- With the homebrew as the old importer leaves it, 42 of 43 characters
  match the JVM oracle exactly. The last differs by the set-order artifact
  of fixtures finding 13.
- Rename all first changed 15 characters. The cause was ORC-131: the key
  stayed on a copy in a pack that is off. After #46, 2 characters differ,
  only by ORC-132.
- Not covered: a real browser session with these files, and custom magic
  items (the account has none).

## 4. Decisions made in M5

- **One PR into `main` for each issue**, no milestone branch.
- **The old server sends EDN.** The bookmarklet does not parse it. A
  `dmv-export` entry in `characters` or `magicItems` can be the raw
  EDN text of one server response. `GET /dnd/5e/characters` holds every
  character in full, so the bookmarklet makes no per-id calls.
- **Magic items are not in `.orcbrew` export.** They go in the
  `dmv-export` bundle as item maps, without their on/off flags.
- **Magic items are stored apart from packs**, keyed from the name with
  the old `name-to-kw` rule. A new or renamed item cannot take another
  item's key.
- **The builders keep a stored key on rename**, because the engine's
  validators do so on purpose. A background whose key differs from its
  name shows a warning; characters always take the name's key.
- **No encounter builder** until the combat tracker decision (ORC-90).
- **`:plugin?`** is set only by the old built-in supplement classes, so
  homebrew classes keep their ASI and HP. No change.
- **No monster browse page** yet (ORC-87, M7). A saved monster shows in
  My Content.

## 5. Follow-ups filed in this session

| Issue | What |
|---|---|
| ORC-127 | Golden `fighter-20` holds `attuned-magic-items`, which the old server cannot store. The Docker test leaves it out |
| ORC-129 | Builder lists offer SRD values only (languages, weapons, class attunement, spell lists); the Custom base weapon is missing |
| ORC-130 | No import warning for a background key that differs from `name-to-kw(name)` |
| ORC-132 | PubDoor: two subclasses with the same name; a renamed key changes only `levels.<class>.subclass` |

Older open items: ORC-73's export check passed (84 exports). ORC-125 (no
line numbers in EDN parse errors) is still in the backlog.

## 6. Traps

- **This machine has no Docker.** The Docker test runs only in GitHub
  Actions. It triggers on PRs that touch `tools/exporter-bookmarklet/**`,
  or on demand with `gh workflow run bookmarklet-docker.yml --ref <branch>`.
  One run takes about 9 minutes.
- **The old public character link downloads a file** (`application/edn`
  with nosniff). It does not show text in the browser.
- **bun 1.0.14 lockfile bug.** Adding a new workspace and depending on it
  in one install fails. Install twice: first without the dependency.
- **`Content.homebrew` is required** (`Homebrew | undefined`), so a bare
  homebrew map does not type-check as `Content`.
- **No Transit strings in components.** Use `tag`, `untag`, `intKey`,
  `intKeyValue`, `asSet` and `setItems` in `engine/content.ts`.
- **Parallel workers on builder forms** each wrote their own toolkit in
  ORC-75. Give each worker the shared `builders/fields.tsx` up front.
- **Prettier.** The repository has no prettier config. Do not run it.
