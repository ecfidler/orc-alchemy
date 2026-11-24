// Drawn icons (docs/design/theme.md, "Icons"). Each is an SVG in the text
// color (currentColor), and is decoration: it has aria-hidden, so the text
// beside it names the control or the label.

/**
 * A closed lock, 13px, in the text color, for a value that cannot change.
 * It is hidden from a screen reader: put text beside it. `className` is for
 * layout.
 */
export function LockIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" width="13" height="13" className={className} style={{ flex: "none" }}>
      <rect x="3" y="7" width="10" height="7" fill="currentColor" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

// The pixel icons, from Ethan's 16px sprite sheet. Each icon is 16 rows of 16 characters, one for each pixel:
// "#" is the shape, "+" is the edge above it, "o" is the shadow below it, and "." is empty. To change an icon, change its rows.
const PIXEL_ICONS = {
  pencil: [
    ".++++...........",
    ".####...........",
    ".####++.........",
    ".##..##.........",
    ".##..##++.......",
    ".oo##..##.......",
    "...##..##++.....",
    "...oo##..##.....",
    ".....##..##++...",
    ".....oo##..##...",
    ".......##..##...",
    ".......oo##..++.",
    ".........##..++.",
    ".........oo++++.",
    "...........++++.",
    "+++++++++++++++.",
  ],
  x: [
    ".++..........++.",
    ".##..........##.",
    ".##++......++##.",
    ".oo##......##oo.",
    "...##++..++##...",
    "...oo##..##oo...",
    ".....##++##.....",
    ".....oo##oo.....",
    ".....++##++.....",
    ".....##oo##.....",
    "...++##..##++...",
    "...##oo..oo##...",
    ".++##......##++.",
    ".##oo......oo##.",
    ".##..........##.",
    ".oo..........oo.",
  ],
  check: [
    ".............++.",
    ".............##.",
    "............+##.",
    "............##o.",
    "...........+##..",
    "...........##o..",
    ".++.......+##...",
    ".##.......##o...",
    ".##++....+##....",
    ".oo##....##o....",
    "...##++.+##.....",
    "...oo##.##o.....",
    ".....##.##......",
    ".....oo##o......",
    ".......##.......",
    ".......oo.......",
  ],
  download: [
    ".......++.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    "...++..##..++...",
    "...##..##..##...",
    "...##++##++##...",
    "...oo######oo...",
    ".....######.....",
    ".....oo##oo.....",
    ".++....##....++.",
    ".##....oo....##.",
    ".##++++++++++##.",
    ".##############.",
    ".##############.",
    ".oooooooooooooo.",
  ],
  moon: [
    "...++++++++++...",
    "...##########...",
    ".++##########++.",
    ".######oooooo##.",
    ".######......##.",
    ".####oo......oo.",
    ".####...........",
    ".####...........",
    ".####...........",
    ".####...........",
    ".####++......++.",
    ".######......##.",
    ".######++++++##.",
    ".oo##########oo.",
    "...##########...",
    "...oooooooooo...",
  ],
  // The sparkles have no edge and no shadow in the sheet.
  sparkles: [
    "................",
    "...........##...",
    "...........##...",
    ".........##..##.",
    ".........##..##.",
    ".....##....##...",
    ".....##....##...",
    ".....##.........",
    ".....##.........",
    ".####..####.....",
    ".####..####.....",
    ".....##.........",
    ".....##.........",
    ".....##.........",
    ".....##.........",
    "................",
  ],
  external: [
    ".++++++..++++++.",
    ".######..######.",
    ".######..######.",
    ".##oooo..oo####.",
    ".##......++####.",
    ".##......##oo##.",
    ".##....++##..##.",
    ".##....##oo..oo.",
    ".##..++##....++.",
    ".##..##oo....##.",
    ".##..##......##.",
    ".##..oo......##.",
    ".##++++++++++##.",
    ".##############.",
    ".##############.",
    ".oooooooooooooo.",
  ],
  up: [
    ".......++.......",
    ".......##.......",
    ".....++##++.....",
    ".....######.....",
    "...++######++...",
    "...##oo##oo##...",
    ".++##..##..##++.",
    ".##oo..##..oo##.",
    ".##....##....##.",
    ".oo....##....oo.",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......oo.......",
  ],
  down: [
    ".......++.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".......##.......",
    ".++....##....++.",
    ".##....##....##.",
    ".##++..##..++##.",
    ".oo##..##..##oo.",
    "...##++##++##...",
    "...oo######oo...",
    ".....######.....",
    ".....oo##oo.....",
    ".......##.......",
    ".......oo.......",
  ],
} as const;

export type PixelIconName = keyof typeof PIXEL_ICONS;

// The gray of the edge and of the shadow in the sprite sheet, as a part of the text color. So the icon is correct on paper, in dark mode and in a solid button.
const TONES = [
  [/#+/g, 1],
  [/\++/g, 0.75],
  [/o+/g, 0.25],
] as const;

/** One SVG path for the pixels of one tone: a rectangle for each run of pixels in a row. `runs` finds the runs of the tone. */
function tonePath(rows: readonly string[], runs: RegExp): string {
  return rows.map((row, y) => [...row.matchAll(runs)].map((run) => `M${run.index} ${y}h${run[0].length}v1h-${run[0].length}z`).join("")).join("");
}

/**
 * A pixel icon, 16px, in the text color, for the start of the text of a
 * button or a link. Its edge and its shadow are lighter tones of the same
 * color. It is hidden from a screen reader: the text names the control.
 * `className` is for layout.
 */
export function PixelIcon({ name, className }: { name: PixelIconName; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      fill="currentColor"
      shapeRendering="crispEdges"
      data-icon={name}
      className={className ? `ui-icon ${className}` : "ui-icon"}
    >
      {TONES.map(([runs, opacity]) => (
        <path key={opacity} d={tonePath(PIXEL_ICONS[name], runs)} opacity={opacity} />
      ))}
    </svg>
  );
}
