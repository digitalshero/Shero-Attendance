import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { getISTMinutes, getISTTodayString } from '../utils/time';
import { query, withTransaction } from '../db';
import { mapUser, mapSettings, mapAttendance, mapAttendanceEvent, mapWorkSession, mapPermission, mapHoliday, mapWfhDay, toDateStr } from '../mappers';
import bcrypt from 'bcryptjs';

const router = Router();
router.use(authenticateToken, requireAdmin);

const DEFAULT_DEPARTMENTS = [
  'DST',
  'TECH',
  'HR',
  'OGB',
  'KOB',
  'Accounts',
  'Finance',
  'Compliance',
];

// --- Settings ---
router.get('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM settings WHERE id = 1`);
    let row = rows[0];
    if (row && (!row.departments || row.departments.length === 0)) {
      await query(`UPDATE settings SET departments = $1 WHERE id = 1`, [DEFAULT_DEPARTMENTS]);
      row.departments = DEFAULT_DEPARTMENTS;
    }
    res.json(mapSettings(row));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req: AuthRequest, res: Response) => {
  try {
    const {
      pfEmployeeRate,
      pfEmployerRate,
      esiEmployeeRate,
      esiEmployerRate,
      officeStartTime,
      officeEndTime,
      graceMinutes,
      officeLocation,
      geofenceEnabled,
      departments,
    } = req.body;

    const sets: string[] = [
      'pf_employee_rate = $1',
      'pf_employer_rate = $2',
      'esi_employee_rate = $3',
      'esi_employer_rate = $4',
    ];
    const params: any[] = [Number(pfEmployeeRate), Number(pfEmployerRate), Number(esiEmployeeRate), Number(esiEmployerRate)];

    if (officeStartTime !== undefined) {
      params.push(officeStartTime);
      sets.push(`office_start_time = $${params.length}`);
    }
    if (officeEndTime !== undefined) {
      params.push(officeEndTime);
      sets.push(`office_end_time = $${params.length}`);
    }
    if (graceMinutes !== undefined) {
      params.push(Number(graceMinutes));
      sets.push(`grace_minutes = $${params.length}`);
    }
    if (departments !== undefined && Array.isArray(departments)) {
      const cleaned = Array.from(new Set(departments.map((d: any) => String(d).trim()).filter((d: string) => d.length > 0)));
      params.push(cleaned);
      sets.push(`departments = $${params.length}`);
    }
    if (officeLocation !== undefined) {
      params.push(Number(officeLocation.latitude) || 0);
      sets.push(`office_lat = $${params.length}`);
      params.push(Number(officeLocation.longitude) || 0);
      sets.push(`office_lng = $${params.length}`);
      params.push(Number(officeLocation.radiusMeters) || 500);
      sets.push(`office_radius_m = $${params.length}`);
      params.push(officeLocation.address || '');
      sets.push(`office_address = $${params.length}`);
    }
    if (geofenceEnabled !== undefined) {
      params.push(!!geofenceEnabled);
      sets.push(`geofence_enabled = $${params.length}`);
    }

    const { rows } = await query(
      `UPDATE settings SET ${sets.join(', ')} WHERE id = 1 RETURNING *`,
      params
    );
    res.json(mapSettings(rows[0]));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// --- Dashboard Summary Handler (Supports both /dashboard and /dashboard-summary) ---
const handleDashboardSummary = async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query as any;
    const targetDateStr = date ? String(date) : getISTTodayString(new Date());

    const [todayRes, employeesRes, permsRes, settingsRes] = await Promise.all([
      query(
        `SELECT a.*, u.employee_id AS employee_code, u.name AS user_name, u.email AS user_email, u.work_mode AS user_work_mode
         FROM attendance a JOIN users u ON u.id = a.user_id
         WHERE a.work_date = $1::date`,
        [targetDateStr]
      ),
      query(`SELECT id, name, employee_id, email, work_mode, status FROM users WHERE role = 'EMPLOYEE' AND status != 'INACTIVE'`),
      query(
        `SELECT p.*, u.employee_id AS employee_code, u.name AS employee_name, u.email AS employee_email, u.work_mode AS employee_work_mode
         FROM permissions p JOIN users u ON u.id = p.employee_id
         WHERE p.request_date = $1::date AND p.status != 'REJECTED'`,
        [targetDateStr]
      ),
      query(`SELECT * FROM settings WHERE id = 1`),
    ]);

    const todayRecords = todayRes.rows;
    const allEmployees = employeesRes.rows;
    const permissionsForDate = permsRes.rows;
    const currentSettings = settingsRes.rows[0];
    const officeStartTime = currentSettings?.office_start_time?.slice(0, 5) || '09:00';
    const officeEndTime = currentSettings?.office_end_time?.slice(0, 5) || '18:00';
    const graceMinutes = currentSettings?.grace_minutes ?? 15;

    const [startH, startM] = officeStartTime.split(':').map(Number);
    const thresholdMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM) + graceMinutes;

    const checkedInEmployeeIds = new Set(todayRecords.map((r) => r.employee_code));

    const presentList: any[] = [];
    const lateList: any[] = [];
    const checkedOutList: any[] = [];
    const stoppedList: any[] = [];

    for (const rec of todayRecords) {
      let isLate = false;
      if (rec.check_in) {
        isLate = getISTMinutes(new Date(rec.check_in)) > thresholdMinutes;
      }
      const item = {
        _id: rec.id,
        employeeId: rec.employee_code,
        name: rec.user_name || rec.employee_code,
        email: rec.user_email,
        workMode: rec.work_mode || rec.user_work_mode || 'WFO',
        checkIn: rec.check_in,
        checkOut: rec.check_out,
        status: rec.status,
        totalWorkingSeconds: rec.total_working_seconds || 0,
        isLate,
      };
      presentList.push(item);
      if (isLate) lateList.push(item);
      if (rec.status === 'CHECKED_OUT') checkedOutList.push(item);
      if (rec.status === 'STOPPED') stoppedList.push(item);
    }

    const absentList = allEmployees
      .filter((emp) => !checkedInEmployeeIds.has(emp.employee_id))
      .map((emp) => ({
        employeeId: emp.employee_id,
        name: emp.name,
        email: emp.email,
        workMode: emp.work_mode || 'WFO',
        status: 'ABSENT',
      }));

    const permissionList = permissionsForDate.map((p) => ({
      _id: p.id,
      employeeId: p.employee_code,
      name: p.employee_name || p.employee_code,
      email: p.employee_email,
      workMode: p.employee_work_mode || 'WFO',
      requestType: p.request_type,
      reason: p.reason,
      attachmentUrl: p.attachment_url || null,
      attachmentName: p.attachment_name || null,
      status: p.status,
      date: toDateStr(p.request_date),
      startTime: p.start_time?.slice(0, 5),
      endTime: p.end_time?.slice(0, 5),
    }));

    res.json({
      present: todayRecords.length,
      lateToday: lateList.length,
      workingNow: todayRecords.filter((r) => r.status === 'WORKING').length,
      permissionCount: permissionsForDate.length,
      stoppedNow: stoppedList.length,
      checkedOut: checkedOutList.length,
      absent: absentList.length,
      presentList,
      lateList,
      permissionList,
      absentList,
      checkedOutList,
      stoppedList,
      officeTiming: { officeStartTime, officeEndTime, graceMinutes },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard summary' });
  }
};

router.get('/dashboard', handleDashboardSummary);
router.get('/dashboard-summary', handleDashboardSummary);

// --- All attendance (for a given date) ---
router.get('/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const { date } = req.query as any;
    const targetDateStr = date ? String(date) : getISTTodayString(new Date());

    const { rows: settingsRows } = await query(`SELECT * FROM settings WHERE id = 1`);
    const currentSettings = settingsRows[0];
    const officeStartTime = currentSettings?.office_start_time?.slice(0, 5) || '09:00';
    const graceMinutes = currentSettings?.grace_minutes ?? 15;
    const [startH, startM] = officeStartTime.split(':').map(Number);
    const thresholdMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM) + graceMinutes;

    const { rows: records } = await query(
      `SELECT a.*, u.name AS user_name, u.employee_id AS employee_code, u.work_mode AS user_work_mode
       FROM attendance a JOIN users u ON u.id = a.user_id
       WHERE a.work_date = $1::date
       ORDER BY a.check_in ASC NULLS LAST`,
      [targetDateStr]
    );

    const recordsWithUser = await Promise.all(
      records.map(async (rec) => {
        const { rows: eventRows } = await query(
          `SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY timestamp ASC`,
          [rec.id]
        );
        let isLate = false;
        if (rec.check_in) {
          isLate = getISTMinutes(new Date(rec.check_in)) > thresholdMinutes;
        }
        return {
          ...mapAttendance(rec),
          user: { name: rec.user_name, employeeId: rec.employee_code, workMode: rec.user_work_mode },
          events: eventRows.map(mapAttendanceEvent),
          isLate,
        };
      })
    );
    res.json(recordsWithUser);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch attendance list' });
  }
});

// --- Single attendance record detail ---
router.get('/attendance/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT a.*, u.name AS user_name, u.employee_id AS employee_code
       FROM attendance a JOIN users u ON u.id = a.user_id WHERE a.id = $1`,
      [req.params.id]
    );
    const record = rows[0];
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const [eventsRes, sessionsRes] = await Promise.all([
      query(`SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY timestamp ASC`, [record.id]),
      query(`SELECT * FROM work_sessions WHERE attendance_id = $1 ORDER BY start_time ASC`, [record.id]),
    ]);

    res.json({
      ...mapAttendance(record),
      user: { name: record.user_name, employeeId: record.employee_code },
      events: eventsRes.rows.map(mapAttendanceEvent),
      workSessions: sessionsRes.rows.map(mapWorkSession),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch attendance details' });
  }
});

// --- Fetch all managers/users available to be assigned as manager ---
router.get('/managers', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT id, name, employee_id, role, email FROM users WHERE status != 'INACTIVE' ORDER BY role ASC, name ASC`
    );
    res.json(rows.map((r) => ({ _id: r.id, id: r.id, name: r.name, employeeId: r.employee_id, role: r.role, email: r.email })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch managers' });
  }
});

// --- Fetch all employees with reporting manager populated ---
router.get('/employees', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(
      `SELECT u.*, m.id AS mgr_id, m.name AS mgr_name, m.employee_id AS mgr_employee_code, m.role AS mgr_role, m.email AS mgr_email
       FROM users u LEFT JOIN users m ON m.id = u.reporting_manager_id
       WHERE u.role = 'EMPLOYEE'
       ORDER BY u.name ASC`
    );

    const populatedEmployees = rows.map((emp) => ({
      ...mapUser(emp),
      reportingManager: emp.mgr_id
        ? { id: emp.mgr_id, name: emp.mgr_name, employeeId: emp.mgr_employee_code, role: emp.mgr_role, email: emp.mgr_email }
        : null,
    }));

    res.json(populatedEmployees);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
});

// --- Fetch single employee entire profile details ---
router.get('/employees/:id/detail', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { rows: empRows } = await query(`SELECT * FROM users WHERE id::text = $1 OR employee_id = $1`, [id]);
    const emp = empRows[0];
    if (!emp) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    let manager: any = null;
    if (emp.reporting_manager_id) {
      const { rows: mgrRows } = await query(`SELECT * FROM users WHERE id = $1`, [emp.reporting_manager_id]);
      manager = mgrRows[0] || null;
    }

    const [recentRes, leavesRes, allAttendanceRes, allHolidaysRes] = await Promise.all([
      query(`SELECT * FROM attendance WHERE user_id = $1 ORDER BY work_date DESC LIMIT 10`, [emp.id]),
      query(
        `SELECT * FROM permissions WHERE employee_id = $1 AND request_type = 'LEAVE' AND status = 'APPROVED' ORDER BY request_date DESC`,
        [emp.id]
      ),
      query(`SELECT * FROM attendance WHERE user_id = $1`, [emp.id]),
      query(`SELECT * FROM holidays`),
    ]);

    const holidayDateMap = new Map(allHolidaysRes.rows.map((h) => [toDateStr(h.holiday_date), h.name]));
    const holidaysWorkedList: any[] = [];
    for (const rec of allAttendanceRes.rows) {
      const dateStr = toDateStr(rec.work_date) as string;
      const recDate = new Date(dateStr + 'T00:00:00');
      const isSunday = recDate.getDay() === 0;
      if (holidayDateMap.has(dateStr) || isSunday) {
        holidaysWorkedList.push({
          date: dateStr,
          holidayName: holidayDateMap.get(dateStr) || (isSunday ? 'Sunday Weekend' : 'Holiday'),
          checkIn: rec.check_in,
          checkOut: rec.check_out,
          status: rec.status,
          workingSeconds: rec.total_working_seconds || 0,
        });
      }
    }

    res.json({
      employee: {
        ...mapUser(emp),
        reportingManager: manager
          ? { id: manager.id, name: manager.name, employeeId: manager.employee_id, email: manager.email, role: manager.role }
          : null,
      },
      recentAttendance: recentRes.rows.map(mapAttendance),
      approvedLeaves: leavesRes.rows.map((l) => ({ ...mapPermission(l), date: toDateStr(l.request_date) })),
      holidaysWorkedCount: holidaysWorkedList.length,
      holidaysWorkedList,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employee detail' });
  }
});

// --- Fetch a specific employee's attendance history ---
router.get('/employees/:employeeId/attendance', async (req: AuthRequest, res: Response) => {
  try {
    const { employeeId } = req.params;
    const { rows: records } = await query(
      `SELECT a.* FROM attendance a JOIN users u ON u.id = a.user_id WHERE u.employee_id = $1 ORDER BY a.work_date DESC`,
      [employeeId]
    );

    const recordsWithEvents = await Promise.all(
      records.map(async (rec) => {
        const { rows: eventRows } = await query(
          `SELECT * FROM attendance_events WHERE attendance_id = $1 ORDER BY timestamp ASC`,
          [rec.id]
        );
        return { ...mapAttendance(rec), events: eventRows.map(mapAttendanceEvent) };
      })
    );
    res.json(recordsWithEvents);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch employee attendance history' });
  }
});

// --- Admin creates a new employee ---
router.post('/employees', async (req: AuthRequest, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      employeeId,
      department,
      designation,
      dateOfBirth,
      status = 'ACTIVE',
      workMode = 'WFO',
      isSsc = false,
      rollType,
      roleType = 'ON_ROLE',
      employmentType,
      basicSalary,
      grossSalary,
      pfApplicable,
      esiApplicable,
      otherDeductions,
      reportingManagerId,
    } = req.body as any;

    if (!name || !email || !password || !employeeId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { rows: existingEmailRows } = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existingEmailRows[0]) {
      return res.status(409).json({ error: 'User with this email already exists' });
    }
    const { rows: existingEmpIdRows } = await query(`SELECT id FROM users WHERE employee_id = $1`, [employeeId]);
    if (existingEmpIdRows[0]) {
      return res.status(409).json({ error: 'User with this Employee ID already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const validWorkMode = ['WFO', 'WFH', 'HYBRID'].includes(workMode) ? workMode : 'WFO';
    const incomingType = String(rollType || roleType || employmentType || 'ON_ROLL').trim().toUpperCase();
    const validRollType = ['OFF_ROLE', 'OFF_ROLL', 'OFF-ROLE', 'OFF-ROLL', 'OFF ROLE', 'OFF ROLL'].includes(incomingType)
      ? 'OFF_ROLL'
      : 'ON_ROLL';

    const { rows } = await query(
      `INSERT INTO users
        (name, email, password_hash, role, employee_id, department, designation, date_of_birth, status, work_mode,
         is_ssc, roll_type, reporting_manager_id, basic_salary, gross_salary, pf_applicable, esi_applicable, other_deductions)
       VALUES ($1,$2,$3,'EMPLOYEE',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING id`,
      [
        name,
        email,
        passwordHash,
        employeeId,
        department ? String(department).trim() : '',
        designation ? String(designation).trim() : '',
        dateOfBirth ? String(dateOfBirth).trim() : null,
        status,
        validWorkMode,
        Boolean(isSsc),
        validRollType,
        reportingManagerId || null,
        basicSalary ? Number(basicSalary) : 0,
        grossSalary ? Number(grossSalary) : 0,
        Boolean(pfApplicable),
        Boolean(esiApplicable),
        otherDeductions ? Number(otherDeductions) : 0,
      ]
    );
    res.status(201).json({ insertedId: rows[0].id });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create employee' });
  }
});

// --- Admin Bulk Imports Employees from Excel data ---
router.post('/employees/bulk-import', async (req: AuthRequest, res: Response) => {
  try {
    const { employees: importedList } = req.body as { employees: any[] };

    if (!Array.isArray(importedList) || importedList.length === 0) {
      return res.status(400).json({ error: 'No employee records provided for import' });
    }

    const { rows: allUsers } = await query(`SELECT id, email, employee_id FROM users`);
    const existingEmails = new Set(allUsers.map((u) => u.email.toLowerCase().trim()));
    const existingEmpIds = new Set(allUsers.map((u) => u.employee_id.toLowerCase().trim()));
    const userMapByEmpId = new Map(allUsers.map((u) => [u.employee_id.toLowerCase().trim(), u.id]));
    const userMapByEmail = new Map(allUsers.map((u) => [u.email.toLowerCase().trim(), u.id]));

    const batchEmails = new Set<string>();
    const batchEmpIds = new Set<string>();

    const toInsert: any[] = [];
    const skippedRecords: Array<{ employeeId?: string; name?: string; email?: string; reason: string }> = [];

    for (let i = 0; i < importedList.length; i++) {
      const row = importedList[i];
      const rowIndex = i + 1;

      const name = String(row.name || '').trim();
      const email = String(row.email || '').trim().toLowerCase();
      const employeeId = String(row.employeeId || '').trim();
      const rawPassword = String(row.password || '').trim() || `${employeeId || 'Welcome'}@123`;
      const department = String(row.department || '').trim();
      const rawWorkMode = String(row.workMode || 'WFO').trim().toUpperCase();
      const workMode = ['WFO', 'WFH', 'HYBRID'].includes(rawWorkMode) ? rawWorkMode : 'WFO';
      const rawStatus = String(row.status || 'ACTIVE').trim().toUpperCase();
      const status = ['ACTIVE', 'INACTIVE', 'STOPPED'].includes(rawStatus) ? rawStatus : 'ACTIVE';
      const isSsc = Boolean(
        row.isSsc === true ||
          String(row.isSsc).toLowerCase() === 'true' ||
          String(row.isSsc).toLowerCase() === 'yes' ||
          String(row.isSsc) === '1'
      );

      if (!name) {
        skippedRecords.push({ employeeId, name, email, reason: `Row #${rowIndex}: Name is missing` });
        continue;
      }
      if (!email || !email.includes('@')) {
        skippedRecords.push({ employeeId, name, email, reason: `Row #${rowIndex}: Invalid or missing email (${email || 'blank'})` });
        continue;
      }
      if (!employeeId) {
        skippedRecords.push({ employeeId, name, email, reason: `Row #${rowIndex}: Employee ID is missing` });
        continue;
      }
      if (existingEmails.has(email)) {
        skippedRecords.push({ employeeId, name, email, reason: `Email "${email}" already exists in database` });
        continue;
      }
      if (existingEmpIds.has(employeeId.toLowerCase())) {
        skippedRecords.push({ employeeId, name, email, reason: `Employee ID "${employeeId}" already exists in database` });
        continue;
      }
      if (batchEmails.has(email)) {
        skippedRecords.push({ employeeId, name, email, reason: `Duplicate email "${email}" within uploaded file` });
        continue;
      }
      if (batchEmpIds.has(employeeId.toLowerCase())) {
        skippedRecords.push({ employeeId, name, email, reason: `Duplicate Employee ID "${employeeId}" within uploaded file` });
        continue;
      }

      let reportingManagerId: string | null = null;
      if (row.reportingManagerId) {
        const mgrKey = String(row.reportingManagerId).trim().toLowerCase();
        if (userMapByEmpId.has(mgrKey)) {
          reportingManagerId = userMapByEmpId.get(mgrKey) || null;
        } else if (userMapByEmail.has(mgrKey)) {
          reportingManagerId = userMapByEmail.get(mgrKey) || null;
        }
      }

      const rawRollType = String(
        row.rollType || row.roleType || row.employmentType || row['Roll Type'] || row['Role Type'] || row['Employment Type'] || 'ON_ROLL'
      )
        .trim()
        .toUpperCase();
      const rollType = ['OFF_ROLE', 'OFF_ROLL', 'OFF-ROLE', 'OFF-ROLL', 'OFF ROLE', 'OFF ROLL'].includes(rawRollType) ? 'OFF_ROLL' : 'ON_ROLL';
      const passwordHash = await bcrypt.hash(rawPassword, 10);

      toInsert.push({
        name,
        email,
        passwordHash,
        employeeId,
        department,
        designation: String(row.designation || row['Designation'] || '').trim(),
        dateOfBirth: String(row.dateOfBirth || row['Date of Birth'] || '').trim() || null,
        status,
        workMode,
        isSsc,
        rollType,
        reportingManagerId,
        basicSalary: row.basicSalary ? Number(row.basicSalary) : 0,
        grossSalary: row.grossSalary ? Number(row.grossSalary) : 0,
        pfApplicable: Boolean(row.pfApplicable),
        esiApplicable: Boolean(row.esiApplicable),
        otherDeductions: row.otherDeductions ? Number(row.otherDeductions) : 0,
      });

      batchEmails.add(email);
      batchEmpIds.add(employeeId.toLowerCase());
    }

    if (toInsert.length > 0) {
      await withTransaction(async (client) => {
        for (const row of toInsert) {
          await client.query(
            `INSERT INTO users
              (name, email, password_hash, role, employee_id, department, designation, date_of_birth, status, work_mode,
               is_ssc, roll_type, reporting_manager_id, basic_salary, gross_salary, pf_applicable, esi_applicable, other_deductions)
             VALUES ($1,$2,$3,'EMPLOYEE',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
            [
              row.name,
              row.email,
              row.passwordHash,
              row.employeeId,
              row.department,
              row.designation,
              row.dateOfBirth,
              row.status,
              row.workMode,
              row.isSsc,
              row.rollType,
              row.reportingManagerId,
              row.basicSalary,
              row.grossSalary,
              row.pfApplicable,
              row.esiApplicable,
              row.otherDeductions,
            ]
          );
        }
      });
    }

    res.status(200).json({
      message: `Successfully imported ${toInsert.length} employees`,
      importedCount: toInsert.length,
      skippedCount: skippedRecords.length,
      skippedRecords,
    });
  } catch (error) {
    console.error('Bulk import employees error:', error);
    res.status(500).json({ error: 'Failed to bulk import employees' });
  }
});

// --- Admin updates an employee (Full details: name, email, employeeId, password, status, workMode, salary, manager) ---
router.put('/employees/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const {
      name,
      email,
      password,
      employeeId,
      department,
      designation,
      dateOfBirth,
      status,
      workMode,
      isSsc,
      rollType,
      roleType,
      employmentType,
      reportingManagerId,
      basicSalary,
      grossSalary,
      pfApplicable,
      esiApplicable,
      otherDeductions,
    } = req.body as any;

    const { rows: existingRows } = await query(`SELECT * FROM users WHERE id = $1`, [id]);
    const existingUser = existingRows[0];
    if (!existingUser) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    const sets: string[] = [];
    const params: any[] = [];
    const addSet = (col: string, val: any) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (name !== undefined) addSet('name', String(name).trim());

    if (email !== undefined && email !== existingUser.email) {
      const { rows: conflictRows } = await query(`SELECT id FROM users WHERE email = $1 AND id != $2`, [String(email).trim(), id]);
      if (conflictRows[0]) {
        return res.status(409).json({ error: 'Another user already has this email address' });
      }
      addSet('email', String(email).trim());
    }

    const oldEmployeeId = existingUser.employee_id;
    let newEmpId: string | undefined;
    if (employeeId !== undefined && employeeId !== oldEmployeeId) {
      const trimmedEmpId = String(employeeId).trim();
      const { rows: conflictRows } = await query(`SELECT id FROM users WHERE employee_id = $1 AND id != $2`, [trimmedEmpId, id]);
      if (conflictRows[0]) {
        return res.status(409).json({ error: 'Another user already has this Employee ID' });
      }
      newEmpId = trimmedEmpId;
      addSet('employee_id', trimmedEmpId);
    }

    if (password && String(password).trim().length > 0) {
      addSet('password_hash', await bcrypt.hash(String(password).trim(), 10));
    }
    if (department !== undefined) addSet('department', String(department).trim());
    if (designation !== undefined) addSet('designation', String(designation).trim());
    if (dateOfBirth !== undefined) addSet('date_of_birth', String(dateOfBirth).trim() || null);
    if (status !== undefined) addSet('status', status);
    if (workMode !== undefined) addSet('work_mode', ['WFO', 'WFH', 'HYBRID'].includes(workMode) ? workMode : 'WFO');
    if (isSsc !== undefined) addSet('is_ssc', Boolean(isSsc));

    if (rollType !== undefined || roleType !== undefined || employmentType !== undefined) {
      const incomingType = String(rollType !== undefined ? rollType : roleType !== undefined ? roleType : employmentType).trim().toUpperCase();
      const validRollType = ['OFF_ROLE', 'OFF_ROLL', 'OFF-ROLE', 'OFF-ROLL', 'OFF ROLE', 'OFF ROLL'].includes(incomingType) ? 'OFF_ROLL' : 'ON_ROLL';
      addSet('roll_type', validRollType);
    }

    if (reportingManagerId !== undefined) {
      if (reportingManagerId && reportingManagerId === id) {
        return res.status(400).json({ error: 'An employee cannot be their own reporting manager' });
      }
      addSet('reporting_manager_id', reportingManagerId || null);
    }

    if (basicSalary !== undefined) addSet('basic_salary', Number(basicSalary) || 0);
    if (grossSalary !== undefined) addSet('gross_salary', Number(grossSalary) || 0);
    if (pfApplicable !== undefined) addSet('pf_applicable', Boolean(pfApplicable));
    if (esiApplicable !== undefined) addSet('esi_applicable', Boolean(esiApplicable));
    if (otherDeductions !== undefined) addSet('other_deductions', Number(otherDeductions) || 0);

    if (sets.length > 0) {
      params.push(id);
      await query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length}`, params);
    }

    // If employeeId changed, cascade to permissions' denormalized manager-reference fields.
    // Attendance/events/work_sessions reference users via FK (user_id), so no cascade needed there.
    if (newEmpId && newEmpId !== oldEmployeeId) {
      // nothing additional required: all FKs reference users.id, not employee_id text
    }

    res.json({ message: 'Employee details updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
});

router.put('/employees/:id/manager', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { reportingManagerId } = req.body;

    if (reportingManagerId && reportingManagerId === id) {
      return res.status(400).json({ error: 'An employee cannot be their own reporting manager' });
    }

    if (reportingManagerId) {
      const { rows: mgrRows } = await query(`SELECT id FROM users WHERE id = $1`, [reportingManagerId]);
      if (!mgrRows[0]) {
        return res.status(404).json({ error: 'Selected reporting manager not found' });
      }
    }

    const { rowCount } = await query(`UPDATE users SET reporting_manager_id = $1 WHERE id = $2`, [reportingManagerId || null, id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Reporting manager updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update reporting manager' });
  }
});

// --- Admin sets salary for an existing employee ---
router.put('/employees/:id/salary', async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const { basicSalary, grossSalary, pfApplicable, esiApplicable, otherDeductions } = req.body;

    if (basicSalary === undefined || grossSalary === undefined) {
      return res.status(400).json({ error: 'Missing basicSalary or grossSalary' });
    }

    const { rowCount } = await query(
      `UPDATE users SET basic_salary = $1, gross_salary = $2, pf_applicable = $3, esi_applicable = $4, other_deductions = $5 WHERE id = $6`,
      [Number(basicSalary), Number(grossSalary), Boolean(pfApplicable), Boolean(esiApplicable), Number(otherDeductions) || 0, id]
    );

    if (rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }

    res.json({ message: 'Salary updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update salary' });
  }
});

// --- Helper to calculate working days in a month excluding weekly offs and declared holidays ---
const getMonthWorkingDaysStats = async (year: number, month: number, workWeekPattern: string = '6_DAYS') => {
  const daysInMonth = new Date(year, month, 0).getDate();
  const mm = String(month).padStart(2, '0');
  const startDateStr = `${year}-${mm}-01`;
  const endDateStr = `${year}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

  const { rows: monthHolidays } = await query(
    `SELECT holiday_date FROM holidays WHERE holiday_date BETWEEN $1::date AND $2::date`,
    [startDateStr, endDateStr]
  );
  const holidayDateSet = new Set(monthHolidays.map((h) => toDateStr(h.holiday_date)));

  let workingDaysCount = 0;
  let holidaysCount = 0;
  let weeklyOffsCount = 0;
  const workingDates: string[] = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    const dd = String(day).padStart(2, '0');
    const dateStr = `${year}-${mm}-${dd}`;

    let isWeeklyOff = false;
    if (workWeekPattern === '5_DAYS') {
      isWeeklyOff = dayOfWeek === 0 || dayOfWeek === 6;
    } else if (workWeekPattern === 'ALTERNATE_SATURDAYS') {
      const weekNum = Math.ceil(day / 7);
      isWeeklyOff = dayOfWeek === 0 || (dayOfWeek === 6 && (weekNum === 2 || weekNum === 4));
    } else {
      isWeeklyOff = dayOfWeek === 0;
    }

    if (isWeeklyOff) {
      weeklyOffsCount++;
    } else if (holidayDateSet.has(dateStr)) {
      holidaysCount++;
    } else {
      workingDaysCount++;
      workingDates.push(dateStr);
    }
  }

  if (workingDaysCount === 0) workingDaysCount = daysInMonth;

  return { daysInMonth, workingDaysCount, holidaysCount, weeklyOffsCount, workingDates };
};

// --- Admin Payroll Calculation ---
router.get('/payroll', async (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.query as any;
    if (!month || !year) return res.status(400).json({ error: 'Missing month and year' });

    const m = Number(month);
    const y = Number(year);
    const mm = String(m).padStart(2, '0');
    const daysInMonth = new Date(y, m, 0).getDate();
    const startDateStr = `${y}-${mm}-01`;
    const endDateStr = `${y}-${mm}-${String(daysInMonth).padStart(2, '0')}`;

    const { rows: settingsRows } = await query(`SELECT * FROM settings WHERE id = 1`);
    const currentSettings = settingsRows[0] || {
      pf_employee_rate: 0.12,
      pf_employer_rate: 0.12,
      esi_employee_rate: 0.0075,
      esi_employer_rate: 0.0325,
      work_week_pattern: '6_DAYS',
    };

    const { workingDaysCount, holidaysCount, weeklyOffsCount } = await getMonthWorkingDaysStats(
      y,
      m,
      currentSettings.work_week_pattern || '6_DAYS'
    );

    const { rows: employees } = await query(`SELECT * FROM users WHERE role = 'EMPLOYEE'`);
    const { rows: records } = await query(
      `SELECT user_id, COUNT(*)::int AS attended_days FROM attendance WHERE work_date BETWEEN $1::date AND $2::date GROUP BY user_id`,
      [startDateStr, endDateStr]
    );
    const attendedMap = new Map(records.map((r) => [r.user_id, r.attended_days]));

    const payroll = employees.map((emp) => {
      const attendedDays = attendedMap.get(emp.id) || 0;
      const eligibleDays = Math.min(workingDaysCount, attendedDays);

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

      return {
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
      };
    });

    res.json(payroll);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to calculate payroll' });
  }
});

// --- Quick update employee work mode (WFO | WFH | HYBRID) ---
router.patch('/employees/:id/work-mode', async (req: AuthRequest, res: Response) => {
  try {
    const { workMode } = req.body;
    if (!['WFO', 'WFH', 'HYBRID'].includes(workMode)) {
      return res.status(400).json({ error: 'Invalid workMode. Must be WFO, WFH, or HYBRID.' });
    }
    const { rowCount } = await query(`UPDATE users SET work_mode = $1 WHERE id = $2`, [workMode, req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.json({ message: `Work mode updated to ${workMode}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update work mode' });
  }
});

// --- Company Holidays CRUD ---
router.get('/holidays', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.json(rows.map(mapHoliday));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

router.post('/holidays', async (req: AuthRequest, res: Response) => {
  try {
    const { name, date, type, description } = req.body;
    if (!name || !date) {
      return res.status(400).json({ error: 'Holiday name and date are required' });
    }
    const { rows } = await query(
      `INSERT INTO holidays (name, holiday_date, type, description) VALUES ($1, $2::date, $3, $4) RETURNING *`,
      [String(name).trim(), String(date).trim(), type || 'COMPANY', description ? String(description).trim() : '']
    );
    const { rows: updatedList } = await query(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.status(201).json({
      message: 'Company holiday added successfully',
      holiday: mapHoliday(rows[0]),
      holidays: updatedList.map(mapHoliday),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

router.post('/holidays/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { rule, year, items, name: customName, type: customType } = req.body;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const { rows: existingHolidays } = await query(`SELECT holiday_date FROM holidays`);
    const existingDates = new Set(existingHolidays.map((h) => toDateStr(h.holiday_date)));

    let toInsert: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.date && !existingDates.has(item.date)) {
          toInsert.push({
            name: String(item.name || 'Holiday').trim(),
            date: String(item.date).trim(),
            type: item.type || 'COMPANY',
            description: item.description || '',
          });
          existingDates.add(item.date);
        }
      }
    } else if (rule === 'SUNDAYS') {
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 0) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!existingDates.has(dateStr)) {
            toInsert.push({
              name: customName ? String(customName).trim() : 'Sunday Weekly Off',
              date: dateStr,
              type: customType || 'COMPANY',
              description: `Recurring Sunday off for ${targetYear}`,
            });
            existingDates.add(dateStr);
          }
        }
      }
    } else if (rule === 'SATURDAYS_2_4') {
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6) {
          const dayOfMonth = d.getDate();
          const weekNum = Math.ceil(dayOfMonth / 7);
          if (weekNum === 2 || weekNum === 4) {
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            if (!existingDates.has(dateStr)) {
              toInsert.push({
                name: customName ? String(customName).trim() : `${weekNum === 2 ? '2nd' : '4th'} Saturday Off`,
                date: dateStr,
                type: customType || 'COMPANY',
                description: `2nd/4th Saturday holiday for ${targetYear}`,
              });
              existingDates.add(dateStr);
            }
          }
        }
      }
    }

    if (toInsert.length > 0) {
      await withTransaction(async (client) => {
        for (const h of toInsert) {
          await client.query(
            `INSERT INTO holidays (name, holiday_date, type, description) VALUES ($1, $2::date, $3, $4)`,
            [h.name, h.date, h.type, h.description]
          );
        }
      });
    }

    const { rows: updatedList } = await query(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.json({ message: `Successfully added ${toInsert.length} holidays`, addedCount: toInsert.length, holidays: updatedList.map(mapHoliday) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to bulk create holidays' });
  }
});

router.delete('/holidays/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { rowCount } = await query(`DELETE FROM holidays WHERE id = $1`, [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    const { rows: updatedList } = await query(`SELECT * FROM holidays ORDER BY holiday_date ASC`);
    res.json({ message: 'Holiday deleted successfully', holidays: updatedList.map(mapHoliday) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// --- Company-Wide WFH Days Management ---
router.get('/wfh-days', async (req: AuthRequest, res: Response) => {
  try {
    const { rows } = await query(`SELECT * FROM wfh_days ORDER BY wfh_date ASC`);
    res.json(rows.map(mapWfhDay));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch company WFH days' });
  }
});

router.post('/wfh-days', async (req: AuthRequest, res: Response) => {
  try {
    const { date, title, description } = req.body;
    if (!date) {
      return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });
    }
    const dateStr = String(date).trim();
    const { rows: existingRows } = await query(`SELECT id FROM wfh_days WHERE wfh_date = $1::date`, [dateStr]);
    if (existingRows[0]) {
      return res.status(409).json({ error: `A Company WFH schedule already exists for ${dateStr}` });
    }

    const { rows } = await query(
      `INSERT INTO wfh_days (wfh_date, title, description) VALUES ($1::date, $2, $3) RETURNING *`,
      [dateStr, title ? String(title).trim() : 'Company-Wide Work From Home', description ? String(description).trim() : '']
    );
    const { rows: updatedList } = await query(`SELECT * FROM wfh_days ORDER BY wfh_date ASC`);
    res.status(201).json({
      message: 'Company-wide WFH day added successfully',
      wfhDay: mapWfhDay(rows[0]),
      wfhDays: updatedList.map(mapWfhDay),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to add company WFH day' });
  }
});

router.post('/wfh-days/bulk', async (req: AuthRequest, res: Response) => {
  try {
    const { rule, year, items, title: customTitle, description: customDesc } = req.body;
    const targetYear = parseInt(year) || new Date().getFullYear();
    const { rows: existingWfh } = await query(`SELECT wfh_date FROM wfh_days`);
    const existingDates = new Set(existingWfh.map((w) => toDateStr(w.wfh_date)));

    let toInsert: any[] = [];

    if (Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (item.date && !existingDates.has(item.date)) {
          toInsert.push({
            date: String(item.date).trim(),
            title: String(item.title || customTitle || 'Company-Wide WFH Day').trim(),
            description: item.description || customDesc || '',
          });
          existingDates.add(item.date);
        }
      }
    } else if (rule === 'WEDNESDAYS' || rule === 'SATURDAYS' || rule === 'WEDNESDAYS_AND_SATURDAYS' || rule === 'FRIDAYS') {
      const startDate = new Date(targetYear, 0, 1);
      const endDate = new Date(targetYear, 11, 31);
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const dayOfWeek = d.getDay();
        let shouldInclude = false;
        let defaultTitle = 'Company WFH Day';

        if (rule === 'WEDNESDAYS' && dayOfWeek === 3) {
          shouldInclude = true;
          defaultTitle = 'Wednesday Team WFH';
        } else if (rule === 'SATURDAYS' && dayOfWeek === 6) {
          shouldInclude = true;
          defaultTitle = 'Saturday Team WFH';
        } else if (rule === 'WEDNESDAYS_AND_SATURDAYS' && (dayOfWeek === 3 || dayOfWeek === 6)) {
          shouldInclude = true;
          defaultTitle = dayOfWeek === 3 ? 'Wednesday Team WFH' : 'Saturday Team WFH';
        } else if (rule === 'FRIDAYS' && dayOfWeek === 5) {
          shouldInclude = true;
          defaultTitle = 'Friday Remote WFH';
        }

        if (shouldInclude) {
          const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (!existingDates.has(dateStr)) {
            toInsert.push({
              date: dateStr,
              title: customTitle ? String(customTitle).trim() : defaultTitle,
              description: customDesc || `Scheduled recurring WFH day for ${targetYear}`,
            });
            existingDates.add(dateStr);
          }
        }
      }
    }

    if (toInsert.length > 0) {
      await withTransaction(async (client) => {
        for (const w of toInsert) {
          await client.query(
            `INSERT INTO wfh_days (wfh_date, title, description) VALUES ($1::date, $2, $3)`,
            [w.date, w.title, w.description]
          );
        }
      });
    }

    const { rows: updatedList } = await query(`SELECT * FROM wfh_days ORDER BY wfh_date ASC`);
    res.json({
      message: `Successfully generated ${toInsert.length} company WFH days`,
      addedCount: toInsert.length,
      wfhDays: updatedList.map(mapWfhDay),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to bulk create WFH days' });
  }
});

router.delete('/wfh-days/:id', async (req: AuthRequest, res: Response) => {
  try {
    const id = String(req.params.id);
    const { rowCount } = await query(`DELETE FROM wfh_days WHERE id::text = $1 OR wfh_date::text = $1`, [id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Company WFH day not found' });
    }
    const { rows: updatedList } = await query(`SELECT * FROM wfh_days ORDER BY wfh_date ASC`);
    res.json({ message: 'Company WFH day removed successfully', wfhDays: updatedList.map(mapWfhDay) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete company WFH day' });
  }
});

// --- Monthly Report: Leave / Late / Permission counts per employee over a date range ---
router.get('/reports/monthly', async (req: AuthRequest, res: Response) => {
  try {
    const { startDate, endDate } = req.query as any;
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const [employeesRes, leavePermsRes, permissionPermsRes, attendanceRes, settingsRes] = await Promise.all([
      query(`SELECT id, name, employee_id, department FROM users WHERE role = 'EMPLOYEE'`),
      query(
        `SELECT p.*, u.employee_id AS employee_code FROM permissions p JOIN users u ON u.id = p.employee_id
         WHERE p.request_type = 'LEAVE' AND p.status != 'REJECTED' AND p.request_date BETWEEN $1::date AND $2::date`,
        [startDate, endDate]
      ),
      query(
        `SELECT p.*, u.employee_id AS employee_code FROM permissions p JOIN users u ON u.id = p.employee_id
         WHERE p.request_type = 'PERMISSION' AND p.status != 'REJECTED' AND p.request_date BETWEEN $1::date AND $2::date`,
        [startDate, endDate]
      ),
      query(
        `SELECT a.*, u.employee_id AS employee_code FROM attendance a JOIN users u ON u.id = a.user_id
         WHERE a.work_date BETWEEN $1::date AND $2::date`,
        [startDate, endDate]
      ),
      query(`SELECT * FROM settings WHERE id = 1`),
    ]);

    const currentSettings = settingsRes.rows[0];
    const officeStartTime = currentSettings?.office_start_time?.slice(0, 5) || '09:00';
    const graceMinutes = currentSettings?.grace_minutes ?? 15;
    const [startH, startM] = officeStartTime.split(':').map(Number);
    const thresholdMinutes = (isNaN(startH) ? 9 : startH) * 60 + (isNaN(startM) ? 0 : startM) + graceMinutes;

    const leaveCountMap: Record<string, number> = {};
    leavePermsRes.rows.forEach((p) => {
      leaveCountMap[p.employee_code] = (leaveCountMap[p.employee_code] || 0) + 1;
    });

    const permissionCountMap: Record<string, number> = {};
    permissionPermsRes.rows.forEach((p) => {
      permissionCountMap[p.employee_code] = (permissionCountMap[p.employee_code] || 0) + 1;
    });

    const lateCountMap: Record<string, number> = {};
    attendanceRes.rows.forEach((rec) => {
      if (!rec.check_in) return;
      const checkInMinutes = getISTMinutes(new Date(rec.check_in));
      if (checkInMinutes > thresholdMinutes) {
        lateCountMap[rec.employee_code] = (lateCountMap[rec.employee_code] || 0) + 1;
      }
    });

    const report = employeesRes.rows.map((emp) => ({
      employeeId: emp.employee_id,
      name: emp.name,
      department: emp.department || '',
      leaveCount: leaveCountMap[emp.employee_id] || 0,
      lateCount: lateCountMap[emp.employee_id] || 0,
      permissionCount: permissionCountMap[emp.employee_id] || 0,
    }));

    res.json({ startDate, endDate, report });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to generate monthly report' });
  }
});

export default router;
