import type { RouteObject } from "react-router";
import { Link } from "react-router";
import { AppShell } from "../components/AppShell.tsx";

export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <h1 className="text-xl">Characters</h1> },
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
