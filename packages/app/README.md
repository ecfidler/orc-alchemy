# Alchemy 5e

The app. Vite, React 18, TypeScript, react-router, TanStack Query, Zustand,
Tailwind, and the theme and controls of `@orc-alchemy/ui` (`packages/ui`).

```bash
bun run dev        # dev server
bun run typecheck
bun run test       # vitest
bun run e2e        # Playwright (Chromium); builds and serves on :4173
```

Use `bun run test`, not `bun test`, which runs Bun's own test runner.

- **Client state is Zustand**, not Redux Toolkit: Plan Set 1 doc 04 allows
  either, and Zustand needs less boilerplate.
- **react-router is pinned to v7**: v8 requires React 19.
- **The theme comes from `@orc-alchemy/ui`.** `src/index.css` imports its
  `theme.css` after Tailwind. The spec is `docs/design/theme.md`.

`src/` layout: `engine/` (the `@pubdoor/dmv` wrapper), `state/`, `routes/`,
`components/`, `storage/`.
