# Orchestrate — Corporate Training Management System

**Orchestrate** is an enterprise-grade web application for managing, scheduling, and tracking corporate training programs. It gives training administrators, trainers, and employees a single place to coordinate sessions, monitor trainer wellness, track certifications, and gain data-driven insights into training effectiveness.

---

## ✨ Features

| Feature | Description |
| --- | --- |
| **Dashboard** | Role-specific home screen with key metrics, upcoming sessions, and live notifications |
| **Multi-View Scheduling** | Calendar, list, and Kanban board views with drag-and-drop rescheduling and conflict detection (Gantt view: planned) |
| **Schedule Templates** | Reusable recurring-session templates (daily / weekly / monthly / custom) |
| **Courses** | Course catalog with module management, enrollment counts, and progress tracking |
| **People** | Employee and trainer directory with profiles, certifications, and training history |
| **Analytics** | Charts and metrics for completion rates, attendance, workload, and trends |
| **Trainer Availability** | Utilization heatmaps, workload-balance scoring, and redistribution recommendations |
| **Burnout Risk Dashboard** | Composite burnout-risk scores and trend charts for every trainer |
| **Wellness & Recovery** | Structured check-ins (mood, stress, energy, sleep …) and recovery-plan creation |
| **Certifications** | Certification records with automated renewal reminders at 90 / 60 / 30 / 14 / 7 days |
| **Notifications** | In-app notification center, sound alerts (Web Audio API), and browser push notifications |
| **User Guide** | Built-in interactive reference covering every section of the application |
| **Dark / Light Theme** | System-aware theme toggle in the header |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 24.14.0 (see `.node-version` for the exact required version)
- **pnpm** 10.32.1 via Corepack

> **pnpm is the only supported package manager for this project.**
> Using any other package manager will create an alternate lockfile and a different dependency graph than the committed `pnpm-lock.yaml`.
> Only `pnpm-lock.yaml` is committed; alternate lockfiles are listed in `.gitignore`.

### Installation

```bash
# Clone the repository
git clone https://github.com/TheOneHyer/orchestrate.git
cd orchestrate

# Enable Corepack so the correct pnpm version is used automatically
corepack enable

# Install dependencies
pnpm install
```

### Running the App

```bash
# Start the Vite development server (http://localhost:5173)
pnpm dev
```

### Production Build

```bash
pnpm build       # Type-check and bundle
pnpm preview     # Preview the production build locally
```

### Running Unit Tests

```bash
pnpm test                # Run the unit test suite once
pnpm test:watch          # Run Vitest in watch mode
pnpm test:coverage       # Generate a coverage report
```

The initial test rollout focuses on core business logic in `src/lib/`.

### Other Scripts

```bash
pnpm lint        # Run ESLint
pnpm optimize    # Optimise the Vite bundle
pnpm kill        # Free the Vite dev port (5173) on Linux/macOS
pnpm kill:win    # Free port 5173 on Windows (PowerShell)
```

### GitHub Automation

- Dependabot pull requests are evaluated by a dedicated auto-merge workflow.
- The workflow detects stale Dependabot branches and requests a manual update, waits for the required CI checks to pass, squash-merges successful PRs, and leaves a comment when it auto-merges.
- If the PR head commit changes while waiting for checks (for example, when the Build workflow commits an updated `pnpm-lock.yaml` via `GITHUB_TOKEN`, which does not trigger new CI runs), the workflow exits early and requests manual CI triggering.
- If a required check fails or the workflow cannot complete the merge, it leaves a manual-resolution comment that mentions the repository owner.

---

## 🗂️ Project Structure

```text
orchestrate/
├── src/
│   ├── App.tsx                        # Root component & global state
│   ├── main.tsx                       # React entry point
│   ├── components/
│   │   ├── Layout.tsx                 # Sidebar navigation + header
│   │   ├── views/                     # One file per application view
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Schedule.tsx
│   │   │   ├── ScheduleTemplates.tsx
│   │   │   ├── Courses.tsx
│   │   │   ├── People.tsx
│   │   │   ├── Analytics.tsx
│   │   │   ├── TrainerAvailability.tsx
│   │   │   ├── BurnoutDashboard.tsx
│   │   │   ├── TrainerWellness.tsx
│   │   │   ├── CertificationDashboard.tsx
│   │   │   ├── Notifications.tsx
│   │   │   └── UserGuide.tsx
│   │   ├── AddPersonDialog.tsx        # Modal dialogs (co-located with components)
│   │   ├── EnrollStudentsDialog.tsx
│   │   ├── RecordScoreDialog.tsx
│   │   ├── … (other dialog components)
│   │   ├── charts/                    # D3 / Recharts visualisations
│   │   └── ui/                        # shadcn/ui component library
│   ├── hooks/                         # Custom React hooks
│   ├── lib/                           # Business logic, types, utilities
│   └── styles/
│       └── theme.css
├── index.html
├── package.json
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Framework | React 19, TypeScript 5.7 |
| Build Tool | Vite 8 with SWC |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| State / Storage | `@github/spark` KV store (useKV hook) |
| Charts | Recharts, D3.js |
| Forms | React Hook Form + Zod validation |
| Icons | Phosphor Icons, Lucide React |
| Notifications | Sonner (toast), Web Audio API, Browser Push API |
| Animation | Framer Motion |
| Date Handling | date-fns |

---

## 👥 User Roles

Orchestrate supports three role levels that control which navigation items and actions are visible:

| Role | Access |
| --- | --- |
| **Admin** | Full access to all views, including Certifications, Burnout Risk, Wellness & Recovery, People, Settings, and all scheduling tools |
| **Trainer** | Dashboard, Schedule, Schedule Templates, Trainer Availability, Courses, People, Analytics, Notifications |
| **Employee** | Dashboard, Schedule (read-only), Courses, Notifications |

---

## 🔔 Notifications

Orchestrate delivers alerts through three channels:

1. **In-app notification center** — persistent, filterable notification list
2. **Toast messages** — ephemeral pop-ups for high/critical-priority events
3. **Browser push notifications** — alerts that appear outside the tab (requires permission)

Sound alerts can be configured (type, volume) via the speaker icon in the header.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
