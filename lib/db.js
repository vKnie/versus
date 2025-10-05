// ============================================================================
// CommonJS wrapper for server.js to access database
// ============================================================================
// Since server.js is CommonJS and lib/db.ts is TypeScript/ESM, we re-implement
// the pool logic here with the SAME configuration to ensure consistency
// ============================================================================

const mysql = require('mysql2/promise');
const { logger, LogCategory } = require('./logger.js');

// Validate required environment variables
if (!process.env.DB_HOST) throw new Error('DB_HOST environment variable is required');
if (!process.env.DB_USER) throw new Error('DB_USER environment variable is required');
if (!process.env.DB_PASSWORD) throw new Error('DB_PASSWORD environment variable is required');
if (!process.env.DB_NAME) throw new Error('DB_NAME environment variable is required');

// ✅ UNIFIED DB CONFIG - MUST match lib/db.ts exactly
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 20, // ✅ Same as TypeScript version
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  idleTimeout: 60000,
  maxIdle: 8, // ✅ Same as TypeScript version
  connectTimeout: 10000,
  acquireTimeout: 10000,
};

let pool = null;

function getPool() {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    logger.info(LogCategory.DATABASE, 'Database pool created (CommonJS)', {
      connectionLimit: dbConfig.connectionLimit,
      maxIdle: dbConfig.maxIdle
    });
  }
  return pool;
}

async function query(sql, params) {
  const startTime = Date.now();
  const pool = getPool();

  try {
    const [results] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;

    if (duration > 100) {
      logger.db.query(sql, duration, Array.isArray(results) ? results.length : 0);
    }

    return results;
  } catch (error) {
    logger.db.error('query execution', error, sql);
    throw error;
  }
}

async function queryOne(sql, params) {
  const results = await query(sql, params);
  return results[0] || null;
}

async function getUserIdByName(username) {
  const users = await query('SELECT id FROM users WHERE name = ?', [username]);
  return users.length > 0 ? users[0].id : null;
}

async function userHasRole(userId, role) {
  const roles = await query(
    'SELECT role FROM user_roles WHERE user_id = ? AND role = ?',
    [userId, role]
  );
  return roles.length > 0;
}

async function getUserRoles(userId) {
  const roles = await query(
    'SELECT role FROM user_roles WHERE user_id = ?',
    [userId]
  );
  return roles.map(r => r.role);
}

async function updateUserRoles(userId, roles) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();

    await connection.execute('DELETE FROM user_roles WHERE user_id = ?', [userId]);

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

module.exports = {
  getPool,
  query,
  queryOne,
  getUserIdByName,
  userHasRole,
  getUserRoles,
  updateUserRoles,
  dbConfig
};
