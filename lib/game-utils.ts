import { query } from '@/lib/db';
import type { TournamentData, GameSession } from '@/types/game';
import fs from 'fs/promises';
import path from 'path';
import { convertDbRows } from '@/lib/case-converter';

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

    // ✅ REFACTORED: Use case converter for consistent naming
    // Récupérer tous les votes avec les détails
    const allVotesRaw = await query(
      `SELECT v.duel_index, v.item_voted, u.name as voter_name, u.profile_picture_url, v.created_at
       FROM votes v
       JOIN users u ON v.user_id = u.id
       WHERE v.game_session_id = ?
       ORDER BY v.duel_index`,
      [gameSessionId]
    );

    const allVotes = convertDbRows(allVotesRaw);

    // Récupérer tous les membres du salon
    const membersRaw = await query(
      `SELECT u.name, rm.joined_at
       FROM room_members rm
       JOIN users u ON rm.user_id = u.id
       WHERE rm.room_id = ?`,
      [roomId]
    );

    const members = convertDbRows(membersRaw);

    // Organiser les votes par duel
    const duelResults = tournamentData.duels.map((duel, index) => {
      const duelVotes = allVotes.filter((v: any) => v.duelIndex === index);

      const item1Votes = duelVotes.filter((v: any) => v.itemVoted === duel.item1.name);
      const item2Votes = duelVotes.filter((v: any) => v.itemVoted === duel.item2.name);

      const winner = item1Votes.length > item2Votes.length ? duel.item1.name : duel.item2.name;

      return {
        duelIndex: index,
        round: duel.round,
        item1: duel.item1,
        item2: duel.item2,
        item1Votes: item1Votes.map((v: any) => ({ voter: v.voterName, votedAt: v.createdAt, profilePictureUrl: v.profilePictureUrl })),
        item2Votes: item2Votes.map((v: any) => ({ voter: v.voterName, votedAt: v.createdAt, profilePictureUrl: v.profilePictureUrl })),
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
      members: members.map((m: any) => ({ name: m.name, joinedAt: m.joinedAt })),
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
