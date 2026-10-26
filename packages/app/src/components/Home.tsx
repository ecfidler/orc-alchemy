import { Link } from "react-router";
import mugStain from "../assets/mug-stain.svg?raw";
import { raceAndClasses, useCreateCharacter, useSummaries } from "./characters.ts";

const button = "border-[1.5px] border-ink px-[18px] py-2.5 font-sans text-sm font-semibold rounded-md cursor-pointer";
const solid = `${button} bg-ink text-paper`;
const ghost = `${button} text-ink no-underline`;

/** The Home page at `/` (ORC-150, variant C): one column, with the mug stain behind it. */
export function Home() {
  const { create, error } = useCreateCharacter();
  return (
    <div className="relative">
      {/* The stain is behind the content and takes no clicks, so it never blocks a control. */}
      <span
        data-testid="mug-stain"
        aria-hidden="true"
        className="pointer-events-none absolute top-[250px] left-[min(470px,calc(100%-160px))] z-0 size-[240px] opacity-(--stain-op) [&>svg]:block [&>svg]:size-full [&>svg]:overflow-visible"
        dangerouslySetInnerHTML={{ __html: mugStain }}
      />
      <section className="relative z-1 grid max-w-[640px] justify-items-start gap-[22px] pt-[18px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <img src="/potion-32.png" width={64} height={64} alt="" className="block [image-rendering:pixelated]" />
          <h1 aria-label="Alchemy 5e" className="text-[clamp(52px,10vw,84px)] leading-[.95] font-[560] tracking-[-0.02em]">
            Alchemy
            <small className="ml-1.5 align-[32px] font-sans text-[15px] font-semibold tracking-[0.1em] text-ink-muted">5E</small>
          </h1>
        </div>
        <p className="max-w-[34ch] text-[19px]">Build and keep your D&amp;D 5e characters. Everything stays in this browser.</p>
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={() => create(false)} className={solid}>
            New character
          </button>
          <button type="button" onClick={() => create(true)} className={ghost}>
            Random character
          </button>
          <Link to="/import/dmv" className={ghost}>
            Import from Dungeon Master's Vault
          </Link>
        </div>
        {error && <p role="alert">{error}</p>}
        <ul aria-label="What Alchemy 5e does" className="grid gap-1.5 text-[15px]">
          {[
            "Build a character step by step, or roll a random one.",
            "Bring in characters and homebrew from Dungeon Master's Vault (.orcbrew).",
            "Works without an account. Export your characters any time.",
          ].map((fact) => (
            <li
              key={fact}
              className="grid grid-cols-[16px_minmax(0,1fr)] items-baseline gap-2 before:size-[9px] before:translate-y-px before:border-[1.5px] before:border-ink before:content-['']"
            >
              {fact}
            </li>
          ))}
        </ul>
        <RecentCharacters />
      </section>
    </div>
  );
}

/** The three most recently changed characters. */
function RecentCharacters() {
  const { summaries, error, retry } = useSummaries();
  const recent = summaries && [...summaries].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3);

  return (
    <div className="mt-2 grid w-full min-w-0 gap-2.5">
      <h2 className="text-xl font-medium">Recent characters</h2>
      {error ? (
        <p role="alert">
          {error}.{" "}
          <button type="button" onClick={retry}>
            Try again
          </button>
        </p>
      ) : summaries === null || recent === null ? (
        <p role="status">Loading characters…</p>
      ) : recent.length === 0 ? (
        <p className="border-[1.5px] border-dashed border-rule-strong p-[18px] text-[15px] text-ink-muted">Characters you make or import show here.</p>
      ) : (
        <>
          <ul aria-label="Recent characters" className="border-t-[1.5px] border-rule-strong">
            {recent.map((summary) => {
              const name = summary.name ?? "Unnamed character";
              return (
                <li key={summary.id} aria-label={name} className="grid gap-0.5 border-b border-rule px-0.5 py-2.5">
                  <Link to={`/sheet/${summary.id}`} className="text-[19px] font-medium">
                    {name}
                  </Link>
                  <span className="text-[14.5px] text-ink-muted">{raceAndClasses(summary)}</span>
                </li>
              );
            })}
          </ul>
          <Link to="/characters" className="font-sans text-[13px] font-semibold">
            All characters ({summaries.length})
          </Link>
        </>
      )}
    </div>
  );
}
