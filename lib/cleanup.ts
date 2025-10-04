import { query } from './db';
import fs from 'fs/promises';
import path from 'path';
import type { DBGameSession, MySQLResultSetHeader } from '@/types/db';

/**
 * Nettoyer les données obsolètes de la base de données et du système de fichiers
 */
export async function cleanupOldData() {
  console.log('[Cleanup] Starting cleanup process...');

  try {
    // 1. Supprimer les messages de chat de plus de 30 jours
    const messagesDeleted = await query<MySQLResultSetHeader>(
      'DELETE FROM messages WHERE created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)'
    );
    console.log(`[Cleanup] Deleted ${(messagesDeleted as unknown as MySQLResultSetHeader).affectedRows || 0} old messages`);

    // 2. Supprimer les sessions expirées
    const sessionsDeleted = await query<MySQLResultSetHeader>(
      'DELETE FROM sessions WHERE expires <= NOW()'
    );
    console.log(`[Cleanup] Deleted ${(sessionsDeleted as unknown as MySQLResultSetHeader).affectedRows || 0} expired sessions`);

    // 3. Supprimer les sessions de jeu terminées de plus de 90 jours
    const oldGameSessions = await query<Pick<DBGameSession, 'id'>>(
      `SELECT id FROM game_sessions
       WHERE status = 'finished'
       AND created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)`
    );

    if (oldGameSessions.length > 0) {
      const gameSessionIds = oldGameSessions.map(s => s.id);
      const placeholders = gameSessionIds.map(() => '?').join(',');

      // Supprimer les votes associés
      await query(
        `DELETE FROM votes WHERE game_session_id IN (${placeholders})`,
        gameSessionIds
      );

      // Supprimer les résultats associés
      await query(
        `DELETE FROM game_results WHERE game_session_id IN (${placeholders})`,
        gameSessionIds
      );

      // Supprimer les sessions de jeu
      await query(
        `DELETE FROM game_sessions WHERE id IN (${placeholders})`,
        gameSessionIds
      );

      console.log(`[Cleanup] Deleted ${oldGameSessions.length} old game sessions`);
    }

    // 4. Nettoyer les fichiers d'historique de jeu de plus de 90 jours
    const historyDir = path.join(process.cwd(), 'public', 'game_history');
    try {
      await fs.access(historyDir);
      const files = await fs.readdir(historyDir);
      const now = Date.now();
      const ninetyDaysAgo = now - (90 * 24 * 60 * 60 * 1000);
      let filesDeleted = 0;

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(historyDir, file);
        try {
          const stats = await fs.stat(filePath);
          if (stats.mtimeMs < ninetyDaysAgo) {
            await fs.unlink(filePath);
            filesDeleted++;
          }
        } catch (error) {
          console.error(`[Cleanup] Error deleting file ${file}:`, error);
        }
      }

      console.log(`[Cleanup] Deleted ${filesDeleted} old game history files`);
    } catch {
      console.log('[Cleanup] Game history directory does not exist, skipping file cleanup');
    }

    // 5. Réinitialiser le statut in_game des utilisateurs sans session active
    const usersUpdated = await query<MySQLResultSetHeader>(
      `UPDATE users u
       LEFT JOIN sessions s ON u.id = s.user_id AND s.expires > NOW()
       SET u.in_game = FALSE
       WHERE u.in_game = TRUE AND s.id IS NULL`
    );
    console.log(`[Cleanup] Reset in_game status for ${(usersUpdated as unknown as MySQLResultSetHeader).affectedRows || 0} users`);

    console.log('[Cleanup] Cleanup process completed successfully');
    return {
      success: true,
      messagesDeleted: (messagesDeleted as unknown as MySQLResultSetHeader).affectedRows || 0,
      sessionsDeleted: (sessionsDeleted as unknown as MySQLResultSetHeader).affectedRows || 0,
      gameSessionsDeleted: oldGameSessions.length,
      usersUpdated: (usersUpdated as unknown as MySQLResultSetHeader).affectedRows || 0,
    };
  } catch (error) {
    console.error('[Cleanup] Error during cleanup process:', error);
    throw error;
  }
}

/**
 * Nettoyer uniquement les sessions expirées (léger, peut être appelé fréquemment)
 */
export async function cleanupExpiredSessions(): Promise<number> {
  try {
    const result = await query<MySQLResultSetHeader>('DELETE FROM sessions WHERE expires <= NOW()');
    const deleted = (result as unknown as MySQLResultSetHeader).affectedRows || 0;
    if (deleted > 0) {
      console.log(`[Cleanup] Deleted ${deleted} expired sessions`);
    }
    return deleted;
  } catch (error) {
    console.error('[Cleanup] Error cleaning up sessions:', error);
    return 0;
  }
}
