import { query } from '@/lib/db';
import type { TournamentData, GameSession } from '@/types/game';
import fs from 'fs/promises';
import path from 'path';

export async function saveGameHistory(
  gameSessionId: number,
  tournamentData: TournamentData,
  roomId: number
): Promise<void> {
  try {
    // Récupérer toutes les informations de la partie
    const gameSession = await query<Pick<GameSession, 'id' | 'status' | 'created_at'>>(
      'SELECT id, status, created_at FROM game_sessions WHERE id = ?',
      [gameSessionId]
    );

    // Récupérer tous les votes avec les détails
    const allVotes = await query<{
      duel_index: number;
      item_voted: string;
      voter_name: string;
      created_at: string;
    }>(
      `SELECT v.duel_index, v.item_voted, u.name as voter_name, v.created_at
       FROM votes v
       JOIN users u ON v.user_id = u.id
       WHERE v.game_session_id = ?
       ORDER BY v.duel_index`,
      [gameSessionId]
    );

    // Récupérer tous les membres du salon
    const members = await query<{ name: string; joined_at: string }>(
      `SELECT u.name, rm.joined_at
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = ?`,
      [roomId]
    );

    // Organiser les votes par duel
    const duelResults = tournamentData.duels.map((duel, index) => {
      const duelVotes = allVotes.filter((v) => v.duel_index === index);

      const item1Votes = duelVotes.filter((v) => v.item_voted === duel.item1.name);
      const item2Votes = duelVotes.filter((v) => v.item_voted === duel.item2.name);

      const winner = item1Votes.length > item2Votes.length ? duel.item1.name : duel.item2.name;

      return {
        duelIndex: index,
        round: duel.round,
        item1: duel.item1,
        item2: duel.item2,
        item1Votes: item1Votes.map((v) => ({ voter: v.voter_name, votedAt: v.created_at })),
        item2Votes: item2Votes.map((v) => ({ voter: v.voter_name, votedAt: v.created_at })),
        item1Count: item1Votes.length,
        item2Count: item2Votes.length,
        winner
      };
    });

    // Créer l'objet historique complet
    const historyData = {
      gameSessionId,
      roomName: tournamentData.roomName,
      winner: tournamentData.winners[0],
      totalRounds: tournamentData.totalRounds,
      allParticipants: tournamentData.allItems,
      members: members.map((m) => ({ name: m.name, joinedAt: m.joined_at })),
      duelResults,
      tieBreakers: tournamentData.tieBreakers || [],
      startedAt: gameSession[0].created_at,
      finishedAt: new Date().toISOString()
    };

    // Sauvegarder dans un fichier JSON avec création du répertoire si nécessaire
    const historyDir = path.join(process.cwd(), 'public', 'game_history');
    await fs.mkdir(historyDir, { recursive: true }); // Créer le répertoire s'il n'existe pas

    const fileName = `game_${gameSessionId}_${Date.now()}.json`;
    const filePath = path.join(historyDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(historyData, null, 2), 'utf-8');

    // Enregistrer le chemin du fichier dans game_results
    await query(
      'INSERT INTO game_results (game_session_id, history_file, winner) VALUES (?, ?, ?)',
      [gameSessionId, `/game_history/${fileName}`, tournamentData.winners[0]]
    );

    console.log(`Historique de la partie ${gameSessionId} sauvegardé dans ${fileName}`);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de l\'historique:', error);
    throw error;
  }
}
