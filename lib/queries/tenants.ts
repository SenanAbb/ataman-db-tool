import { pool } from '../db';

export interface Tenant {
  id: string;
  name: string;
}

export async function listTenants(): Promise<Tenant[]> {
  const { rows } = await pool.query<Tenant>(
    `SELECT id, name FROM admin.tenants WHERE id <> $1 ORDER BY id`,
    ['admin'],
  );
  return rows;
}

export async function tenantExists(id: string): Promise<boolean> {
  if (!/^[a-z_][a-z0-9_]*$/.test(id)) return false;
  const { rows } = await pool.query(
    `SELECT 1 FROM admin.tenants WHERE id = $1 LIMIT 1`,
    [id],
  );
  return rows.length === 1;
}
