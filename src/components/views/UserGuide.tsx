import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  House,
  CalendarDots,
  Repeat,
  GraduationCap,
  Users,
  ChartBar,
  Calendar,
  Heart,
  Certificate,
  Bell,
  Gear,
  BookOpen,
  CaretRight,
} from '@phosphor-icons/react'

/** Describes a single section entry in the User Guide sidebar. */
interface Section {
  /** Unique identifier used to track the active section. */
  id: string
  /** Human-readable label shown in the sidebar navigation. */
  label: string
  /** Phosphor icon component rendered next to the label. */
  icon: React.ComponentType<{ size?: number; weight?: string }>
  /** User roles that this section is relevant to (e.g. `['admin', 'trainer']`). */
  roles: string[]
  /** JSX content rendered in the main panel when this section is active. */
  content: React.ReactNode
}

/**
 * Renders a row of role badges indicating which user roles a guide section applies to.
 * @param roles - Array of role strings to display as badges.
 */
function SectionBadge({ roles }: { roles: string[] }) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {roles.map(role => (
        <Badge
          key={role}
          data-testid={`role-badge-${role}`}
          variant={role === 'admin' ? 'default' : role === 'trainer' ? 'secondary' : 'outline'}
          className="text-xs capitalize"
        >
          {role}
        </Badge>
      ))}
    </div>
  )
}

/**
 * Renders a titled subsection within a guide page with a heading and styled body.
 * @param title - The subsection heading text.
 * @param children - Body content for the subsection.
 */
function GuideSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </div>
  )
}

/**
 * Renders an unordered list of guide bullet points.
 * @param items - Array of strings to display as list items.
 */
function GuideList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/**
 * Renders a single label–value pair used in guide reference tables.
 * @param label - The field label text.
 * @param value - The field value text.
 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-sm">
      <span className="font-medium text-foreground min-w-32">{label}:</span>
      <span className="text-muted-foreground">{value}</span>
    </div>
  )
}

const sections: Section[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: BookOpen,
    roles: ['admin', 'trainer', 'employee'],
    content: (
      <div className="space-y-6">
        <GuideSection title="What is TrainSync?">
          <p>
            TrainSync is a comprehensive corporate training management system. It allows
            organisations to schedule training sessions, manage trainer workloads, track
            employee certifications, and monitor trainer wellness — all from a single
            application.
          </p>
        </GuideSection>

        <GuideSection title="User Roles">
          <p>TrainSync has three role levels. Each role sees a tailored set of navigation items and actions:</p>
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-foreground">Role</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Capabilities</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="px-4 py-2 font-medium">Admin</td>
                  <td className="px-4 py-2">Full access to every view including Certifications, Burnout Risk, Wellness &amp; Recovery, Settings, and all scheduling tools</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Trainer</td>
                  <td className="px-4 py-2">Dashboard, Schedule, Schedule Templates, Trainer Availability, Courses, People, Analytics, Notifications</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 font-medium">Employee</td>
                  <td className="px-4 py-2">Dashboard, Schedule (read-only), Courses, Notifications</td>
                </tr>
              </tbody>
            </table>
          </div>
        </GuideSection>

        <GuideSection title="Navigation">
          <p>
            The sidebar on the left is your primary navigation. Click any item to switch to that
            view. The currently active view is highlighted with the primary colour. On smaller
            screens the sidebar collapses — tap the icon to expand it.
          </p>
        </GuideSection>

        <GuideSection title="Header Controls">
          <GuideList items={[
            'Speaker icon — opens Notification Sound Settings where you can choose a sound type, adjust volume, and enable/disable browser push notifications.',
            'Moon / Sun icon — toggles between dark and light theme. Your preference is saved automatically.',
          ]} />
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: House,
    roles: ['admin', 'trainer', 'employee'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Dashboard is your home screen. It gives you a quick, role-appropriate
            snapshot of everything that matters right now — without having to navigate away.
          </p>
        </GuideSection>

        <GuideSection title="Metric Cards">
          <p>Three summary cards appear at the top of the Dashboard:</p>
          <GuideList items={[
            'Active Courses — the number of training courses you are currently enrolled in or managing.',
            'Upcoming Sessions — the count of scheduled sessions that start in the future, with the date and time of the very next one.',
            'Notifications — unread notification count, with a direct link to the full Notifications view.',
          ]} />
        </GuideSection>

        <GuideSection title="Upcoming Sessions Panel">
          <p>
            Lists the next sessions in chronological order. Each row shows the session title,
            start time, location, and the number of enrolled participants. Click any row to
            jump to that session in the Schedule view.
          </p>
        </GuideSection>

        <GuideSection title="Recent Notifications Panel">
          <p>
            Displays the most recent notifications. Unread items are visually distinguished.
            You can mark items as read or dismiss them directly from the Dashboard without
            opening the full Notifications view.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: CalendarDots,
    roles: ['admin', 'trainer', 'employee'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Schedule is the central hub for all training session management. It lets you
            view, create, edit, and rearrange sessions using several different layouts so you
            can choose the view that best suits your planning style.
          </p>
        </GuideSection>

        <GuideSection title="View Modes">
          <p>Switch between views using the tab bar at the top:</p>
          <GuideList items={[
            'Calendar — a month-or-week grid with colour-coded session blocks. Hover over a block to see a summary; click it to open the details panel.',
            'Gantt — a timeline view showing sessions as horizontal bars across days. Drag a session bar left or right to reschedule it. Conflict detection runs automatically during the drag.',
            'List — a scrollable table of all sessions ordered by date. Useful for bulk review and quick editing.',
            'Kanban — sessions grouped into columns by status (Scheduled, In Progress, Completed, Cancelled). Drag cards between columns to update status.',
          ]} />
        </GuideSection>

        <GuideSection title="Creating a Session">
          <GuideList items={[
            'Click the + New Session button (admin/trainer only).',
            'Fill in the form: course, trainer, date/time, location, and capacity.',
            'Conflict detection will warn you immediately if the chosen trainer or room is already booked.',
            'Save to add the session to the schedule.',
          ]} />
        </GuideSection>

        <GuideSection title="Session Details Panel">
          <p>
            Clicking any session opens a side panel (Sheet) with full details. From here you can:
          </p>
          <GuideList items={[
            'Edit any session field inline.',
            'Enroll Students — opens a searchable dialog that shows all employees and highlights those with scheduling conflicts in red.',
            'Change session status.',
            'Delete the session (admin only).',
          ]} />
        </GuideSection>

        <GuideSection title="Conflict Detection">
          <p>
            The system automatically checks for conflicts whenever you:
          </p>
          <GuideList items={[
            'Drag a session to a new time slot — the move is blocked if a conflict exists.',
            'Enroll a student — students already booked in an overlapping session are highlighted and excluded from bulk enrollment.',
          ]} />
        </GuideSection>

        <GuideSection title="Filtering">
          <p>
            Use the filter bar to narrow sessions by department, trainer, date range, course, or
            status. Filters apply across all view modes.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'schedule-templates',
    label: 'Schedule Templates',
    icon: Repeat,
    roles: ['admin', 'trainer'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            Schedule Templates let you define a reusable pattern of training sessions and then
            generate many real sessions from it in one click. This is ideal for recurring
            programs such as weekly safety briefings or monthly compliance training.
          </p>
        </GuideSection>

        <GuideSection title="Creating a Template">
          <GuideList items={[
            'Click Create Template.',
            'Give the template a name and optional description.',
            'Select the associated course and a category tag.',
            'Choose a recurrence pattern: Daily, Weekly, Biweekly, Monthly, or Custom.',
            'Add one or more template sessions: set the day-of-week (or offset), start/end time, shift, location, and capacity.',
            'Optionally enable Auto-assign Trainer and Send Notifications to participants.',
            'Save the template.',
          ]} />
        </GuideSection>

        <GuideSection title="Applying a Template">
          <GuideList items={[
            'Select a template from the list.',
            'Click Apply Template.',
            'Choose a start date and the number of cycles to generate.',
            'Optionally override the location or capacity for this run.',
            'Preview the generated session list, then confirm.',
            'All sessions are created in the Schedule immediately.',
          ]} />
        </GuideSection>

        <GuideSection title="Managing Templates">
          <GuideList items={[
            'Edit — update any field; existing sessions generated from the template are not affected.',
            'Duplicate — create a copy of a template to use as a starting point for a similar program.',
            'Delete — removes the template only; generated sessions remain.',
            'Search and filter by category to find templates quickly.',
          ]} />
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'courses',
    label: 'Courses',
    icon: GraduationCap,
    roles: ['admin', 'trainer', 'employee'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Courses view is the content catalog for your training program. It stores all
            courses, their descriptions, enrollment counts, and completion rates.
          </p>
        </GuideSection>

        <GuideSection title="Course List">
          <p>
            Courses are displayed as cards or in a table (toggle the layout in the top-right
            corner). Each card shows:
          </p>
          <GuideList items={[
            'Course name and description.',
            'Category / department tag.',
            'Total enrollment and completion percentage.',
            'Required certifications for trainers.',
            'Status badge (Active / Draft / Archived).',
          ]} />
        </GuideSection>

        <GuideSection title="Creating a Course (Admin)">
          <GuideList items={[
            'Click New Course.',
            'Enter a name, description, category, and estimated duration.',
            'Add any required trainer certifications.',
            'Set the maximum capacity per session.',
            'Save as Draft to keep it hidden, or Publish to make it available for scheduling.',
          ]} />
        </GuideSection>

        <GuideSection title="Viewing Course Details">
          <p>
            Click a course to open its detail view, which includes a roster of enrolled
            employees, session history, and completion statistics.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'people',
    label: 'People',
    icon: Users,
    roles: ['admin', 'trainer'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The People view is the employee and trainer directory. Use it to manage profiles,
            view training histories, and assign or revoke certifications.
          </p>
        </GuideSection>

        <GuideSection title="Employee List">
          <p>
            All users are listed in a searchable, sortable table. Filter by role
            (Admin / Trainer / Employee) or department using the controls at the top.
          </p>
        </GuideSection>

        <GuideSection title="Trainer Profile">
          <p>
            Clicking a trainer opens their full profile, which includes:
          </p>
          <GuideList items={[
            'Contact information and department.',
            'Current certifications with expiry dates and renewal status.',
            'Shift preferences and maximum weekly hours.',
            'Utilization rate and current workload.',
            'Training history — all sessions they have led or participated in.',
            'Wellness check-in history and current wellness score.',
            'Active recovery plans.',
          ]} />
        </GuideSection>

        <GuideSection title="Adding a Person (Admin)">
          <GuideList items={[
            'Click Add Person.',
            'Enter name, email, role, department, and hire date.',
            'For trainers, you can immediately add certifications from the same dialog.',
            'Save — the new user appears in the list immediately.',
          ]} />
        </GuideSection>

        <GuideSection title="Managing Certifications">
          <p>
            From a trainer's profile, click Manage Certifications to:
          </p>
          <GuideList items={[
            'Add a new certification with issued date, expiry date, and optional notes.',
            'Update the renewal status of an existing certification.',
            'Remove a certification record.',
          ]} />
        </GuideSection>

        <GuideSection title="Deleting a Person (Admin)">
          <p>
            Click the Delete icon on a profile row. The user is removed from all active sessions
            and future enrollments. Historical session data is preserved for reporting purposes.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: ChartBar,
    roles: ['admin', 'trainer'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Analytics view provides data-driven insights into your training program's
            performance. It aggregates session, enrollment, and utilization data into
            interactive charts and summary metrics.
          </p>
        </GuideSection>

        <GuideSection title="Available Metrics">
          <GuideList items={[
            'Completion Rate — percentage of enrolled employees who have completed each course.',
            'Attendance Rate — percentage of scheduled seats that were filled.',
            'Session Volume — number of sessions run over a selected date range.',
            'Trainer Utilization — average utilization across all trainers.',
            'Top Courses — most-enrolled courses ranked by participation.',
            'Department Breakdown — training activity segmented by department.',
          ]} />
        </GuideSection>

        <GuideSection title="Filtering and Date Ranges">
          <p>
            Use the filter controls to narrow the data by date range, department, course, or
            trainer. All charts update in real time when filters change.
          </p>
        </GuideSection>

        <GuideSection title="Chart Types">
          <GuideList items={[
            'Line charts — trend data over time (completion rates, session volume).',
            'Bar charts — comparative data (department breakdowns, course popularity).',
            'Donut / pie charts — proportional breakdowns (enrollment by status).',
            'Utilization gauge — current trainer capacity at a glance.',
          ]} />
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'trainer-availability',
    label: 'Trainer Availability',
    icon: Calendar,
    roles: ['admin', 'trainer'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            This view helps you understand how busy each trainer is and identify imbalances
            before they cause burnout. It shows real-time utilization data and gives
            actionable recommendations for redistributing workload.
          </p>
        </GuideSection>

        <GuideSection title="Availability Tab">
          <p>
            Displays a heatmap-style calendar for each trainer showing when they are available,
            booked, or at capacity. Use this to quickly identify free slots when scheduling new
            sessions.
          </p>
        </GuideSection>

        <GuideSection title="Workload Balance Tab">
          <p>
            Shows each trainer's utilization rate as a percentage of their maximum capacity.
            The overall balance score (0–100) reflects how evenly workload is distributed
            across the team.
          </p>
          <GuideList items={[
            'Below 60 % — Underutilized (shown in green).',
            '60–84 % — Healthy utilization (shown in blue).',
            '85–94 % — Overutilized — a warning notification is automatically sent to the trainer and all admins.',
            '95–100 % — Critical — an urgent toast alert is generated immediately.',
          ]} />
        </GuideSection>

        <GuideSection title="Workload Recommendations">
          <p>
            Click the Recommendations button for an AI-generated list of suggested workload
            redistributions. Each recommendation names a specific trainer who could absorb
            sessions from an overloaded colleague, along with the sessions that could be
            transferred.
          </p>
        </GuideSection>

        <GuideSection title="Coverage Heatmap">
          <p>
            The Coverage Heatmap tab visualises trainer coverage across shifts and days of
            the week. Darker cells indicate higher coverage; white cells indicate gaps that
            may need to be addressed by scheduling additional sessions or trainers.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'burnout-dashboard',
    label: 'Burnout Risk',
    icon: Heart,
    roles: ['admin'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Burnout Risk Dashboard gives admins an at-a-glance view of trainer burnout
            risk across the organisation. It aggregates utilization, wellness check-in scores,
            and historical trends into a single composite risk score for each trainer.
          </p>
        </GuideSection>

        <GuideSection title="Risk Score">
          <p>
            Each trainer receives a burnout risk score from 0 (low risk) to 100 (critical risk).
            The score is calculated from:
          </p>
          <GuideList items={[
            'Current utilization rate.',
            'Trend direction (is utilization rising or falling?).',
            'Wellness check-in scores (mood, stress, energy, sleep quality).',
            'Number of consecutive high-stress weeks.',
          ]} />
        </GuideSection>

        <GuideSection title="Risk Gauge">
          <p>
            A gauge chart for each trainer visually communicates their risk level:
          </p>
          <GuideList items={[
            'Green zone (0–33) — Low risk.',
            'Yellow zone (34–66) — Moderate risk — monitor closely.',
            'Red zone (67–100) — High / Critical risk — intervention recommended.',
          ]} />
        </GuideSection>

        <GuideSection title="Risk Trend Chart">
          <p>
            The trend chart shows how a trainer's risk score has changed over recent weeks.
            Use this to distinguish between an improving situation (score falling) and a
            worsening one (score rising), and to assess whether an intervention is working.
          </p>
        </GuideSection>

        <GuideSection title="Taking Action">
          <p>
            From the Burnout Risk Dashboard you can navigate directly to:
          </p>
          <GuideList items={[
            'Trainer Availability — to redistribute workload.',
            'Wellness & Recovery — to initiate a check-in or create a recovery plan.',
          ]} />
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'trainer-wellness',
    label: 'Wellness & Recovery',
    icon: Heart,
    roles: ['admin'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Wellness &amp; Recovery view lets admins conduct structured wellness check-ins
            with trainers and create formal recovery plans for those showing signs of burnout
            or sustained high stress.
          </p>
        </GuideSection>

        <GuideSection title="Wellness Check-Ins">
          <p>
            A check-in is a structured assessment covering eight dimensions of trainer wellbeing:
          </p>
          <GuideList items={[
            'Mood (1–5 scale).',
            'Stress level (Low / Moderate / High / Critical).',
            'Energy level (Low / Moderate / High).',
            'Workload satisfaction.',
            'Sleep quality.',
            'Physical wellbeing.',
            'Mental clarity.',
            'Specific concerns (selected from a common list or entered free-form).',
          ]} />
          <p className="pt-1">
            After submission the system calculates a wellness score (0–100). Scores below 50,
            or critical stress combined with high utilization, automatically trigger a recovery
            plan recommendation.
          </p>
        </GuideSection>

        <GuideSection title="Wellness Score Thresholds">
          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium text-foreground">Score Range</th>
                  <th className="text-left px-4 py-2 font-medium text-foreground">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  ['> 85', 'Excellent'],
                  ['70 – 85', 'Good'],
                  ['55 – 70', 'Fair'],
                  ['40 – 55', 'Poor'],
                  ['< 40', 'Critical'],
                ].map(([range, status]) => (
                  <tr key={range}>
                    <td className="px-4 py-2">{range}</td>
                    <td className="px-4 py-2">{status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GuideSection>

        <GuideSection title="Recovery Plans">
          <p>
            A recovery plan is a time-bound intervention document. To create one:
          </p>
          <GuideList items={[
            'Select the trainer and click Create Recovery Plan.',
            'The system pre-fills the trigger reason from the latest check-in.',
            'Set a target utilization percentage (default 70 %).',
            'Set a duration (default 4 weeks).',
            'Add recovery actions — e.g., workload reduction, paid time off, support sessions, or training resources — each with a description and a target completion date.',
            'Add plan notes for context.',
            'Submit — the plan is created with Active status.',
          ]} />
          <p className="pt-1">
            Progress is calculated automatically based on completed actions and how closely
            utilization tracks toward the target. A plan is marked Completed when the target
            utilization is reached and all actions are done.
          </p>
        </GuideSection>

        <GuideSection title="Check-In History &amp; Trends">
          <p>
            The check-in history panel shows a timeline of past check-ins with wellness
            scores plotted as a trend chart. Use this to evaluate whether interventions
            are improving trainer wellbeing over time.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'certifications',
    label: 'Certifications',
    icon: Certificate,
    roles: ['admin'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Certifications Dashboard gives admins full visibility into the certification
            status of every trainer and ensures that renewals never slip through the cracks.
          </p>
        </GuideSection>

        <GuideSection title="Certification Status Indicators">
          <GuideList items={[
            'Active (green) — certification is current with no expiry concerns.',
            'Expiring Soon (amber) — certification expires within 90 days.',
            'Expired (red) — certification has passed its expiry date.',
          ]} />
        </GuideSection>

        <GuideSection title="Automated Renewal Reminders">
          <p>
            The system automatically generates notifications to the trainer and all admins
            at the following intervals before expiry:
          </p>
          <GuideList items={[
            '90 days — early heads-up.',
            '60 days — reminder.',
            '30 days — action required.',
            '14 days — urgent.',
            '7 days — critical / final warning.',
          ]} />
        </GuideSection>

        <GuideSection title="Adding a Certification">
          <GuideList items={[
            "Click Add Certification or open the trainer's profile and click Manage Certifications.",
            'Enter the certification name, issuing body, issued date, and expiry date.',
            'Optionally add renewal notes.',
            'Save — reminders are scheduled automatically.',
          ]} />
        </GuideSection>

        <GuideSection title="Compliance Overview">
          <p>
            The top of the Certifications view shows aggregate compliance metrics: total
            active certifications, percentage of trainers fully compliant, and the number
            of certifications expiring within the next 30 days.
          </p>
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    roles: ['admin', 'trainer', 'employee'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Notifications view is your persistent inbox for all system events. Unlike
            toast messages, notifications here are stored and remain visible until you
            dismiss them.
          </p>
        </GuideSection>

        <GuideSection title="Notification Types">
          <GuideList items={[
            'Session — upcoming session reminders and schedule changes.',
            'Workload — utilization threshold warnings (85 % and 95 %) sent to both the affected trainer and admins.',
            'Certification — renewal reminders at 90 / 60 / 30 / 14 / 7 days before expiry.',
            'Wellness — check-in reminders and recovery plan updates.',
            'System — general administrative messages.',
          ]} />
        </GuideSection>

        <GuideSection title="Priority Levels">
          <GuideList items={[
            'Low — informational; no sound alert by default.',
            'Medium — standard; plays the configured notification sound.',
            'High — important; plays an elevated sound; triggers a toast pop-up.',
            'Critical — urgent; triggers a toast pop-up with an alarm sound.',
          ]} />
        </GuideSection>

        <GuideSection title="Managing Notifications">
          <GuideList items={[
            'Mark as Read / Unread — toggle read status on individual notifications.',
            'Mark All as Read — one click to clear the unread count.',
            'Dismiss — permanently removes a single notification.',
            'Dismiss All — clears all notifications (or only the read ones).',
            'Filter by type or priority using the controls at the top of the list.',
          ]} />
        </GuideSection>

        <GuideSection title="Sound Alerts">
          <p>
            Click the speaker icon in the header to open Notification Sound Settings:
          </p>
          <GuideList items={[
            'Sound Type — choose from Default, Chime, Bell, or Alert.',
            'Volume — slide to your preferred level and test immediately.',
            'Per-priority toggles — enable or disable sounds for each priority level independently.',
            'Browser push notifications — grant permission once and receive alerts even when TrainSync is not in focus.',
          ]} />
        </GuideSection>
      </div>
    ),
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Gear,
    roles: ['admin'],
    content: (
      <div className="space-y-6">
        <GuideSection title="Purpose">
          <p>
            The Settings view (admin only) is a placeholder for organisation-wide
            configuration options. Additional settings will be available here in future
            releases.
          </p>
        </GuideSection>

        <GuideSection title="Theme Toggle">
          <p>
            The dark/light theme toggle is available to all users via the Moon / Sun icon
            in the top-right header. The selected theme is persisted across sessions.
          </p>
        </GuideSection>

        <GuideSection title="Notification Sound Settings">
          <p>
            Sound and push-notification preferences are accessible to all users via the
            speaker icon in the top-right header. See the Notifications section of this
            guide for full details.
          </p>
        </GuideSection>
      </div>
    ),
  },
]

/**
 * Renders the full-page User Guide for TrainSync.
 *
 * Provides a sidebar-navigated reference covering every major feature of the application,
 * organised into role-tagged sections (Overview, Schedule, Templates, People, Reports,
 * Trainer Availability, Wellness, Courses, Notifications, Settings, and Glossary).
 */
export function UserGuide() {
  const [activeSection, setActiveSection] = useState('overview')

  const current = sections.find(s => s.id === activeSection) ?? sections[0]

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-foreground">User Guide</h1>
        <p className="text-muted-foreground mt-1">
          A complete reference for every feature in TrainSync
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar TOC */}
        <aside className="w-56 shrink-0">
          <Card>
            <CardContent className="p-2 space-y-0.5">
              {sections.map(section => {
                const Icon = section.icon
                const isActive = section.id === activeSection
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-left transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground font-medium'
                        : 'text-foreground hover:bg-secondary'
                    )}
                  >
                    <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                    <span className="flex-1 truncate">{section.label}</span>
                    {isActive && <CaretRight size={12} weight="bold" />}
                  </button>
                )
              })}
            </CardContent>
          </Card>
        </aside>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <current.icon size={22} weight="fill" className="text-primary" />
                  </div>
                  <CardTitle className="text-xl">{current.label}</CardTitle>
                </div>
                <SectionBadge roles={current.roles} />
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {current.content}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
