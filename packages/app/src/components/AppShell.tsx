import { Link, Outlet } from "react-router";
import { useStorage } from "../storage/characters.ts";

export function AppShell() {
  const inMemory = useStorage((state) => state.inMemory);
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black px-4 py-3">
        <Link to="/" className="font-bold">
          Alchemy 5e
        </Link>
      </header>
      {inMemory && (
        <p role="alert" className="border-b border-black px-4 py-2">
          This browser is not letting Alchemy 5e save. Your characters are kept only until you close this tab.
        </p>
      )}
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
