import { ObjectId } from 'mongodb';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();
import { connectMongo, users } from './mongo';

(async () => {
  // Ensure Mongo connection is established
  await connectMongo();
  await main();
})();

async function main() {
  console.log('Seeding database...');

  const adminPassword = await bcrypt.hash('admin123', 10);
  const employeePassword = await bcrypt.hash('emp123', 10);

  const userCol = users();

  // Admin user
  const admin = await userCol.findOne({ email: 'admin@company.com' });
  if (!admin) {
    await userCol.insertOne({
      name: 'Admin User',
      email: 'admin@company.com',
      passwordHash: adminPassword,
      role: 'ADMIN',
      employeeId: 'ADM001',
      status: 'ACTIVE',
    });
    console.log('Created admin user');
  }

  // Employee 1
  const emp1 = await userCol.findOne({ email: 'employee1@company.com' });
  if (!emp1) {
    await userCol.insertOne({
      name: 'John Doe',
      email: 'employee1@company.com',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      employeeId: 'EMP001',
      status: 'ACTIVE',
    });
    console.log('Created employee1');
  }

  // Employee 2
  const emp2 = await userCol.findOne({ email: 'employee2@company.com' });
  if (!emp2) {
    await userCol.insertOne({
      name: 'Jane Smith',
      email: 'employee2@company.com',
      passwordHash: employeePassword,
      role: 'EMPLOYEE',
      employeeId: 'EMP002',
      status: 'ACTIVE',
    });
    console.log('Created employee2');
  }

  console.log('Database seeded successfully');
}

// Removed previous main invocation; handled inside async IIFE above
