import mysql from 'mysql2/promise';

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'versus_user',
  password: process.env.DB_PASSWORD || 'azerty123',
  database: process.env.DB_NAME || 'versus_db',
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const pool = getPool();
  const [results] = await pool.execute(sql, params);
  return results as T[];
}

export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const results = await query<T>(sql, params);
  return results[0] || null;
}

export async function getUserIdByName(username: string): Promise<number | null> {
  const users = await query<{ id: number }>('SELECT id FROM users WHERE name = ?', [username]);
  return users.length > 0 ? users[0].id : null;
}