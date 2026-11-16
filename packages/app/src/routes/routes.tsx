import { AlertNote, AlertNotes, Button, ButtonLink, useConfirm } from "@orc-alchemy/ui";
import { type ReactNode, useEffect, useState } from "react";
import type { RouteObject } from "react-router";
import { Link, useBlocker, useParams } from "react-router";
import { AppShell } from "../components/AppShell.tsx";
import { Builder } from "../components/Builder.tsx";
import { CharacterList, NewCharacter } from "../components/CharacterList.tsx";
import { CharacterSheet } from "../components/CharacterSheet.tsx";
import { DmvExporter } from "../components/DmvExporter.tsx";
import { ExportCharacter, ExportEverything, ExportMessageLine } from "../components/Export.tsx";
import { Home } from "../components/Home.tsx";
import { HomebrewBuilder } from "../components/HomebrewBuilder.tsx";
import { ImportPage } from "../components/ImportPage.tsx";
import { useAskOnBlock } from "../components/leave-guard.tsx";
import { MyContent } from "../components/MyContent.tsx";
import { Preferences } from "../components/Preferences.tsx";
import { ReviewUses } from "../components/ReviewUses.tsx";
import { OpenCharacterGaps } from "../components/UnresolvedContent.tsx";
import { EngineGate } from "../engine/EngineGate.tsx";
import type { Sheet } from "../engine/sheet.ts";
import { flushAutosave, readCharacter, useCharacter, useOpenCharacter } from "../state/character.ts";
import { restorePacks } from "../state/homebrew.ts";
import { useStorage } from "../storage/characters.ts";

/**
 * Opens the character at the route's :id, and renders children once it is
 * open and built, under one row of buttons: Back to List on the left; on the
 * right, the save status, Save while it has unsaved changes, then the page's
 * `actions`. A note under the row says when unsaved changes were recovered
 * from a draft on open.
 */
function OpenCharacter({ actions, children }: { actions: (id: string) => ReactNode; children: (sheet: Sheet) => ReactNode }) {
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
            useCharacter.getState().load(id, found.entity, found.dirty, found.custom);
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
  const [confirm, confirmDialog] = useConfirm();
  const blocker = useBlocker(({ nextLocation }) => {
    const open = useCharacter.getState();
    if (!open.dirty || open.id !== id || [`/sheet/${id}`, `/build/${id}`].includes(nextLocation.pathname)) return false;
    if (!useStorage.getState().failed) {
      flushAutosave().catch(console.error);
      return false;
    }
    return true;
  });
  useAskOnBlock(blocker, confirm, "Saving your changes to this browser failed. Leave anyway?", "Leave");

  if (problem !== null) {
    return (
      <>
        <h1 className="text-xl">{problem}</h1>
        <Link to="/characters" className="underline">
          Back to characters
        </Link>
      </>
    );
  }
  if (openId !== id || sheet === null) return <p role="status">Opening the character…</p>;
  return (
    <>
      {confirmDialog}
      <div className="mb-4 @container">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ButtonLink render={<Link to="/characters" aria-label="Back to List" />}>
            Back<span className="@max-[719px]:hidden"> to List</span>
          </ButtonLink>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
            <span role="status" aria-label="Save status" className="text-sm text-ink-muted">
              {dirty ? (
                <>
                  Unsaved<span className="@max-[719px]:sr-only"> changes</span>
                </>
              ) : (
                "Saved"
              )}
            </span>
            {dirty && <Button onClick={() => flushAutosave().catch(console.error)}>Save</Button>}
            {actions(id)}
          </div>
        </div>
      </div>
      {recovered && dirty && (
        <AlertNotes>
          <AlertNote tone="info" onDismiss={() => setRecovered(false)}>
            Unsaved changes from your last visit were recovered.
          </AlertNote>
        </AlertNotes>
      )}
      {children(sheet)}
    </>
  );
}

function SheetPage() {
  // Why an export failed shows under the action row, so the row keeps its one line. It belongs to the character it came from.
  const { id: openId } = useParams();
  const [exported, setExported] = useState<{ id: string; message: string | null } | null>(null);
  const exportMessage = exported !== null && exported.id === openId ? exported.message : null;
  return (
    <OpenCharacter
      actions={(id) => (
        <>
          <ButtonLink variant="solid" render={<Link to={`/build/${id}`} />}>
            Edit
          </ButtonLink>
          <ExportCharacter id={id} label="Export" variant="ghost" onMessage={(message) => setExported({ id, message })} />
        </>
      )}
    >
      {(sheet) => (
        <>
          <ExportMessageLine message={exportMessage} className="mb-4" />
          <OpenCharacterGaps characterName={sheet.name ?? "Unnamed character"} />
          <CharacterSheet sheet={sheet} />
        </>
      )}
    </OpenCharacter>
  );
}

function BuildPage() {
  return (
    <OpenCharacter
      actions={(id) => (
        <ButtonLink variant="solid" render={<Link to={`/sheet/${id}`} />}>
          Done
        </ButtonLink>
      )}
    >
      {() => <Builder />}
    </OpenCharacter>
  );
}

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      {
        path: "characters",
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
      { path: "preferences", element: <Preferences /> },
      ...["content/new/:type", "content/edit/:type/:key", "content/edit/:type/:pack/:key"].map((path) => ({
        path,
        element: (
          <EngineGate>
            <HomebrewBuilder />
          </EngineGate>
        ),
      })),
      {
        path: "content/review-uses/:pack",
        element: (
          <EngineGate>
            <ReviewUses />
          </EngineGate>
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
            <Link to="/characters" className="underline">
              Back to characters
            </Link>
          </>
        ),
      },
    ],
  },
];
