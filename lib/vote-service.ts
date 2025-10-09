// ============================================================================
// VOTE SERVICE
// ============================================================================
// Centralized vote logic to eliminate duplication across:
// - app/api/game/vote/route.ts
// - server.ts (vote_cast handler)
// - app/api/game/state/route.ts
// This service handles vote validation, counting, and tiebreaker resolution
// ============================================================================

import { query } from './db';
import { logger } from './logger';
import type { PoolConnection, RowDataPacket } from 'mysql2/promise';

/**
 * Vote detail with user information
 */
export interface VoteDetail {
  userId: number;
  name: string;
  profilePictureUrl: string | null;
  itemVoted: string;
}

/**
 * Vote count results grouped by item
 */
export interface VoteResults {
  item_voted: string;
  votes: number;
}

/**
 * Tiebreaker result when two items have equal votes
 */
export interface TieBreaker {
  duelIndex: number;
  winner: string;
  item1: string;
  item2: string;
  coinFlip: 'heads' | 'tails';
  votes: number;
}

/**
 * Result of checking if all players have voted
 */
export interface AllVotedResult {
  allVoted: boolean;
  voteCount: number;
  totalPlayers: number;
  winner?: string;
  tieBreaker?: TieBreaker;
}

/**
 * Validates vote input parameters
 *
 * @param gameSessionId - Game session ID
 * @param duelIndex - Current duel index
 * @param itemVoted - Item being voted for
 * @throws Error if validation fails
 */
export function validateVoteInput(
  gameSessionId: any,
  duelIndex: any,
  itemVoted: any
): void {
  if (typeof gameSessionId !== 'number' || gameSessionId <= 0) {
    throw new Error('Invalid game session ID');
  }

  if (typeof duelIndex !== 'number' || duelIndex < 0) {
    throw new Error('Invalid duel index');
  }

  if (typeof itemVoted !== 'string' || itemVoted.length === 0 || itemVoted.length > 500) {
    throw new Error('Invalid item voted');
  }
}

/**
 * Fetches vote details for a specific duel with user information
 *
 * @param gameSessionId - Game session ID
 * @param duelIndex - Duel index
 * @returns Array of vote details
 */
export async function getVoteDetails(
  gameSessionId: number,
  duelIndex: number
): Promise<VoteDetail[]> {
  const votes: any = await query(
    `SELECT v.user_id, u.name, u.profile_picture_url, v.item_voted
     FROM votes v
     JOIN users u ON v.user_id = u.id
     WHERE v.game_session_id = ? AND v.duel_index = ?`,
    [gameSessionId, duelIndex]
  );

  return votes.map((v: any) => ({
    userId: v.user_id,
    name: v.name,
    profilePictureUrl: v.profile_picture_url,
    itemVoted: v.item_voted,
  }));
}

/**
 * Gets the count of votes for a specific duel
 *
 * @param gameSessionId - Game session ID
 * @param duelIndex - Duel index
 * @returns Vote count
 */
export async function getVoteCount(
  gameSessionId: number,
  duelIndex: number
): Promise<number> {
  const result: any = await query(
    'SELECT COUNT(*) as count FROM votes WHERE game_session_id = ? AND duel_index = ?',
    [gameSessionId, duelIndex]
  );

  return result[0].count || 0;
}

/**
 * Gets vote results grouped by item with counts
 *
 * @param gameSessionId - Game session ID
 * @param duelIndex - Duel index
 * @returns Array of vote results by item
 */
export async function getVoteResults(
  gameSessionId: number,
  duelIndex: number
): Promise<VoteResults[]> {
  const results: any = await query(
    `SELECT item_voted, COUNT(*) as votes
     FROM votes
     WHERE game_session_id = ? AND duel_index = ?
     GROUP BY item_voted
     ORDER BY votes DESC`,
    [gameSessionId, duelIndex]
  );

  return results;
}

/**
 * Determines the winner of a duel, handling ties with a coin flip
 *
 * @param voteResults - Vote results grouped by item
 * @param duelIndex - Current duel index
 * @returns Winner name and optional tiebreaker info
 */
export function determineWinner(
  voteResults: VoteResults[],
  duelIndex: number
): { winner: string; tieBreaker: TieBreaker | null } {
  if (voteResults.length === 0) {
    throw new Error('No votes found');
  }

  // Check for tie (at least 2 items with equal votes)
  if (voteResults.length >= 2 && voteResults[0].votes === voteResults[1].votes) {
    const item1 = voteResults[0].item_voted;
    const item2 = voteResults[1].item_voted;

    // Coin flip: 50/50 chance
    const coinFlip = Math.random() < 0.5 ? 'heads' : 'tails';
    const winner = coinFlip === 'heads' ? item1 : item2;

    const tieBreaker: TieBreaker = {
      duelIndex,
      winner,
      item1,
      item2,
      coinFlip,
      votes: voteResults[0].votes,
    };

    logger.game.tieBreaker(
      0, // gameSessionId not available here
      duelIndex,
      item1,
      item2,
      winner
    );

    return { winner, tieBreaker };
  }

  // No tie - highest votes wins
  return { winner: voteResults[0].item_voted, tieBreaker: null };
}

/**
 * Checks if all players in a room have voted for the current duel
 *
 * @param gameSessionId - Game session ID
 * @param duelIndex - Current duel index
 * @param roomId - Room ID
 * @returns Result indicating if all voted and vote counts
 */
export async function checkAllVoted(
  gameSessionId: number,
  duelIndex: number,
  roomId: number
): Promise<AllVotedResult> {
  // Get vote count and total players in parallel
  const [voteCount, totalPlayers] = await Promise.all([
    getVoteCount(gameSessionId, duelIndex),
    query('SELECT COUNT(*) as count FROM room_members WHERE room_id = ?', [roomId]),
  ]);

  const totalPlayerCount = (totalPlayers as any)[0].count;
  const allVoted = voteCount === totalPlayerCount;

  return {
    allVoted,
    voteCount,
    totalPlayers: totalPlayerCount,
  };
}

/**
 * Records a vote in the database (with transaction support)
 *
 * @param connection - Database connection (for transaction support)
 * @param gameSessionId - Game session ID
 * @param userId - User ID voting
 * @param duelIndex - Current duel index
 * @param itemVoted - Item being voted for
 * @throws Error if duplicate vote or other error
 */
export async function recordVote(
  connection: PoolConnection,
  gameSessionId: number,
  userId: number,
  duelIndex: number,
  itemVoted: string
): Promise<void> {
  try {
    await connection.execute(
      `INSERT INTO votes (game_session_id, user_id, duel_index, item_voted)
       VALUES (?, ?, ?, ?)`,
      [gameSessionId, userId, duelIndex, itemVoted]
    );
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      throw new Error('DUPLICATE_VOTE');
    }
    throw error;
  }
}

/**
 * Checks if a user has already voted in a duel
 *
 * @param gameSessionId - Game session ID
 * @param userId - User ID
 * @param duelIndex - Duel index
 * @returns True if user has voted, false otherwise
 */
export async function hasUserVoted(
  gameSessionId: number,
  userId: number,
  duelIndex: number
): Promise<boolean> {
  const result: any = await query(
    'SELECT COUNT(*) as count FROM votes WHERE game_session_id = ? AND user_id = ? AND duel_index = ?',
    [gameSessionId, userId, duelIndex]
  );

  return result[0].count > 0;
}

/**
 * Gets the vote cast by a specific user for a duel
 *
 * @param gameSessionId - Game session ID
 * @param userId - User ID
 * @param duelIndex - Duel index
 * @returns Item voted for, or null if no vote
 */
export async function getUserVote(
  gameSessionId: number,
  userId: number,
  duelIndex: number
): Promise<string | null> {
  const result: any = await query(
    'SELECT item_voted FROM votes WHERE game_session_id = ? AND user_id = ? AND duel_index = ?',
    [gameSessionId, userId, duelIndex]
  );

  return result.length > 0 ? result[0].item_voted : null;
}
