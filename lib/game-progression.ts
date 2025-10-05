// ============================================================================
// GAME PROGRESSION LOGIC
// ============================================================================
// Shared logic for advancing to next duel (normal and tiebreaker modes)
// Extracted from normal-continue and tiebreaker-continue routes to eliminate
// 90% code duplication
// ============================================================================

import { query } from './db';
import { saveGameHistory } from './game-utils';
import type { TournamentData as BaseTournamentData } from '@/types/game';

// Extended version with nextDuelInfo used internally
interface TournamentData extends BaseTournamentData {
  nextDuelInfo?: {
    nextDuelIndex: number;
    duelsCompleted: number;
    duelsInCurrentRound: number;
    isTie: boolean;
  };
}

interface AdvanceResult {
  success: boolean;
  gameFinished: boolean;
  nextDuelIndex: number;
}

/**
 * ✅ OPTIMIZED: Shared function to advance game to next duel
 * Handles both normal progression and tiebreaker continuation
 *
 * @param gameSessionId - ID of the game session
 * @param currentDuelIndex - Current duel index
 * @returns Result indicating if game advanced and finished
 */
export async function advanceToNextDuel(
  gameSessionId: number,
  currentDuelIndex: number
): Promise<AdvanceResult> {
  // Fetch game session data
  const gameSession: any = await query(
    'SELECT id, duels_data FROM game_sessions WHERE id = ?',
    [gameSessionId]
  );

  if (gameSession.length === 0) {
    throw new Error('Session de jeu non trouvée');
  }

  const tournamentData: TournamentData = JSON.parse(gameSession[0].duels_data);
  const roomId = tournamentData.roomId;
  const currentDuels = tournamentData.duels;
  const currentRound = tournamentData.currentRound;

  // Determine next duel index
  const nextDuelIndex = tournamentData.nextDuelInfo?.nextDuelIndex || currentDuelIndex + 1;
  const duelsCompleted = tournamentData.nextDuelInfo?.duelsCompleted || tournamentData.winners.length;
  const duelsInCurrentRound = tournamentData.nextDuelInfo?.duelsInCurrentRound ||
    currentDuels.filter((d: any) => d.round === currentRound).length;

  let gameFinished = false;

  // Check if current round is completed
  if (duelsCompleted === duelsInCurrentRound) {
    // Round finished - check if tournament is over
    if (tournamentData.winners.length === 1) {
      // ✅ TOURNAMENT FINISHED!
      await saveGameHistory(gameSessionId, tournamentData, roomId);

      // Update game status to finished
      await query(
        'UPDATE game_sessions SET status = ?, current_duel_index = ? WHERE id = ?',
        ['finished', nextDuelIndex, gameSessionId]
      );

      // Reset in_game status for all room members
      await query(
        `UPDATE users u
         JOIN room_members rm ON u.id = rm.user_id
         SET u.in_game = FALSE
         WHERE rm.room_id = ?`,
        [roomId]
      );

      // Delete the room
      await query('DELETE FROM rooms WHERE id = ?', [roomId]);

      gameFinished = true;
    } else {
      // Create next round duels with winners
      const nextRound = currentRound + 1;
      const winners = tournamentData.winners;
      const newDuels: any[] = [];

      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          newDuels.push({
            item1: tournamentData.allItems.find((item: any) => item.name === winners[i]),
            item2: tournamentData.allItems.find((item: any) => item.name === winners[i + 1]),
            round: nextRound,
            matchIndex: Math.floor(i / 2)
          });
        }
      }

      // Update tournament data with new duels
      tournamentData.duels = [...currentDuels, ...newDuels];
      tournamentData.currentRound = nextRound;
      tournamentData.winners = [];

      await query(
        'UPDATE game_sessions SET current_duel_index = ?, video_start_time = NOW(), duels_data = ? WHERE id = ?',
        [nextDuelIndex, JSON.stringify(tournamentData), gameSessionId]
      );
    }
  } else {
    // Move to next duel in same round
    await query(
      'UPDATE game_sessions SET current_duel_index = ?, video_start_time = NOW(), duels_data = ? WHERE id = ?',
      [nextDuelIndex, JSON.stringify(tournamentData), gameSessionId]
    );
  }

  return {
    success: true,
    gameFinished,
    nextDuelIndex
  };
}

/**
 * ✅ OPTIMIZED: Record continue click and advance if threshold reached
 *
 * @param gameSessionId - ID of the game session
 * @param duelIndex - Current duel index
 * @param userId - User ID clicking continue
 * @param tableName - Either 'normal_continues' or 'tiebreaker_continues'
 * @param requiredClicks - Number of clicks needed (2 for tiebreaker, all players for normal)
 * @returns Continue click count and whether ready to advance
 */
export async function handleContinueClick(
  gameSessionId: number,
  duelIndex: number,
  userId: number,
  tableName: 'normal_continues' | 'tiebreaker_continues',
  requiredClicks: number | 'all'
): Promise<{ continueClicks: number; totalPlayers: number; allContinued: boolean }> {
  // Insert continue click (will fail with duplicate key if already clicked)
  await query(
    `INSERT INTO ${tableName} (game_session_id, duel_index, user_id) VALUES (?, ?, ?)`,
    [gameSessionId, duelIndex, userId]
  );

  // Count total clicks
  const clicks: any = await query(
    `SELECT COUNT(*) as count FROM ${tableName} WHERE game_session_id = ? AND duel_index = ?`,
    [gameSessionId, duelIndex]
  );

  const continueClicks = clicks[0].count;

  // Get total players in room
  const gameSession: any = await query(
    'SELECT duels_data FROM game_sessions WHERE id = ?',
    [gameSessionId]
  );

  const tournamentData = JSON.parse(gameSession[0].duels_data);
  const roomId = tournamentData.roomId;

  const totalPlayers: any = await query(
    'SELECT COUNT(*) as count FROM room_members WHERE room_id = ?',
    [roomId]
  );

  const totalCount = totalPlayers[0].count;
  const threshold = requiredClicks === 'all' ? totalCount : requiredClicks;
  const allContinued = continueClicks >= threshold;

  // If threshold reached, advance to next duel
  if (allContinued) {
    await advanceToNextDuel(gameSessionId, duelIndex);

    // Clean up continue clicks for this duel
    await query(
      `DELETE FROM ${tableName} WHERE game_session_id = ? AND duel_index = ?`,
      [gameSessionId, duelIndex]
    );
  }

  return {
    continueClicks,
    totalPlayers: totalCount,
    allContinued
  };
}
