// Extracts from the SRD 5.2.1 PDF the text that the content test compares with the srd52 pack: the header of
// each spell, and the weapon and armor tables. It writes src/srd52/fixtures/srd-5.2.1-text.json.
//
// Usage: bun scripts/extract-srd-text.ts <SRD_CC_v5.2.1.pdf>
//
// The PDF is not in the repository. docs/kb/5e-bits-2024-data.md, section "Sources and how they were read",
// names the copy and its SHA-256. The script needs pdftotext (poppler-utils).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ATTRIBUTION } from "./import-srd.ts";

const PDF_SHA256 = "8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87";
const OUTPUT = resolve(import.meta.dirname, "../src/srd52/fixtures/srd-5.2.1-text.json");

/** The pages of the spell descriptions, and of the weapon and armor tables. */
const SPELL_PAGES = [107, 175] as const;
const WEAPON_PAGE = 91;
const ARMOR_PAGE = 92;

/** The page is 594 points wide, in two columns. */
const COLUMN_WIDTH = 297;
const PAGE_HEIGHT = 783;

function pdftotext(pdf: string, page: number, args: string[]): string {
  return execFileSync("pdftotext", ["-f", String(page), "-l", String(page), ...args, pdf, "-"], { encoding: "utf8" });
}

/** The lines of one page, the left column and then the right column, with no page footer. */
function columnLines(pdf: string, page: number): string[] {
  // The footer is the document name and the page number. The number can be on a line of its own.
  const footer = new RegExp(`^((${page}\\s+)?System Reference Document 5\\.2\\.1(\\s+${page})?|${page})$`);
  return [0, COLUMN_WIDTH].flatMap((x) =>
    pdftotext(pdf, page, ["-x", String(x), "-y", "0", "-W", String(COLUMN_WIDTH), "-H", String(PAGE_HEIGHT)])
      .split("\n")
      .map((line) => line.replace(/\f/g, "").trim())
      .filter((line) => !footer.test(line)),
  );
}

export type SpellHeader = {
  name: string;
  page: number;
  /** For example "Level 2 Evocation (Wizard)" or "Evocation Cantrip (Sorcerer, Wizard)". */
  header: string;
  castingTime: string;
  range: string;
  components: string;
  duration: string;
};

const HEADER_START = /^(Level \d \w+|\w+ Cantrip) \(/;

function spellHeaders(pdf: string): SpellHeader[] {
  const lines: { text: string; page: number }[] = [];
  for (let page = SPELL_PAGES[0]; page <= SPELL_PAGES[1]; page++) {
    for (const text of columnLines(pdf, page)) lines.push({ text, page });
  }
  const spells: SpellHeader[] = [];
  lines.forEach((line, i) => {
    if (!line.text.startsWith("Casting Time:")) return;
    // Back from "Casting Time:" to the start of the level and school, which can take two lines.
    let start = i - 1;
    while (start > 0 && !HEADER_START.test(lines[start].text)) start--;
    let nameAt = start - 1;
    while (!lines[nameAt].text) nameAt--;
    const header = lines
      .slice(start, i)
      .map((l) => l.text)
      .filter(Boolean)
      .join(" ");
    // The fields after it, each to the next field. Components with a long material take more lines.
    const fields: Record<string, string> = {};
    let key = "";
    for (let j = i; j < lines.length; j++) {
      const field = /^(Casting Time|Range|Components?|Duration): (.*)$/.exec(lines[j].text);
      if (field) {
        key = field[1].replace(/^Component$/, "Components");
        fields[key] = field[2];
      } else if (key === "Duration") break;
      else if (lines[j].text) fields[key] += ` ${lines[j].text}`;
    }
    spells.push({
      name: lines[nameAt].text,
      page: lines[nameAt].page,
      header,
      castingTime: fields["Casting Time"],
      range: fields.Range,
      components: fields.Components,
      duration: fields.Duration,
    });
  });
  return spells;
}

/** The rows of a table in the layout text: a group heading, then rows whose cells have two or more spaces between them. */
function layoutLines(pdf: string, page: number): string[] {
  return pdftotext(pdf, page, ["-layout"]).split("\n");
}

export type WeaponRow = { group: string; name: string; damage: string; properties: string; mastery: string; weight: string; cost: string };

function weaponTable(pdf: string): WeaponRow[] {
  const rows: WeaponRow[] = [];
  let group = "";
  const row = /^\s+(.+?)\s+(\d+(?:d\d+)? [A-Z][a-z]+)\s+(.+?)\s{2,}([A-Z][a-z]+)\s+(\S+ lb\.|—)\s+([\d,]+ [CSG]P)$/;
  for (const line of layoutLines(pdf, WEAPON_PAGE)) {
    const heading = /^\s+((Simple|Martial) (Melee|Ranged) Weapons)$/.exec(line);
    const cells = row.exec(line);
    if (heading) group = heading[1];
    else if (cells) {
      const [, name, damage, properties, mastery, weight, cost] = cells;
      rows.push({ group, name, damage, properties, mastery, weight, cost });
    } else if (group && rows.length && /^\s{20,}\S/.test(line)) rows[rows.length - 1].properties += ` ${line.trim()}`;
  }
  return rows;
}

export type ArmorRow = { group: string; name: string; armorClass: string; strength: string; stealth: string; weight: string; cost: string };

function armorTable(pdf: string): ArmorRow[] {
  const rows: ArmorRow[] = [];
  let group = "";
  const row = /^\s+(.+?)\s{2,}(\+2|\d+(?: \+ Dex modifier(?: \(max 2\))?)?)\s{2,}(—|Str \d+)\s{2,}(—|Disadvantage)\s+(\d+ lb\.)\s+([\d,]+ GP)$/;
  for (const line of layoutLines(pdf, ARMOR_PAGE)) {
    const heading = /^\s+((Light|Medium|Heavy) Armor|Shield) \(/.exec(line);
    const cells = row.exec(line);
    if (heading) group = heading[1];
    else if (cells && group) {
      const [, name, armorClass, strength, stealth, weight, cost] = cells;
      rows.push({ group, name, armorClass, strength, stealth, weight, cost });
    }
  }
  return rows;
}

function main() {
  const pdf = process.argv[2];
  if (!pdf) throw new Error("Usage: bun scripts/extract-srd-text.ts <SRD_CC_v5.2.1.pdf>");
  const sha256 = createHash("sha256").update(readFileSync(pdf)).digest("hex");
  if (sha256 !== PDF_SHA256) throw new Error(`The PDF is not the SRD 5.2.1 copy that the docs name: SHA-256 ${sha256}`);
  const fixture = {
    source: "SRD_CC_v5.2.1.pdf",
    sha256,
    attribution: ATTRIBUTION,
    spells: spellHeaders(pdf),
    weapons: weaponTable(pdf),
    armor: armorTable(pdf),
  };
  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`Wrote ${fixture.spells.length} spells, ${fixture.weapons.length} weapons, ${fixture.armor.length} armor to ${OUTPUT}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
