// The Spellcasting section of the character sheet: the caster boxes, the cantrip lines and the table of spells by level.
import { Button, FramedBox, Label, ShadedPanel, SlotCircles } from "@orc-alchemy/ui";
import { Fragment, type ReactNode } from "react";
import { bonusStr, type OpenSpells, ordinal, type Sheet, type Spellcasting, type SpendSlots } from "../engine/sheet.ts";
import { type ListedSpell, spellGroups } from "../engine/spell-list.ts";
import { slotGroupsOf, spentText } from "../engine/spell-slots.ts";
import { useSpellLookup } from "../state/spell-records.ts";
import { abbr, RowBox, Tag } from "./sheet-parts.tsx";

/**
 * The Spellcasting section of the theme spec: a row of boxes for the sources,
 * then one table row for each level, with the shared slots and the spells.
 * A source that prepares shows only its prepared spells. Other sources show
 * all known spells. Sources with the same DC, attack and ability share one
 * row of boxes. A source that is not a class and knows only cantrips, such
 * as a High Elf's cantrip, is one short line in place of boxes and tags
 * (ORC-176). With more than one source in the table, the smaller sources
 * get marks (ORC-179, see `sourceMarks`). On a narrow sheet the slots go
 * under the level, and the spells get the width of the Slots column.
 * Each spell shows the name from its record, or the name from its key when it
 * has no record (ORC-280). Until the SRD spells load, the section shows its
 * levels and slots, and no spell names, so a wrong name never shows.
 * The Pact Magic slots are apart, as diamonds after the circles in the row
 * of their slot level (ORC-283). `spellGroups` gives the spells that show,
 * the Spells panel uses the same rule. With `onOpenSpells`, an "All spells"
 * button at the end of the section rule opens the panel, and each spell name
 * is a button that opens it at that spell (ORC-285).
 */
export function SpellcastingBox({
  spellcasting,
  classes,
  narrow,
  onSpendSlots,
  onOpenSpells,
}: {
  spellcasting: Spellcasting;
  classes: Sheet["classes"];
  narrow: boolean;
  onSpendSlots?: SpendSlots;
  onOpenSpells?: OpenSpells;
}) {
  const { casters } = spellcasting;
  const lookup = useSpellLookup();
  const classNames = new Set(classes.map((c) => c.name));
  const prepares = new Map(casters.map((caster) => [caster.name, caster.prepares]));
  const levelGroups = spellGroups(spellcasting, lookup);
  const spells = levelGroups.flatMap((group) => group.spells);
  // A spell's source can have no boxes, so the sources come from the spells too.
  const allSources = new Set([...casters.map((caster) => caster.name), ...spells.map((spell) => spell.source)]);
  const cantripOnly = (source: string) =>
    !classNames.has(source) && spells.some((spell) => spell.source === source) && spells.every((spell) => spell.source !== source || spell.level === 0);
  const lines = new Set([...allSources].filter(cantripOnly));
  const sources = [...allSources].filter((source) => !lines.has(source));
  const several = sources.length > 1;
  const title = several ? "Spells" : prepares.get(sources[0]!) ? "Prepared spells" : "Known spells";
  const groups = casterGroups(casters.filter((caster) => !lines.has(caster.name)));
  const rows = levelGroups
    .map(({ level, spells }) => ({ level, slots: slotGroupsOf(spellcasting, level), spells: spells.filter((spell) => !lines.has(spell.source)) }))
    .filter((row) => row.slots.length > 0 || row.spells.length > 0);
  const marks = sourceMarks(
    rows.flatMap((row) => row.spells.map((spell) => spell.source)),
    classes,
    new Set(groups.filter((group) => isNamed(group, groups)).flatMap((group) => group.names)),
  );
  return (
    <FramedBox
      label="Spellcasting"
      className="gap-2.5"
      action={
        onOpenSpells && (
          <Button icon="sparkles" onClick={() => onOpenSpells()}>
            All spells
          </Button>
        )
      }
    >
      {groups.length > 0 && (
        <ShadedPanel>
          {groups.map((group) => (
            <CasterRow key={group.names.join("/")} group={group} named={isNamed(group, groups)} marks={marks} />
          ))}
        </ShadedPanel>
      )}
      {lines.size > 0 && lookup !== null && (
        // role="list": without bullets, Safari does not name a ul as a list.
        <ul role="list" className="grid gap-0.5 text-[14.5px]">
          {[...lines].map((source) => (
            <CantripLine
              key={source}
              source={source}
              cantrips={spells.filter((spell) => spell.source === source)}
              caster={casters.find((caster) => caster.name === source)}
              onOpen={onOpenSpells}
            />
          ))}
        </ul>
      )}
      {rows.length > 0 && (
        <table className="w-full table-fixed border-collapse text-left text-[14.5px]">
          <caption className="sr-only">Spells by level</caption>
          <colgroup>
            {/* Circles that change have 28px tap areas: the Slots column takes four on a line with space at each side, and the narrow
                level column three. */}
            <col className={narrow && !onSpendSlots ? "w-[76px]" : "w-[80px]"} />
            {!narrow && <col className={onSpendSlots ? "w-[132px]" : "w-[98px]"} />}
            <col />
          </colgroup>
          <thead>
            <tr className="border-b border-rule-strong">
              <th scope="col" className="pb-0.5 text-center font-normal">
                <Label>Level</Label>
              </th>
              {!narrow && (
                <th scope="col" className="pb-0.5 pl-2.5 font-normal">
                  <Label>Slots</Label>
                </th>
              )}
              <th scope="col" className={`pb-0.5 font-normal ${narrow ? "pl-2" : "pl-3"}`}>
                <Label>{title}</Label>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ level, slots, spells }) => (
              <SlotRow
                key={level}
                name={level === 0 ? "Cantrips" : ordinal(level)}
                small={level === 0}
                narrow={narrow}
                groups={slots.map(({ group, label, count, spent }) => ({
                  label,
                  count,
                  spent,
                  shape: group === "pact" ? ("diamond" as const) : undefined,
                  onChange: onSpendSlots && ((next: number) => onSpendSlots(group, next)),
                }))}
              >
                {/* role="list": without bullets, Safari does not name a ul as a list. */}
                {lookup !== null && (
                  <ul role="list" className="[&>li]:inline [&>li:not(:last-child)]:after:content-[',_']">
                    {spells.map((spell) => (
                      <li key={`${spell.source}/${spell.key}`}>
                        <SpellName spell={spell} onOpen={onOpenSpells} />
                        <SourceMark source={spell.source} mark={marks.get(spell.source)} />
                        <CastNote note={spell.castNote} />
                      </li>
                    ))}
                  </ul>
                )}
              </SlotRow>
            ))}
          </tbody>
        </table>
      )}
    </FramedBox>
  );
}

/** A group of slots in a row of the Spellcasting table: the circles of a level, or the diamonds of the pact slots. */
interface RowSlots {
  /** The name a screen reader gives the group. */
  label: string;
  count: number;
  spent: number;
  shape?: "diamond";
  /** Sets the spent slots. With it the slots can change: they are drawn larger, with tap areas. */
  onChange: ((spent: number) => void) | undefined;
}

/**
 * A row of the Spellcasting table: the level cell, the Slots cell and the
 * spells cell. `name` is the level cell's text: an ordinal, or the word
 * "Cantrips" in the smaller size. The pact slots of the level are after its
 * other slots. On a narrow sheet the slots go under the name, and the row is
 * named by the name only, so a screen reader does not read the slots with
 * each spell.
 */
function SlotRow({ name, small, narrow, groups, children }: { name: string; small: boolean; narrow: boolean; groups: RowSlots[]; children: ReactNode }) {
  const circles = groups.map(({ label, count, spent, shape, onChange }) => (
    // Four small circles fit on one line in the narrow column. Circles that change take three on a line, and
    // four go two and two.
    <span key={label} className={narrow && onChange && count === 4 ? "max-w-[56px]" : undefined}>
      <SlotCircles
        shape={shape}
        label={label}
        count={count}
        marked={spent}
        size={narrow && !onChange ? "small" : "normal"}
        onChange={onChange}
        valueText={spentText}
      />
    </span>
  ));
  const has = groups.length > 0;
  return (
    <tr className="border-b border-rule last:border-0">
      <th
        scope="row"
        aria-label={narrow && has ? name : undefined}
        className={`border-r border-rule py-1.5 text-center font-serif leading-[1.1] font-medium ${narrow ? "pr-1.5 align-top" : "pr-2.5"} ${
          small ? (narrow ? "text-[13px]" : "text-base") : narrow ? "text-lg" : "text-2xl"
        }`}
      >
        {name}
        {/* A group that does not fit beside the group before it goes on the next line. */}
        {narrow && has && <span className="mt-1 flex flex-col items-center gap-0.5">{circles}</span>}
      </th>
      {!narrow && (
        <td className="border-r border-rule py-1.5 pl-2.5">{has && <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">{circles}</span>}</td>
      )}
      <td className={`py-1.5 align-top ${narrow ? "pl-2" : "pl-3"}`}>{children}</td>
    </tr>
  );
}

/**
 * A spell name. With `onOpen`, it is a button with the look of plain text that opens the Spells panel at the
 * spell; else it is plain text.
 */
function SpellName({ spell, onOpen }: { spell: ListedSpell; onOpen: OpenSpells | undefined }) {
  if (!onOpen) return spell.name;
  return (
    <Button variant="plain" onClick={() => onOpen({ key: spell.key, source: spell.source })}>
      {spell.name}
    </Button>
  );
}

/** A spell's cast note, in parentheses after the name and its mark: "Detect Magic (at will)". */
function CastNote({ note }: { note: string | null }) {
  return note === null ? null : <> ({note})</>;
}

type Caster = Spellcasting["casters"][number];
type CasterGroup = Pick<Caster, "saveDc" | "attackBonus" | "ability"> & { names: string[] };

/** A caster row has a label when there is more than one row, or when the row is for more than one source. */
function isNamed(group: CasterGroup, groups: CasterGroup[]) {
  return groups.length > 1 || group.names.length > 1;
}

/** The casters, with the ones that have the same DC, attack and ability in one group, in the order they come. */
function casterGroups(casters: Caster[]): CasterGroup[] {
  const groups: CasterGroup[] = [];
  for (const { name, saveDc, attackBonus, ability } of casters) {
    const same = groups.find((g) => g.saveDc === saveDc && g.attackBonus === attackBonus && g.ability === ability);
    if (same) same.names.push(name);
    else groups.push({ names: [name], saveDc, attackBonus, ability });
  }
  return groups;
}

/** How a spell shows its source: nothing, a mark keyed on the source's caster row, or the source name as a tag. */
type Mark = { kind: "symbol"; symbol: string } | { kind: "tag" };

const symbols = ["\u2020", "\u2021"];

/**
 * The marks of the sources in the table (ORC-179). `tableSources` has one
 * entry for each spell in the table. The main source, the one with the most
 * spells, has no mark. Ties go to a class over a race or feat, then to the
 * higher class level, then to the class taken first, then A to Z. With 2 or
 * 3 sources, the second gets † and the third ‡. With 4 or more, every source
 * but the main one gets its name as a tag. A source whose name is not in
 * `labelled` (the names on the caster row labels) has nowhere to put the key,
 * so it gets a tag too, and the symbols go to the sources that remain.
 */
export function sourceMarks(tableSources: string[], classes: Sheet["classes"], labelled: Set<string>): Map<string, Mark> {
  const counts = new Map<string, number>();
  for (const source of tableSources) counts.set(source, (counts.get(source) ?? 0) + 1);
  const classIndex = (source: string) => classes.findIndex((c) => c.name === source);
  const ranked = [...counts.keys()].sort((a, b) => {
    const [ia, ib] = [classIndex(a), classIndex(b)];
    return (
      counts.get(b)! - counts.get(a)! ||
      Number(ib >= 0) - Number(ia >= 0) ||
      (classes[ib]?.level ?? 0) - (classes[ia]?.level ?? 0) ||
      (ia >= 0 && ib >= 0 ? ia - ib : 0) ||
      a.localeCompare(b)
    );
  });
  const tagsOnly = ranked.length > symbols.length + 1;
  let next = 0;
  return new Map(
    ranked
      .slice(1)
      .map((source): [string, Mark] => [source, tagsOnly || !labelled.has(source) ? { kind: "tag" } : { kind: "symbol", symbol: symbols[next++]! }]),
  );
}

/** The mark after a spell name. A screen reader reads the source name in place of the symbol. */
function SourceMark({ source, mark }: { source: string; mark: Mark | undefined }) {
  if (!mark) return null;
  if (mark.kind === "tag")
    // A tag stays on the line of the name's last word, and does not wrap inside. A long name can wrap.
    return (
      <>
        {"\u00a0"}
        <span className="whitespace-nowrap">
          <Tag>{source}</Tag>
        </span>
      </>
    );
  return (
    <>
      <sup aria-hidden className="text-[0.9em] text-ink-muted">
        {mark.symbol}
      </sup>
      <span className="sr-only"> ({source})</span>
    </>
  );
}

/** A source with only cantrips, on one line: "Mending (High Elf, INT, DC 14, +6)". */
function CantripLine({
  source,
  cantrips,
  caster,
  onOpen,
}: {
  source: string;
  cantrips: ListedSpell[];
  caster: Caster | undefined;
  onOpen: OpenSpells | undefined;
}) {
  const numbers = caster ? [abbr(caster.ability), `DC ${caster.saveDc}`, bonusStr(caster.attackBonus)] : [];
  return (
    <li>
      {cantrips.map((spell, i) => (
        <Fragment key={spell.key}>
          {i > 0 && ", "}
          <SpellName spell={spell} onOpen={onOpen} />
          <CastNote note={spell.castNote} />
        </Fragment>
      ))}{" "}
      <span className="text-ink-muted">({[source, ...numbers].join(", ")})</span>
    </li>
  );
}

/**
 * The spell save DC, spell attack and spellcasting ability of one or more
 * sources. With `named`, the row is a group named by its sources. The label
 * shows "Tiefling · Warlock". A source with a mark has its symbol after its
 * name: "Tiefling † · Warlock".
 */
function CasterRow({ group, named, marks }: { group: CasterGroup; named: boolean; marks: Map<string, Mark> }) {
  const boxes = (
    <div className="flex justify-evenly gap-2">
      <RowBox label="Spell save DC">{group.saveDc}</RowBox>
      <RowBox label="Spell attack">{bonusStr(group.attackBonus)}</RowBox>
      <RowBox label="Spellcasting ability" shortLabel="Ability">
        {abbr(group.ability)}
      </RowBox>
    </div>
  );
  if (!named) return boxes;
  // A screen reader reads "Tiefling and Warlock", not the dot of the visible label.
  return (
    <div role="group" aria-label={group.names.join(" and ")} className="grid gap-1">
      <span aria-hidden className="grid">
        <Label>{group.names.map((name) => withSymbol(name, marks.get(name))).join(" · ")}</Label>
      </span>
      {boxes}
    </div>
  );
}

/** A source name on a caster row label, with its symbol as the key to the marks in the table. */
function withSymbol(name: string, mark: Mark | undefined) {
  return mark?.kind === "symbol" ? `${name} ${mark.symbol}` : name;
}
