# Demo Mode Follow-Up Items

Deferred issues from PR #102 review (feature/preview-demo-mode).
Each item was identified during review-comment resolution and intentionally
deferred because it requires significant refactoring beyond the PR scope.

---

## 1. Extract Demo Storage Helpers into a Custom Hook

**Review comment:** coderabbitai (id 3016053570)

**Problem:**
`App.tsx` mixes `useKV` state with bespoke `sessionStorage`/`localStorage`
helper functions (`readSessionStorageValue`, `writeSessionStorageValue`,
`readLocalStorageFlag`, `writeLocalStorageFlag`, `readLocalStorageValue`,
`writeLocalStorageValue`). This creates an inconsistent persistence model —
the project standard is `@github/spark` KV via the `useKV` hook — and makes
the demo storage logic harder to test in isolation.

**Affected code:**

- `src/App.tsx` lines ~100–185 (free functions)
- Every call site inside `App()` that reads/writes demo session or lease state

**Suggested approach:**

1. Create `src/hooks/use-demo-storage.ts` containing a `useDemoStorage` hook.
2. Internally the hook should:
   - Expose reactive getters/setters for:
     - `demoModeActive` (sessionStorage key `orchestrate-demo-mode-active`)
     - `demoSessionUserId` (sessionStorage key `orchestrate-demo-mode-user-id`)
     - `demoSeededFlag` (localStorage key `orchestrate-demo-mode-seeded`)
     - `demoSeededInTab` (sessionStorage key `orchestrate-demo-seeded-in-tab`)
     - `demoLease` (localStorage key `orchestrate-demo-seed-lease`)
   - Handle `typeof window === 'undefined'` guards internally.
   - Swallow storage errors the same way the current free functions do.
3. Replace all direct calls to the free functions in `App.tsx` with the hook's
   API.
4. Write a corresponding `src/hooks/use-demo-storage.test.ts` covering:
   - SSR fallback (window undefined)
   - Storage quota errors
   - Read/write round-trips for each key
   - Lease creation, reading, and expiry

**Why deferred:**
Significant refactor touching many call sites in the ~2 200-line `App.tsx`.
Risk of regressions if done alongside other demo-mode changes.

---

## 2. Make Stale-Demo Cleanup Reactive to Lease Expiry

**Review comment:** coderabbitai (id 3016053579)

**Problem:**
`shouldClearStaleDemoData` is computed from direct storage reads during render:

```ts
const seededInThisTab = readSessionStorageValue(SESSION_DEMO_MARKER_STORAGE_KEY) === 'true'
const hasLiveDemoLease = hasActiveDemoLease()
const shouldClearStaleDemoData = !previewMode
  && !demoModeEnabled
  && (seededInThisTab || !hasLiveDemoLease)
  && readLocalStorageFlag(DEMO_MODE_SEEDED_STORAGE_KEY)
```

These reads are not reactive. If a non-demo tab is opened while a lease is
still live, `shouldClearStaleDemoData` evaluates to `false`. The cleanup will
not fire until some unrelated state update triggers a re-render — which could
happen mid-flow once the lease has actually expired.

**Affected code:**

- `src/App.tsx` lines ~619–632 (`shouldClearStaleDemoData` derivation)
- `src/App.tsx` `useIsomorphicLayoutEffect` that calls `clearPreviewDataState`

**Suggested approach:**

1. Create a `useDemoLeaseStatus` hook (or fold into `useDemoStorage` from item
   1) that:
   - Listens to the `storage` event on `window` so cross-tab mutations to
     `orchestrate-demo-seed-lease` and `orchestrate-demo-mode-seeded` trigger
     re-renders.
   - Optionally polls with `setInterval` at a reasonable cadence (e.g. every
     30 s) to catch same-tab lease expiry that doesn't produce a `storage`
     event.
   - Exposes a reactive boolean `hasActiveLease`.
2. Derive `shouldClearStaleDemoData` from the hook's reactive state instead of
   direct reads.
3. Keep the existing `useIsomorphicLayoutEffect` that calls
   `clearPreviewDataState(false)` — it just needs to depend on the reactive
   value.
4. Test:
   - Simulate a `StorageEvent` setting the lease key to an expired value →
     expect cleanup.
   - Simulate a `StorageEvent` removing the seeded flag → expect cleanup.
   - Verify no cleanup fires while the lease is live.

**Why deferred:**
Requires new event-listener plumbing and potentially a polling mechanism.
Should ideally be combined with item 1 (the `useDemoStorage` hook extraction)
to avoid two rounds of refactoring the same area.

---

## 3. Fix `pnpm typecheck` Pre-Existing Failures

**Review comment:** coderabbitai (id 3015008019)

**Problem:**
`pnpm typecheck` (`tsc -b --noEmit`) fails on the branch even before any
PR #102 changes due to:

1. `vite.config.ts` uses `path` and `process` which need `@types/node`.
2. Test files (`*.test.ts`) reference Vitest globals (`describe`, `it`,
   `expect`) that are only typed when `vitest/globals` is in `types` — but
   the root `tsconfig.json` does not include that type.
3. `src/test/setup.ts` has a `boolean | null` → `boolean | undefined`
   assignment error.

The CodeRabbit suggestion to add project references
(`tsconfig.json → tsconfig.test.json`) does not work because the parent
config sets `noEmit: true` which conflicts with `composite: true` required
for project references.

**Suggested approach (pick one):**

**Option A — Add missing type packages:**

```bash
pnpm add -D @types/node
```

Then add `"vitest/globals"` to the root `tsconfig.json` `compilerOptions.types`
array. Fix the `null → undefined` issue in `src/test/setup.ts`.

**Option B — Separate typecheck targets:**
Create a `typecheck` script that runs `tsc -p tsconfig.json --noEmit` **and**
`tsc -p tsconfig.test.json --noEmit` sequentially, accepting that each config
covers different file subsets.

**Why deferred:**
Pre-existing issue not introduced by PR #102. Should be addressed in a
dedicated PR to avoid conflating type-system fixes with demo-mode behavior.

---

## 4. Optional Chaining in `Courses.tsx` Cannot Be Removed

**Review comment:** coderabbitai (id 3015912982)

**Problem (non-actionable — documented for context):**
The review suggested removing `?.` from `onUpdateCourse?.(...)` and
`onCreateCourse?.(...)` since they are guarded earlier in the function.
However, TypeScript's control-flow analysis cannot narrow the type across
the branching structure:

```ts
if (editingCourse) {
  // guard: if (!onUpdateCourse) { return }
} else {
  // guard: if (!onCreateCourse) { return }
}

// Later:
if (editingCourse) {
  onUpdateCourse(...)   // TS2722: Cannot invoke possibly undefined
} else {
  onCreateCourse(...)   // TS2722: Cannot invoke possibly undefined
}
```

The optional chaining is **required** for type safety because the narrowing
from the `if` branch is not carried into the later `if` branch.

**Resolution:**
No change needed. The optional chaining is correct and necessary. If a future
TypeScript version improves cross-branch narrowing, this can be revisited.

---

## 5. `typecheck` Script Scope Note

**Review comment:** Copilot (id 3016034020)

**Observation:**
The `typecheck` script was added in this PR but the PR description focuses on
demo-mode/session-storage behavior. Consider mentioning it in the PR
description or moving it to a separate PR for cleaner review scope.

**Resolution:**
Low priority. The script is already merged into the branch. Update the PR
description to mention it, or leave as-is — it is a single-line addition.
