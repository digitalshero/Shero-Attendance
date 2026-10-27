import fs from 'fs';
import { Pool, PoolClient, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('POSTGRES_URL (or DATABASE_URL) not defined in .env');
}

// Local Postgres typically has no CA chain to verify against — explicitly opt out with
// PGSSLMODE=disable for local dev only. Any other value (including unset) requires a
// real CA certificate and verifies the server's identity; this must never silently
// fall back to an unverified connection in production.
const buildSslConfig = (): false | { ca: string; rejectUnauthorized: true } => {
  if (process.env.PGSSLMODE === 'disable') {
    return false;
  }

  const caPath = process.env.DATABASE_SSL_CA_PATH;
  if (!caPath) {
    throw new Error(
      'DATABASE_SSL_CA_PATH is not set. A CA certificate is required to verify the PostgreSQL ' +
        'server (e.g. the AWS RDS CA bundle) unless PGSSLMODE=disable is explicitly set for local ' +
        'development. Refusing to start with an unverified database connection.'
    );
  }

  let ca: string;
  try {
    ca = fs.readFileSync(caPath, 'utf8');
  } catch (err) {
    throw new Error(`Failed to read DATABASE_SSL_CA_PATH ("${caPath}"): ${(err as Error).message}`);
  }

  return { ca, rejectUnauthorized: true };
};

export const pool = new Pool({
  connectionString,
  ssl: buildSslConfig(),
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
