import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

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

    // Compter les joueurs du salon
    const totalPlayers: any = await query(
      'SELECT COUNT(*) as count FROM room_members WHERE room_id = ?',
      [roomId]
    );

    // Récupérer les votes pour le duel actuel avec photos de profil
    const votes: any = await query(
      `SELECT v.user_id, u.name, u.profile_picture_url, v.item_voted
       FROM votes v
       JOIN users u ON v.user_id = u.id
       WHERE v.game_session_id = ? AND v.duel_index = ?`,
      [session_data.id, session_data.current_duel_index]
    );

    // Vérifier si l'utilisateur actuel a déjà voté
    const userVote = votes.find((v: any) => v.user_id === userId);

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

    return NextResponse.json({
      gameSessionId: session_data.id,
      status: session_data.status,
      currentDuelIndex: session_data.current_duel_index,
      totalDuels: duels.length,
      currentDuel,
      currentRound,
      totalRounds: tournamentData.totalRounds,
      votes: votes.length,
      voteDetails: votes.map((v: any) => ({
        userId: v.user_id,
        name: v.name,
        profilePictureUrl: v.profile_picture_url,
        itemVoted: v.item_voted
      })),
      totalPlayers: totalPlayers[0].count,
      hasVoted: !!userVote,
      userVote: userVote?.item_voted || null,
      videoStartTime: session_data.video_start_time,
      allVoted: votes.length === totalPlayers[0].count,
      tieBreaker: currentTieBreaker || null,
      continueClicks,
      userHasContinued
    });
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'état du jeu:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
