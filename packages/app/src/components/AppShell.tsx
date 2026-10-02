import { Link, Outlet } from "react-router";

export function AppShell() {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="border-b border-black px-4 py-3">
        <Link to="/" className="font-bold">
          Alchemy 5e
        </Link>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
