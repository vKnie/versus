import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, getPool } from '@/lib/db';
import { withRateLimit } from '@/lib/rate-limit';
import { saveGameHistory } from '@/lib/game-utils';

async function handleVote(req: NextRequest) {
  const connection = await getPool().getConnection();

  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { gameSessionId, duelIndex, itemVoted } = await req.json();

    if (!gameSessionId || duelIndex === undefined || !itemVoted) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
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

    // Enregistrer le vote (si déjà voté, le UNIQUE constraint empêchera le doublon)
    try {
      await connection.execute(
        `INSERT INTO votes (game_session_id, user_id, duel_index, item_voted)
         VALUES (?, ?, ?, ?)`,
        [gameSessionId, userId, duelIndex, itemVoted]
      );
    } catch (error: any) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
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
      // Récupérer le gagnant du duel
      const [voteResults]: any = await connection.execute(
        'SELECT item_voted, COUNT(*) as votes FROM votes WHERE game_session_id = ? AND duel_index = ? GROUP BY item_voted ORDER BY votes DESC',
        [gameSessionId, duelIndex]
      );

      let winner: string;
      let isTie = false;
      let tieBreaker: { winner: string; item1: string; item2: string; coinFlip: 'heads' | 'tails' } | null = null;

      // Vérifier s'il y a égalité
      if (voteResults.length >= 2 && voteResults[0].votes === voteResults[1].votes) {
        // ÉGALITÉ ! Pile ou face
        isTie = true;
        const item1 = voteResults[0].item_voted;
        const item2 = voteResults[1].item_voted;

        // Pile ou face aléatoire (50/50)
        const coinFlip = Math.random() < 0.5 ? 'heads' : 'tails';
        winner = coinFlip === 'heads' ? item1 : item2;

        tieBreaker = {
          winner,
          item1,
          item2,
          coinFlip
        };

        // Enregistrer le tie-breaker dans les données du tournoi pour l'affichage
        if (!tournamentData.tieBreakers) tournamentData.tieBreakers = [];
        tournamentData.tieBreakers.push({
          duelIndex,
          ...tieBreaker,
          votes: voteResults[0].votes
        });

        console.log(`🎲 TIE BREAKER - Duel ${duelIndex}: ${item1} vs ${item2} (${voteResults[0].votes}-${voteResults[0].votes})`);
        console.log(`🪙 Coin flip: ${coinFlip} → Winner: ${winner}`);
      } else {
        // Pas d'égalité, le plus de votes gagne
        winner = voteResults[0].item_voted;
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

    return NextResponse.json({
      success: true,
      allVoted,
      message: 'Vote enregistré avec succès'
    });
  } catch (error) {
    await connection.rollback();
    console.error('Erreur lors de l\'enregistrement du vote:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  } finally {
    connection.release();
  }
}

// Appliquer rate limiting : 20 votes max par minute
export const POST = withRateLimit(handleVote, 20, 60000);
