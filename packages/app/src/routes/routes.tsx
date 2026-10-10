import { useEffect, useState, type ReactNode } from "react";
import type { RouteObject } from "react-router";
import { Link, useBlocker, useParams } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { Builder } from "../components/Builder.tsx";
import { CharacterList, NewCharacter } from "../components/CharacterList.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { DmvExporter } from "../components/DmvExporter.tsx";
import { ExportCharacter, ExportEverything } from "../components/Export.tsx";
import { HomebrewBuilder } from "../components/HomebrewBuilder.tsx";
import { ImportPage } from "../components/ImportPage.tsx";
import { MyContent } from "../components/MyContent.tsx";
import { OpenCharacterGaps } from "../components/UnresolvedContent.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import type { Sheet } from "../engine/sheet.ts";
import { flushAutosave, readCharacter, useCharacter, useOpenCharacter } from "../state/character.ts";
import { restorePacks } from "../state/homebrew.ts";
import { useStorage } from "../storage/characters.ts";

/**
 * Opens the character at the route's :id, and renders children once it is
 * open and built, under its save status: Save while it has unsaved changes,
 * and a notice when those were recovered from a draft on open.
 */
function OpenCharacter({ children }: { children: (id: string, sheet: Sheet) => ReactNode }) {
  const { id } = useParams() as { id: string };
  const openId = useCharacter((state) => state.id);
  const { sheet, dirty } = useOpenCharacter();
  const [problem, setProblem] = useState<string | null>(null);
  const [recovered, setRecovered] = useState(false);

  useEffect(() => {
    let current = true;
    setProblem(null);
    setRecovered(false);
    if (id !== useCharacter.getState().id) {
      // A slow open for a page already left must not replace this one's character.
      // The character opens once the stored packs are back, so it never builds or saves without them.
      Promise.all([readCharacter(id), restorePacks()]).then(
        ([found]) => {
          if (!current) return;
          if (found) {
            useCharacter.getState().load(id, found.entity, found.dirty);
            setRecovered(found.dirty);
          } else setProblem("Character not found");
        },
        () => current && setProblem("The character could not be read from this browser"),
      );
    }
    return () => {
      current = false;
    };
  }, [id]);

  // Leaving the character's pages saves its pending changes at once; its draft keeps them until then,
  // so nothing is lost. It asks first only when a save has failed (beforeunload asks while one is pending too).
  useBlocker(({ nextLocation }) => {
    const open = useCharacter.getState();
    if (!open.dirty || open.id !== id || [`/sheet/${id}`, `/build/${id}`].includes(nextLocation.pathname)) return false;
    if (!useStorage.getState().failed) {
      flushAutosave().catch(console.error);
      return false;
    }
    return !window.confirm("Saving your changes to this browser failed. Leave anyway?");
  });

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
      <div className="flex flex-wrap items-center gap-3">
        {dirty && (
          <button type="button" onClick={() => flushAutosave().catch(console.error)} className="border border-black px-3 py-1">
            Save
          </button>
        )}
        <span role="status">{dirty ? "Unsaved changes" : "Saved"}</span>
        {recovered && dirty && <span>Unsaved changes from your last visit were recovered.</span>}
      </div>
      {children(id, sheet)}
    </>
  );
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
          <OpenCharacterGaps characterName={sheet.name ?? "Unnamed character"} />
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
            <p className="mt-4">
              <Link to="/import" className="underline">
                Import homebrew and characters
              </Link>
            </p>
            <ExportEverything />
            <div className="mt-4">
              <CharacterList />
            </div>
          </>
        ),
      },
      { path: "import", element: <ImportPage /> },
      { path: "import/dmv", element: <DmvExporter /> },
      { path: "content", element: <MyContent /> },
      ...["content/new/:type", "content/edit/:type/:key", "content/edit/:type/:pack/:key"].map((path) => ({
        path,
        element: (
          <EngineGate>
            <HomebrewBuilder />
          </EngineGate>
        ),
      })),
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
