import mysql from 'mysql2/promise';
import type { User } from '@/types/user';
import { logger, LogCategory } from './logger';

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
  connectionLimit: 20, // ✅ OPTIMISÉ: Augmenté de 15 à 20 pour gérer plus de connexions simultanées
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // ✅ OPTIMISATIONS pour performances
  idleTimeout: 60000, // Fermer les connexions inactives après 1 minute
  maxIdle: 8, // ✅ OPTIMISÉ: Augmenté de 5 à 8 connexions idle
  connectTimeout: 10000, // ✅ Timeout de connexion à 10s
  acquireTimeout: 10000, // ✅ Timeout d'acquisition de connexion
};

let pool: mysql.Pool | null = null;

export function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    logger.info(LogCategory.DATABASE, 'Database pool created', {
      connectionLimit: dbConfig.connectionLimit,
      maxIdle: dbConfig.maxIdle
    });
  }
  return pool;
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  const startTime = Date.now();
  const pool = getPool();

  try {
    const [results] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;

    // ✅ Log des requêtes lentes uniquement (> 100ms)
    if (duration > 100) {
      logger.db.query(sql, duration, Array.isArray(results) ? results.length : 0);
    }

    return results as T[];
  } catch (error: any) {
    logger.db.error('query execution', error, sql);
    throw error;
  }
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