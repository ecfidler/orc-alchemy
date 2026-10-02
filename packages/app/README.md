# Alchemy 5e

The app. Vite, React 18, TypeScript, react-router, TanStack Query, Zustand,
Base UI (`@base-ui/react`) styled with Tailwind.

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
- **The theme is barebones black and white** until ORC-102 settles it.

`src/` layout: `engine/` (the `@pubdoor/dmv` wrapper), `state/`, `routes/`,
`components/`, `storage/`.
