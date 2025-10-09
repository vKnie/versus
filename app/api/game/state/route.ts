import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';
import { convertDbRow } from '@/lib/case-converter';
import { getVoteDetails } from '@/lib/vote-service';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'roomId requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier d'abord s'il y a une partie terminée pour ce salon
    const finishedSession: any = await query(
      `SELECT gs.id, gs.status, gs.duels_data
       FROM game_sessions gs
       WHERE gs.status = 'finished'
       ORDER BY gs.created_at DESC
       LIMIT 1`
    );

    if (finishedSession.length > 0) {
      const finishedData = JSON.parse(finishedSession[0].duels_data);
      if (finishedData.roomId === parseInt(roomId)) {
        return NextResponse.json({
          gameSessionId: finishedSession[0].id,
          status: 'finished'
        });
      }
    }

    // Vérifier que l'utilisateur est membre du salon
    const memberCheck: any = await query(
      'SELECT id FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (memberCheck.length === 0) {
      return NextResponse.json({ error: 'Vous n\'êtes pas membre de ce salon' }, { status: 403 });
    }

    // Récupérer la session de jeu active pour ce salon
    const gameSession: any = await query(
      `SELECT id, status, current_duel_index, duels_data, video_start_time, created_at FROM game_sessions WHERE status = 'in_progress' ORDER BY created_at DESC LIMIT 1`
    );

    if (gameSession.length === 0) {
      return NextResponse.json({ error: 'Aucune partie en cours' }, { status: 404 });
    }

    const session_data = gameSession[0];
    const tournamentData = JSON.parse(session_data.duels_data);

    // Vérifier que c'est le bon salon
    if (tournamentData.roomId !== parseInt(roomId)) {
      return NextResponse.json({ error: 'Aucune partie en cours pour ce salon' }, { status: 404 });
    }

    const duels = tournamentData.duels;
    const currentDuel = duels[session_data.current_duel_index];
    const currentRound = tournamentData.currentRound;

    // ✅ OPTIMIZED: Batch fetch all proposer profiles in ONE query instead of N+1 queries
    const enrichDuelWithProfiles = async (duel: any) => {
      // Collect all unique proposer names from both items
      const allProposers: string[] = [];

      const collectProposers = (item: any) => {
        item.proposedBy.forEach((person: string | { name: string; profilePictureUrl?: string | null }) => {
          if (typeof person === 'string') {
            allProposers.push(person);
          }
        });
      };

      collectProposers(duel.item1);
      collectProposers(duel.item2);

      // Remove duplicates
      const uniqueProposers = [...new Set(allProposers)];

      // ✅ Single batched query with IN clause instead of N separate queries
      let profileMap = new Map<string, string | null>();
      if (uniqueProposers.length > 0) {
        const placeholders = uniqueProposers.map(() => '?').join(',');
        const profiles: any = await query(
          `SELECT name, profile_picture_url FROM users WHERE name IN (${placeholders})`,
          uniqueProposers
        );
        profileMap = new Map(profiles.map((p: any) => [p.name, p.profile_picture_url]));
      }

      // Enrich items with fetched profiles
      const enrichItem = (item: any) => {
        const proposedByWithProfiles = item.proposedBy.map((person: string | { name: string; profilePictureUrl?: string | null }) => {
          if (typeof person === 'object' && person !== null) {
            return person;
          }
          const personName = person as string;
          return {
            name: personName,
            profilePictureUrl: profileMap.get(personName) || null
          };
        });
        return { ...item, proposedBy: proposedByWithProfiles };
      };

      return {
        item1: enrichItem(duel.item1),
        item2: enrichItem(duel.item2)
      };
    };

    const enrichedCurrentDuel = await enrichDuelWithProfiles(currentDuel);

    // Compter les joueurs du salon et récupérer le créateur
    const totalPlayers: any = await query(
      'SELECT COUNT(*) as count FROM room_members WHERE room_id = ?',
      [roomId]
    );

    // Récupérer le créateur du salon avec ses informations
    const roomInfo: any = await query(
      `SELECT r.created_by, u.name, u.profile_picture_url
       FROM rooms r
       JOIN users u ON r.created_by = u.id
       WHERE r.id = ?`,
      [roomId]
    );
    const isGameMaster = roomInfo.length > 0 && roomInfo[0].created_by === userId;
    const gameMaster = roomInfo.length > 0 ? {
      name: roomInfo[0].name,
      profilePictureUrl: roomInfo[0].profile_picture_url
    } : null;

    // ✅ REFACTORED: Use vote service to get vote details
    const voteDetails = await getVoteDetails(session_data.id, session_data.current_duel_index);

    // Vérifier si l'utilisateur actuel a déjà voté
    const userVote = voteDetails.find((v) => v.userId === userId);

    // Vérifier s'il y a un tie-breaker pour ce duel
    const tieBreakers = tournamentData.tieBreakers || [];
    const currentTieBreaker = tieBreakers.find((tb: any) => tb.duelIndex === session_data.current_duel_index);

    // Compter combien de personnes ont cliqué sur "Continuer" pour ce tie-breaker
    let continueClicks = 0;
    let userHasContinued = false;
    if (currentTieBreaker) {
      const continueCount: any = await query(
        'SELECT COUNT(*) as count, SUM(user_id = ?) as user_clicked FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
        [userId, session_data.id, session_data.current_duel_index]
      );
      continueClicks = continueCount[0].count || 0;
      userHasContinued = (continueCount[0].user_clicked || 0) > 0;
    }

    // ✅ REFACTORED: Use case converter for consistent naming
    const sessionDataCamel = convertDbRow(session_data);

    return NextResponse.json({
      gameSessionId: sessionDataCamel.id,
      status: sessionDataCamel.status,
      currentDuelIndex: sessionDataCamel.currentDuelIndex,
      totalDuels: duels.length,
      currentDuel: enrichedCurrentDuel,
      currentRound,
      totalRounds: tournamentData.totalRounds,
      votes: voteDetails.length,
      voteDetails,
      totalPlayers: totalPlayers[0].count,
      hasVoted: !!userVote,
      userVote: userVote?.itemVoted || null,
      videoStartTime: sessionDataCamel.videoStartTime,
      allVoted: voteDetails.length === totalPlayers[0].count,
      tieBreaker: currentTieBreaker || null,
      continueClicks,
      userHasContinued,
      isGameMaster,
      gameMaster
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'état du jeu:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
