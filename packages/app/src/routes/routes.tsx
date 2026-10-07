import { useEffect, useState, type ReactNode } from "react";
import type { RouteObject } from "react-router";
import { Link, useParams } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { Builder } from "../components/Builder.tsx";
import { CharacterList, NewCharacter } from "../components/CharacterList.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { ExportCharacter, ExportEverything } from "../components/Export.tsx";
import { ImportCharacter } from "../components/ImportCharacter.tsx";
import { LoadHomebrew } from "../components/LoadHomebrew.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import type { Sheet } from "../engine/sheet.ts";
import { readCharacter, useCharacter, useOpenCharacter } from "../state/character.ts";
import { restorePacks } from "../state/homebrew.ts";

/** Opens the character at the route's :id, and renders children once it is open and built. */
function OpenCharacter({ children }: { children: (id: string, sheet: Sheet) => ReactNode }) {
  const { id } = useParams() as { id: string };
  const openId = useCharacter((state) => state.id);
  const { sheet } = useOpenCharacter();
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    setProblem(null);
    if (id !== useCharacter.getState().id) {
      // A slow open for a page already left must not replace this one's character.
      // The character opens once the stored packs are back, so it never builds or saves without them.
      Promise.all([readCharacter(id), restorePacks()]).then(
        ([found]) => {
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
  return children(id, sheet);
}

function SheetPage() {
  return (
    <OpenCharacter>
      {(id, sheet) => (
        <>
          <div className="flex flex-wrap gap-3">
            <Link to={`/build/${id}`} className="underline">
              Build
            </Link>
            <ExportCharacter id={id} />
          </div>
          <CharacterSheet sheet={sheet} />
        </>
      )}
    </OpenCharacter>
  );
}

function BuildPage() {
  return (
    <OpenCharacter>
      {(id) => (
        <>
          <Link to={`/sheet/${id}`} className="underline">
            Sheet
          </Link>
          <Builder />
        </>
      )}
    </OpenCharacter>
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
            <NewCharacter />
            <ImportCharacter />
            <LoadHomebrew />
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
        path: "build/:id",
        element: (
          <EngineGate>
            <BuildPage />
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
