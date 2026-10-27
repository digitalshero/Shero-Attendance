# Shero Home Food — Attendance, Leave & Payroll System

Complete technical documentation: architecture, tech stack, data model, and business logic.

---

## 1. What this project is

A full-stack web application used by **Shero Home Food** to manage:

- Daily employee **attendance** (sign in / sign out, GPS-verified office check-ins, WFH/remote tracking)
- **Leave, Permission, WFH and Week-Off requests** with a manager/admin approval workflow
- **Payroll** calculation (PF, ESI, working-days-based salary)
- **Admin configuration** (office timings, geofence, holidays, company WFH calendar, departments, payroll rates)
- **Reporting** (live daily dashboard, per-employee history, monthly leave/late/permission report)

There are two user roles, each with their own portal:

- **Admin** — manages employees, reviews requests, configures the system, views reports
- **Employee** — signs in/out, submits requests, views their own history and payroll

---

## 2. Tech stack

### Frontend (`frontend/`)
| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript, built with Vite |
| Routing | react-router-dom v7 |
| Styling | Tailwind CSS 3 |
| HTTP client | axios |
| Icons | lucide-react |
| Dates | date-fns |
| Notifications | react-hot-toast |
| Excel import/export | xlsx |
| Linting | oxlint |
| Hosting | **Vercel** (SPA, confirmed by `frontend/vercel.json` rewriting all routes to `index.html`) |

The app is also a basic **PWA** (installable, with a manifest/service worker and an install-prompt component).

### Backend (`backend/`)
| Layer | Technology |
|---|---|
| Framework | Express 5 + TypeScript |
| Database driver | official `mongodb` Node driver (no ODM/Mongoose — collections are untyped, shapes enforced in route code) |
| Auth | JSON Web Tokens (`jsonwebtoken`) + `bcryptjs` for password hashing |
| File uploads | `multer` (disk storage) |
| Dev tooling | `nodemon` + `ts-node`; production build via `tsc` → `node dist/server.js` |
| Hosting | **Render** (web service; confirmed by CORS config anticipating Render/Vercel origins — no IaC file in repo, configured via Render's dashboard) |

### Database
- **MongoDB Atlas** in production; a local `docker-compose.yml` spins up a single-node Mongo replica set for local development.
- Database name: `attendance`. No schema validation — document shapes are whatever the route handlers write.

---

## 3. Project structure

```
backend/
  src/
    server.ts          # Express app bootstrap, CORS, static /uploads, route mounting
    mongo.ts           # Mongo client + typed collection accessors
    middleware/auth.ts # authenticateToken, requireAdmin
    routes/
      auth.ts           # login, /me, change-password
      attendance.ts     # check-in/out, stop/resume, regularization, salary, holidays, leave-summary
      admin.ts           # employees CRUD, settings, dashboard, payroll, holidays, WFH days, monthly report
      permission.ts      # leave/permission/WFH/week-off request + approval workflow
    utils/
      time.ts            # IST-aware date helpers
      geo.ts             # Haversine distance for geofencing
    seed.ts             # one-off dev seed script (admin + demo employees)
  uploads/
    leave-attachments/  # multer disk storage for leave supporting documents

frontend/
  src/
    pages/
      Login.tsx
      admin/            # AdminDashboard, AdminEmployees(+Detail/Attendance), AdminSettings,
                         # AdminPermissions, AdminMonthlyReport
      employee/         # EmployeeDashboard, AttendanceHistory, EmployeePermissions, EmployeeSalary
    layouts/            # AdminLayout (sidebar nav), EmployeeLayout
    components/
      attendance/       # AttendanceCard (sign in/out UI), AttendanceTimeline, LiveTimer
      common/           # AttendanceReminderAndPWA, DateRangeFilter
    context/AuthContext.tsx
    services/           # api.ts (axios instance), authService, attendanceService, permissionService
    utils/              # fileUrl.ts, timeUtils.ts
    App.tsx             # all route definitions + role-based guards
```

> **Note:** `AdminPayroll.tsx` and `AdminEmployeePayrollDetail.tsx` still exist as files but are **not wired into any route or nav link** — they were disconnected from the UI at some point. The backend payroll logic they would have called (`GET /api/admin/payroll`) is still fully functional and is used by the employee-facing `EmployeeSalary.tsx` page.

---

## 4. Authentication

- **Login** (`POST /api/auth/login`): accepts either an email or an Employee ID (case-insensitive match against either field), verifies the password with bcrypt, and issues a JWT containing `{ id, employeeId, role }` valid for **365 days**.
- The frontend stores the token (and a cached user object) in `localStorage`. On every request, an axios interceptor attaches `Authorization: Bearer <token>`.
- `AuthContext` hydrates the UI instantly from the cached `localStorage` user, then silently re-validates against `GET /api/auth/me` in the background; an invalid/expired token clears the cache and the app falls back to the login screen (the blank-white-screen bug fixed earlier in this project's history was exactly this verify call hanging with no timeout).
- **Route guards** (`App.tsx`): `PrivateRoute` compares the logged-in user's `role` against the route's required role and redirects mismatches to the correct portal; admin routes live under `/admin/*` wrapped in `AdminLayout`, employee routes under `/employee/*` wrapped in `EmployeeLayout`.

---

## 5. Attendance — the core flow

All attendance logic lives in `backend/src/routes/attendance.ts`. One **Attendance** document represents one employee's one calendar day.

### Sign in (`POST /attendance/check-in`)
1. If there's already an attendance record for today **and** it isn't `CHECKED_OUT`, the request is rejected ("Already signed in today").
2. **Work mode for the day** is resolved as: an individually approved WFH permission for today → WFH; else a company-wide WFH day exists → WFH; else the employee's own default `workMode`. The employee can override this explicitly (e.g. come into the office on a company WFH day, or vice versa).
3. **Earlier/custom sign-in**: an employee can back-date their check-in time, capped at **3 times per calendar month**.
4. **Geofence check** (only for `WFO`/`SSC` work mode, and only when the admin's **"Enforce Geofence on Sign-In"** toggle is on):
   - Only applies to the employee's **first** sign-in of the day. If they already checked out once today and are signing in again (e.g. office → home), geofence is skipped entirely — the system assumes they might legitimately be elsewhere now.
   - Otherwise, GPS coordinates are required and checked against the configured office location/radius (Haversine distance); company-wide WFH days exempt everyone from this check.
5. A new `Attendance` doc is created (or, for a same-day re-sign-in, the existing `CHECKED_OUT` doc is reopened), plus a `CHECK_IN` event and a new `WorkSession`.

### Stop / Resume (`POST /attendance/stop` / `/resume`)
A short in-day pause (e.g. lunch break) — not a full sign-out. `stop` closes the active work session and accumulates worked time; `resume` opens a new session and accumulates the elapsed paused time. This can repeat any number of times within a day.

### Sign out (`POST /attendance/check-out`)
1. Closes the active work session and marks the day `CHECKED_OUT`.
2. **Auto half-day flagging**: if this was the employee's **only** sign-in session of the day (no earlier sign-out/re-sign-in cycle) and the final check-out happens **at or after 8:00 PM IST**, the record is automatically flagged `isHalfDayFlagged`. This exists to catch employees who forget to sign out, while still letting genuinely early/legitimate re-sign-ins (multi sign-in/out days) through unflagged.

### Regularization (clearing a half-day flag)
- The employee submits a remark explaining the late sign-out (`POST /attendance/regularize/:attendanceId`), capped at **3 requests per calendar month**.
- It routes to their **reporting manager** (or any admin).
- The manager/admin approves (clears the flag) or rejects (flag stays) via `PUT /attendance/regularize/:id/status`, visible in both the Admin Permissions page and the manager's "Team" tab in Employee Permissions.

### WFH mechanisms
- **Individual**: an approved `WFH`-type permission for that specific date.
- **Company-wide**: an admin-declared `WfhDay` applying to everyone, which also exempts geofencing even for WFO staff with no GPS.

### SSC / Week-Off
`isSsc` employees (a special shift category) are the only ones allowed to request a compensatory `WEEK_OFF`. For geofencing purposes, SSC is treated like WFO (still requires office presence when enabled).

---

## 6. Leave, Permission & WFH requests

Handled by `backend/src/routes/permission.ts`. A single `Permission` collection holds four request types: `PERMISSION`, `WFH`, `LEAVE`, `WEEK_OFF`.

- **Submission**: date + start/end time + reason, optionally a supporting-document attachment (PDF/JPG/PNG, 5MB max, stored on disk under `backend/uploads/leave-attachments/`).
- **Half/full-day** leave or WFH is a frontend-only convention — selecting "Full Day" sends 09:00–18:00, "Half Day" sends either 09:00–13:30 or 13:30–18:00. The backend only ever sees a time range.
- **Multi-date leave**: the employee can select several dates for one leave application; the frontend submits one request per date in sequence (there's no backend batch endpoint for this).
- **Monthly free-leave limit**: employees get **2 free leave days per month**. A 3rd+ leave request in the same month is rejected unless a supporting document is attached.
- **Approval**: routes to the employee's reporting manager, or any admin. Approving a same-day WFH request automatically creates/updates that day's attendance record (auto check-in at the requested start time).
- **Week Off** requests are gated to SSC employees only.

---

## 7. Payroll

Calculated in two near-identical places: `GET /attendance/salary` (employee, self) and `GET /admin/payroll` (admin, all employees) — both use the same formula:

1. Classify every day of the month as a **weekly off**, **declared holiday**, or **working day**, based on the admin-configured work-week pattern (6-day week / 5-day week / alternate Saturdays off).
2. `eligibleDays` = the smaller of (working days in the month) and (the employee's actual attendance record count) — i.e. payable days are capped by real attendance, not pro-rated credit for leave.
3. `earnedBasic` / `earnedGross` = `basicSalary` / `grossSalary` × `eligibleDays ÷ workingDaysInMonth`.
4. **PF** (Provident Fund): `earnedBasic × pfEmployeeRate` / `× pfEmployerRate`, only if the employee has `pfApplicable` set.
5. **ESI**: `earnedGross × esiEmployeeRate` / `× esiEmployerRate`, only if `esiApplicable` **and** gross salary is within the statutory ESI ceiling (₹21,000).
6. **Net salary** = earned gross − employee PF − employee ESI − other deductions (floored at 0).

All rates (`pfEmployeeRate`, `pfEmployerRate`, `esiEmployeeRate`, `esiEmployerRate`) and the work-week pattern live in the single `Settings` document and are editable by the admin.

---

## 8. Admin Settings

Configured from the Settings page (sidebar → Settings dropdown), backed by a single `Settings` document that auto-creates itself with sensible defaults on first use:

- **Shift & Timings**: office start/end time, late-arrival grace period (minutes).
- **Office Geofence**: office latitude/longitude/address, allowed radius (metres), and an **"Enforce Geofence on Sign-In"** on/off switch — when off, WFO/SSC employees can sign in from anywhere.
- **Company WFH Days**: a calendar of company-wide remote days, addable individually or in bulk by recurring weekday rule (e.g. every Wednesday & Saturday for a year).
- **Holidays Calendar**: declared holidays (National/Festival/Company/Optional), addable individually, in bulk by rule (all Sundays, or 2nd/4th Saturdays of a year), or via **Excel upload**.
- **Departments**: the list of selectable departments for employee records.
- **Payroll rates** (PF/ESI percentages) are still part of the same `Settings` document and used by the payroll calculations above, even though a dedicated "Payroll" settings tab is no longer in the sidebar.

---

## 9. Reporting & review pages

| Page | Purpose |
|---|---|
| **Admin Dashboard** | Live view for a single selected day (Today/Yesterday/Day Before/Custom): present/late/on-leave/permission/signed-out counts, filterable by status and WFO/WFH, with a work-mode toggle and a "multiple sign-in today" indicator next to employee names. |
| **Admin Monthly Report** | Per-employee Leave / Late / Permission counts over any date range (Today, Yesterday, This/Last Week, This/Last Month, custom), with drill-down modals listing the affected employees. |
| **Admin → Employee Attendance History** | Full sign-in/out history for one employee, with Leave/Permission summary cards and a multi-sign-in indicator per date. Reached by clicking any employee's name on the dashboard. |
| **Admin / Employee "Requests Status"** | Review and approve/reject Leave/WFH/Permission/Week-Off requests, plus half-day regularization requests, with date-range and type filters. Employees who are also reporting managers see a "Team" tab here for reviewing their reports' requests. |
| **Employee Dashboard** | Today's sign-in/out controls, this month's attendance summary (Leave/Permission/WFO/WFH day counts), and this month's company holidays. |
| **Employee Attendance History** | Personal log history with status filters (Present/Late/WFO/WFH/Leave/Permission) and the half-day regularization action when flagged. |

---

## 10. Deployment & environment

- **Frontend**: deployed to **Vercel** as a static SPA. Configured via `VITE_API_URL` at build time (points at the backend's base URL).
- **Backend**: deployed to **Render** as a Node web service. Build command `npm run build` (runs `tsc`), start command `npm start` (`node dist/server.js`). Environment variables: `MONGO_URI`, `JWT_SECRET`, `PORT`, `FRONTEND_URL`/`CLIENT_URL` (for CORS). Auto-deploys on every push to `main`.
- **Database**: MongoDB Atlas in production.
- **File storage caveat**: leave-attachment uploads are stored on the backend's local disk (`backend/uploads/`). On a typical PaaS deployment this storage is **not guaranteed to persist** across redeploys/restarts unless a persistent disk is attached — worth keeping in mind if attachments start disappearing after a deploy.

---

## 11. Known gaps (for awareness, not yet fixed)

- The `workWeekPattern` setting (used by payroll calculations) is sent by the frontend's Save but is **not actually persisted** by the `PUT /admin/settings` backend handler — it only ever reflects its default value server-side.
- Default geofence radius is inconsistent between the auto-created Settings document (100m) and the runtime fallback used if no radius is set (500m).
- `AdminPayroll.tsx` / `AdminEmployeePayrollDetail.tsx` are orphaned UI files no longer reachable from navigation, even though the backend payroll endpoint they'd use is still live and used elsewhere (`EmployeeSalary.tsx`).
