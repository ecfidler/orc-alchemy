import { useEffect, useState } from "react";
import type { RouteObject } from "react-router";
import { Link, useParams } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { CharacterList } from "../components/CharacterList.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { ExportCharacter, ExportEverything } from "../components/Export.tsx";
import { ImportCharacter } from "../components/ImportCharacter.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import { readCharacter, useCharacter, useOpenCharacter } from "../state/character.ts";

function SheetPage() {
  const { id } = useParams() as { id: string };
  const openId = useCharacter((state) => state.id);
  const { sheet } = useOpenCharacter();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setProblem(null);
    if (id !== useCharacter.getState().id) {
      // A slow open for a page already left must not replace this one's character.
      readCharacter(id).then(
        (found) => {
          if (!current) return;
          if (found) useCharacter.getState().load(id, found.entity, found.dirty);
          else setProblem("Character not found");
        },
        () => current && setProblem("The character could not be read from this browser"),
      );
    }
    return () => {
      current = false;
    };
  }, [id]);

  if (problem !== null) {
    return (
      <>
        <h1 className="text-xl">{problem}</h1>
        <Link to="/" className="underline">
          Back to characters
        </Link>
      </>
    );
  }
  if (openId !== id || sheet === null) return <p role="status">Opening the character…</p>;
  return (
    <>
      <ExportCharacter id={id} />
      <CharacterSheet sheet={sheet} />
    </>
  );
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
            <ExportEverything />
            <div className="mt-4">
              <CharacterList />
            </div>
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
