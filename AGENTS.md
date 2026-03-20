# AI Agent Instructions — TrainSync (orchestrate)

This document provides coding standards, tooling constraints, and quality
requirements for every AI agent or coding assistant working in this repository.
All rules below apply regardless of which tool generated the code.

---

## Package Manager — pnpm Only

**Use `pnpm` exclusively.** `npm` and `yarn` are not supported.

```bash
pnpm install          # install / sync dependencies
pnpm add <pkg>        # add a runtime dependency
pnpm add -D <pkg>     # add a dev dependency
pnpm remove <pkg>     # remove a dependency
```

- The committed lock file is `pnpm-lock.yaml`.
- `package-lock.json` and `yarn.lock` are listed in `.gitignore` and must
  never be committed.
- The exact package manager version is pinned in `package.json`
  (`"packageManager": "pnpm@10.32.1"`). Enable it via `corepack enable`.

---

## Runtime

- **Node.js version:** `v24.14.0` (see `.node-version`).
- Activate the correct version with any Node version manager that respects
  `.node-version` (e.g. `fnm`, `nvm`, `volta`).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript ~5.7 |
| Framework | React 19 |
| Build / Dev server | Vite 8 with SWC (`@vitejs/plugin-react-swc`) |
| Styling | Tailwind CSS 4 (`@tailwindcss/vite`), shadcn/ui, Radix UI |
| State / Storage | `@github/spark` KV store (`useKV` hook) |
| Forms | React Hook Form + Zod |
| Charts | Recharts, D3.js |
| Animations | Framer Motion |
| Date handling | date-fns |
| Icons | Phosphor Icons (`@phosphor-icons/react`), Lucide React |
| Notifications | Sonner (toast), Web Audio API, Browser Push API |
| Testing | Vitest, @testing-library/react, jsdom |
| Linting | ESLint 9 with TypeScript and React plugins |

---

## Project Structure

```text
orchestrate/
├── src/
│   ├── App.tsx                  # Root component & global state
│   ├── main.tsx                 # React entry point (excluded from coverage)
│   ├── components/
│   │   ├── views/               # One file per application view
│   │   ├── charts/              # D3 / Recharts visualisations
│   │   └── ui/                  # shadcn/ui components (excluded from coverage)
│   ├── hooks/                   # Custom React hooks
│   ├── lib/                     # Business logic, types, utilities
│   ├── styles/
│   └── test/
│       └── setup.ts             # Vitest global setup & browser-API mocks
├── .node-version                # Pinned Node.js version
├── package.json
├── pnpm-lock.yaml
├── vite.config.ts               # Vite + Vitest configuration
├── tsconfig.json
└── tsconfig.test.json
```

Place business logic in `src/lib/`, React components in `src/components/`,
and custom hooks in `src/hooks/`.

---

## Common Scripts

```bash
pnpm dev              # Start the Vite dev server (http://localhost:5173)
pnpm build            # Type-check and produce a production bundle
pnpm preview          # Preview the production build locally
pnpm lint             # Run ESLint across the project
pnpm test             # Run the unit-test suite once (Vitest)
pnpm test:watch       # Run Vitest in watch mode
pnpm test:coverage    # Run tests and generate a coverage report
```

---

## Testing Requirements

### Coverage Thresholds — 95 % Minimum

All four coverage metrics must remain at or above **95 %**:

| Metric | Threshold |
|---|---|
| Statements | ≥ 95 % |
| Branches | ≥ 95 % |
| Functions | ≥ 95 % |
| Lines | ≥ 95 % |

These thresholds are enforced by Vitest in `vite.config.ts`
(`test.coverage.thresholds`). A coverage run that falls below any threshold
fails the CI pipeline.

### Every New Function, Method, and Module Must Have Tests

- Write tests **before or alongside** every new function, method, class, or
  React component you create.
- Tests live next to the source file they exercise:
  - `src/lib/foo.ts` → `src/lib/foo.test.ts`
  - `src/components/Bar.tsx` → `src/components/Bar.test.tsx`
- Use the Vitest APIs already imported globally (`describe`, `it`/`test`,
  `expect`, `vi`, `beforeEach`, `afterEach`).
- Use `@testing-library/react` and `@testing-library/user-event` for
  component tests.
- Prefer `userEvent` over `fireEvent` for interaction simulation.
- Mock browser APIs (ResizeObserver, IntersectionObserver, Notification, Audio)
  using the helpers in `src/test/setup.ts`.

### What to Test

- **Happy path** — expected inputs produce expected outputs.
- **Edge cases** — empty arrays, null/undefined, boundary values.
- **Error paths** — functions that can throw should be tested for those throws.
- **Branch coverage** — every `if`/`switch`/ternary branch must be exercised.

---

## Documentation Requirements

### Every New Export Must Have a JSDoc Comment

All exported functions, classes, interfaces, type aliases, and constants require
a JSDoc block comment. The style already used in this codebase is the standard
to follow.

**Function / method pattern:**

```typescript
/**
 * One-sentence summary of what the function does.
 *
 * Longer description if needed — explain non-obvious behaviour,
 * side effects, or performance characteristics here.
 *
 * @param paramName - Description of the parameter.
 * @param optionalParam - Description. Omit if not applicable.
 * @returns Description of the return value.
 * @throws {ErrorType} When and why this throws.
 */
export function myFunction(paramName: string, optionalParam?: number): boolean {
  // ...
}
```

**Interface / type pattern:**

```typescript
/**
 * One-sentence description of what this interface represents.
 */
export interface MyInterface {
  /** Description of this property. */
  id: string;
  /** Description of this optional property. */
  label?: string;
}
```

**Constant pattern:**

```typescript
/**
 * Brief description of why this constant exists and what it represents.
 */
export const DEFAULT_TIMEOUT_MS = 5_000;
```

### Inline Comments

- Add inline comments only when the logic is genuinely non-obvious.
- Do not paraphrase TypeScript — `// increment counter` above `count++` adds
  no value.

---

## Code Quality Standards

1. **TypeScript strict mode** is enabled. Do not use `any` unless absolutely
   unavoidable; prefer `unknown` with narrowing or a specific type.
2. **No commented-out code** should be committed.
3. **Imports** should be ordered: external packages first, then internal
   `@/` aliases, then relative paths. Let ESLint enforce this.
4. **shadcn/ui components** live in `src/components/ui/` and are excluded from
   coverage requirements. Do not modify them unless updating a component via
   the shadcn CLI.
5. `src/main.tsx` is also excluded from coverage (entry-point boilerplate).
6. Follow the existing file-naming convention: `PascalCase` for React
   component files (`.tsx`), `kebab-case` for library / utility files (`.ts`).

---

## Submitting Changes

1. Ensure `pnpm lint` passes with no errors or warnings.
2. Ensure `pnpm build` succeeds.
3. Ensure `pnpm test:coverage` passes with all four metrics ≥ 95 %.
4. All new public exports must have JSDoc comments.
5. All new source files must have corresponding test files.
