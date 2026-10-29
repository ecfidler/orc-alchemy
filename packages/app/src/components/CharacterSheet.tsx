// The read-only character sheet: layout F of the theme spec (docs/design/theme.md,
// "Character sheet"), two columns that become one in a narrow container.
// Each value is a group named by its label, so a screen reader and a test find it by its label.
import { CurrentMax, FramedBox, Label, ShadedPanel, SlotCircles, SmallBox, StatBox, UseBubble } from "@orc-alchemy/ui";
import { useId, type ReactNode } from "react";
import { bonusStr, modStr, type Ability, type Sheet, type SheetFeature, type SheetItem, type Spellcasting } from "../engine/sheet.ts";

const abbr = (ability: Ability) => ability.toUpperCase();
const ABILITY_NAMES: Record<Ability, string> = {
  str: "Strength",
  dex: "Dexterity",
  con: "Constitution",
  int: "Intelligence",
  wis: "Wisdom",
  cha: "Charisma",
};
export const ordinal = (n: number) => `${n}${n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th"}`;
const paragraphs = (text: string) => text.split("\n").map((line, i) => <p key={i}>{line}</p>);

/** Each coin's value in gold pieces: 10 cp = 1 sp, 10 sp = 1 gp, 2 ep = 1 gp, 1 pp = 10 gp. */
const COIN_GP: Record<string, number> = { cp: 0.01, sp: 0.1, ep: 0.5, gp: 1, pp: 10 };

/** All coins as gold pieces, to two decimals. */
const goldOf = (treasure: SheetItem[]) =>
  Math.round(treasure.reduce((gp, item) => gp + (COIN_GP[item.key] ?? 0) * item.quantity, 0) * 100) / 100;

/** `preview`: the builder's preview leaves out what only matters in play (temporary hit points, death saves). */
export function CharacterSheet({ sheet, preview = false }: { sheet: Sheet; preview?: boolean }) {
  const { spellcasting, features, equipment, details } = sheet;
  const race = sheet.subrace ? `${sheet.race} (${sheet.subrace})` : sheet.race;
  const classes = sheet.classes.map((c) => `${c.name} ${c.level}${c.subclass ? ` (${c.subclass})` : ""}`).join(" / ");
  const hitDice = sheet.classes.map((c) => `${c.level}d${c.hitDie}`).join(" + ");
  const defenses: [string, string[]][] = [
    ["Resistances", sheet.resistances],
    ["Immunities", sheet.immunities],
    ["Condition Immunities", sheet.conditionImmunities],
    ["Vulnerabilities", sheet.vulnerabilities],
  ];
  const proficiencies: [string, string[]][] = [
    ["Languages", sheet.languages],
    ["Tools", sheet.tools.map((tool) => `${tool.name} (${bonusStr(tool.bonus)})`)],
    ["Weapons", sheet.weaponProficiencies],
    ["Armor", sheet.armorProficiencies],
    ["Darkvision", sheet.darkvision > 0 ? [`${sheet.darkvision} ft.`] : []],
  ];
  const featureGroups: [string, SheetFeature[]][] = [
    ["Actions", features.actions],
    ["Bonus Actions", features.bonusActions],
    ["Reactions", features.reactions],
    ["Features, Traits, and Feats", features.traits],
  ];
  const gear = [
    ...equipment.weapons,
    ...equipment.armor,
    ...equipment.magicItems,
    ...equipment.other,
    ...equipment.treasure.filter((item) => !Object.hasOwn(COIN_GP, item.key)),
  ];

  return (
    <article className="@container mx-auto grid max-w-[960px] gap-4">
      <header className="grid items-start gap-3.5 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <div className="grid content-end rounded-[6px_26px_26px_6px] border-[1.5px] border-rule-strong bg-paper-raised px-[18px] py-1.5">
          <h1 className="border-b border-rule-strong pb-0.5 text-[clamp(26px,4vw,36px)] leading-[1.05] font-medium">
            {sheet.name ?? "Unnamed character"}
          </h1>
          <Label>Character name</Label>
        </div>
        <div className="grid grid-cols-2 items-end gap-x-[18px] gap-y-1.5 rounded-md border-[1.5px] border-rule-strong px-3.5 py-2 @min-[720px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Detail label="Class" className="col-span-2 @min-[720px]:col-span-1">
            {classes}
          </Detail>
          <Detail label="Background">{sheet.background}</Detail>
          <Detail label="Race">{race}</Detail>
        </div>
      </header>

      <div className="grid items-start gap-4 @min-[720px]:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
        <div className="grid min-w-0 content-start gap-3">
          {/* On a narrow sheet the ability boxes go in three columns above the saves and skills. */}
          <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2.5 @max-[719px]:grid-cols-1">
            <ShadedPanel className="content-start gap-4 px-1.5 pt-2 pb-[18px] @max-[719px]:grid-cols-3 @max-[719px]:gap-x-2.5 @max-[719px]:gap-y-5">
              {sheet.abilities.map((a) => (
                <StatBox key={a.ability} label={abbr(a.ability)} value={bonusStr(a.modifier)} oval={a.score} />
              ))}
            </ShadedPanel>
            <div className="grid min-w-0 content-start gap-2.5">
              <SmallBox label="Inspiration" value="" />
              <SmallBox label="Proficiency Bonus" value={bonusStr(sheet.proficiencyBonus)} />
              <FramedBox label="Saving Throws">
                <ul className="grid gap-0.5">
                  {sheet.abilities.map((a) => (
                    <Line key={a.ability} proficient={a.saveProficient}>
                      {bonusStr(a.save)} {ABILITY_NAMES[a.ability]}
                    </Line>
                  ))}
                </ul>
              </FramedBox>
              <FramedBox label="Skills">
                <ul className="grid gap-0.5">
                  {sheet.skills.map((skill) => (
                    <Line key={skill.key} proficient={skill.proficient}>
                      {bonusStr(skill.bonus)} {skill.name} <Tag>{abbr(skill.ability)}</Tag>
                      {skill.expertise && <Tag>expertise</Tag>}
                    </Line>
                  ))}
                </ul>
              </FramedBox>
            </div>
          </div>
          <SmallBox label="Passive Perception" value={sheet.passivePerception} />
          <Equipment gold={goldOf(equipment.treasure)} gear={gear} />
        </div>

        <div className="grid min-w-0 content-start gap-3">
          <ShadedPanel className="@container/vitals">
            <div className="flex justify-evenly gap-2">
              <RowBox label="Armor Class" shield>
                {sheet.armorClass}
              </RowBox>
              <RowBox label="Initiative">{modStr(sheet.initiative)}</RowBox>
              <RowBox label="Speed">
                {sheet.speeds.map((speed, i) => (
                  <div key={i} className={i > 0 ? "text-sm leading-snug" : undefined}>
                    {speed.feet} ft.{speed.label && ` (${speed.label})`}
                  </div>
                ))}
              </RowBox>
            </div>
            {/* The three boxes share a row only when the panel is wide enough for the death save circles. */}
            <div
              className={
                preview
                  ? "grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-2"
                  : "grid grid-cols-[minmax(0,4fr)_minmax(0,5fr)] gap-2 @min-[600px]/vitals:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)]"
              }
            >
              <HitPoints
                current={sheet.currentHitPoints ?? sheet.maxHitPoints}
                max={sheet.maxHitPoints}
                temporary={!preview}
                className={preview ? undefined : "col-span-2 @min-[600px]/vitals:col-span-1"}
              />
              <FramedBox label="Hit dice" className="grid-rows-[1fr_auto] text-center">
                <span className="self-center text-2xl leading-[1.1]">{hitDice}</span>
              </FramedBox>
              {!preview && (
                <FramedBox label="Death saves" className="grid-rows-[1fr_auto]">
                  {/* The app records no death saves, so the circles are empty. */}
                  <div className="grid content-evenly gap-1.5">
                    <div className="flex items-center justify-between gap-1.5">
                      {/* The circles say "Successes", so the visible label is not read twice. */}
                      <span aria-hidden>
                        <Label>Successes</Label>
                      </span>
                      <SlotCircles label="Successes" count={3} color="success" />
                    </div>
                    <div className="flex items-center justify-between gap-1.5">
                      <span aria-hidden>
                        <Label>Failures</Label>
                      </span>
                      <SlotCircles label="Failures" count={3} color="caution" />
                    </div>
                  </div>
                </FramedBox>
              )}
            </div>
          </ShadedPanel>

          {(sheet.weaponAttacks.length > 0 || sheet.specialAttacks.length > 0) && (
            <FramedBox label="Attacks">
              {sheet.weaponAttacks.length > 0 && (
                <>
                  <Table caption="Weapon attacks" headers={["Name", "Proficient?", "Attack", "Damage modifier"]}>
                    {sheet.weaponAttacks.map((weapon) => (
                      <tr key={weapon.key}>
                        <Td>{weapon.name}</Td>
                        <Td>{weapon.proficient ? "Yes" : "No"}</Td>
                        <Td>{modStr(weapon.attackBonus)} to hit</Td>
                        <Td>
                          {modStr(weapon.damageModifier)}
                          {weapon.offHandDamageModifier !== null && ` (off-hand ${modStr(weapon.offHandDamageModifier)})`}
                        </Td>
                      </tr>
                    ))}
                  </Table>
                  <p className="text-sm text-ink-muted">Damage dice need content data, which is not available yet.</p>
                </>
              )}
              {sheet.numberOfAttacks > 1 && (
                <FieldList fields={[["Number of Attacks", [String(sheet.numberOfAttacks)]]]} />
              )}
              <Features items={sheet.specialAttacks} />
            </FramedBox>
          )}

          {spellcasting && <SpellcastingBox spellcasting={spellcasting} />}

          {featureGroups.some(([, items]) => items.length > 0) && (
            <FramedBox label="Features & traits">
              <div className="grid gap-4">
                {featureGroups.map(
                  ([title, items]) =>
                    items.length > 0 && (
                      <div key={title} className="grid gap-2.5">
                        <h3 className="border-b border-rule font-sans text-[10.5px] font-medium tracking-[0.08em] text-ink-muted uppercase">
                          {title}
                        </h3>
                        <Features items={items} />
                      </div>
                    ),
                )}
              </div>
            </FramedBox>
          )}

          {proficiencies.some(([, values]) => values.length > 0) && (
            <FramedBox label="Other proficiencies & languages">
              <FieldList fields={proficiencies} />
            </FramedBox>
          )}

          {defenses.some(([, values]) => values.length > 0) && (
            <FramedBox label="Defenses">
              <FieldList fields={defenses} />
            </FramedBox>
          )}

          {/* Layout F has no place for these. They are not on the spec's list of items to remove, so they stay, after Defenses. */}
          {sheet.armorClassOptions.length > 0 && (
            <FramedBox label="AC by armor">
              <Table caption="Armor class options" headers={["Armor", "AC"]}>
                {sheet.armorClassOptions.map((option, i) => (
                  <tr key={i}>
                    <Td>
                      {option.armor
                        ? `${option.armor.name}${option.shield ? ` + ${option.shield.name}` : ""}`
                        : `Unarmored${option.shield ? ` + ${option.shield.name}` : ""}`}
                    </Td>
                    <Td>{option.ac}</Td>
                  </tr>
                ))}
              </Table>
            </FramedBox>
          )}

          {details.notes !== null && (
            <FramedBox label="Notes">
              <div className="grid gap-1 text-[14.5px]">{paragraphs(details.notes)}</div>
            </FramedBox>
          )}
        </div>
      </div>
    </article>
  );
}

/** A header value on a line, with its label under it. */
function Detail({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className={className ? `grid min-w-0 ${className}` : "grid min-w-0"}>
      <span role="group" aria-labelledby={id} className="min-h-[26px] border-b border-rule-strong">
        {children}
      </span>
      <Label id={id}>{label}</Label>
    </div>
  );
}

/** A save or skill line: a square proficiency mark, then the text, muted when not proficient. */
function Line({ proficient, children }: { proficient: boolean; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[14px_minmax(0,1fr)] items-baseline gap-1 text-[14.5px]">
      {proficient ? (
        <span role="img" aria-label="Proficient" className="size-2.5 border-[1.5px] border-ink bg-ink" />
      ) : (
        <span aria-hidden className="size-2.5 border-[1.5px] border-ink-muted" />
      )}
      <span className={`truncate tabular-nums ${proficient ? "" : "text-ink-muted"}`}>{children}</span>
    </li>
  );
}

/** Small Inter caps text after a line's text. */
function Tag({ children }: { children: ReactNode }) {
  return <span className="ml-1 font-sans text-[9.5px] tracking-[0.04em] text-ink-muted uppercase">{children}</span>;
}

/**
 * A box in the AC row: a large value, its label under it. It fits its
 * content, at least 96px. On a narrow sheet the boxes share the width, up to
 * 112px each.
 */
function RowBox({ label, shield = false, children }: { label: string; shield?: boolean; children: ReactNode }) {
  const id = useId();
  return (
    <div
      className={`grid min-w-24 flex-[0_0_auto] border-[1.5px] border-rule-strong bg-paper-raised px-3.5 py-2 text-center @max-[719px]:max-w-28 @max-[719px]:min-w-0 @max-[719px]:flex-[1_1_0] @max-[719px]:px-1.5 ${
        shield ? "rounded-[8px_8px_50%_50%/8px_8px_34%_34%] pb-3.5" : "rounded-md"
      }`}
    >
      <span role="group" aria-labelledby={id} className="text-[26px] leading-[1.1] font-medium tabular-nums">
        {children}
      </span>
      <Label id={id}>{label}</Label>
    </div>
  );
}

/**
 * The Spellcasting section of the theme spec: a row of boxes for each source,
 * then one table row for each level, with the shared slots and the spells.
 * A source that prepares shows only its prepared spells. Other sources show
 * all known spells.
 */
function SpellcastingBox({ spellcasting }: { spellcasting: Spellcasting }) {
  const { casters, slots, byLevel } = spellcasting;
  const prepares = new Map(casters.map((caster) => [caster.name, caster.prepares]));
  // A spell's source can have no boxes, so the sources come from the spells too.
  const sources = new Set([...casters.map((caster) => caster.name), ...byLevel.flatMap((row) => row.spells.map((spell) => spell.source))]);
  const several = sources.size > 1;
  const title = several ? "Spells" : prepares.get([...sources][0]) ? "Prepared spells" : "Known spells";
  const rows = [...new Set([...slots.map((slot) => slot.level), ...byLevel.map((row) => row.level)])]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      slots: slots.find((slot) => slot.level === level)?.count ?? 0,
      spells: (byLevel.find((row) => row.level === level)?.spells ?? [])
        .filter((spell) => level === 0 || spell.prepared || !prepares.get(spell.source))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }))
    .filter((row) => row.slots > 0 || row.spells.length > 0);
  return (
    <FramedBox label="Spellcasting" className="gap-2.5">
      {casters.length > 0 && (
        <ShadedPanel>
          {casters.map((caster) => (
            <CasterRow key={caster.name} caster={caster} named={several} />
          ))}
        </ShadedPanel>
      )}
      <table className="w-full table-fixed border-collapse text-left text-[14.5px]">
        <caption className="sr-only">Spells by level</caption>
        <colgroup>
          <col className="w-20 @max-[719px]:w-[58px]" />
          <col className="w-[98px]" />
          <col />
        </colgroup>
        <thead>
          <tr className="border-b border-rule-strong">
            <th scope="col" className="pb-0.5 text-center font-normal">
              <Label>Level</Label>
            </th>
            <th scope="col" className="pb-0.5 pl-2.5 font-normal">
              <Label>Slots</Label>
            </th>
            <th scope="col" className="pb-0.5 pl-3 font-normal @max-[719px]:pl-2">
              <Label>{title}</Label>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ level, slots, spells }) => (
            <tr key={level} className="border-b border-rule last:border-0">
              <th
                scope="row"
                className={`border-r border-rule py-1.5 pr-2.5 text-center leading-[1.1] font-medium ${
                  level === 0 ? "text-base @max-[719px]:text-[13px]" : "text-2xl @max-[719px]:text-xl"
                }`}
              >
                {level === 0 ? "Cantrips" : ordinal(level)}
              </th>
              <td className="border-r border-rule py-1.5 pl-2.5">
                {slots > 0 && <SlotCircles label={`${ordinal(level)}-level slots`} count={slots} />}
              </td>
              <td className="py-1.5 pl-3 align-top @max-[719px]:pl-2">
                {/* role="list": without bullets, Safari does not name a ul as a list. */}
                <ul role="list" className="[&>li]:inline [&>li:not(:last-child)]:after:content-[',_']">
                  {spells.map((spell) => (
                    // With a tag, the name and its tag stay on one line.
                    <li key={`${spell.source}/${spell.key}`} className={several ? "whitespace-nowrap" : undefined}>
                      {spell.name}
                      {several && <> <Tag>{spell.source}</Tag></>}
                    </li>
                  ))}
                </ul>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </FramedBox>
  );
}

/**
 * One source's spell save DC, spell attack and spellcasting ability. With
 * several sources, the row is a group named by its source.
 */
function CasterRow({ caster, named }: { caster: Spellcasting["casters"][number]; named: boolean }) {
  const id = useId();
  const boxes = (
    <div className="flex justify-evenly gap-2">
      <RowBox label="Spell save DC">{caster.saveDc}</RowBox>
      <RowBox label="Spell attack">{bonusStr(caster.attackBonus)}</RowBox>
      <RowBox label="Spellcasting ability">{abbr(caster.ability)}</RowBox>
    </div>
  );
  if (!named) return boxes;
  return (
    <div role="group" aria-labelledby={id} className="grid gap-1">
      <Label id={id}>{caster.name}</Label>
      {boxes}
    </div>
  );
}

/** Hit points: temporary on the left (the sheet has none, so it is empty), then current / max. */
function HitPoints({ current, max, temporary, className }: { current: number; max: number; temporary: boolean; className?: string }) {
  const id = useId();
  const temporaryId = useId();
  return (
    <FramedBox label="Hit Points" labelId={id} className={className}>
      <div className={temporary ? "grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] items-end gap-2" : "grid"}>
        {temporary && (
          <div className="grid border-r border-rule text-center">
            <span role="group" aria-labelledby={temporaryId} className="min-h-9 text-2xl leading-normal" />
            <Label id={temporaryId}>Temporary</Label>
          </div>
        )}
        <span role="group" aria-labelledby={id} className="self-center text-center text-[34px] leading-[1.1] tabular-nums">
          <CurrentMax current={current} max={max} />
        </span>
      </div>
    </FramedBox>
  );
}

/** Equipment: the Gold box in the top-right corner, and the gear lines wrap beside it, then run the full width under it. */
function Equipment({ gold, gear }: { gold: number; gear: SheetItem[] }) {
  const id = useId();
  return (
    <FramedBox label="Equipment">
      <div className="flow-root text-[14.5px]">
        <div className="float-right mb-1.5 ml-3 grid min-w-16 rounded-md border-[1.5px] border-rule-strong px-2.5 pt-1 pb-[3px] text-center">
          <span role="group" aria-labelledby={id} className="text-[22px] leading-[1.15] tabular-nums">
            {gold.toLocaleString("en-US")}
          </span>
          <Label id={id}>Gold</Label>
        </div>
        {gear.map((item) => (
          <p key={item.key} className="flow-root border-b border-rule py-0.5">
            {item.quantity !== 1 && <span className="tabular-nums">{item.quantity} </span>}
            {item.name}
            {item.equipped && <span className="text-xs text-ink-muted"> (equipped)</span>}
          </p>
        ))}
      </div>
    </FramedBox>
  );
}

/** A label and its value on one line; the dd is named by the label, so a test finds the value by label. */
function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="border-b border-rule py-0.5 last:border-0">
      <dt className="mr-1.5 inline">
        <Label id={id}>{label}</Label>
      </dt>
      <dd aria-labelledby={id} className="inline">
        {children}
      </dd>
    </div>
  );
}

function FieldList({ fields }: { fields: [string, string[]][] }) {
  return (
    <dl className="text-[14.5px]">
      {fields.map(
        ([label, values]) =>
          values.length > 0 && (
            <Field key={label} label={label}>
              {values.join(", ")}
            </Field>
          ),
      )}
    </dl>
  );
}

/**
 * More than 8 uses show as a pool, such as Lay on Hands' 25 hit points, not as
 * circles. A click on a pool of 20 or more spends 5, as in the prototype; on a
 * smaller pool it spends 1.
 */
const usesOrPool = (amount: number) => (amount > 8 ? { pool: { max: amount, step: amount >= 20 ? 5 : 1 } } : { uses: amount });

/** Each feature's name on its own line above its text. A limited-use feature sits in a use bubble. */
function Features({ items }: { items: SheetFeature[] }) {
  return (
    <div className="grid gap-2.5 text-[14.5px]">
      {items.map((item, i) =>
        item.uses ? (
          <UseBubble key={`${i}-${item.name}`} title={item.name} tag={item.uses.recharge} {...usesOrPool(item.uses.amount)}>
            {item.text}
          </UseBubble>
        ) : (
          <p key={`${i}-${item.name}`} className="grid gap-px">
            <b className="font-semibold">{item.name}</b>
            <span>{item.text}</span>
          </p>
        ),
      )}
    </div>
  );
}

function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-left text-[14.5px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((header) => (
            <th key={header} scope="col" className="py-0.5 pr-1.5 font-normal">
              <Label>{header}</Label>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ children }: { children: ReactNode }) {
  return <td className="border-b border-rule-strong bg-panel py-[3px] pr-1.5 pl-1">{children}</td>;
}
