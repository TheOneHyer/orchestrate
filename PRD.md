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

### Smart Scheduling Algorithm
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
- **Functionality**: Send alerts for upcoming sessions, assignments, completions, administrative messages, and workload warnings
- **Purpose**: Keeps all users informed of relevant updates, deadlines, and critical workload issues
- **Trigger**: System event, manual send from admin, or automatic workload threshold detection
- **Progression**: Event occurs → Notification generated → Appears in dashboard → Toast notification for critical alerts → User clicks → Navigate to source
- **Success criteria**: Notifications appear in real-time, dismissible, linked to source content, critical workload alerts trigger toast notifications

### Trainer Workload Balancing
- **Functionality**: Analyze trainer utilization rates, generate intelligent recommendations for redistributing workload, and automatically notify trainers and admins when utilization thresholds are exceeded
- **Purpose**: Prevents trainer burnout, optimizes capacity utilization, ensures balanced distribution of training sessions, and provides proactive alerts for intervention
- **Trigger**: Navigate to Trainer Availability → Workload Balance tab, or automatic detection when trainer reaches 85% (overutilized) or 95% (critically overutilized) capacity
- **Progression**: System monitors utilization → Threshold exceeded → Notifications sent to trainer and admin → View balance score → Review overutilized/underutilized trainers → Read AI recommendations → Click trainer name → View redistribution opportunities → Apply suggestions → Workload normalized notification sent
- **Success criteria**: Balance score calculation accurate, recommendations identify compatible trainers for redistribution, clear action steps provided, automatic notifications trigger at correct thresholds (85% and 95%), toast alerts appear for critical cases, resolved notifications sent when balance returns to normal

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
