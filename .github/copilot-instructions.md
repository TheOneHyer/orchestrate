# GitHub Copilot Instructions — Orchestrate

These instructions apply to every Copilot suggestion, edit, and chat response
in this repository. Follow all rules below precisely.

---

## Package Manager — pnpm Only

Always use `pnpm`. Never generate `npm install`, `npm run`, `yarn add`, or any
`yarn`/`npm` command in shell snippets, CI configs, or documentation.

```bash
pnpm install          # install / sync dependencies
pnpm add <pkg>        # add a runtime dependency
pnpm add -D <pkg>     # add a dev dependency
pnpm remove <pkg>     # remove a dependency
```

The committed lock file is `pnpm-lock.yaml`. `package-lock.json` and
`yarn.lock` are in `.gitignore` and must never be generated or committed.

---

## Runtime

- **Node.js version:** `v24.14.0` (pinned in `.node-version`).

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

### Coverage Thresholds — 97 % Minimum

All four coverage metrics must remain at or above **97 %**:

| Metric | Threshold |
|---|---|
| Statements | ≥ 97 % |
| Branches | ≥ 97 % |
| Functions | ≥ 97 % |
| Lines | ≥ 97 % |

Thresholds are enforced by Vitest in `vite.config.ts`
(`test.coverage.thresholds`). Any coverage run falling below a threshold fails.

### Every New Function, Method, and Module Must Have Tests

Always generate a corresponding test file for every new source file you create.
When adding a function or component to an existing file, add or extend the
matching test file.

- Test files are co-located with source files:
  - `src/lib/foo.ts` → `src/lib/foo.test.ts`
  - `src/components/Bar.tsx` → `src/components/Bar.test.tsx`
- Use Vitest globals (`describe`, `it`/`test`, `expect`, `vi`, `beforeEach`,
  `afterEach`) — they are available without imports.
- Use `@testing-library/react` and `@testing-library/user-event` for React
  component tests.
- Prefer `userEvent` over `fireEvent` for interaction simulation.

### What to Cover

- Happy path with representative inputs.
- Edge cases: empty arrays, null/undefined, boundary values.
- Error paths: every `throw` and rejected `Promise`.
- All branches of `if`/`switch`/ternary expressions.

---

## Documentation Requirements

### Every New Export Must Have a JSDoc Comment

Generate a JSDoc block comment for every exported function, class, interface,
type alias, and constant.

**Function pattern:**

```typescript
/**
 * One-sentence summary of what the function does.
 *
 * @param paramName - Description of the parameter.
 * @param optionalParam - Description.
 * @returns Description of the return value.
 * @throws {ErrorType} When and why this throws.
 */
export function myFunction(paramName: string, optionalParam?: number): boolean {
  // ...
}
```

**Interface pattern:**

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

---

## Code Quality Standards

1. **TypeScript strict mode** is on. Avoid `any`; use `unknown` with narrowing
   or a precise type instead.
2. Do not commit commented-out code.
3. Do not modify files in `src/components/ui/` except via the shadcn CLI.
4. `src/main.tsx` and `src/components/ui/**` are excluded from coverage.
5. File naming: `PascalCase` for React component files (`.tsx`), `kebab-case`
   for library / utility files (`.ts`).

---

## Checklist Before Finalising a Change

- [ ] `pnpm lint` passes with no errors.
- [ ] `pnpm build` succeeds.
- [ ] `pnpm test:coverage` passes with all four metrics ≥ 97 %.
- [ ] Every new exported symbol has a JSDoc comment.
- [ ] Every new source file has a corresponding test file.
