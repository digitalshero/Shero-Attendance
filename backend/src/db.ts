import { Pool, PoolClient, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL (or DATABASE_URL) not defined in .env');
}

// Local Postgres typically has no SSL cert chain to verify; Render/managed
// Postgres usually requires SSL. Allow opting out explicitly for local dev.
const useSsl = process.env.PGSSLMODE !== 'disable';

export const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

export const connectPostgres = async (): Promise<void> => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Connected to PostgreSQL (database: ' + (connectionString.split('/').pop()?.split('?')[0] || 'unknown') + ')');
  } finally {
    client.release();
  }
};

export const query = <T extends QueryResultRow = any>(text: string, params?: any[]) =>
  pool.query<T>(text, params);

// Wrap a sequence of statements in a single transaction (BEGIN/COMMIT/ROLLBACK).
// Used for every multi-step write that was previously unguarded in MongoDB
// (check-in, stop, resume, check-out, WFH-approval side effect, employee rename).
export const withTransaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

process.on('SIGINT', async () => {
  await pool.end();
  console.log('🔌 PostgreSQL pool closed');
  process.exit(0);
});
