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
