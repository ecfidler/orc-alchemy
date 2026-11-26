// The draft of a text field of the character (ORC-342): the field keeps its text while the user types, and writes it
// on blur or on Enter. A write evaluates the whole character, so a keystroke does not write. The Name step and the
// Description step use it.
import { useState } from "react";

export interface Draft {
  /** The text of the field. */
  text: string;
  setText: (text: string) => void;
  /**
   * Writes the text when it stores another value than `stored`, and then shows the text as stored. It returns false
   * when the write fails, and else true.
   */
  commit: () => boolean;
}

/**
 * The draft of a field whose stored value is `stored`. `write` gets the typed text, and returns false when the write
 * fails. `normalized` gives the value that a text stores, such as "12" for "12.9" in a number field; by default the
 * text itself. A stored value changed from elsewhere replaces the text.
 */
export function useDraft(stored: string, write: (text: string) => boolean, normalized: (text: string) => string = (text) => text): Draft {
  const [text, setText] = useState(stored);
  const [seen, setSeen] = useState(stored);
  if (stored !== seen) {
    setSeen(stored);
    setText(stored);
  }
  const commit = () => {
    const value = normalized(text);
    setText(value);
    return value === stored || write(text);
  };
  return { text, setText, commit };
}
