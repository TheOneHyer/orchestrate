# Corporate Training Management System

A comprehensive web application for tracking, scheduling, and planning teaching sessions for corporations, enabling efficient management of employee training across multiple shifts and departments.

**Experience Qualities**:

1. **Professional** - Instills confidence through clean material design, clear information hierarchy, and attention to data security
2. **Efficient** - Streamlines complex scheduling workflows through smart automation and intuitive multi-view interfaces
3. **Connected** - Creates seamless navigation between related data with contextual panels, cross-references, and real-time updates

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is an enterprise-grade learning management and scheduling system that coordinates multiple user roles, complex scheduling algorithms, content management, progress tracking, and permission systems across an organization.

## Essential Features

### Dashboard & Home

- **Functionality**: Central hub displaying notifications, upcoming sessions, tasks, reminders, and key metrics
- **Purpose**: Provides role-appropriate overview and quick access to urgent items
- **Trigger**: Application launch or home navigation
- **Progression**: Login → Role-based dashboard loads → View notifications/tasks → Click item → Navigate to detail
- **Success criteria**: Users can identify urgent items within 3 seconds, all notifications are actionable

### Multi-View Scheduling System

- **Functionality**: Display training sessions in calendar, Gantt chart, list, and kanban board views with filtering
- **Purpose**: Accommodates different planning preferences and use cases (day planning vs. project timeline)
- **Trigger**: Navigate to Schedule section, switch view toggle
- **Progression**: Select schedule view → Apply filters (department/trainer/date) → Click session → Side panel opens → Edit or view full details
- **Success criteria**: View switches in <300ms, side panel loads session data, changes persist

### Learning Content Builder

- **Functionality**: Create modular learning content with videos, slideshows, quizzes, interactive elements
- **Purpose**: Enables trainers to build reusable curriculum that can be combined into courses
- **Trigger**: Create Course or Create Module button
- **Progression**: Click create → Select content types → Add/arrange modules → Configure quiz questions → Preview → Publish
- **Success criteria**: Modules can be reused across courses, all content types render properly, quiz scores calculate

### Conflict Detection & Prevention

- **Functionality**: Comprehensive conflict detection system that prevents double-booking of trainers, rooms, and students. Automatically checks for scheduling conflicts during drag-and-drop session rescheduling and student enrollment operations.
- **Purpose**: Ensures scheduling integrity by preventing overlapping sessions for any resource (trainers, rooms, students), maintaining data quality and preventing operational chaos from double-bookings
- **Trigger**: Automatically when dragging sessions to new time slots, or when enrolling students in sessions through the enrollment dialog
- **Progression**:
  - **Drag-and-drop**: User drags session → Real-time conflict check on hover → Visual warning if conflicts detected → Drop prevented if conflicts exist → Toast error message with conflict details if attempted
  - **Student enrollment**: User opens enrollment dialog → Selects students → Real-time conflict check → Students with conflicts highlighted in red with conflicting session name → Option to enroll only non-conflicting students → Confirmation with count of successfully enrolled students
- **Success criteria**: No trainer, room, or student can be double-booked, conflicts display clear messages indicating the conflicting resource and session, partial enrollment succeeds for non-conflicting students, drag-and-drop blocks moves that would create conflicts

### Student Enrollment Management

- **Functionality**: Add students to training sessions with intelligent conflict detection, search/filter capabilities, bulk selection, capacity management, and real-time validation
- **Purpose**: Streamlines student enrollment while preventing scheduling conflicts and capacity overruns, provides clear feedback on enrollment status and conflicts
- **Trigger**: Click "Enroll Students" button from session details panel in Schedule view
- **Progression**: Click Enroll Students → Dialog opens with searchable student list → Search by name/email/department → Select students (individual or bulk) → Real-time conflict detection highlights students already enrolled in overlapping sessions → Shows capacity remaining → Displays warning if capacity exceeded → Shows conflict summary with affected students and conflicting sessions → Click Enroll → System enrolls only non-conflicting students within capacity → Success toast with enrollment count → Updated session enrollment count visible
- **Success criteria**: Students can be searched and selected efficiently, conflicts detected before enrollment, clear visual indicators for conflicts (red highlight, warning icon, conflicting session name), capacity limits enforced, partial enrollment succeeds for eligible students, enrolled count updates immediately
- **Functionality**: Automatically match trainers to sessions based on shift alignment, certifications, and availability
- **Purpose**: Solves the complex problem of 24/7 scheduling across multiple shifts
- **Trigger**: "Auto-assign trainer" or "Create recurring sessions"
- **Progression**: Define session parameters (role, shifts, dates) → Algorithm finds certified trainers → Review matches with compatibility scores → Confirm assignments → Notifications sent
- **Success criteria**: Algorithm considers shift overlap, finds all eligible trainers, handles conflicts, provides ranked suggestions with reasoning

### Student Roster & Attendance

- **Functionality**: Add employees to courses via search, badge scan simulation, or bulk upload
- **Purpose**: Manages enrollment and tracks attendance
- **Trigger**: Open course → Manage students → Add student action
- **Progression**: Search employee or scan badge → Select from results → Add to course → Confirmation → Student receives notification
- **Success criteria**: Students added appear in roster immediately, duplicate prevention works

### Training Profiles

- **Functionality**: Comprehensive employee training history, certifications, progress, and upcoming sessions
- **Purpose**: Central record for compliance and development tracking
- **Trigger**: Click employee name or navigate to People section
- **Progression**: Search/select employee → Profile loads → View training history/progress → Click course → Navigate to course details
- **Success criteria**: All enrollments visible, progress accurate, historical data preserved

### Analytics Dashboard

- **Functionality**: Visual metrics including completion rates, scores, attendance, and trending data
- **Purpose**: Provides insights for training effectiveness and compliance monitoring
- **Trigger**: Navigate to Analytics or view course statistics
- **Progression**: Select date range/filters → Charts update → Drill into specific metric → View detailed breakdown
- **Success criteria**: Charts render performance data, filters work, exportable reports

### Permission & Role Management

- **Functionality**: Three-tier access control (Admin, Trainer, Employee) with role-specific features
- **Purpose**: Ensures data security and appropriate access to sensitive PII
- **Trigger**: User login or role assignment
- **Progression**: Login → Role identified → UI adapts → Restricted actions hidden/disabled → Unauthorized access blocked
- **Success criteria**: Employees cannot access admin functions, trainers see only assigned courses

### Notification System

- **Functionality**: Send alerts for upcoming sessions, assignments, completions, administrative messages, and workload warnings with sound alerts and browser push notifications
- **Purpose**: Keeps all users informed of relevant updates, deadlines, and critical workload issues through multiple notification channels
- **Trigger**: System event, manual send from admin, automatic workload threshold detection, or browser push when app is not in focus
- **Progression**: Event occurs → Notification generated → Appears in dashboard → Sound alert plays (configurable) → Browser push notification sent (if enabled and permissions granted) → Toast notification for critical alerts → User clicks → Navigate to source
- **Success criteria**: Notifications appear in real-time, dismissible, linked to source content, critical workload alerts trigger toast notifications, sound alerts play at appropriate volume and can be configured, browser push notifications work when app is not in focus, settings persist across sessions

### Trainer Workload Balancing

- **Functionality**: Analyze trainer utilization rates, generate intelligent recommendations for redistributing workload, and automatically notify trainers and admins when utilization thresholds are exceeded
- **Purpose**: Prevents trainer burnout, optimizes capacity utilization, ensures balanced distribution of training sessions, and provides proactive alerts for intervention
- **Trigger**: Navigate to Trainer Availability → Workload Balance tab, or automatic detection when trainer reaches 85% (overutilized) or 95% (critically overutilized) capacity
- **Progression**: System monitors utilization → Threshold exceeded → Notifications sent to trainer and admin → View balance score → Review overutilized/underutilized trainers → Read AI recommendations → Click trainer name → View redistribution opportunities → Apply suggestions → Workload normalized notification sent
- **Success criteria**: Balance score calculation accurate, recommendations identify compatible trainers for redistribution, clear action steps provided, automatic notifications trigger at correct thresholds (85% and 95%), toast alerts appear for critical cases, resolved notifications sent when balance returns to normal

### Trainer Wellness Check-Ins

- **Functionality**: Structured wellness assessments capturing mood, stress, energy, workload satisfaction, sleep quality, physical wellbeing, mental clarity, and specific concerns. Tracks check-in history with analytics and trending data.
- **Purpose**: Proactively monitor trainer wellbeing, identify early signs of burnout before they become critical, create documentation for intervention decisions, and establish wellbeing trends over time
- **Trigger**: Admin initiates check-in for a trainer from Wellness & Recovery view, or scheduled periodic check-ins (weekly/monthly based on risk level)
- **Progression**: Admin selects trainer → Opens check-in dialog → Trainer completes assessment (mood 1-5 scale, stress level, energy level, satisfaction ratings) → Selects applicable concerns from common list → Adds optional comments → Flags for follow-up if needed → Submit → System calculates wellness score (0-100) → Triggers recovery plan recommendation if thresholds exceeded → Stores in history with timestamp and utilization snapshot
- **Success criteria**: Check-ins capture comprehensive wellness data, wellness score accurately reflects overall status (excellent >85, good 70-85, fair 55-70, poor 40-55, critical <40), trending shows wellness changes over time, automatic recovery plan recommendations when score < 50 or stress critical/high combined with high utilization, follow-up flags tracked until completed

### Certification Tracking & Renewal Management

- **Functionality**: Track trainer certification expiration dates, automatically generate renewal reminders at configurable intervals, display certification status dashboards with compliance metrics, and manage certification records with issued/expiration dates, renewal progress, and notes
- **Purpose**: Ensure regulatory compliance, prevent expired certifications from causing scheduling conflicts, maintain training quality standards, and provide proactive alerts to trainers and administrators for timely renewal actions
- **Trigger**: Automatic daily checks trigger renewal reminder notifications when certifications approach expiration (90, 60, 30, 14, and 7 days), admin navigates to Certifications dashboard, or trainer profile viewed showing certification status
- **Progression**: System monitors certification expiration dates → Sends escalating notifications to trainer and admin at preset intervals → Displays certification dashboard with color-coded status indicators (active/expiring-soon/expired) → Admin clicks certification entry → Navigate to trainer profile → Click "Manage Certifications" → Add/edit certification with name, issued date, expiration date, renewal status, and notes → System automatically updates status and schedules next reminder → Critical/expired certifications prominently displayed with urgent visual indicators
- **Success criteria**: Notifications sent at correct intervals (90/60/30/14/7 days before expiration), certification status accurately reflects expiration timeline, compliance rate calculated correctly, expired certifications clearly flagged as critical alerts, certification records persist and update reminder counts, admin can view all certification statuses at a glance, trainers receive timely renewal reminders

### Burnout Recovery Plans

- **Functionality**: Structured intervention plans with specific recovery actions (workload reduction, time off, schedule adjustments, support sessions, training resources), target utilization goals, completion timelines, progress tracking, and action completion monitoring
- **Purpose**: Provide systematic approach to trainer recovery, ensure accountability for wellness interventions, track recovery progress objectively, document interventions for compliance and effectiveness analysis
- **Trigger**: Admin creates recovery plan from Wellness & Recovery view, triggered by low wellness scores, sustained high stress, follow-up requests, or manual intervention decision
- **Progression**: Admin selects trainer → Opens recovery plan dialog → System pre-fills trigger reason from latest check-in data → Admin sets target utilization (default 70%) → Sets duration (default 4 weeks) → System suggests initial actions based on wellness data (e.g., workload reduction if >85% utilized, time off if critical stress, support session if follow-up flagged) → Admin adds/customizes recovery actions with descriptions and target dates → Adds plan notes → Submit → Plan created with "active" status → Actions tracked → Progress calculated based on action completion and utilization improvement → Plan marked "completed" when target utilization reached and all actions done
- **Success criteria**: Recovery plans provide clear structured interventions, actions align with identified wellness issues, progress tracking shows measurable improvement, utilization trends down toward target, multiple check-ins during recovery period show wellness score improvement, plans can be reviewed for compliance and effectiveness analysis

### Notification Sound Alerts & Browser Push Notifications

- **Functionality**: Configurable sound alerts using Web Audio API and browser push notifications that alert users even when the application is not in focus. Includes four sound types (default, chime, bell, alert), adjustable volume, priority-based sound variations, and granular control over which notification priorities trigger browser push notifications
- **Purpose**: Provides immediate, multi-sensory feedback for important system events, ensures users never miss critical notifications even when working in other tabs or applications, supports different user preferences for notification delivery
- **Trigger**: Any notification event (workload alerts, certification reminders, wellness check-ins, etc.) automatically triggers configured sound and push notifications based on priority level and user settings
- **Progression**: Notification created → Sound alert plays based on priority (low/medium/high/critical) with distinct audio patterns → Browser push notification sent if enabled and permissions granted → User clicks push notification → App focuses and navigates to relevant view → Settings accessible via speaker icon in header → Permission requested for browser notifications → Test sounds and notifications available → Settings persist via useKV
- **Success criteria**: Sound alerts play without delay, volume and type preferences persist, different priorities have distinct sounds, push notifications appear outside the app, clicking push notifications navigates to correct view, permission flow is clear and non-intrusive, test functionality allows users to preview settings before committing
- **Functionality**: Create, save, and apply reusable schedule templates for recurring training programs. Define session patterns (daily, weekly, biweekly, monthly, custom), session times, shifts, locations, capacity, and required certifications. Apply templates to generate multiple sessions at once with configurable start dates and cycle counts.
- **Purpose**: Streamline creation of recurring training schedules, ensure consistency across training programs, save time for admins when setting up regular training cycles, enable standardization of common training patterns
- **Trigger**: Navigate to Schedule Templates → Create Template button, or from Schedule view → Apply Template
- **Progression**: Click create template → Name and describe template → Select course and category → Define recurrence pattern (weekly, monthly, etc.) → Add template sessions with days, times, durations, shifts, capacity → Set auto-assign trainers and notification preferences → Add tags for organization → Save template → Browse templates by search or category filter → Select template → Apply Template → Choose start date and number of cycles → Override location or capacity if needed → Preview generated sessions → Confirm → Sessions created in schedule
- **Success criteria**: Templates save all session configurations correctly, recurrence patterns generate sessions on correct dates and times, sessions inherit all template properties (shift, capacity, location), templates can be edited/duplicated/deleted, usage tracking shows template popularity, applying template creates all sessions with proper spacing based on recurrence type, auto-assign trainer option works when enabled, notifications sent to participants if enabled

## Edge Case Handling

- **No available trainers**: Display warning with conflicting constraints, suggest alternative times/dates
- **Overlapping sessions**: Prevent double-booking, show conflict warning before save
- **Employee termination**: Archive training records, remove from active courses, preserve historical data
- **Shift changes**: Update algorithm parameters, re-evaluate existing assignments with warnings
- **Incomplete content**: Prevent course publishing until all modules complete, show validation errors
- **Concurrent edits**: Last-write-wins with timestamp warning if data changed
- **Missing certifications**: Show trainer suggestions with required certification list, training paths
- **Badge scan failures**: Fallback to manual search, log scan attempts for debugging
- **Empty states**: Provide helpful onboarding flows with sample data and clear CTAs
- **Trainer capacity exceeded**: Automatic notifications sent to trainer and admin when utilization reaches 85% (warning) or 95% (critical), prevent new assignments if at 100% capacity
- **Rapid workload changes**: Debounce notification generation to prevent spam, track historical utilization states to avoid duplicate alerts
- **Admin user notifications**: Special handling for admin userId to ensure all administrators receive system-wide alerts

## Design Direction

The design should evoke professionalism, trust, and efficiency - characteristics essential for enterprise training software handling sensitive employee data. The interface should feel modern and approachable while maintaining corporate polish. Material design principles create familiarity and consistency, with depth through subtle shadows and elevation. The color scheme balances corporate blue (trust, stability) with energetic orange (engagement, learning) while maintaining excellent readability for extended use.

## Color Selection

The palette combines corporate professionalism with learning energy, using blue as the dominant brand color with orange accents for calls-to-action and important notifications.

- **Primary Color**: Deep Blue `oklch(0.45 0.15 250)` - Conveys trust, professionalism, and stability expected in corporate training systems
- **Secondary Colors**:
  - Light Blue `oklch(0.92 0.02 250)` for backgrounds and subtle UI elements
  - Slate `oklch(0.35 0.01 250)` for secondary text and borders
- **Accent Color**: Vibrant Orange `oklch(0.68 0.18 45)` - Energizes CTAs, highlights notifications, represents learning engagement
- **Foreground/Background Pairings**:
  - Primary Blue (oklch(0.45 0.15 250)): White text (oklch(0.99 0 0)) - Ratio 8.2:1 ✓
  - Accent Orange (oklch(0.68 0.18 45)): White text (oklch(0.99 0 0)) - Ratio 5.1:1 ✓
  - Background White (oklch(0.99 0 0)): Slate text (oklch(0.35 0.01 250)) - Ratio 10.5:1 ✓
  - Card Light Blue (oklch(0.92 0.02 250)): Slate text (oklch(0.35 0.01 250)) - Ratio 9.1:1 ✓

## Font Selection

Typography should balance professional credibility with modern approachability, using a geometric sans-serif that excels at both display sizes and dense data tables.

- **Primary Font**: Work Sans - A geometric humanist sans-serif that conveys professionalism while remaining highly readable in tables and dashboards
- **Typographic Hierarchy**:
  - H1 (Page Titles): Work Sans SemiBold / 32px / -0.02em letter spacing / 1.2 line height
  - H2 (Section Headers): Work Sans SemiBold / 24px / -0.01em letter spacing / 1.3 line height
  - H3 (Card Titles): Work Sans Medium / 18px / normal letter spacing / 1.4 line height
  - Body (Content): Work Sans Regular / 15px / normal letter spacing / 1.6 line height
  - Small (Metadata): Work Sans Regular / 13px / normal letter spacing / 1.5 line height
  - Button Text: Work Sans Medium / 14px / normal letter spacing

## Animations

Animations should feel responsive and purposeful, reinforcing the connected nature of the application. Use motion to guide attention during state changes, provide feedback for user actions, and maintain spatial relationships during navigation. Material design motion curves (ease-out for entering, ease-in for exiting) create natural, physics-based movement. Key moments: side panels slide from edge with content fading in (300ms), calendar events scale slightly on hover (150ms), notification badges pulse subtly when new items arrive (500ms), view transitions cross-fade (250ms), loading states use skeleton screens rather than spinners.

## Component Selection

- **Components**:
  - Calendar: Custom D3-based calendar with event blocks (shadcn calendar too limited)
  - Gantt Chart: Custom D3 timeline with draggable sessions
  - Kanban Board: Custom drag-drop using framer-motion with Card components
  - Side Panel: Sheet component for contextual editing
  - Forms: Form, Input, Select, Textarea, Checkbox, Switch components
  - Data Tables: Table component with sorting, filtering, pagination
  - Dashboard Cards: Card component with custom chart integration
  - Navigation: Sidebar component for main nav with collapsible sections
  - Modals: Dialog component for confirmations and complex forms
  - Notifications: Toast (sonner) for system messages, custom notification panel for persistent items
  - Progress: Progress component for course completion
  - Tabs: Tabs component for view switching (calendar/gantt/list/board)
  - Badges: Badge component for status indicators and counts
  - Avatars: Avatar component for user representations
  - Buttons: Button component with primary (blue), secondary (outline), and destructive variants

- **Customizations**:
  - Multi-select employee picker with avatar chips
  - Rich text editor wrapper for course descriptions
  - Video embed handler for external content (YouTube, Vimeo)
  - Quiz builder with question type templates
  - Badge scanner input (simulated with number input)
  - Shift selector with visual timeline
  - Notification panel with grouping and filters

- **States**:
  - Buttons: Solid blue primary with white text, hover darkens 10%, active scales 98%, disabled reduces opacity 50%
  - Inputs: Border slate, focus shows blue ring with 3px spread, error state red border with shake animation
  - Cards: Subtle shadow on rest, lift 2px and increase shadow on hover (200ms), clicked state brief scale
  - Sessions/Events: Blue background, hover shows actions overlay, selected state orange left border, dragging reduces opacity 80%

- **Icon Selection**:
  - Calendar: CalendarDots for scheduling views
  - Courses: GraduationCap for learning content
  - People: Users for employee management
  - Analytics: ChartBar for statistics
  - Notifications: Bell with badge counter
  - Add: Plus for create actions
  - Edit: PencilSimple for inline editing
  - Delete: Trash with destructive color
  - Filter: Funnel for data filtering
  - Search: MagnifyingGlass for search inputs
  - Settings: Gear for configuration
  - Navigation: CaretRight for expansion
  - Success: CheckCircle for completions
  - Warning: Warning for conflicts
  - Video: Play for media content
  - Quiz: ListChecks for assessments

- **Spacing**:
  - Page padding: p-6 (24px)
  - Card padding: p-4 (16px) for compact, p-6 (24px) for detailed
  - Section gaps: gap-6 (24px) for major sections, gap-4 (16px) within sections
  - List items: gap-2 (8px) for tight lists, gap-3 (12px) for readable lists
  - Form fields: gap-4 (16px) between fields
  - Button groups: gap-2 (8px)
  - Grid columns: gap-4 (16px) for cards, gap-6 (24px) for major layout regions

- **Mobile**:
  - Sidebar collapses to bottom navigation bar with icons only
  - Calendar switches to list view by default on mobile, day view for calendar mode
  - Side panels become full-screen modals on small screens
  - Tables convert to stacked card layout with key fields prominent
  - Multi-column dashboards stack vertically
  - Touch targets minimum 44px height for all interactive elements
  - Gantt chart shows compressed timeline with horizontal scroll
  - Forms display single column with full-width inputs
