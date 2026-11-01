// The read-only character sheet: layout F of the theme spec (docs/design/theme.md,
// "Character sheet"), two columns that become one in a narrow container. Under 720px
// the sections go in tabs ("Small screens and motion").
// Each value is a group named by its label, so a screen reader and a test find it by its label.
import { CurrentMax, FramedBox, Label, ShadedPanel, SlotCircles, SmallBox, StatBox, Tabs, UseBubble, type Tab } from "@orc-alchemy/ui";
import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
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
  const article = useRef<HTMLElement>(null);
  const [narrow, setNarrow] = useState(false);
  // Measured before paint, so a phone never shows layout F first. The builder preview keeps one long column.
  // A width of 0 is a sheet that is not laid out (hidden, or in jsdom); it keeps layout F.
  useLayoutEffect(() => {
    const element = article.current;
    if (preview || !element) return;
    const measure = () => setNarrow(element.clientWidth > 0 && element.clientWidth < 720);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [preview]);
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

  // Ability scores, saves, skills and passive perception: the left column of layout F, and part of the Stats tab.
  // On a narrow sheet the ability boxes go in three columns above the saves and skills.
  const abilitiesSection = (
    <>
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
                <Line key={skill.key} proficient={skill.proficient} expertise={skill.expertise}>
                  {bonusStr(skill.bonus)} {skill.name} <Tag>{abbr(skill.ability)}</Tag>
                </Line>
              ))}
            </ul>
          </FramedBox>
        </div>
      </div>
      <SmallBox label="Passive Perception" value={sheet.passivePerception} />
    </>
  );
  const vitalsSection = (
    <ShadedPanel className="@container/vitals">
      <div className="flex justify-evenly gap-2">
        <RowBox label="Armor Class" shield>
          {sheet.armorClass}
        </RowBox>
        <RowBox label="Initiative">{modStr(sheet.initiative)}</RowBox>
        <RowBox label="Speed">
          {/* Only the first speed's number is large. Its qualifier and the other speeds are small lines under it. */}
          {sheet.speeds.map((speed, i) => (
            <span key={i} className={i === 0 ? "block" : "block font-sans text-[11px] leading-snug text-ink-muted"}>
              {speed.feet} ft.
              {speed.label && (
                <>
                  {" "}
                  <span className={i === 0 ? "block font-sans text-[9.5px] leading-tight font-medium tracking-[0.08em] text-ink-muted uppercase" : undefined}>
                    {speed.label}
                  </span>
                </>
              )}
            </span>
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
  );
  const attacksSection =
    (sheet.weaponAttacks.length > 0 || sheet.specialAttacks.length > 0) && (
      <FramedBox label="Attacks">
        {sheet.weaponAttacks.length > 0 && (
          <>
            {/* Under 720px: no Proficient? column (a tag marks a weapon that is not proficient), the attack as "+11" under
                "To hit", and the off-hand modifier on its own line. */}
            <Table
              caption="Weapon attacks"
              headers={[
                "Name",
                "Proficient?",
                <Narrow key="attack" wide="Attack" narrow="To hit" />,
                <Narrow key="damage" wide="Damage modifier" narrow="Damage" />,
              ]}
              hiddenNarrow={[1]}
            >
              {sheet.weaponAttacks.map((weapon) => (
                <tr key={weapon.key}>
                  <Td>
                    {weapon.name}
                    {!weapon.proficient && <span className="@min-[720px]:hidden"> <Tag>not proficient</Tag></span>}
                  </Td>
                  <Td className="@max-[719px]:hidden">{weapon.proficient ? "Yes" : "No"}</Td>
                  <Td className="whitespace-nowrap">
                    {modStr(weapon.attackBonus)}
                    <span className="@max-[719px]:hidden"> to hit</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {modStr(weapon.damageModifier)}
                    {weapon.offHandDamageModifier !== null && (
                      <span className="@max-[719px]:block @max-[719px]:text-xs @max-[719px]:text-ink-muted">
                        {" "}
                        (off-hand {modStr(weapon.offHandDamageModifier)})
                      </span>
                    )}
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
    );
  const featuresSection =
    featureGroups.some(([, items]) => items.length > 0) && (
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
    );
  const proficienciesSection =
    proficiencies.some(([, values]) => values.length > 0) && (
      <FramedBox label="Other proficiencies & languages">
        <FieldList fields={proficiencies} />
      </FramedBox>
    );
  const defensesSection =
    defenses.some(([, values]) => values.length > 0) && (
      <FramedBox label="Defenses">
        <FieldList fields={defenses} />
      </FramedBox>
    );
  const armorOptionsSection =
    sheet.armorClassOptions.length > 0 && (
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
    );
  const notesSection =
    details.notes !== null && (
      <FramedBox label="Notes">
        <div className="grid gap-1 text-[14.5px]">{paragraphs(details.notes)}</div>
      </FramedBox>
    );
  const equipmentSection = <Equipment gold={goldOf(equipment.treasure)} gear={gear} />;
  const spellcastingSection = spellcasting && <SpellcastingBox spellcasting={spellcasting} narrow={narrow} />;

  // The phone layout (ORC-173): under 720px the sections go in tabs, without the empty ones.
  const tabs: Tab[] = [
    {
      value: "stats",
      label: "Stats",
      color: "yellow",
      content: (
        <div className="grid gap-3">
          {vitalsSection}
          {attacksSection}
          {abilitiesSection}
        </div>
      ),
    },
    { value: "spells", label: "Spells", color: "blue", content: spellcastingSection },
    { value: "features", label: "Features", color: "green", content: featuresSection },
    {
      value: "more",
      label: "More",
      color: "orange",
      content: (
        <div className="grid gap-3">
          {equipmentSection}
          {proficienciesSection}
          {defensesSection}
          {armorOptionsSection}
          {notesSection}
        </div>
      ),
    },
  ];

  return (
    <article ref={article} className="@container mx-auto grid max-w-[960px] gap-4">
      <header className="grid items-start gap-3.5 @min-[720px]:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]">
        <div className="grid content-end rounded-[6px_26px_26px_6px] border-[1.5px] border-rule-strong bg-paper-raised px-[18px] py-1.5">
          <Name>{sheet.name ?? "Unnamed character"}</Name>
          <Label>Character name</Label>
        </div>
        <div className="grid grid-cols-[repeat(2,minmax(0,auto))] items-end gap-x-[18px] gap-y-1.5 rounded-md border-[1.5px] border-rule-strong px-3.5 py-2 @min-[720px]:grid-cols-[repeat(3,minmax(0,auto))]">
          <Detail label="Class" className="col-span-2 @min-[720px]:col-span-1" value={classes} />
          <Detail label="Background" value={sheet.background} />
          <Detail label="Race" value={race} />
        </div>
      </header>

      {narrow ? (
        <Tabs label="Sheet sections" tabs={tabs.filter((tab) => tab.content)} />
      ) : (
        <div className="grid items-start gap-4 @min-[720px]:grid-cols-[minmax(320px,1fr)_minmax(0,2fr)]">
          <div className="grid min-w-0 content-start gap-3">
            {abilitiesSection}
            {equipmentSection}
            {proficienciesSection}
            {defensesSection}
            {armorOptionsSection}
          </div>

          <div className="grid min-w-0 content-start gap-3">
            {vitalsSection}
            {attacksSection}
            {spellcastingSection}
            {featuresSection}
            {notesSection}
          </div>
        </div>
      )}
    </article>
  );
}

/**
 * The character name. The box keeps the height of one line at the largest
 * size: a long name gets smaller, and wraps to two lines only when two lines
 * fit in that height.
 */
function Name({ children }: { children: string }) {
  const heading = useRef<HTMLHeadingElement>(null);
  const nameText = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const box = heading.current?.parentElement;
    if (!heading.current || !nameText.current || !box) return;
    const fit = () => {
      const element = heading.current!;
      const span = nameText.current!;
      element.style.cssText = "";
      // A width of 0 is a name that is not laid out (hidden, or in jsdom).
      if (element.clientWidth === 0) return;
      const style = getComputedStyle(element);
      const largest = parseFloat(style.fontSize);
      const leading = parseFloat(style.lineHeight) / largest;
      // The space for text: one line at the largest size.
      const height = element.clientHeight - parseFloat(style.paddingBottom);
      element.style.height = `${element.offsetHeight}px`;
      // 12px is the smallest size; a longer name is cut off.
      for (let size = largest; size >= 12; size--) {
        element.style.fontSize = `${size}px`;
        const lines = 2 * size * leading <= height ? 2 : 1;
        element.style.whiteSpace = lines === 2 ? "normal" : "nowrap";
        if (span.offsetWidth <= element.clientWidth && span.offsetHeight <= lines * size * leading + 1) return;
      }
    };
    fit();
    // The fallback font has other widths, so the name fits again when the fonts load.
    document.fonts?.ready.then(fit);
    // The box, not the name: fit sets the name's height, which would start the observer again.
    const observer = new ResizeObserver(fit);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children]);
  // The name sits on the rule. A name too long for two lines at 12px keeps its start, and a hover shows all of it.
  return (
    <h1
      ref={heading}
      title={children}
      className="flex items-end-safe overflow-hidden border-b border-rule-strong pb-0.5 text-[clamp(26px,4vw,36px)] leading-[1.05] font-medium text-balance break-words whitespace-nowrap"
    >
      <span ref={nameText}>{children}</span>
    </h1>
  );
}

/** A header value on one line, truncated, with its label under it. A hover shows the whole value. */
function Detail({ label, className, value }: { label: string; className?: string; value: string | null }) {
  const id = useId();
  return (
    <div className={className ? `grid min-w-0 ${className}` : "grid min-w-0"}>
      <span role="group" aria-labelledby={id} title={value ?? undefined} className="min-h-[26px] truncate border-b border-rule-strong">
        {value}
      </span>
      <Label id={id}>{label}</Label>
    </div>
  );
}

/**
 * A save or skill line: a square proficiency mark, then the text, muted when
 * not proficient. Expertise is a ring around the filled square, as on the
 * paper sheet.
 */
function Line({ proficient, expertise = false, children }: { proficient: boolean; expertise?: boolean; children: ReactNode }) {
  return (
    <li className="grid grid-cols-[16px_minmax(0,1fr)] items-baseline gap-1 text-[14.5px]">
      {expertise ? (
        <span role="img" aria-label="Expertise" className="ml-[3px] size-2.5 border-[1.5px] border-ink bg-ink outline-[1.5px] outline-offset-[1.5px] outline-ink outline-solid" />
      ) : proficient ? (
        <span role="img" aria-label="Proficient" className="ml-[3px] size-2.5 border-[1.5px] border-ink bg-ink" />
      ) : (
        <span aria-hidden className="ml-[3px] size-2.5 border-[1.5px] border-ink-muted" />
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
 * A box in the AC row: a large value, its label at the bottom, so a taller
 * box in the row does not move the other labels. It fits its content, at
 * least 96px. On a narrow sheet the boxes share the width, up to 112px each,
 * and `shortLabel` replaces a label too long for that width.
 */
function RowBox({ label, shortLabel, shield = false, children }: { label: string; shortLabel?: string; shield?: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid min-w-24 flex-[0_0_auto] grid-rows-[1fr_auto] border-[1.5px] border-rule-strong bg-paper-raised px-3.5 py-2 text-center @max-[719px]:max-w-28 @max-[719px]:min-w-0 @max-[719px]:flex-[1_1_0] @max-[719px]:px-1.5 ${
        shield ? "rounded-[8px_8px_50%_50%/8px_8px_34%_34%] pb-3.5" : "rounded-md"
      }`}
    >
      <span role="group" aria-label={label} className="self-center text-[26px] leading-[1.1] font-medium tabular-nums">
        {children}
      </span>
      {/* The group has the label as its name, so the visible label is not read twice. A grid, so a label on two
          lines keeps the label's line height. */}
      <span aria-hidden className="grid">
        {shortLabel ? (
          <Label>
            <span className="@max-[719px]:hidden">{label}</span>
            <span className="@min-[720px]:hidden">{shortLabel}</span>
          </Label>
        ) : (
          <Label>{label}</Label>
        )}
      </span>
    </div>
  );
}

/**
 * The Spellcasting section of the theme spec: a row of boxes for each source,
 * then one table row for each level, with the shared slots and the spells.
 * A source that prepares shows only its prepared spells. Other sources show
 * all known spells. On a narrow sheet the slots go under the level, and the
 * spells get the width of the Slots column.
 */
function SpellcastingBox({ spellcasting, narrow }: { spellcasting: Spellcasting; narrow: boolean }) {
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
          <col className={narrow ? "w-[76px]" : "w-20"} />
          {!narrow && <col className="w-[98px]" />}
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
            <th scope="col" className="pb-0.5 pl-3 font-normal @max-[719px]:pl-2">
              <Label>{title}</Label>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ level, slots, spells }) => {
            const circles = slots > 0 && <SlotCircles label={`${ordinal(level)}-level slots`} count={slots} />;
            return (
              <tr key={level} className="border-b border-rule last:border-0">
                <th
                  scope="row"
                  className={`border-r border-rule py-1.5 text-center leading-[1.1] font-medium ${
                    narrow ? "pr-1.5 align-top" : "pr-2.5"
                  } ${level === 0 ? (narrow ? "text-[13px]" : "text-base") : narrow ? "text-lg" : "text-2xl"}`}
                >
                  {level === 0 ? "Cantrips" : ordinal(level)}
                  {/* Four circles fit on one line in the narrow column. */}
                  {narrow && circles && <span className="mt-1 flex justify-center [&_.ui-slot-circles]:gap-[3px] [&_.ui-slot-circle]:size-3">{circles}</span>}
                </th>
                {!narrow && <td className="border-r border-rule py-1.5 pl-2.5">{circles}</td>}
                <td className="py-1.5 pl-3 align-top @max-[719px]:pl-2">
                  {/* role="list": without bullets, Safari does not name a ul as a list. */}
                  <ul role="list" className="[&>li]:inline [&>li:not(:last-child)]:after:content-[',_']">
                    {spells.map((spell) => (
                      // A tag stays on the line of the name's last word, and does not wrap inside. A long name can wrap.
                      <li key={`${spell.source}/${spell.key}`}>
                        {spell.name}
                        {several && (
                          <>
                            {"\u00a0"}
                            <span className="whitespace-nowrap">
                              <Tag>{spell.source}</Tag>
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </td>
              </tr>
            );
          })}
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
      <RowBox label="Spellcasting ability" shortLabel="Ability">{abbr(caster.ability)}</RowBox>
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

/** `hiddenNarrow`: the indexes of the columns that do not show under 720px. Their cells must hide too. */
function Table({ caption, headers, hiddenNarrow = [], children }: { caption: string; headers: ReactNode[]; hiddenNarrow?: number[]; children: ReactNode }) {
  return (
    <table className="w-full border-collapse text-left text-[14.5px]">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {headers.map((header, i) => (
            <th key={i} scope="col" className={`py-0.5 pr-1.5 font-normal ${hiddenNarrow.includes(i) ? "@max-[719px]:hidden" : ""}`}>
              <Label>{header}</Label>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function Td({ className, children }: { className?: string; children: ReactNode }) {
  return <td className={`border-b border-rule-strong bg-panel py-[3px] pr-1.5 pl-1 ${className ?? ""}`}>{children}</td>;
}

/** Text that is shorter when the sheet is narrower than 720px. */
function Narrow({ wide, narrow }: { wide: string; narrow: string }) {
  return (
    <>
      <span className="@max-[719px]:hidden">{wide}</span>
      <span className="@min-[720px]:hidden">{narrow}</span>
    </>
  );
}
