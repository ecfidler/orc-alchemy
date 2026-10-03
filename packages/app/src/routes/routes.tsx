import { useEffect, useState } from "react";
import type { RouteObject } from "react-router";
import { Link, useParams } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { ImportCharacter } from "../components/ImportCharacter.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import { openCharacter, useCharacter, useOpenCharacter } from "../state/character.ts";

function SheetPage() {
  const { id } = useParams() as { id: string };
  const openId = useCharacter((state) => state.id);
  const { sheet } = useOpenCharacter();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    setMissing(false);
    if (id !== useCharacter.getState().id) openCharacter(id).then((found) => setMissing(!found));
  }, [id]);

  if (missing) {
    return (
      <>
        <h1 className="text-xl">Character not found</h1>
        <Link to="/" className="underline">
          Back to characters
        </Link>
      </>
    );
  }
  if (openId !== id || sheet === null) return <p role="status">Opening the character…</p>;
  return <CharacterSheet sheet={sheet} />;
}

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <>
            <h1 className="text-xl">Characters</h1>
            <ImportCharacter />
          </>
        ),
      },
      {
        path: "sheet/:id",
        element: (
          <EngineGate>
            <SheetPage />
          </EngineGate>
        ),
      },
      {
        path: "*",
        element: (
          <>
            <h1 className="text-xl">Page not found</h1>
            <Link to="/" className="underline">
              Back to characters
            </Link>
          </>
        ),
      },
    ],
  },
];
