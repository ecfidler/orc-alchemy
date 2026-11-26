// The ability column of the character sheet: the ability boxes, inspiration, saves, skills and passive perception.
import { type BoxToggleProps, FramedBox, PixelIcon, ShadedPanel, SmallBox, StatBox } from "@orc-alchemy/ui";
import { type ReactNode, useState } from "react";
import { type Ability, type Sheet, type SheetPlay } from "../engine/sheet.ts";
import { ABILITY_NAMES, bonusStr } from "../engine/sheet-text.ts";
import { abbr, Tag } from "./sheet-parts.tsx";

/** The ability highlight of the sheet: the ability whose skills show, and the toggle props of each ability box. */
export type AbilityHighlight = ReturnType<typeof useAbilityHighlight>;

/** The ability column. `play` and `highlight` make the ability boxes and the Inspiration box buttons. */
export function AbilitiesBlock({ sheet, play, highlight }: { sheet: Sheet; play: SheetPlay | undefined; highlight: AbilityHighlight }) {
  return (
    <>
      <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-2.5 @max-[719px]:grid-cols-1">
        <ShadedPanel className="content-start gap-4 px-1.5 pt-2 pb-[18px] @max-[719px]:grid-cols-3 @max-[719px]:gap-x-2.5 @max-[719px]:gap-y-5">
          {/* With play, each ability box is a button that highlights the skills of its ability (ORC-324). */}
          {sheet.abilities.map((a) => (
            <StatBox
              key={a.ability}
              label={abbr(a.ability)}
              value={bonusStr(a.modifier)}
              oval={a.score}
              toggle={play ? highlight.toggle(a.ability) : undefined}
            />
          ))}
        </ShadedPanel>
        <div className="grid min-w-0 content-start gap-2.5">
          {/* With play, the box is a button that sets inspiration or removes it (ORC-324). The mark keeps the box's size. */}
          {play ? (
            <SmallBox
              label="Inspiration"
              value={sheet.inspiration && <InspirationMark />}
              toggle={{ pressed: sheet.inspiration, onPressedChange: (on) => play.onInspiration(on) }}
            />
          ) : (
            <SmallBox label="Inspiration" value={sheet.inspiration && <InspirationMark label="Has inspiration" />} />
          )}
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
                <Line key={skill.key} proficient={skill.proficient} expertise={skill.expertise} highlight={highlight.shown === skill.ability}>
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
}

/** A proficiency mark: a 10px square, with space for the expertise ring around it. */
const MARK = "ml-[3px] size-2.5 border-[1.5px]";

/**
 * A save or skill line: a square proficiency mark, then the text, muted when
 * not proficient. Expertise is a ring around the filled square, as on the
 * paper sheet.
 */
function Line({
  proficient,
  expertise = false,
  highlight = false,
  children,
}: {
  proficient: boolean;
  expertise?: boolean;
  /** The ability highlight: the note color behind the line (ORC-324). It changes only colors, so no text moves. */
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <li
      data-highlight={highlight ? "" : undefined}
      className={`grid grid-cols-[16px_minmax(0,1fr)] items-baseline gap-1 text-[14.5px] ${highlight ? "skill-highlight" : ""}`}
    >
      {expertise ? (
        <span role="img" aria-label="Expertise" className={`${MARK} border-ink bg-ink outline-[1.5px] outline-offset-[1.5px] outline-ink outline-solid`} />
      ) : proficient ? (
        <span role="img" aria-label="Proficient" className={`${MARK} border-ink bg-ink`} />
      ) : (
        <span aria-hidden className={`${MARK} border-ink-muted`} />
      )}
      <span className={`truncate tabular-nums ${proficient ? "" : "text-ink-muted"}`}>{children}</span>
    </li>
  );
}

/**
 * The mark of the Inspiration box: the check icon, until inspiration has an icon of its own. With `label`, it is an
 * image with that name; else it is hidden, as the pressed state of the box says it.
 */
function InspirationMark({ label }: { label?: string }) {
  const icon = <PixelIcon name="check" />;
  return label ? (
    <span role="img" aria-label={label} data-inspiration-mark="">
      {icon}
    </span>
  ) : (
    <span data-inspiration-mark="">{icon}</span>
  );
}

/**
 * The ability highlight (ORC-324, docs/design/sheet-interactivity.md "Ability highlight"). It is local state, not play
 * state: the app does not save it. A hover or the keyboard focus on an ability box shows its skills. A click keeps
 * them; a second click on the same box, or a click on another box, removes the kept one. A click that removes it also
 * hides the hover, so the change shows at once: the pointer stays on the box, so no new hover shows it again until the
 * pointer leaves. `shown` is the ability whose skills have the highlight, or null.
 */
export function useAbilityHighlight() {
  const [kept, setKept] = useState<Ability | null>(null);
  const [pointed, setPointed] = useState<Ability | null>(null);
  const leave = (ability: Ability) => setPointed((current) => (current === ability ? null : current));
  return {
    shown: pointed ?? kept,
    toggle: (ability: Ability): BoxToggleProps => ({
      "aria-label": `${ABILITY_NAMES[ability]}: highlight the skills`,
      pressed: kept === ability,
      onPressedChange: (pressed: boolean) => {
        setKept(pressed ? ability : null);
        setPointed(pressed ? ability : null);
      },
      onMouseEnter: () => setPointed(ability),
      onMouseLeave: () => leave(ability),
      // Only a focus from the keyboard shows the highlight. A click also focuses the box, and that focus must not keep it.
      onFocus: (event) => {
        if (event.currentTarget.matches(":focus-visible")) setPointed(ability);
      },
      onBlur: () => leave(ability),
    }),
  };
}
