import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName, getPool } from '@/lib/db';
import { logger } from '@/lib/logger';
import { validateVoteInput, recordVote, getVoteResults, determineWinner } from '@/lib/vote-service';

async function handleVote(req: NextRequest) {
  const connection = await getPool().getConnection();
  const startTime = Date.now();
  let username: string | undefined;

  try {
    const session = await getServerSession();
    username = session?.user?.name;
    if (!session || !session.user?.name) {
      logger.api.error('POST', '/api/game/vote', new Error('Unauthorized'));
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { gameSessionId, duelIndex, itemVoted } = await req.json();

    // ✅ REFACTORED: Use vote service for validation
    try {
      validateVoteInput(gameSessionId, duelIndex, itemVoted);
    } catch (validationError: any) {
      return NextResponse.json({ error: validationError.message }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // ✅ Démarrer une transaction pour garantir l'atomicité
    await connection.beginTransaction();

    // Vérifier que la session de jeu existe et est en cours
    const [gameSession]: any = await connection.execute(
      'SELECT id, status, current_duel_index, duels_data FROM game_sessions WHERE id = ? AND status = \'in_progress\'',
      [gameSessionId]
    );

    if (gameSession.length === 0) {
      await connection.rollback();
      return NextResponse.json({ error: 'Session de jeu non trouvée ou terminée' }, { status: 404 });
    }

    // Vérifier que le duelIndex correspond au duel actuel
    if (gameSession[0].current_duel_index !== duelIndex) {
      await connection.rollback();
      return NextResponse.json({ error: 'Ce duel n\'est plus actif' }, { status: 400 });
    }

    // ✅ REFACTORED: Use vote service to record vote
    try {
      await recordVote(connection, gameSessionId, userId, duelIndex, itemVoted);
    } catch (error: any) {
      await connection.rollback();
      if (error.message === 'DUPLICATE_VOTE') {
        return NextResponse.json({ error: 'Vous avez déjà voté pour ce duel' }, { status: 400 });
      }
      throw error;
    }

    // Récupérer les données du tournoi
    const tournamentData = JSON.parse(gameSession[0].duels_data);
    const roomId = tournamentData.roomId;

    // Vérifier si tous les joueurs ont voté
    const [voteCount]: any = await connection.execute(
      'SELECT COUNT(*) as count FROM votes WHERE game_session_id = ? AND duel_index = ?',
      [gameSessionId, duelIndex]
    );

    const [totalPlayers]: any = await connection.execute(
      'SELECT COUNT(*) as count FROM room_members WHERE room_id = ?',
      [roomId]
    );

    const allVoted = voteCount[0].count === totalPlayers[0].count;

    if (allVoted) {
      // ✅ REFACTORED: Use vote service to get results and determine winner
      const [voteResults]: any = await connection.execute(
        'SELECT item_voted, COUNT(*) as votes FROM votes WHERE game_session_id = ? AND duel_index = ? GROUP BY item_voted ORDER BY votes DESC',
        [gameSessionId, duelIndex]
      );

      const { winner, tieBreaker } = determineWinner(voteResults, duelIndex);
      const isTie = tieBreaker !== null;

      // Enregistrer le tie-breaker dans les données du tournoi pour l'affichage
      if (tieBreaker) {
        if (!tournamentData.tieBreakers) tournamentData.tieBreakers = [];
        tournamentData.tieBreakers.push(tieBreaker);
      }

      // Mettre à jour les données du tournoi
      const currentDuels = tournamentData.duels;
      const currentRound = tournamentData.currentRound;

      // Ajouter le gagnant à la liste
      if (!tournamentData.winners) tournamentData.winners = [];
      tournamentData.winners.push(winner);

      const nextDuelIndex = duelIndex + 1;

      // Vérifier si tous les duels du round actuel sont terminés
      const duelsInCurrentRound = currentDuels.filter((d: any) => d.round === currentRound);
      const duelsCompleted = tournamentData.winners.length;

      // Sauvegarder les données du tournoi mais NE PAS changer de duel
      // Le changement de duel sera géré par l'API normal-continue ou tiebreaker-continue
      // quand tous les joueurs auront cliqué sur "Continuer"

      // Stocker les informations nécessaires pour le prochain duel dans tournamentData
      tournamentData.nextDuelInfo = {
        nextDuelIndex,
        duelsCompleted,
        duelsInCurrentRound: duelsInCurrentRound.length,
        isTie
      };

      // Mettre à jour SEULEMENT les données du tournoi mais PAS le duel_index
      await connection.execute(
        'UPDATE game_sessions SET duels_data = ? WHERE id = ?',
        [JSON.stringify(tournamentData), gameSessionId]
      );
    }

    // ✅ Commit de la transaction si tout s'est bien passé
    await connection.commit();

    const duration = Date.now() - startTime;
    logger.game.voted(gameSessionId, duelIndex, itemVoted, session.user.name);
    logger.api.request('POST', '/api/game/vote', 200, duration, session.user.name);

    return NextResponse.json({
      success: true,
      allVoted,
      message: 'Vote enregistré avec succès'
    });
  } catch (error: any) {
    await connection.rollback();
    logger.api.error('POST', '/api/game/vote', error, username);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  } finally {
    connection.release();
  }
}

// Pas de rate limiting pour les votes
export const POST = handleVote;
