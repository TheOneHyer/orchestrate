# Business Domain

Orchestrate manages a three-sided marketplace of **Employees** (learners), **Trainers** (instructors), and **Admin**. 

## Core Entities
1. **Sessions & Courses**
   - **Course**: A syllabus of modules (quizzes, videos).
   - **Session**: Scheduled instance of a Course taking place on a Date/Time with a capacity limit.
   - **Conflicts**: The system heavily guards against double-booking trainers, overlapping students, and violating room capacities.
2. **Trainers & Wellness**
   - Trainers are assigned to sessions.
   - **Capacity / Workload**: If a Trainer hits >85% capacity, they are flagged. >95% is critical.
   - **Wellness Check-ins**: Periodic reports rating mood, sleep, stress. If scores dip below threshold (<50), the system surfaces "Recovery Plan" requirements.
3. **Employees & Certifications**
   - Employees attend sessions.
   - Certain sessions grant or renew certifications.
   - System auto-generates 90/60/30/14/7-day warnings for expiring certifications.

## UX & Design System
- **Colors**: Primary Blue (`oklch(0.45 0.15 250)`) + Accent Orange (`oklch(0.68 0.18 45)`).
- **Typography**: Work Sans
- **Transitions**: Relies heavily on Framer Motion for sliding panels, toast notifications (Sonner), and modal transitions to feel app-like and fluid.
- **Notifications**: Includes Web Audio API bells and Browser Push notification alerts for critical threshold breaks (e.g., burnout warnings).
