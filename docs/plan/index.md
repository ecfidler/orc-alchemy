# Plan Set 2

The active plan. Start with the overview.

* [Plan Set 2](README.md) - The active plan: a new app on the compiled cljc engine library, with user-level content compatibility.
* [Phase A handoff: start here](HANDOFF-phase-a.md) - The starting point for Phase A work on @pubdoor/dmv: environment, repository state, the M1 sequence, and the rules.
* [00: Repository strategy](00-repo-strategy.md) - Where the work happens: the engine is built and published from the fork, and the app is its own repository.
* [01: The compatibility contract](01-compatibility-contract.md) - The three user-level contracts: homebrew in both directions, characters from the old app to the new app, and content identity.
* [02: The engine library](02-engine-library.md) - What the compiled engine package exposes beyond the Plan Set 1 facade, the build scope, the engine wrinkles, and the golden tests.
* [03: Character import and storage](03-character-import-and-storage.md) - How characters leave an old instance through the exporter bookmarklet, how the new app imports them, and the native character format.
* [04: Homebrew](04-homebrew.md) - .orcbrew import and export through the engine library: validation, conflicts, storage, and old bugs to fix.
* [05: Application and backend](05-app-and-backend.md) - The application layer by reference to Plan Set 1, the local-first mode, and the new backend.
* [06: Milestones, decisions, and risks](06-milestones-and-risks.md) - The milestone sequence, the decision record, and the definition of done. Linear has the status and the risk register.

# Subdirectories

* [Plan Set 1](plan-set-1/index.md) - Reference plan that Plan Set 2 builds on.
