import { PixelIcon } from "@orc-alchemy/ui";
import { Link } from "react-router";

/** The page for a path that the app does not have. */
export function NotFound() {
  return (
    <>
      <h1 className="text-xl">Page not found</h1>
      <Link to="/characters" className="underline">
        <PixelIcon name="left" />
        Back to characters
      </Link>
    </>
  );
}
