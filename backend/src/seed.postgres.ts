import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import { pool, connectPostgres, query } from './db';

(async () => {
  await connectPostgres();
  await main();
  await pool.end();
})();

async function main() {
  console.log('Seeding PostgreSQL database (local/dev only)...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const employeePassword = await bcrypt.hash('emp123', 10);

  const { rows: adminRows } = await query(
    `INSERT INTO users (name, email, password_hash, role, employee_id, status, work_mode)
     VALUES ('Admin User', 'admin@company.com', $1, 'ADMIN', 'ADM001', 'ACTIVE', 'WFO')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [adminPassword]
  );
  if (adminRows[0]) console.log('Created admin user');

  const { rows: mgrRows } = await query(
    `INSERT INTO users (name, email, password_hash, role, employee_id, status, work_mode)
     VALUES ('Jane Smith', 'employee2@company.com', $1, 'EMPLOYEE', 'EMP002', 'ACTIVE', 'WFO')
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [employeePassword]
  );
  if (mgrRows[0]) console.log('Created employee2 (manager)');

  const { rows: managerLookup } = await query(`SELECT id FROM users WHERE email = 'employee2@company.com'`);
  const managerId = managerLookup[0]?.id || null;

  const { rows: emp1Rows } = await query(
    `INSERT INTO users (name, email, password_hash, role, employee_id, status, work_mode, reporting_manager_id, basic_salary, gross_salary)
     VALUES ('John Doe', 'employee1@company.com', $1, 'EMPLOYEE', 'EMP001', 'ACTIVE', 'WFO', $2, 30000, 40000)
     ON CONFLICT (email) DO NOTHING
     RETURNING id`,
    [employeePassword, managerId]
  );
  if (emp1Rows[0]) console.log('Created employee1');

  console.log('PostgreSQL database seeded successfully');
}
