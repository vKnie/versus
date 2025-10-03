import mysql from 'mysql2/promise';
import type { User } from '@/types/user';

// Validate required environment variables
if (!process.env.DB_HOST) throw new Error('DB_HOST environment variable is required');
if (!process.env.DB_USER) throw new Error('DB_USER environment variable is required');
if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD environment variable is required');
if (!process.env.DB_NAME) throw new Error('DB_NAME environment variable is required');

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 15, // Pool unifié : suffisant pour API routes + Socket.IO
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Optimisations supplémentaires
  idleTimeout: 60000, // Fermer les connexions inactives après 1 minute
  maxIdle: 5, // Garder maximum 5 connexions idle
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
  const users = await query<Pick<User, 'id'>>('SELECT id FROM users WHERE name = ?', [username]);
  return users.length > 0 ? users[0].id : null;
}

export async function userHasRole(userId: number, role: string): Promise<boolean> {
  const roles = await query<{ role: string }>(
    'SELECT role FROM user_roles WHERE user_id = ? AND role = ?',
    [userId, role]
  );
  return roles.length > 0;
}

export async function getUserRoles(userId: number): Promise<string[]> {
  const roles = await query<{ role: string }>(
    'SELECT role FROM user_roles WHERE user_id = ?',
    [userId]
  );
  return roles.map(r => r.role);
}

export async function updateUserRoles(userId: number, roles: string[]): Promise<void> {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    // Supprimer tous les rôles existants
    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);

    // ✅ OPTIMISÉ : Insertion en une seule requête au lieu de boucle
    if (roles.length > 0) {
      const values = roles.map(role => [userId, role]);
      await connection.query(
        'INSERT INTO user_roles (user_id, role) VALUES ?',
        [values]
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}