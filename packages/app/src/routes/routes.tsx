import type { RouteObject } from "react-router";
import { Link } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { ImportCharacter } from "../components/ImportCharacter.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import { useOpenCharacter } from "../state/character.ts";

function SheetPage() {
  const { sheet } = useOpenCharacter();
  if (sheet === null) {
    return (
      <>
        <h1 className="text-xl">No character is open</h1>
        <Link to="/" className="underline">
          Back to characters
        </Link>
      </>
    );
  }
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
        path: "sheet",
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
