// A developer page (ORC-238): a golden 2024 character on the sheet, at one
// of its checked levels. No link goes here, and the page shows only when the
// developer flag is on in this browser:
//   localStorage.setItem("alchemy-dev-2024", "on")
// The route loads this page in its own chunk, so the app loads no 2024 code
// for users.

import { ButtonLink } from "@orc-alchemy/ui";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { DEV_2024_CHARACTERS, loadDevSheet } from "../engine/dev-2024.ts";
import type { Sheet } from "../engine/sheet.ts";
import { CharacterSheet } from "./CharacterSheet.tsx";
import { NotFound } from "./NotFound.tsx";

export const DEV_2024_FLAG = "alchemy-dev-2024";

/** True when the developer flag is on in this browser. */
export function dev2024On(): boolean {
  try {
    return localStorage.getItem(DEV_2024_FLAG) === "on";
  } catch {
    return false;
  }
}

export function Dev2024Sheet() {
  const [params] = useSearchParams();
  const index = Math.max(
    0,
    DEV_2024_CHARACTERS.findIndex((c) => c.name === params.get("character")),
  );
  const character = DEV_2024_CHARACTERS[index];
  const asked = Number(params.get("level"));
  const level = character.levels.includes(asked) ? asked : character.levels[character.levels.length - 1];
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const on = dev2024On();

  useEffect(() => {
    // Without the flag, the browser loads no 2024 engine.
    if (!on) return;
    let current = true;
    setSheet(null);
    setFailed(null);
    loadDevSheet(index, level).then(
      (built) => current && setSheet(built),
      (error: unknown) => current && setFailed(String(error)),
    );
    return () => {
      current = false;
    };
  }, [index, level, on]);

  if (!on) return <NotFound />;
  const href = (name: string, n: number) => `?${new URLSearchParams({ character: name, level: String(n) })}`;
  return (
    <>
      <p className="mb-2 text-sm text-ink-muted">2024 rules, developer view</p>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {DEV_2024_CHARACTERS.map((c, i) => (
          <ButtonLink key={c.name} variant={i === index ? "solid" : "ghost"} render={<Link to={href(c.name, c.levels[c.levels.length - 1])} />}>
            {c.name}
          </ButtonLink>
        ))}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {character.levels.map((n) => (
          <ButtonLink key={n} variant={n === level ? "solid" : "ghost"} render={<Link to={href(character.name, n)} />}>
            Level {n}
          </ButtonLink>
        ))}
      </div>
      {failed !== null && <p role="alert">{failed}</p>}
      {sheet === null ? failed === null && <p role="status">Loading the 2024 rules engine…</p> : <CharacterSheet sheet={sheet} />}
    </>
  );
}
