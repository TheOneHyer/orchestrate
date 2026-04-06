# Architecture & Tech Stack

## Tech Stack Overview
- **UI Framework**: React 19 + TypeScript 5.7
- **Bundler / Dev**: Vite 8 with SWC
- **Styling**: Tailwind CSS 4, shadcn/ui, Radix UI
- **State & Storage**: `@github/spark` KV store (`useKV` hook)
- **Data Visualisation**: Recharts, D3.js (custom visualizations for Calendar/Gantt/Workload)
- **Forms & Validation**: React Hook Form + Zod
- **Animations**: Framer Motion
- **Testing**: Vitest (`test:coverage` required to hit >= 95%), jsdom, React Testing Library

## Key Components and Patterns

### `src/components/`
- **`views/`**: Contains page-level components (e.g., `Schedule.tsx`, `WellnessCheckIn.tsx`, `Courses.tsx`).
- **`ui/`**: Standard shadcn components. These are explicitly excluded from test coverage requirements.
- **Dialogs & Overlays**: Modals are often co-located at the root of `components/` (e.g., `AddPersonDialog.tsx`, `EnrollStudentsDialog.tsx`).
- **Charts / Heatmaps**: High-complexity custom SVG/D3/Recharts modules (e.g., `TrainerCoverageHeatmap.tsx`).

### `src/lib/` (Core Business Logic)
This directory acts as the application's domain logic backend. Since data is managed in the client (using `@github/spark` KV), complex operations reside here:
- **`scheduler.ts` / `conflict-detection.ts`**: Handle avoiding double-bookings, capacity bounds, and timeline overlap.
- **`workload-balancer.ts` / `wellness-analytics.ts`**: Contain the mathematical rules and algorithms for categorizing trainer "burnout" and "utilization limits".
- **`certification-tracker.ts`**: Handles timing and notifications for expiring qualifications.
