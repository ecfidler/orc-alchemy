# Product

<!-- impeccable:product-schema 1 -->

This file is the product record that the Impeccable design skill reads
(`.claude/skills/impeccable/`). `/impeccable init` wrote it on 2026-11-18
(ORC-260), and Ethan confirmed its content. It holds product facts only. The
look of the app is in `docs/design/theme.md`.

## Platform

web

## Users

- Players of Dungeons & Dragons 5th edition who build a character and then
  use its sheet at the table during a session, on a laptop or a phone.
- People who write homebrew content: races, subraces, classes, subclasses,
  backgrounds, feats, spells, monsters and magic items.
- Many users come from Dungeon Master's Vault (orcpub) and bring their
  characters and `.orcbrew` files with them.

Not decided: if Alchemy 5e is a public product or an app for Ethan and his
group. Do not write copy that assumes one or the other.

## Product Purpose

Alchemy 5e is a character builder and character sheet for D&D 5e. A user
builds a character step by step, and the rules engine computes each value on
the sheet. The user then plays from the sheet: hit points, spell slots, and
the uses of features. The app succeeds when a user can run a character at
the table from it, and can bring all their old content into it.

## Positioning

- Free.
- Local-first. The app works without an account, and the data stays in the
  browser.
- Full homebrew. A form exists for each content type.
- The built-in content is the SRD only. All other content comes from the
  user's own homebrew.
- It imports Dungeon Master's Vault characters and `.orcbrew` files that the
  user exports themselves.

## Operating Context

- The sheet is in use during play. The user reads a value or marks a use in
  a few seconds, often on a phone.
- The builder and the homebrew forms are for longer sessions, mostly on a
  laptop.
- A new user from Dungeon Master's Vault starts with Import, before they
  build a character.
- The pages are Home, Characters, the builder, the sheet, Import, My Content
  with the homebrew forms and Review uses, and Preferences.

## Capabilities and Constraints

- The rules are the 2014 rules, from the `@pubdoor/dmv` engine. The 2024
  rules (SRD 5.2.1) come later from `packages/engine`.
- Built-in content is SRD 5.1 only. Never show non-SRD content as built in.
- There is no account and no backend yet. The backend is the Linear project
  *Demiplane*.
- There is no PDF export.
- The stack is Vite, React 18, TypeScript and Tailwind. The theme and the
  controls come from `@orc-alchemy/ui` (`packages/ui`).
- Use the terms of `GLOSSARY.md` in the interface copy and in the code.

## Brand Commitments

- The name is Alchemy 5e.
- The logo is the potion bottle with the liquid swirl
  (`packages/app/public/potion-*.png`, `packages/app/src/components/Potion.tsx`).
- The motif is Paper. `docs/design/theme.md` is the theme spec and is the
  authority for tokens, type, controls and layout.
- Light and Dark themes, with a Match System preference.
- No voice for the copy is defined.

## Evidence on Hand

- The theme spec: `docs/design/theme.md`. The homebrew forms spec:
  `docs/design/homebrew-forms.md`.
- The prototypes: `docs/design/prototypes/`.
- The engine fixtures in `fixtures/` give real characters for examples.
- There are no testimonials, user counts, or press. Do not invent them.

## Product Principles

1. The sheet must work at the table. Speed of reading and of marking a use
   comes before decoration.
2. The data belongs to the user. It stays local, and the user can import and
   export it.
3. Homebrew content gets the same treatment as built-in content.
4. The app feels like a paper character sheet, but it does not copy paper
   literally.
5. One term for one concept, from `GLOSSARY.md`.

## Accessibility & Inclusion

The standard is WCAG 2.2 AA: 4.5 : 1 for text, and 3 : 1 for field borders
and marks, in the Light theme and in the Dark theme.
