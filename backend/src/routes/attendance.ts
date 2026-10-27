import { Router, Response } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { getISTTodayString, combineDateAndTimeToISTDate, getISTMinutes } from '../utils/time';
import { calculateDistanceMeters } from '../utils/geo';
import { query, withTransaction } from '../db';
import { mapAttendance, mapAttendanceEvent, mapWorkSession, mapHoliday, mapWfhDay, toDateStr } from '../mappers';

const router = Router();

const calculateDurationSeconds = (start: Date | string, end: Date | string): number => {
  return Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
};

// Helper to fetch today's attendance (by IST calendar date) with related events & sessions
const getTodayAttendance = async (employeeId: string, dateStr?: string) => {
  const targetDate = dateStr || getISTTodayString(new Date());
  const { rows } = await query(
    `SELECT a.*, u.employee_id AS employee_code
     FROM attendance a
     JOIN users u ON u.id = a.user_id
     WHERE u.employee_id = $1 AND a.work_date = $2::date
     LIMIT 1`,
    [employeeId, targetDate]
  );
  const attendance = rows[0];
  if (!attendance) return null;

  const [eventsRes, sessionsRes] = await Promise.all([
    query(`SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY timestamp ASC`, [attendance.id]),
    query(`SELECT * FROM work_sessions WHERE attendance_id = $1 ORDER BY start_time ASC`, [attendance.id]),
  ]);

  const mapped = mapAttendance(attendance);
  mapped.events = eventsRes.rows.map(mapAttendanceEvent);
  mapped.workSessions = sessionsRes.rows.map(mapWorkSession);
  // internal-only raw fields used by route handlers below
  mapped.__id = attendance.id;
  mapped.__userId = attendance.user_id;
  return mapped as any;
};

router.post('/check-in', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const { latitude, longitude, customTime, workMode: requestedWorkMode } = req.body;
    const now = new Date();
    const todayStr = getISTTodayString(now);

    const existing = await getTodayAttendance(employeeId, todayStr);
    if (existing && existing.status !== 'CHECKED_OUT') {
      return res.status(400).json({ error: 'Already signed in today' });
    }

    // Check if user has an individual approved WFH request OR if today is a Company-Wide WFH Day
    const [wfhPermRes, companyWfhRes, userRes] = await Promise.all([
      query(
        `SELECT p.* FROM permissions p JOIN users u ON u.id = p.employee_id
         WHERE u.employee_id = $1 AND p.request_type = 'WFH' AND p.request_date = $2::date AND p.status = 'APPROVED'
         LIMIT 1`,
        [employeeId, todayStr]
      ),
      query(`SELECT * FROM wfh_days WHERE wfh_date = $1::date LIMIT 1`, [todayStr]),
      query(`SELECT * FROM users WHERE employee_id = $1`, [employeeId]),
    ]);
    const approvedWfh = wfhPermRes.rows[0];
    const companyWfhDay = companyWfhRes.rows[0];
    const user = userRes.rows[0];

    const isWfhToday = !!approvedWfh || !!companyWfhDay;
    let workMode = isWfhToday ? 'WFH' : (user?.work_mode || 'WFO');
    if (requestedWorkMode === 'WFO') {
      workMode = 'WFO';
    } else if (requestedWorkMode === 'WFH') {
      workMode = 'WFH';
    }
    let locationData: any = null;

    let checkInTimestamp = now;
    const isCustomSignInRequested = !!(customTime && typeof customTime === 'string');

    if (approvedWfh && approvedWfh.start_time) {
      checkInTimestamp = combineDateAndTimeToISTDate(todayStr, approvedWfh.start_time.slice(0, 5));
    } else if (isCustomSignInRequested) {
      // Validate monthly custom sign-in limit (Maximum 3 times per calendar month)
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM attendance a JOIN users u ON u.id = a.user_id
         WHERE u.employee_id = $1 AND date_trunc('month', a.work_date) = date_trunc('month', $2::date) AND a.is_custom_sign_in = true`,
        [employeeId, todayStr]
      );
      if (countRows[0].count >= 3) {
        return res.status(400).json({
          error: 'Monthly earlier sign-in limit reached (Maximum 3 times per month allowed). Please sign in with current time.',
        });
      }
      checkInTimestamp = combineDateAndTimeToISTDate(todayStr, customTime);
    }

    const { rows: settingsRows } = await query(`SELECT * FROM settings WHERE id = 1`);
    const currentSettings = settingsRows[0];
    const geofenceEnabled = currentSettings?.geofence_enabled !== false;

    // Geofence is only enforced on the day's initial sign-in. A re-sign-in after an earlier
    // check-out (e.g. signed out from office, signing in again later from home) skips it.
    if (!existing && (workMode === 'WFO' || workMode === 'SSC') && geofenceEnabled) {
      const allowedRadius = currentSettings?.office_radius_m ? Number(currentSettings.office_radius_m) : 500;
      if (currentSettings?.office_lat && currentSettings?.office_lng) {
        if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
          if (!companyWfhDay) {
            return res.status(400).json({
              error: 'Office Location Required: Please enable GPS location to verify sign-in within office premises.',
            });
          }
        } else {
          const userLat = Number(latitude);
          const userLon = Number(longitude);
          if (isNaN(userLat) || isNaN(userLon)) {
            if (!companyWfhDay) {
              return res.status(400).json({ error: 'Invalid GPS coordinates provided.' });
            }
          } else {
            const distance = calculateDistanceMeters(userLat, userLon, currentSettings.office_lat, currentSettings.office_lng);
            if (distance > allowedRadius && !companyWfhDay) {
              return res.status(400).json({
                error: `Outside Office Perimeter: You are ${distance}m away (Allowed radius: ${allowedRadius}m). Please be within 500m of the office to sign in.`,
                distance,
                allowedRadius,
              });
            }
            locationData = { latitude: userLat, longitude: userLon, distanceMeters: distance };
          }
        }
      }
    } else if (latitude !== undefined && longitude !== undefined) {
      locationData = { latitude: Number(latitude), longitude: Number(longitude) };
    }

    const attendanceId: string = await withTransaction(async (client) => {
      let id: string;
      if (existing) {
        // Re-sign-in after an earlier check-out today: reopen the same day's attendance record
        id = existing.__id;
        await client.query(
          `UPDATE attendance SET status = 'WORKING', work_mode = $1, check_out = NULL WHERE id = $2`,
          [workMode, id]
        );
      } else {
        const insertRes = await client.query(
          `INSERT INTO attendance
            (user_id, work_date, check_in, status, work_mode, location_lat, location_lng, location_distance_m,
             is_geofence_verified, wfh_approved_from_request, total_working_seconds, total_stopped_seconds, is_custom_sign_in)
           VALUES ($1, $2::date, $3, 'WORKING', $4, $5, $6, $7, $8, $9, 0, 0, $10)
           RETURNING id`,
          [
            user.id,
            todayStr,
            checkInTimestamp,
            workMode,
            locationData?.latitude ?? null,
            locationData?.longitude ?? null,
            locationData?.distanceMeters ?? null,
            (workMode === 'WFO' || workMode === 'SSC') ? geofenceEnabled : false,
            !!approvedWfh,
            isCustomSignInRequested,
          ]
        );
        id = insertRes.rows[0].id;
      }

      await client.query(
        `INSERT INTO attendance_events (attendance_id, event_type, timestamp, location_lat, location_lng)
         VALUES ($1, 'CHECK_IN', $2, $3, $4)`,
        [id, checkInTimestamp, locationData?.latitude ?? null, locationData?.longitude ?? null]
      );
      await client.query(
        `INSERT INTO work_sessions (attendance_id, start_time) VALUES ($1, $2)`,
        [id, checkInTimestamp]
      );
      await client.query(`UPDATE users SET status = 'WORKING' WHERE id = $1`, [user.id]);
      return id;
    });

    const attendance = await getTodayAttendance(employeeId, todayStr);
    res.json(attendance);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Check-in failed' });
  }
});

router.post('/stop', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const now = new Date();
    const attendance = await getTodayAttendance(employeeId);
    if (!attendance || attendance.status !== 'WORKING') {
      return res.status(400).json({ error: 'Cannot stop. Status must be WORKING.' });
    }
    const activeSession = attendance.workSessions.find((s: any) => !s.endTime);

    await withTransaction(async (client) => {
      if (activeSession) {
        const duration = calculateDurationSeconds(activeSession.startTime, now);
        await client.query(
          `UPDATE work_sessions SET end_time = $1, duration_seconds = $2 WHERE id = $3`,
          [now, duration, activeSession._id]
        );
        await client.query(
          `UPDATE attendance SET total_working_seconds = total_working_seconds + $1, status = 'STOPPED' WHERE id = $2`,
          [duration, attendance.__id]
        );
      }
      await client.query(
        `INSERT INTO attendance_events (attendance_id, event_type, timestamp) VALUES ($1, 'STOP', $2)`,
        [attendance.__id, now]
      );
      await client.query(`UPDATE users SET status = 'STOPPED' WHERE id = $1`, [attendance.__userId]);
    });

    const updated = await getTodayAttendance(employeeId);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Stop failed' });
  }
});

router.post('/resume', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const now = new Date();
    const attendance = await getTodayAttendance(employeeId);
    if (!attendance || attendance.status !== 'STOPPED') {
      return res.status(400).json({ error: 'Cannot resume. Status must be STOPPED.' });
    }
    const lastStopEvent = attendance.events
      .filter((e: any) => e.eventType === 'STOP')
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    let additionalStoppedSeconds = 0;
    if (lastStopEvent) {
      additionalStoppedSeconds = calculateDurationSeconds(lastStopEvent.timestamp, now);
    }

    await withTransaction(async (client) => {
      await client.query(`INSERT INTO work_sessions (attendance_id, start_time) VALUES ($1, $2)`, [attendance.__id, now]);
      await client.query(
        `UPDATE attendance SET total_stopped_seconds = total_stopped_seconds + $1, status = 'WORKING' WHERE id = $2`,
        [additionalStoppedSeconds, attendance.__id]
      );
      await client.query(
        `INSERT INTO attendance_events (attendance_id, event_type, timestamp) VALUES ($1, 'RESUME', $2)`,
        [attendance.__id, now]
      );
      await client.query(`UPDATE users SET status = 'WORKING' WHERE id = $1`, [attendance.__userId]);
    });

    const updated = await getTodayAttendance(employeeId);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Resume failed' });
  }
});

router.post('/check-out', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const { customTime } = req.body;
    const now = new Date();
    const todayStr = getISTTodayString(now);
    const attendance = await getTodayAttendance(employeeId, todayStr);
    if (!attendance) {
      return res.status(400).json({ error: 'No active attendance today' });
    }
    if (attendance.status === 'CHECKED_OUT') {
      return res.status(400).json({ error: 'Already checked out' });
    }
    if (attendance.status === 'STOPPED') {
      return res.status(400).json({ error: 'You are currently stopped. Please resume before checking out.' });
    }

    let checkOutTimestamp = now;
    if (customTime && typeof customTime === 'string') {
      checkOutTimestamp = combineDateAndTimeToISTDate(todayStr, customTime);
    }

    const activeSession = attendance.workSessions.find((s: any) => !s.endTime);
    let sessionDuration = 0;

    // Auto-flag as Half Day Leave if this is the day's only sign-in session (no re-sign-in after an
    // earlier check-out) and the final check-out happens after 8:00 PM IST. Employees who genuinely
    // worked late can clear this via a regularization request to their reporting manager.
    const LATE_CHECKOUT_THRESHOLD_MINUTES = 20 * 60; // 8:00 PM
    const checkInEventCount = attendance.events.filter((e: any) => e.eventType === 'CHECK_IN').length;
    const isSingleSessionDay = checkInEventCount <= 1;
    const shouldFlagHalfDay = isSingleSessionDay && getISTMinutes(checkOutTimestamp) >= LATE_CHECKOUT_THRESHOLD_MINUTES;

    await withTransaction(async (client) => {
      if (activeSession) {
        sessionDuration = calculateDurationSeconds(activeSession.startTime, checkOutTimestamp);
        if (sessionDuration < 0) sessionDuration = 0;
        await client.query(
          `UPDATE work_sessions SET end_time = $1, duration_seconds = $2 WHERE id = $3`,
          [checkOutTimestamp, sessionDuration, activeSession._id]
        );
      }

      if (shouldFlagHalfDay) {
        await client.query(
          `UPDATE attendance SET status = 'CHECKED_OUT', check_out = $1, total_working_seconds = total_working_seconds + $2,
             is_half_day_flagged = true, half_day_flag_reason = 'LATE_CHECKOUT', regularization_status = 'NONE'
           WHERE id = $3`,
          [checkOutTimestamp, sessionDuration, attendance.__id]
        );
      } else {
        await client.query(
          `UPDATE attendance SET status = 'CHECKED_OUT', check_out = $1, total_working_seconds = total_working_seconds + $2
           WHERE id = $3`,
          [checkOutTimestamp, sessionDuration, attendance.__id]
        );
      }

      await client.query(
        `INSERT INTO attendance_events (attendance_id, event_type, timestamp) VALUES ($1, 'CHECK_OUT', $2)`,
        [attendance.__id, checkOutTimestamp]
      );
      await client.query(`UPDATE users SET status = 'CHECKED_OUT' WHERE id = $1`, [attendance.__userId]);
    });

    const updated = await getTodayAttendance(employeeId, todayStr);
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Check-out failed' });
  }
});

// --- Submit a regularization request for a half-day-flagged attendance record ---
router.post('/regularize/:attendanceId', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const { remark } = req.body;
    if (!remark || !String(remark).trim()) {
      return res.status(400).json({ error: 'A remark explaining the late sign-out is required' });
    }

    const attendanceId = req.params.attendanceId;
    const { rows } = await query(
      `SELECT a.*, u.id AS user_id, u.employee_id AS employee_code, u.reporting_manager_id
       FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE a.id = $1 AND u.employee_id = $2`,
      [attendanceId, employeeId]
    );
    const attendance = rows[0];
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    if (!attendance.is_half_day_flagged) {
      return res.status(400).json({ error: 'This attendance record is not flagged as half day' });
    }
    if (attendance.regularization_status === 'PENDING') {
      return res.status(400).json({ error: 'A regularization request is already pending for this day' });
    }
    if (attendance.regularization_status === 'APPROVED') {
      return res.status(400).json({ error: 'This day has already been regularized' });
    }

    const now = new Date();
    const { rows: countRows } = await query(
      `SELECT COUNT(*)::int AS count FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE u.employee_id = $1 AND date_trunc('month', a.regularization_requested_at) = date_trunc('month', $2::timestamptz)`,
      [employeeId, now]
    );
    if (countRows[0].count >= 3) {
      return res.status(400).json({ error: 'Regularization limit reached (maximum 3 times per month)' });
    }

    let managerUserId: string | null = null;
    if (attendance.reporting_manager_id) {
      const { rows: mgrRows } = await query(`SELECT id FROM users WHERE id = $1`, [attendance.reporting_manager_id]);
      if (mgrRows[0]) managerUserId = mgrRows[0].id;
    }

    await query(
      `UPDATE attendance
       SET regularization_status = 'PENDING', regularization_remark = $1, regularization_requested_at = $2,
           regularization_manager_id = $3
       WHERE id = $4`,
      [String(remark).trim(), now, managerUserId, attendanceId]
    );

    const updatedRes = await query(`SELECT * FROM attendance WHERE id = $1`, [attendanceId]);
    res.json({ message: 'Regularization request submitted successfully', attendance: mapAttendance(updatedRes.rows[0]) });
  } catch (error) {
    console.error('Failed to submit regularization request:', error);
    res.status(500).json({ error: 'Failed to submit regularization request' });
  }
});

// --- Get regularization requests awaiting this manager's (or admin's) review ---
router.get('/regularize/team', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;

    const params: any[] = [];
    let where = `a.regularization_status IN ('PENDING','APPROVED','REJECTED')`;
    if (role !== 'ADMIN') {
      params.push(userId);
      where += ` AND a.regularization_manager_id = $${params.length}`;
    }

    const { rows } = await query(
      `SELECT a.*, u.employee_id AS employee_code, u.name AS user_name, u.email AS user_email
       FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE ${where}
       ORDER BY a.regularization_requested_at DESC NULLS LAST`,
      params
    );

    const withEmployeeInfo = rows.map((rec) => ({
      ...mapAttendance(rec),
      employeeName: rec.user_name || rec.employee_code,
      employeeEmail: rec.user_email,
    }));
    res.json(withEmployeeInfo);
  } catch (error) {
    console.error('Failed to fetch regularization requests:', error);
    res.status(500).json({ error: 'Failed to fetch regularization requests' });
  }
});

// --- Approve / Reject a regularization request (Reporting Manager or Admin) ---
router.put('/regularize/:attendanceId/status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const role = req.user!.role;
    const { status, managerComment } = req.body;
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const attendanceId = req.params.attendanceId;
    const { rows } = await query(`SELECT * FROM attendance WHERE id = $1`, [attendanceId]);
    const attendance = rows[0];
    if (!attendance) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }
    if (attendance.regularization_status !== 'PENDING') {
      return res.status(400).json({ error: 'This request is not pending review' });
    }

    const isManager = attendance.regularization_manager_id && attendance.regularization_manager_id === userId;
    const isAdmin = role === 'ADMIN';
    if (!isManager && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to review this request' });
    }

    const updates: string[] = [
      `regularization_status = $1`,
      `regularization_manager_comment = $2`,
      `regularization_reviewed_at = $3`,
      `regularization_reviewed_by = $4`,
    ];
    const params: any[] = [status, managerComment || '', new Date(), userId];
    if (status === 'APPROVED') {
      updates.push(`is_half_day_flagged = false`);
    }
    params.push(attendanceId);

    await query(`UPDATE attendance SET ${updates.join(', ')} WHERE id = $${params.length}`, params);
    res.json({ message: `Regularization request ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Failed to update regularization status:', error);
    res.status(500).json({ error: 'Failed to update regularization status' });
  }
});

router.get('/custom-signin-quota', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const now = new Date();
    const { rows } = await query(
      `SELECT COUNT(*)::int AS count FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE u.employee_id = $1 AND date_trunc('month', a.work_date) = date_trunc('month', $2::date) AND a.is_custom_sign_in = true`,
      [employeeId, getISTTodayString(now)]
    );
    const count = rows[0].count;
    res.json({
      usedCount: count,
      limit: 3,
      remainingCount: Math.max(0, 3 - count),
      canUseCustomSignIn: count < 3,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch custom sign-in quota' });
  }
});

router.get('/today', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const todayStr = getISTTodayString(new Date());
    const [attendance, companyWfhRes] = await Promise.all([
      getTodayAttendance(req.user!.employeeId, todayStr),
      query(`SELECT * FROM wfh_days WHERE wfh_date = $1::date LIMIT 1`, [todayStr]),
    ]);
    const companyWfhDay = companyWfhRes.rows[0];

    if (attendance) {
      res.json({
        ...attendance,
        isCompanyWfhDay: !!companyWfhDay,
        companyWfhDay: companyWfhDay ? mapWfhDay(companyWfhDay) : null,
      });
    } else {
      res.json(null);
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch today attendance' });
  }
});

router.get('/today-status', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const todayStr = getISTTodayString(new Date());
    const [attendance, companyWfhRes] = await Promise.all([
      getTodayAttendance(req.user!.employeeId, todayStr),
      query(`SELECT * FROM wfh_days WHERE wfh_date = $1::date LIMIT 1`, [todayStr]),
    ]);
    const companyWfhDay = companyWfhRes.rows[0];
    res.json({
      attendance: attendance || null,
      isCompanyWfhDay: !!companyWfhDay,
      companyWfhDay: companyWfhDay ? mapWfhDay(companyWfhDay) : null,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch today status' });
  }
});

router.get('/wfh-days', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM wfh_days ORDER BY wfh_date ASC`);
    res.json(rows.map(mapWfhDay));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch company WFH days' });
  }
});

router.get('/monthly', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const { month, year, startDate: rangeStart, endDate: rangeEnd } = req.query as any;
    let startDate: string, endDate: string;
    if (rangeStart && rangeEnd) {
      startDate = String(rangeStart);
      endDate = String(rangeEnd);
    } else if (month && year) {
      const y = Number(year), m = Number(month);
      startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      endDate = toDateStr(new Date(y, m, 0)) as string;
    } else {
      const now = new Date();
      startDate = toDateStr(new Date(now.getFullYear(), now.getMonth(), 1)) as string;
      endDate = toDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0)) as string;
    }

    const { rows } = await query(
      `SELECT a.*, u.employee_id AS employee_code FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE u.employee_id = $1 AND a.work_date BETWEEN $2::date AND $3::date
       ORDER BY a.work_date ASC`,
      [employeeId, startDate, endDate]
    );

    const recordsWithEvents = await Promise.all(
      rows.map(async (rec) => {
        const { rows: eventRows } = await query(
          `SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY timestamp ASC`,
          [rec.id]
        );
        return { ...mapAttendance(rec), events: eventRows.map(mapAttendanceEvent) };
      })
    );
    res.json(recordsWithEvents);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch monthly attendance' });
  }
});

// --- Fetch Salary & Payroll details for logged-in employee ---
router.get('/salary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const { month, year } = req.query as any;

    if (!month || !year) {
      return res.status(400).json({ error: 'Missing month and year' });
    }

    const m = Number(month);
    const y = Number(year);
    const daysInMonth = new Date(y, m, 0).getDate();

    const { rows: empRows } = await query(`SELECT * FROM users WHERE employee_id = $1`, [employeeId]);
    const emp = empRows[0];
    if (!emp) return res.status(404).json({ error: 'Employee not found' });

    const mm = String(m).padStart(2, '0');
    const startDateStr = `${y}-${mm}-01`;
    const endDateStr = `${y}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    const { rows: records } = await query(
      `SELECT * FROM attendance WHERE user_id = $1 AND work_date BETWEEN $2::date AND $3::date`,
      [emp.id, startDateStr, endDateStr]
    );

    const { rows: settingsRows } = await query(`SELECT * FROM settings WHERE id = 1`);
    const currentSettings = settingsRows[0] || {
      pf_employee_rate: 0.12, pf_employer_rate: 0.12, esi_employee_rate: 0.0075, esi_employer_rate: 0.0325, work_week_pattern: '6_DAYS',
    };

    const { rows: monthHolidays } = await query(
      `SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1::date AND $2::date`,
      [startDateStr, endDateStr]
    );
    const holidayDateSet = new Set(monthHolidays.map((h) => toDateStr(h.holiday_date)));

    let workingDaysCount = 0;
    let holidaysCount = 0;
    let weeklyOffsCount = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(y, m - 1, day);
      const dayOfWeek = d.getDay();
      const dd = String(day).padStart(2, '0');
      const dateStr = `${y}-${mm}-${dd}`;

      let isWeeklyOff = false;
      const pattern = currentSettings.work_week_pattern || '6_DAYS';
      if (pattern === '5_DAYS') {
        isWeeklyOff = (dayOfWeek === 0 || dayOfWeek === 6);
      } else if (pattern === 'ALTERNATE_SATURDAYS') {
        const weekNum = Math.ceil(day / 7);
        isWeeklyOff = (dayOfWeek === 0 || (dayOfWeek === 6 && (weekNum === 2 || weekNum === 4)));
      } else {
        isWeeklyOff = (dayOfWeek === 0);
      }

      if (isWeeklyOff) {
        weeklyOffsCount++;
      } else if (holidayDateSet.has(dateStr)) {
        holidaysCount++;
      } else {
        workingDaysCount++;
      }
    }

    if (workingDaysCount === 0) workingDaysCount = daysInMonth;

    const eligibleDays = Math.min(workingDaysCount, records.length);
    const basicSalary = Number(emp.basic_salary) || 0;
    const grossSalary = Number(emp.gross_salary) || 0;
    const otherDeductions = Number(emp.other_deductions) || 0;

    const earnedBasic = (basicSalary / workingDaysCount) * eligibleDays;
    const earnedGross = (grossSalary / workingDaysCount) * eligibleDays;

    const employeePF = emp.pf_applicable ? earnedBasic * Number(currentSettings.pf_employee_rate) : 0;
    const employerPF = emp.pf_applicable ? earnedBasic * Number(currentSettings.pf_employer_rate) : 0;

    const employeeESI = emp.esi_applicable && grossSalary <= 21000 ? earnedGross * Number(currentSettings.esi_employee_rate) : 0;
    const employerESI = emp.esi_applicable && grossSalary <= 21000 ? earnedGross * Number(currentSettings.esi_employer_rate) : 0;

    const netSalary = Math.max(0, earnedGross - employeePF - employeeESI - otherDeductions);

    res.json({
      employeeId: emp.employee_id,
      name: emp.name,
      basicSalary,
      grossSalary,
      daysInMonth,
      totalWorkingDays: workingDaysCount,
      holidaysInMonth: holidaysCount,
      weeklyOffsInMonth: weeklyOffsCount,
      eligibleDays,
      earnedBasic,
      earnedGross,
      employeePF,
      employerPF,
      employeeESI,
      employerESI,
      otherDeductions,
      netSalary,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate salary' });
  }
});

// --- Public/Employee Holidays List ---
router.get('/holidays', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.json(rows.map(mapHoliday));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// --- Employee Leave Summary & Holidays Worked ---
router.get('/leave-summary', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const employeeId = req.user!.employeeId;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
    const monthPrefix = `${currentYear}-${currentMonth}`;

    const { rows: approvedLeaves } = await query(
      `SELECT p.* FROM permissions p JOIN users u ON u.id = p.employee_id
       WHERE u.employee_id = $1 AND p.request_type IN ('LEAVE','WEEK_OFF') AND p.status = 'APPROVED'
       ORDER BY p.request_date DESC`,
      [employeeId]
    );

    const currentMonthLeaves = approvedLeaves.filter((l) => toDateStr(l.request_date)?.startsWith(monthPrefix));

    const { rows: permCountRows } = await query(
      `SELECT COUNT(*)::int AS count FROM permissions p JOIN users u ON u.id = p.employee_id
       WHERE u.employee_id = $1 AND p.request_type = 'PERMISSION' AND p.status = 'APPROVED'
         AND TO_CHAR(p.request_date, 'YYYY-MM') = $2`,
      [employeeId, monthPrefix]
    );
    const approvedPermissionsThisMonth = permCountRows[0].count;

    // Calculate Holidays Worked (attendance on holidays or Sundays)
    const { rows: allAttendance } = await query(
      `SELECT a.* FROM attendance a JOIN users u ON u.id = a.user_id WHERE u.employee_id = $1`,
      [employeeId]
    );
    const { rows: allHolidays } = await query(`SELECT * FROM holidays`);
    const holidayDateMap = new Map(allHolidays.map((h) => [toDateStr(h.holiday_date), h.name]));

    const holidaysWorkedList: any[] = [];
    let wfoCountMonth = 0;
    let wfhCountMonth = 0;
    for (const rec of allAttendance) {
      const dateStr = toDateStr(rec.work_date) as string;
      const recDate = new Date(dateStr + 'T00:00:00');
      const isSunday = recDate.getDay() === 0;

      if (holidayDateMap.has(dateStr) || isSunday) {
        holidaysWorkedList.push({
          date: dateStr,
          holidayName: holidayDateMap.get(dateStr) || (isSunday ? 'Sunday Weekend' : 'Declared Holiday'),
          checkIn: rec.check_in,
          checkOut: rec.check_out,
          status: rec.status,
          workingSeconds: rec.total_working_seconds || 0,
        });
      }

      if (dateStr.startsWith(monthPrefix)) {
        if (rec.work_mode === 'WFH') wfhCountMonth++;
        else if (rec.work_mode === 'WFO') wfoCountMonth++;
      }
    }

    res.json({
      totalLeaveDaysYear: approvedLeaves.length,
      totalLeaveDaysMonth: currentMonthLeaves.length,
      approvedPermissionsMonth: approvedPermissionsThisMonth,
      wfoCountMonth,
      wfhCountMonth,
      approvedLeaves: approvedLeaves.map((l) => ({ ...l, date: toDateStr(l.request_date) })),
      holidaysWorkedCount: holidaysWorkedList.length,
      holidaysWorkedList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch leave summary' });
  }
});

export default router;
