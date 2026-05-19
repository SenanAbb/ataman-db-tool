import { Pool } from 'pg';

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function buildPool(): Pool {
  return new Pool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    max: 5,
    statement_timeout: 120_000,
    idleTimeoutMillis: 30_000,
  });
}

export const pool: Pool = globalThis._pgPool ?? buildPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis._pgPool = pool;
}
