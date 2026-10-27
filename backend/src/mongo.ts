import { MongoClient, Db, Collection, Document } from 'mongodb';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

// Ensure reliable SRV resolution across all networks
try {
  dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
} catch (e) {
  // Ignore if custom servers cannot be set
}

const uri = process.env.MONGO_URI as string;
if (!uri) {
  throw new Error('MONGO_URI not defined in .env');
}

let client: MongoClient | null = null;
let db: Db | null = null;

export const connectMongo = async (): Promise<Db> => {
  if (db) return db;
  client = new MongoClient(uri);
  await client.connect();
  db = client.db('attendance'); // Explicitly use 'attendance' database
  console.log('✅ Connected to MongoDB Atlas (database: attendance)');
  return db;
};

export const getCollection = <T extends Document = any>(name: string): Collection<T> => {
  if (!db) {
    throw new Error('MongoDB not connected yet');
  }
  return db.collection<T>(name);
};

// Export helpers for each collection used in the app
export const users = () => getCollection<any>('User');
export const attendances = () => getCollection<any>('Attendance');
export const attendanceEvents = () => getCollection<any>('AttendanceEvent');
export const workSessions = () => getCollection<any>('WorkSession');
export const settings = () => getCollection<any>('Settings');
export const permissions = () => getCollection<any>('Permission');
export const holidays = () => getCollection<any>('Holiday');
export const wfhDays = () => getCollection<any>('WfhDay');

process.on('SIGINT', async () => {
  if (client) {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
  process.exit(0);
});
