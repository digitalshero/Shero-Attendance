import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { query, withTransaction } from '../db';
import { getISTTodayString, combineDateAndTimeToISTDate } from '../utils/time';
import { mapPermission, toDateStr } from '../mappers';

const router = Router();
router.use(authenticateToken);

// --- Leave attachment upload (medical certificate, marriage invitation, etc.) ---
const MONTHLY_FREE_LEAVE_LIMIT = 2;
const uploadDir = path.join(__dirname, '..', '..', 'uploads', 'leave-attachments');
fs.mkdirSync(uploadDir, { recursive: true });

const leaveAttachmentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      cb(null, `${Date.now()}-${safeName}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG and PNG files are allowed for leave attachments'));
    }
  },
}).single('attachment');

// Helper function to calculate duration between HH:mm start and end times
export const calculateDuration = (startTime: string, endTime: string) => {
  if (!startTime || !endTime) return { decimalHours: 0, formatted: '0 hrs', diffMins: 0 };

  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const startTotalMins = startH * 60 + startM;
  const endTotalMins = endH * 60 + endM;

  let diffMins = endTotalMins - startTotalMins;
  if (diffMins < 0) {
    diffMins += 24 * 60; // Spans past midnight
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const decimalHours = Number((diffMins / 60).toFixed(2));

  const parts = [];
  if (hours > 0) parts.push(`${hours} hr${hours > 1 ? 's' : ''}`);
  if (mins > 0) parts.push(`${mins} min${mins > 1 ? 's' : ''}`);
  const formatted = parts.length > 0 ? parts.join(' ') : '0 mins';

  return { decimalHours, formatted, diffMins };
};

// --- 1. Request a new permission or WFH (Employee) ---
router.post('/', (req: AuthRequest, res: Response, next) => {
  leaveAttachmentUpload(req, res, (err: any) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Failed to upload attachment' });
    }
    next();
  });
}, async (req: AuthRequest, res: Response) => {
  const uploadedFile = (req as any).file as Express.Multer.File | undefined;
  const cleanupUpload = () => {
    if (uploadedFile) fs.unlink(uploadedFile.path, () => {});
  };

  try {
    const userId = req.user?.id;
    if (!userId) {
      cleanupUpload();
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { date, startTime, endTime, reason, requestType } = req.body;

    if (!date || !startTime || !endTime) {
      cleanupUpload();
      return res.status(400).json({ error: 'Date, start time, and end time are required' });
    }

    const { decimalHours, formatted, diffMins } = calculateDuration(startTime, endTime);
    if (diffMins <= 0) {
      cleanupUpload();
      return res.status(400).json({ error: 'End time must be after start time' });
    }

    const { rows: empRows } = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const employee = empRows[0];
    if (!employee) {
      cleanupUpload();
      return res.status(404).json({ error: 'Employee not found' });
    }

    let managerUserId: string | null = null;
    if (employee.reporting_manager_id) {
      const { rows: mgrRows } = await query(`SELECT id FROM users WHERE id = $1`, [employee.reporting_manager_id]);
      if (mgrRows[0]) managerUserId = mgrRows[0].id;
    }

    if (requestType === 'WEEK_OFF' && !employee.is_ssc && employee.work_mode !== 'SSC') {
      cleanupUpload();
      return res.status(400).json({ error: 'Week Off requests are only available for SSC shift employees' });
    }

    const type = requestType === 'WFH' ? 'WFH' : requestType === 'LEAVE' ? 'LEAVE' : requestType === 'WEEK_OFF' ? 'WEEK_OFF' : 'PERMISSION';

    const attachmentFile = uploadedFile;

    if (type === 'LEAVE') {
      const leaveMonth = String(date).slice(0, 7); // YYYY-MM
      const { rows: countRows } = await query(
        `SELECT COUNT(*)::int AS count FROM permissions
         WHERE employee_id = $1 AND request_type = 'LEAVE' AND status != 'REJECTED' AND TO_CHAR(request_date, 'YYYY-MM') = $2`,
        [userId, leaveMonth]
      );
      const existingLeavesThisMonth = countRows[0].count;

      if (existingLeavesThisMonth >= MONTHLY_FREE_LEAVE_LIMIT && !attachmentFile) {
        return res.status(400).json({
          error: `You have already taken ${existingLeavesThisMonth} leave(s) this month. Please attach a supporting document (e.g. medical certificate, marriage invitation) to request additional leave.`,
        });
      }
    }

    const { rows } = await query(
      `INSERT INTO permissions
        (employee_id, manager_id, request_type, request_date, start_time, end_time, total_hours, total_hours_formatted,
         reason, attachment_url, attachment_name, status)
       VALUES ($1,$2,$3,$4::date,$5,$6,$7,$8,$9,$10,$11,'PENDING')
       RETURNING *`,
      [
        userId,
        managerUserId,
        type,
        date,
        startTime,
        endTime,
        decimalHours,
        formatted,
        reason || '',
        attachmentFile ? `/uploads/leave-attachments/${attachmentFile.filename}` : null,
        attachmentFile ? attachmentFile.originalname : null,
      ]
    );

    const typeLabel = type === 'WEEK_OFF' ? 'Week Off' : type === 'WFH' ? 'Work from Home' : type === 'LEAVE' ? 'Leave' : 'Permission';
    res.status(201).json({
      message: `${typeLabel} request submitted successfully`,
      permissionId: rows[0].id,
      permission: {
        ...mapPermission(rows[0]),
        employeeId: employee.employee_id,
        employeeName: employee.name,
        employeeEmail: employee.email,
      },
    });
  } catch (error) {
    console.error('Failed to submit permission request:', error);
    cleanupUpload();
    res.status(500).json({ error: 'Failed to submit permission request' });
  }
});

const PERMISSION_JOIN = `
  SELECT p.*,
    u.employee_id AS employee_code, u.name AS employee_name, u.email AS employee_email,
    m.id AS manager_id_full, m.name AS manager_name, m.employee_id AS manager_employee_code, m.email AS manager_email, m.role AS manager_role,
    r.name AS reviewed_by_name, r.employee_id AS reviewed_by_employee_code
  FROM permissions p
  JOIN users u ON u.id = p.employee_id
  LEFT JOIN users m ON m.id = p.manager_id
  LEFT JOIN users r ON r.id = p.reviewed_by
`;

// --- 2. Get my submitted permission requests (Employee) ---
router.get('/my', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } = await query(`${PERMISSION_JOIN} WHERE p.employee_id = $1 ORDER BY p.created_at DESC`, [userId]);
    res.json(rows.map(mapPermission));
  } catch (error) {
    console.error('Failed to fetch my permission requests:', error);
    res.status(500).json({ error: 'Failed to fetch permission requests' });
  }
});

// --- 3. Get team permission requests received as reporting manager (or all for Admin) ---
router.get('/team', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rows } =
      role === 'ADMIN'
        ? await query(`${PERMISSION_JOIN} ORDER BY p.created_at DESC`)
        : await query(`${PERMISSION_JOIN} WHERE p.manager_id = $1 ORDER BY p.created_at DESC`, [userId]);

    res.json(rows.map(mapPermission));
  } catch (error) {
    console.error('Failed to fetch team permission requests:', error);
    res.status(500).json({ error: 'Failed to fetch team permission requests' });
  }
});

// --- 4. Approve / Reject permission or WFH request (Reporting Manager or Admin) ---
router.put('/:id/status', async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const role = req.user?.role;
    const { id } = req.params;
    const { status, managerComment } = req.body;

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Status must be APPROVED or REJECTED' });
    }

    const { rows: permRows } = await query(`SELECT * FROM permissions WHERE id = $1`, [id]);
    const permission = permRows[0];
    if (!permission) {
      return res.status(404).json({ error: 'Permission request not found' });
    }

    const isManager = permission.manager_id && permission.manager_id === userId;
    const isAdmin = role === 'ADMIN';

    if (!isManager && !isAdmin) {
      return res.status(403).json({ error: 'You are not authorized to review this request' });
    }

    await query(
      `UPDATE permissions SET status = $1, manager_comment = $2, reviewed_at = $3, reviewed_by = $4 WHERE id = $5`,
      [status, managerComment || '', new Date(), userId, id]
    );

    // If WFH request is APPROVED and it applies to today, initialize attendance starting from requested time
    if (status === 'APPROVED' && permission.request_type === 'WFH') {
      try {
        const todayStr = getISTTodayString(new Date());
        const requestDateStr = toDateStr(permission.request_date);
        if (requestDateStr === todayStr) {
          const requestedStartTime = combineDateAndTimeToISTDate(requestDateStr, permission.start_time?.slice(0, 5) || '09:00');

          const { rows: existingRows } = await query(
            `SELECT * FROM attendance WHERE user_id = $1 AND work_date = $2::date`,
            [permission.employee_id, todayStr]
          );
          const existingAttendance = existingRows[0];

          await withTransaction(async (client) => {
            if (!existingAttendance) {
              const insertRes = await client.query(
                `INSERT INTO attendance
                  (user_id, work_date, check_in, status, work_mode, is_geofence_verified, total_working_seconds,
                   total_stopped_seconds, wfh_approved_from_request)
                 VALUES ($1, $2::date, $3, 'WORKING', 'WFH', true, 0, 0, true)
                 RETURNING id`,
                [permission.employee_id, todayStr, requestedStartTime]
              );
              const attendanceId = insertRes.rows[0].id;

              await client.query(
                `INSERT INTO attendance_events (attendance_id, event_type, timestamp) VALUES ($1, 'CHECK_IN', $2)`,
                [attendanceId, requestedStartTime]
              );
              await client.query(`INSERT INTO work_sessions (attendance_id, start_time) VALUES ($1, $2)`, [attendanceId, requestedStartTime]);
              await client.query(`UPDATE users SET status = 'WORKING' WHERE id = $1`, [permission.employee_id]);
            } else {
              await client.query(
                `UPDATE attendance SET work_mode = 'WFH', status = 'WORKING', check_in = COALESCE(check_in, $1), wfh_approved_from_request = true
                 WHERE id = $2`,
                [requestedStartTime, existingAttendance.id]
              );
              await client.query(`UPDATE users SET status = 'WORKING' WHERE id = $1`, [permission.employee_id]);
            }
          });
        }
      } catch (wfhErr) {
        console.error('Error applying approved WFH attendance:', wfhErr);
      }
    }

    res.json({ message: `${permission.request_type === 'WFH' ? 'WFH' : 'Permission'} request ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error('Failed to update request status:', error);
    res.status(500).json({ error: 'Failed to update request status' });
  }
});

export default router;
