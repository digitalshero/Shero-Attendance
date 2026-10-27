-- ============================================================================
-- Shero Attendance System — PostgreSQL schema
-- Fresh schema replacing the MongoDB data model (dummy/testing Mongo data,
-- not migrated — this is a clean start per the approved migration plan).
-- All business logic/behavior is preserved; only storage engine changes.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- for case-insensitive email

-- ----------------------------------------------------------------------------
-- USERS (employees + admins)
-- ----------------------------------------------------------------------------
CREATE TABLE users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id            TEXT UNIQUE NOT NULL,
  name                   TEXT NOT NULL,
  email                  CITEXT UNIQUE NOT NULL,
  password_hash          TEXT NOT NULL,
  role                   TEXT NOT NULL CHECK (role IN ('ADMIN', 'EMPLOYEE')),
  status                 TEXT NOT NULL DEFAULT 'ACTIVE'
                           CHECK (status IN ('ACTIVE', 'INACTIVE', 'STOPPED', 'WORKING', 'CHECKED_OUT')),
  work_mode              TEXT NOT NULL DEFAULT 'WFO'
                           CHECK (work_mode IN ('WFO', 'WFH', 'HYBRID', 'SSC')),
  department             TEXT,
  designation            TEXT,
  date_of_birth          DATE,
  is_ssc                 BOOLEAN NOT NULL DEFAULT false,
  roll_type              TEXT DEFAULT 'ON_ROLL' CHECK (roll_type IN ('ON_ROLL', 'OFF_ROLL')),
  reporting_manager_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  basic_salary           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  gross_salary           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  other_deductions       NUMERIC(12, 2) NOT NULL DEFAULT 0,
  pf_applicable          BOOLEAN NOT NULL DEFAULT false,
  esi_applicable         BOOLEAN NOT NULL DEFAULT false,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT users_no_self_manager CHECK (reporting_manager_id IS DISTINCT FROM id)
);

CREATE INDEX idx_users_reporting_manager ON users(reporting_manager_id);
CREATE INDEX idx_users_role ON users(role);

-- ----------------------------------------------------------------------------
-- ATTENDANCE (one row per employee per calendar day)
-- ----------------------------------------------------------------------------
CREATE TABLE attendance (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  work_date                       DATE NOT NULL,
  check_in                        TIMESTAMPTZ,
  check_out                       TIMESTAMPTZ,
  status                          TEXT NOT NULL DEFAULT 'WORKING'
                                    CHECK (status IN ('WORKING', 'STOPPED', 'CHECKED_OUT')),
  work_mode                       TEXT NOT NULL,
  location_lat                    DOUBLE PRECISION,
  location_lng                    DOUBLE PRECISION,
  location_distance_m             DOUBLE PRECISION,
  is_geofence_verified            BOOLEAN NOT NULL DEFAULT false,
  wfh_approved_from_request       BOOLEAN NOT NULL DEFAULT false,
  total_working_seconds           INTEGER NOT NULL DEFAULT 0,
  total_stopped_seconds           INTEGER NOT NULL DEFAULT 0,
  is_custom_sign_in               BOOLEAN NOT NULL DEFAULT false,
  is_half_day_flagged             BOOLEAN NOT NULL DEFAULT false,
  half_day_flag_reason            TEXT,
  regularization_status           TEXT NOT NULL DEFAULT 'NONE'
                                    CHECK (regularization_status IN ('NONE', 'PENDING', 'APPROVED', 'REJECTED')),
  regularization_remark           TEXT,
  regularization_requested_at     TIMESTAMPTZ,
  regularization_manager_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  regularization_manager_comment  TEXT,
  regularization_reviewed_at      TIMESTAMPTZ,
  regularization_reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT attendance_one_per_employee_per_day UNIQUE (user_id, work_date)
);

CREATE INDEX idx_attendance_user_date ON attendance(user_id, work_date);
CREATE INDEX idx_attendance_date ON attendance(work_date);
CREATE INDEX idx_attendance_regularization ON attendance(regularization_manager_id, regularization_status);

-- ----------------------------------------------------------------------------
-- ATTENDANCE EVENTS (audit trail: CHECK_IN / STOP / RESUME / CHECK_OUT)
-- ----------------------------------------------------------------------------
CREATE TABLE attendance_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id   UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL CHECK (event_type IN ('CHECK_IN', 'STOP', 'RESUME', 'CHECK_OUT')),
  timestamp       TIMESTAMPTZ NOT NULL,
  location_lat    DOUBLE PRECISION,
  location_lng    DOUBLE PRECISION
);

CREATE INDEX idx_attendance_events_attendance ON attendance_events(attendance_id, timestamp);

-- ----------------------------------------------------------------------------
-- WORK SESSIONS (one row per continuous working interval within a day)
-- ----------------------------------------------------------------------------
CREATE TABLE work_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id      UUID NOT NULL REFERENCES attendance(id) ON DELETE CASCADE,
  start_time         TIMESTAMPTZ NOT NULL,
  end_time           TIMESTAMPTZ,
  duration_seconds   INTEGER
);

CREATE INDEX idx_work_sessions_attendance ON work_sessions(attendance_id, start_time);

-- ----------------------------------------------------------------------------
-- PERMISSIONS (Leave / Permission / WFH / Week-Off requests)
-- ----------------------------------------------------------------------------
CREATE TABLE permissions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  manager_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  request_type     TEXT NOT NULL CHECK (request_type IN ('PERMISSION', 'WFH', 'LEAVE', 'WEEK_OFF')),
  request_date     DATE NOT NULL,
  start_time       TIME NOT NULL,
  end_time         TIME NOT NULL,
  total_hours      NUMERIC(6, 2) NOT NULL DEFAULT 0,
  total_hours_formatted TEXT,
  reason           TEXT,
  attachment_url   TEXT,
  attachment_name  TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  manager_comment  TEXT,
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_permissions_employee_date ON permissions(employee_id, request_date);
CREATE INDEX idx_permissions_manager_status ON permissions(manager_id, status);
CREATE INDEX idx_permissions_type_date ON permissions(request_type, request_date);

-- ----------------------------------------------------------------------------
-- HOLIDAYS (company-declared calendar)
-- ----------------------------------------------------------------------------
CREATE TABLE holidays (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  holiday_date  DATE NOT NULL UNIQUE,
  type          TEXT NOT NULL DEFAULT 'COMPANY' CHECK (type IN ('NATIONAL', 'FESTIVAL', 'COMPANY', 'OPTIONAL')),
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- COMPANY-WIDE WFH DAYS
-- ----------------------------------------------------------------------------
CREATE TABLE wfh_days (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wfh_date      DATE NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  description   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- SETTINGS (singleton row: office timings, geofence, payroll rates, etc.)
-- ----------------------------------------------------------------------------
CREATE TABLE settings (
  id                   INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pf_employee_rate     NUMERIC(6, 4) NOT NULL DEFAULT 0.12,
  pf_employer_rate     NUMERIC(6, 4) NOT NULL DEFAULT 0.12,
  esi_employee_rate    NUMERIC(6, 4) NOT NULL DEFAULT 0.0075,
  esi_employer_rate    NUMERIC(6, 4) NOT NULL DEFAULT 0.0325,
  office_start_time    TIME NOT NULL DEFAULT '09:00',
  office_end_time      TIME NOT NULL DEFAULT '18:00',
  grace_minutes        INTEGER NOT NULL DEFAULT 15,
  office_lat           DOUBLE PRECISION NOT NULL DEFAULT 13.0827,
  office_lng           DOUBLE PRECISION NOT NULL DEFAULT 80.2707,
  office_radius_m      INTEGER NOT NULL DEFAULT 500,
  office_address       TEXT NOT NULL DEFAULT 'Chennai, Tamil Nadu, India',
  geofence_enabled     BOOLEAN NOT NULL DEFAULT true,
  work_week_pattern    TEXT NOT NULL DEFAULT '6_DAYS'
                         CHECK (work_week_pattern IN ('5_DAYS', '6_DAYS', 'ALTERNATE_SATURDAYS')),
  departments          TEXT[] NOT NULL DEFAULT ARRAY[
                          'DST','TECH','HR','OGB','KOB','Accounts','Finance','Compliance'
                        ]::TEXT[]
);

-- Seed the single settings row so the app never has to "create on first read".
INSERT INTO settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- updated_at auto-touch triggers (keeps parity with the old Mongo code paths
-- that manually set updatedAt on every update)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
