# TrainSync — Corporate Training Management System

**TrainSync** (project codename: *orchestrate*) is an enterprise-grade web application for managing, scheduling, and tracking corporate training programs. It gives training administrators, trainers, and employees a single place to coordinate sessions, monitor trainer wellness, track certifications, and gain data-driven insights into training effectiveness.

---

## ✨ Features

| Feature | Description |
|---|---|
| **Dashboard** | Role-specific home screen with key metrics, upcoming sessions, and live notifications |
| **Multi-View Scheduling** | Calendar, Gantt, list, and Kanban views with drag-and-drop rescheduling and conflict detection |
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

- **Node.js** ≥ 18
- **npm** ≥ 9

### Installation

```bash
# Clone the repository (repository name: orchestrate, application name: TrainSync)
git clone https://github.com/TheOneHyer/orchestrate.git
cd orchestrate

# Install dependencies
npm install
```

### Running the App

```bash
# Start the Vite development server (http://localhost:5173)
npm run dev
```

### Production Build

```bash
npm run build       # Type-check and bundle
npm run preview     # Preview the production build locally
```

### Running Unit Tests

```bash
npm run test                # Run the unit test suite once
npm run test:watch          # Run Vitest in watch mode
npm run test:coverage       # Generate a coverage report
```

The initial test rollout focuses on core business logic in `src/lib/burnout-analytics.ts`, `src/lib/workload-balancer.ts`, `src/lib/scheduler.ts`, and `src/lib/conflict-detection.ts`.

### Other Scripts

```bash
npm run lint        # Run ESLint
npm run optimize    # Optimise the Vite bundle
npm run kill        # Free port 5000 (fuser -k 5000/tcp)
```

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
│   │   ├── Dialogs/                   # Modal dialogs
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
|---|---|
| Framework | React 19, TypeScript 5.7 |
| Build Tool | Vite 7 with SWC |
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

TrainSync supports three role levels that control which navigation items and actions are visible:

| Role | Access |
|---|---|
| **Admin** | Full access to all views, including Certifications, Burnout Risk, Wellness & Recovery, People, Settings, and all scheduling tools |
| **Trainer** | Dashboard, Schedule, Schedule Templates, Trainer Availability, Courses, People, Analytics, Notifications |
| **Employee** | Dashboard, Schedule (read-only), Courses, Notifications |

---

## 🔔 Notifications

TrainSync delivers alerts through three channels:

1. **In-app notification center** — persistent, filterable notification list
2. **Toast messages** — ephemeral pop-ups for high/critical-priority events
3. **Browser push notifications** — alerts that appear outside the tab (requires permission)

Sound alerts can be configured (type, volume) via the speaker icon in the header.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
