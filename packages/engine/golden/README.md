# Golden characters

The 2024 rules have no oracle. A golden character is a character with
sheet values that a person or an agent computed by hand from SRD 5.2.1.
`golden.test.ts` builds each character at each checked level and compares
the result with the expected values. A failure names the character, the
level, and the sheet value. The spec is `docs/design/2024-engine.md`,
section _Test strategy_. This folder is not the `fixtures/` snapshot of the
2014 fork.

## Rules

1. Do not copy an expected value from the output of the engine. Compute
   each value from the SRD text. If the engine gives another value, find
   which one is wrong before you change either.
2. Write the arithmetic and the SRD 5.2.1 page of each expected number in
   a comment above it, for example `// Level 1: d10 + Con 2 = 12 (p47).`
3. Check three levels or more, and one of them is level 20.
4. A character makes every choice that the template asks for at the
   checked level. The suite fails on any problem of the character.
5. Each class ticket writes the character of its class in this table's
   plan, adds the file under `characters/`, and lists it in `index.ts`.
   The PR names the file, so that the reviewer can check a sample of the
   values.

## Read the SRD text

The SRD 5.2.1 PDF has two columns on most pages. Extract it one column at
a time with `pdftotext`, as `docs/kb/5e-bits-2024-data.md` says, or use
the page fixture in `src/srd52/fixtures/`, from
`bun run extract-srd-text`. Then find the rule in the text of its page.
A table that splits a sentence can make the text look wrong; check the
page of the PDF when in doubt.

## The file form

A character is a module in `characters/` that exports
`defineGolden({ name, packs?, checks })`:

- `packs`: test pack files beside the built-in pack, for a character with
  a test class.
- `checks`: one entry for each checked level, with the `level`, the
  `entity` (the choices at that level), and `expected`, a part of
  `Built2024`. The suite compares each value as a whole.

## Plan

The 12 class characters and the 2 multiclass characters cover the 9
species and the 4 backgrounds. A class ticket can change its row, but the
table must still cover each species and each background
(`golden.test.ts` checks it).

| Character           | Class and subclass               | Species    | Background | Checked levels  | Ticket  |
| ------------------- | -------------------------------- | ---------- | ---------- | --------------- | ------- |
| Fighter             | Fighter, Champion                | Dwarf      | Soldier    | 1, 3, 5, 11, 20 | ORC-230 |
| Barbarian           | Barbarian, Path of the Berserker | Goliath    | Soldier    | 1, 5, 20        | ORC-250 |
| Monk                | Monk, Warrior of the Open Hand   | Human      | Criminal   | 1, 5, 20        | ORC-251 |
| Rogue               | Rogue, Thief                     | Halfling   | Criminal   | 1, 3, 20        | ORC-252 |
| Wizard              | Wizard, Evoker                   | Elf        | Sage       | 1, 5, 20        | ORC-254 |
| Druid               | Druid, Circle of the Land        | Gnome      | Sage       | 1, 5, 20        | ORC-253 |
| Cleric              | Cleric, Life Domain              | Dwarf      | Acolyte    | 1, 5, 20        | ORC-232 |
| Paladin             | Paladin, Oath of Devotion        | Orc        | Soldier    | 1, 5, 20        | ORC-231 |
| Bard                | Bard, College of Lore            | Halfling   | Acolyte    | 1, 6, 20        | ORC-233 |
| Ranger              | Ranger, Hunter                   | Elf        | Criminal   | 1, 5, 20        | ORC-257 |
| Sorcerer            | Sorcerer, Draconic Sorcery       | Dragonborn | Acolyte    | 1, 6, 20        | ORC-255 |
| Warlock             | Warlock, Fiend Patron            | Tiefling   | Acolyte    | 1, 5, 20        | ORC-256 |
| Fighter and Wizard  | Fighter 2, then Wizard           | Human      | Sage       | 3, 8, 20        | ORC-234 |
| Paladin and Warlock | Paladin 2, then Warlock          | Tiefling   | Soldier    | 3, 8, 20        | ORC-234 |
