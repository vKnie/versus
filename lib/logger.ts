import fs from 'fs';
import path from 'path';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

export enum LogCategory {
  AUTH = 'AUTH',
  DATABASE = 'DATABASE',
  GAME = 'GAME',
  SOCKET = 'SOCKET',
  API = 'API',
  SYSTEM = 'SYSTEM',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  data?: any;
  userId?: number | string;
  username?: string;
  requestId?: string;
}

class Logger {
  private logsDir: string;
  private currentLogFile: string;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === 'production';
    this.logsDir = path.join(process.cwd(), 'logs');
    this.currentLogFile = this.getLogFileName();
    this.ensureLogsDirectory();
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  private getLogFileName(): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `app-${year}-${month}-${day}.log`;
  }

  private formatLogEntry(entry: LogEntry): string {
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

  private writeToFile(entry: LogEntry): void {
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

  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: any,
    userId?: number | string,
    username?: string,
    requestId?: string
  ): void {
    const timestamp = new Date().toISOString();
    const entry: LogEntry = {
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

  // Méthodes publiques
  public debug(category: LogCategory, message: string, data?: any, meta?: { userId?: number | string; username?: string; requestId?: string }): void {
    this.log(LogLevel.DEBUG, category, message, data, meta?.userId, meta?.username, meta?.requestId);
  }

  public info(category: LogCategory, message: string, data?: any, meta?: { userId?: number | string; username?: string; requestId?: string }): void {
    this.log(LogLevel.INFO, category, message, data, meta?.userId, meta?.username, meta?.requestId);
  }

  public warn(category: LogCategory, message: string, data?: any, meta?: { userId?: number | string; username?: string; requestId?: string }): void {
    this.log(LogLevel.WARN, category, message, data, meta?.userId, meta?.username, meta?.requestId);
  }

  public error(category: LogCategory, message: string, data?: any, meta?: { userId?: number | string; username?: string; requestId?: string }): void {
    this.log(LogLevel.ERROR, category, message, data, meta?.userId, meta?.username, meta?.requestId);
  }

  // Méthodes spécifiques par catégorie
  public auth = {
    login: (username: string, success: boolean, ip?: string) => {
      this.info(LogCategory.AUTH, `Login ${success ? 'successful' : 'failed'}`, { ip }, { username });
    },
    logout: (username: string) => {
      this.info(LogCategory.AUTH, 'User logged out', undefined, { username });
    },
    sessionCreated: (username: string, sessionId: string) => {
      this.info(LogCategory.AUTH, 'Session created', { sessionId }, { username });
    },
    sessionExpired: (username: string) => {
      this.info(LogCategory.AUTH, 'Session expired', undefined, { username });
    },
  };

  public db = {
    query: (sql: string, duration: number, rowCount?: number) => {
      this.debug(LogCategory.DATABASE, `Query executed (${duration}ms)`, { sql: sql.substring(0, 200), rowCount });
    },
    error: (operation: string, error: any, sql?: string) => {
      this.error(LogCategory.DATABASE, `Database error: ${operation}`, { error: error.message, sql });
    },
    connectionAcquired: (poolSize: number) => {
      this.debug(LogCategory.DATABASE, `Connection acquired from pool`, { poolSize });
    },
    connectionReleased: (poolSize: number) => {
      this.debug(LogCategory.DATABASE, `Connection released to pool`, { poolSize });
    },
  };

  public game = {
    started: (roomId: number, gameSessionId: number, playerCount: number, username: string) => {
      this.info(LogCategory.GAME, `Game started`, { roomId, gameSessionId, playerCount }, { username });
    },
    finished: (gameSessionId: number, winner: string, duration: number) => {
      this.info(LogCategory.GAME, `Game finished`, { gameSessionId, winner, duration });
    },
    cancelled: (gameSessionId: number, username: string) => {
      this.warn(LogCategory.GAME, `Game cancelled`, { gameSessionId }, { username });
    },
    voted: (gameSessionId: number, duelIndex: number, itemVoted: string, username: string) => {
      this.info(LogCategory.GAME, `Vote cast`, { gameSessionId, duelIndex, itemVoted }, { username });
    },
    duelAdvanced: (gameSessionId: number, fromDuel: number, toDuel: number) => {
      this.info(LogCategory.GAME, `Duel advanced`, { gameSessionId, fromDuel, toDuel });
    },
    tieBreaker: (gameSessionId: number, duelIndex: number, item1: string, item2: string, winner: string) => {
      this.warn(LogCategory.GAME, `Tie breaker resolved`, { gameSessionId, duelIndex, item1, item2, winner });
    },
    playerExcluded: (gameSessionId: number, userId: number, excludedBy: string) => {
      this.warn(LogCategory.GAME, `Player excluded from game`, { gameSessionId, userId }, { username: excludedBy });
    },
  };

  public socket = {
    connected: (socketId: string, userCount: number) => {
      this.info(LogCategory.SOCKET, `Client connected`, { socketId, userCount });
    },
    disconnected: (socketId: string, userCount: number) => {
      this.info(LogCategory.SOCKET, `Client disconnected`, { socketId, userCount });
    },
    roomJoined: (socketId: string, roomName: string, username: string) => {
      this.info(LogCategory.SOCKET, `Joined room`, { socketId, roomName }, { username });
    },
    roomLeft: (socketId: string, roomName: string) => {
      this.info(LogCategory.SOCKET, `Left room`, { socketId, roomName });
    },
    eventEmitted: (event: string, roomName?: string, dataSize?: number) => {
      this.debug(LogCategory.SOCKET, `Event emitted`, { event, roomName, dataSize });
    },
    error: (event: string, error: any, socketId: string) => {
      this.error(LogCategory.SOCKET, `Socket error: ${event}`, { error: error.message, socketId });
    },
  };

  public api = {
    request: (method: string, path: string, statusCode: number, duration: number, username?: string) => {
      this.info(LogCategory.API, `${method} ${path} - ${statusCode} (${duration}ms)`, undefined, { username });
    },
    error: (method: string, path: string, error: any, username?: string) => {
      this.error(LogCategory.API, `${method} ${path} failed`, { error: error.message, stack: error.stack }, { username });
    },
    rateLimited: (path: string, ip: string, username?: string) => {
      this.warn(LogCategory.API, `Rate limit exceeded`, { path, ip }, { username });
    },
  };

  public system = {
    startup: (port: number, env: string) => {
      this.info(LogCategory.SYSTEM, `Application started`, { port, env });
    },
    shutdown: () => {
      this.info(LogCategory.SYSTEM, `Application shutting down`);
    },
    error: (operation: string, error: any) => {
      this.error(LogCategory.SYSTEM, `System error: ${operation}`, { error: error.message, stack: error.stack });
    },
  };
}

// Export singleton instance
export const logger = new Logger();
