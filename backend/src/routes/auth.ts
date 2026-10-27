import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AuthRequest, authenticateToken } from '../middleware/auth';
import { query } from '../db';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, identifier, password } = req.body;
    const loginInput = (email || identifier || '').trim();
    if (!loginInput || !password) {
      return res.status(400).json({ error: 'Email/Employee ID and password are required' });
    }

    const { rows } = await query(
      `SELECT * FROM users WHERE email ILIKE $1 OR employee_id ILIKE $1 LIMIT 1`,
      [loginInput]
    );
    const user = rows[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. Please check your Email/Employee ID.' });
    }
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid password. Please try again.' });
    }

    const workMode = user.work_mode || 'WFO';
    const token = jwt.sign(
      { id: user.id, employeeId: user.employee_id, role: user.role },
      process.env.JWT_SECRET as string,
      { expiresIn: '365d' }
    );
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
        department: user.department || '',
        workMode,
        isSsc: Boolean(user.is_ssc),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Access denied' });
    }
    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let reportingManager = null;
    if (user.reporting_manager_id) {
      try {
        const mgrRes = await query(
          `SELECT id, name, employee_id, email, role FROM users WHERE id = $1`,
          [user.reporting_manager_id]
        );
        const mgr = mgrRes.rows[0];
        if (mgr) {
          reportingManager = {
            id: mgr.id,
            name: mgr.name,
            employeeId: mgr.employee_id,
            email: mgr.email,
            role: mgr.role,
          };
        }
      } catch (err) {
        console.error('Error fetching reporting manager in /me:', err);
      }
    }

    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeId: user.employee_id,
      department: user.department || '',
      status: user.status,
      workMode: user.work_mode || 'WFO',
      isSsc: Boolean(user.is_ssc),
      reportingManager,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

router.put('/change-password', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Access denied' });
    }

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).trim().length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    const { rows } = await query(`SELECT * FROM users WHERE id = $1`, [userId]);
    const user = rows[0];
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password. Please try again.' });
    }

    const passwordHash = await bcrypt.hash(String(newPassword).trim(), 10);
    await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);

    res.json({ message: 'Password updated successfully!' });
  } catch (error) {
    console.error('Failed to change password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

export default router;
