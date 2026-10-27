// Row -> API JSON mappers. Keep output shapes identical to the previous
// MongoDB-backed API (camelCase, `_id` as the primary key field) so the
// frontend requires zero changes.

const toDateStr = (d: any): string | null => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  const dt = new Date(d);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toTimeStr = (t: any): string | null => {
  if (!t) return null;
  // node-postgres returns TIME columns as 'HH:mm:ss' strings already
  return typeof t === 'string' ? t.slice(0, 5) : t;
};

const num = (v: any): number => (v === null || v === undefined ? 0 : Number(v));

export const mapUser = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    employeeId: row.employee_id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    workMode: row.work_mode,
    department: row.department || '',
    designation: row.designation || '',
    dateOfBirth: row.date_of_birth ? toDateStr(row.date_of_birth) : '',
    isSsc: Boolean(row.is_ssc),
    rollType: row.roll_type || 'ON_ROLL',
    employmentType: row.roll_type || 'ON_ROLL',
    reportingManagerId: row.reporting_manager_id || null,
    basicSalary: num(row.basic_salary),
    grossSalary: num(row.gross_salary),
    otherDeductions: num(row.other_deductions),
    pfApplicable: Boolean(row.pf_applicable),
    esiApplicable: Boolean(row.esi_applicable),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapSettings = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    pfEmployeeRate: num(row.pf_employee_rate),
    pfEmployerRate: num(row.pf_employer_rate),
    esiEmployeeRate: num(row.esi_employee_rate),
    esiEmployerRate: num(row.esi_employer_rate),
    officeStartTime: toTimeStr(row.office_start_time),
    officeEndTime: toTimeStr(row.office_end_time),
    graceMinutes: row.grace_minutes,
    officeLocation: {
      latitude: row.office_lat,
      longitude: row.office_lng,
      radiusMeters: row.office_radius_m,
      address: row.office_address,
    },
    geofenceEnabled: row.geofence_enabled !== false,
    workWeekPattern: row.work_week_pattern,
    departments: row.departments || [],
  };
};

export const mapAttendance = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    employeeId: row.employee_code || row.employee_id,
    date: row.work_date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
    workMode: row.work_mode,
    location:
      row.location_lat !== null && row.location_lat !== undefined
        ? { latitude: row.location_lat, longitude: row.location_lng, distanceMeters: row.location_distance_m }
        : null,
    isGeofenceVerified: Boolean(row.is_geofence_verified),
    wfhApprovedFromRequest: Boolean(row.wfh_approved_from_request),
    totalWorkingSeconds: row.total_working_seconds || 0,
    totalStoppedSeconds: row.total_stopped_seconds || 0,
    isCustomSignIn: Boolean(row.is_custom_sign_in),
    isHalfDayFlagged: Boolean(row.is_half_day_flagged),
    halfDayFlagReason: row.half_day_flag_reason || null,
    regularizationStatus: row.regularization_status || 'NONE',
    regularizationRemark: row.regularization_remark || null,
    regularizationRequestedAt: row.regularization_requested_at || null,
    regularizationManagerUserId: row.regularization_manager_id || null,
    regularizationManagerComment: row.regularization_manager_comment || null,
    regularizationReviewedAt: row.regularization_reviewed_at || null,
    regularizationReviewedBy: row.regularization_reviewed_by || null,
    // populated by join-aware callers when needed:
    user: row.user_name
      ? { name: row.user_name, employeeId: row.employee_code || row.employee_id, workMode: row.user_work_mode }
      : undefined,
  };
};

export const mapAttendanceEvent = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    attendanceId: row.attendance_id,
    eventType: row.event_type,
    timestamp: row.timestamp,
    location:
      row.location_lat !== null && row.location_lat !== undefined
        ? { latitude: row.location_lat, longitude: row.location_lng }
        : undefined,
  };
};

export const mapWorkSession = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    attendanceId: row.attendance_id,
    startTime: row.start_time,
    endTime: row.end_time,
    durationSeconds: row.duration_seconds,
  };
};

export const mapPermission = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    employeeUserId: row.employee_id,
    employeeId: row.employee_code,
    employeeName: row.employee_name,
    employeeEmail: row.employee_email,
    managerUserId: row.manager_id || null,
    managerInfo: row.manager_id
      ? {
          id: row.manager_id,
          name: row.manager_name,
          employeeId: row.manager_employee_code,
          email: row.manager_email,
          role: row.manager_role,
        }
      : null,
    requestType: row.request_type,
    date: toDateStr(row.request_date),
    startTime: toTimeStr(row.start_time),
    endTime: toTimeStr(row.end_time),
    totalHours: num(row.total_hours),
    totalHoursFormatted: row.total_hours_formatted,
    reason: row.reason || '',
    attachmentUrl: row.attachment_url || null,
    attachmentName: row.attachment_name || null,
    status: row.status,
    managerComment: row.manager_comment || '',
    reviewedAt: row.reviewed_at || null,
    reviewedBy: row.reviewed_by
      ? { id: row.reviewed_by, name: row.reviewed_by_name, employeeId: row.reviewed_by_employee_code }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export const mapHoliday = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    date: toDateStr(row.holiday_date),
    type: row.type,
    description: row.description || '',
    createdAt: row.created_at,
  };
};

export const mapWfhDay = (row: any): any => {
  if (!row) return null;
  return {
    _id: row.id,
    date: toDateStr(row.wfh_date),
    title: row.title,
    description: row.description || '',
    createdAt: row.created_at,
  };
};

export { toDateStr, toTimeStr, num };
