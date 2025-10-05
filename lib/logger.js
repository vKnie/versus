/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const LogLevel = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

const LogCategory = {
  AUTH: 'AUTH',
  DATABASE: 'DATABASE',
  GAME: 'GAME',
  SOCKET: 'SOCKET',
  API: 'API',
  SYSTEM: 'SYSTEM',
};

class Logger {
  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logsDir = path.join(process.cwd(), 'logs');
    this.currentLogFile = this.getLogFileName();
    this.ensureLogsDirectory();
  }

  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  getLogFileName() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `app-${year}-${month}-${day}.log`;
  }

  formatLogEntry(entry) {
    const parts = [
      `[${entry.timestamp}]`,
      `[${entry.level}]`,
      `[${entry.category}]`,
    ];

    if (entry.username) {
      parts.push(`[User: ${entry.username}]`);
    } else if (entry.userId) {
      parts.push(`[UserId: ${entry.userId}]`);
    }

    if (entry.requestId) {
      parts.push(`[Req: ${entry.requestId}]`);
    }

    parts.push(entry.message);

    if (entry.data) {
      parts.push(`\nData: ${JSON.stringify(entry.data, null, 2)}`);
    }

    return parts.join(' ');
  }

  writeToFile(entry) {
    try {
      const logFileName = this.getLogFileName();
      if (logFileName !== this.currentLogFile) {
        this.currentLogFile = logFileName;
      }

      const logPath = path.join(this.logsDir, this.currentLogFile);
      const formattedEntry = this.formatLogEntry(entry) + '\n';
      fs.appendFileSync(logPath, formattedEntry, 'utf-8');
    } catch (error) {
      console.error('❌ Failed to write to log file:', error);
    }
  }

  log(level, category, message, data, userId, username, requestId) {
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level,
      category,
      message,
      data,
      userId,
      username,
      requestId,
    };

    // Console output avec couleurs
    const consoleMessage = this.formatLogEntry(entry);

    switch (level) {
      case LogLevel.DEBUG:
        if (!this.isProduction) console.log(`🔍 ${consoleMessage}`);
        break;
      case LogLevel.INFO:
        console.log(`ℹ️ ${consoleMessage}`);
        break;
      case LogLevel.WARN:
        console.warn(`⚠️ ${consoleMessage}`);
        break;
      case LogLevel.ERROR:
        console.error(`❌ ${consoleMessage}`);
        break;
    }

    // Écriture dans le fichier
    this.writeToFile(entry);
  }

  debug(category, message, data, meta = {}) {
    this.log(LogLevel.DEBUG, category, message, data, meta.userId, meta.username, meta.requestId);
  }

  info(category, message, data, meta = {}) {
    this.log(LogLevel.INFO, category, message, data, meta.userId, meta.username, meta.requestId);
  }

  warn(category, message, data, meta = {}) {
    this.log(LogLevel.WARN, category, message, data, meta.userId, meta.username, meta.requestId);
  }

  error(category, message, data, meta = {}) {
    this.log(LogLevel.ERROR, category, message, data, meta.userId, meta.username, meta.requestId);
  }
}

// Créer l'instance
const loggerInstance = new Logger();

// Méthodes spécifiques par catégorie
loggerInstance.auth = {
  login: (username, success, ip) => {
    loggerInstance.info(LogCategory.AUTH, `Login ${success ? 'successful' : 'failed'}`, { ip }, { username });
  },
  logout: (username) => {
    loggerInstance.info(LogCategory.AUTH, 'User logged out', undefined, { username });
  },
  sessionCreated: (username, sessionId) => {
    loggerInstance.info(LogCategory.AUTH, 'Session created', { sessionId }, { username });
  },
  sessionExpired: (username) => {
    loggerInstance.info(LogCategory.AUTH, 'Session expired', undefined, { username });
  },
};

loggerInstance.db = {
  query: (sql, duration, rowCount) => {
    loggerInstance.debug(LogCategory.DATABASE, `Query executed (${duration}ms)`, { sql: sql.substring(0, 200), rowCount });
  },
  error: (operation, error, sql) => {
    loggerInstance.error(LogCategory.DATABASE, `Database error: ${operation}`, { error: error.message, sql });
  },
  connectionAcquired: (poolSize) => {
    loggerInstance.debug(LogCategory.DATABASE, `Connection acquired from pool`, { poolSize });
  },
  connectionReleased: (poolSize) => {
    loggerInstance.debug(LogCategory.DATABASE, `Connection released to pool`, { poolSize });
  },
};

loggerInstance.game = {
  started: (roomId, gameSessionId, playerCount, username) => {
    loggerInstance.info(LogCategory.GAME, `Game started`, { roomId, gameSessionId, playerCount }, { username });
  },
  finished: (gameSessionId, winner, duration) => {
    loggerInstance.info(LogCategory.GAME, `Game finished`, { gameSessionId, winner, duration });
  },
  cancelled: (gameSessionId, username) => {
    loggerInstance.warn(LogCategory.GAME, `Game cancelled`, { gameSessionId }, { username });
  },
  voted: (gameSessionId, duelIndex, itemVoted, username) => {
    loggerInstance.info(LogCategory.GAME, `Vote cast`, { gameSessionId, duelIndex, itemVoted }, { username });
  },
  duelAdvanced: (gameSessionId, fromDuel, toDuel) => {
    loggerInstance.info(LogCategory.GAME, `Duel advanced`, { gameSessionId, fromDuel, toDuel });
  },
  tieBreaker: (gameSessionId, duelIndex, item1, item2, winner) => {
    loggerInstance.warn(LogCategory.GAME, `Tie breaker resolved`, { gameSessionId, duelIndex, item1, item2, winner });
  },
  playerExcluded: (gameSessionId, userId, excludedBy) => {
    loggerInstance.warn(LogCategory.GAME, `Player excluded from game`, { gameSessionId, userId }, { username: excludedBy });
  },
};

loggerInstance.socket = {
  connected: (socketId, userCount) => {
    loggerInstance.info(LogCategory.SOCKET, `Client connected`, { socketId, userCount });
  },
  disconnected: (socketId, userCount) => {
    loggerInstance.info(LogCategory.SOCKET, `Client disconnected`, { socketId, userCount });
  },
  roomJoined: (socketId, roomName, username) => {
    loggerInstance.info(LogCategory.SOCKET, `Joined room`, { socketId, roomName }, { username });
  },
  roomLeft: (socketId, roomName) => {
    loggerInstance.info(LogCategory.SOCKET, `Left room`, { socketId, roomName });
  },
  eventEmitted: (event, roomName, dataSize) => {
    loggerInstance.debug(LogCategory.SOCKET, `Event emitted`, { event, roomName, dataSize });
  },
  error: (event, error, socketId) => {
    loggerInstance.error(LogCategory.SOCKET, `Socket error: ${event}`, { error: error.message, socketId });
  },
};

loggerInstance.api = {
  request: (method, path, statusCode, duration, username) => {
    loggerInstance.info(LogCategory.API, `${method} ${path} - ${statusCode} (${duration}ms)`, undefined, { username });
  },
  error: (method, path, error, username) => {
    loggerInstance.error(LogCategory.API, `${method} ${path} failed`, { error: error.message, stack: error.stack }, { username });
  },
  rateLimited: (path, ip, username) => {
    loggerInstance.warn(LogCategory.API, `Rate limit exceeded`, { path, ip }, { username });
  },
};

loggerInstance.system = {
  startup: (port, env) => {
    loggerInstance.info(LogCategory.SYSTEM, `Application started`, { port, env });
  },
  shutdown: () => {
    loggerInstance.info(LogCategory.SYSTEM, `Application shutting down`);
  },
  error: (operation, error) => {
    loggerInstance.error(LogCategory.SYSTEM, `System error: ${operation}`, { error: error.message, stack: error.stack });
  },
};

// Export singleton
module.exports = {
  logger: loggerInstance,
  LogLevel,
  LogCategory,
};
