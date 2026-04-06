# AI Developer Workflow Rules

**CRITICAL: Ignoring these rules will break the pipeline.**

## 1. Package Management
- **ONLY `pnpm`**. Never run `npm` or `yarn`. 
- Prefix commands: `pnpm install`, `pnpm run build`, `pnpm test`.

## 2. Test Coverage (The 95% Rule)
- Vitest thresholds are strictly set to 95% for Statements, Branches, Functions, and Lines.
- **Any new feature must include its tests in the same PR/commit.**
- Structure: Code in `src/lib/foo.ts` must have tests in `src/lib/foo.test.ts`. Use React Testing Library + `userEvent` (avoid `fireEvent`) for `components/`.

## 3. Types and Documentation
- `any` is forbidden. Use `unknown` and type guards.
- **Every public export must have a JSDoc block:**
```typescript
/**
 * Short description.
 *
 * @param param - description.
 * @returns description.
 */
```

## 4. Local Execution
- Start Dev Server: `pnpm dev`
- Run Tests: `pnpm test:coverage` (Always run this to verify you didn't drop coverage).
- Format & Lint: `pnpm lint`
