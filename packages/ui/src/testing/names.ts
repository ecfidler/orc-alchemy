// The names that the pick helpers take, shared by the Vitest and the Playwright helpers.

/** One row name, or a list of them. */
export type Names = string | RegExp | readonly (string | RegExp)[];

/** The names as a list. */
export const nameList = (names: Names): readonly (string | RegExp)[] => (typeof names === "string" || names instanceof RegExp ? [names] : names);
