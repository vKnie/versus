import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';
import { saveGameHistory } from '@/lib/game-utils';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { gameSessionId, duelIndex } = await req.json();

    if (!gameSessionId || duelIndex === undefined) {
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Enregistrer le clic "Continuer" de cet utilisateur
    try {
      await query(
        `INSERT INTO tiebreaker_continues (game_session_id, duel_index, user_id)
         VALUES (?, ?, ?)`,
        [gameSessionId, duelIndex, userId]
      );
    } catch (error: any) {
      if (error.code === 'ER_DUP_ENTRY') {
        return NextResponse.json({ error: 'Vous avez déjà cliqué sur Continuer' }, { status: 400 });
      }
      throw error;
    }

    // Compter combien de personnes ont cliqué
    const continueCount: any = await query(
      'SELECT COUNT(*) as count FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
      [gameSessionId, duelIndex]
    );

    const totalContinues = continueCount[0].count;

    console.log(`🎲 Tiebreaker continue: ${totalContinues}/2`);

    // Si au moins 2 personnes ont cliqué, passer au duel suivant
    if (totalContinues >= 2) {
      console.log(`✅ 2+ clics détectés, changement de duel...`);
      // Récupérer les données de la session
      const gameSession: any = await query(
        'SELECT * FROM game_sessions WHERE id = ?',
        [gameSessionId]
      );

      if (gameSession.length === 0) {
        return NextResponse.json({ error: 'Session non trouvée' }, { status: 404 });
      }

      const tournamentData = JSON.parse(gameSession[0].duels_data);
      const roomId = tournamentData.roomId;
      const currentDuels = tournamentData.duels;
      const currentRound = tournamentData.currentRound;
      const nextDuelIndex = duelIndex + 1;

      // Vérifier si tous les duels du round actuel sont terminés
      const duelsInCurrentRound = currentDuels.filter((d: any) => d.round === currentRound);
      const duelsCompleted = tournamentData.winners.length;

      if (duelsCompleted === duelsInCurrentRound.length) {
        // Round terminé, créer les matchs du prochain round
        if (tournamentData.winners.length === 1) {
          // Le tournoi est terminé ! Sauvegarder tout dans un fichier avant nettoyage
          await saveGameHistory(gameSessionId, tournamentData, roomId);

          await query(
            'UPDATE game_sessions SET status = \'finished\', current_duel_index = ? WHERE id = ?',
            [nextDuelIndex, gameSessionId]
          );

          // Remettre tous les utilisateurs du salon à in_game = FALSE
          await query(
            `UPDATE users u
             JOIN room_members rm ON u.id = rm.user_id
             SET u.in_game = FALSE
             WHERE rm.room_id = ?`,
            [roomId]
          );

          // Supprimer le salon
          await query('DELETE FROM rooms WHERE id = ?', [roomId]);
        } else {
          // Créer les duels du prochain round avec les gagnants
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

          // Ajouter les nouveaux duels et réinitialiser les gagnants pour le prochain round
          tournamentData.duels = [...currentDuels, ...newDuels];
          tournamentData.currentRound = nextRound;
          tournamentData.winners = [];

          await query(
            'UPDATE game_sessions SET current_duel_index = ?, video_start_time = NOW(), duels_data = ? WHERE id = ?',
            [nextDuelIndex, JSON.stringify(tournamentData), gameSessionId]
          );
        }
      } else {
        // Passer au duel suivant dans le même round
        await query(
          'UPDATE game_sessions SET current_duel_index = ?, video_start_time = NOW(), duels_data = ? WHERE id = ?',
          [nextDuelIndex, JSON.stringify(tournamentData), gameSessionId]
        );
      }

      // Nettoyer les clics "Continuer" pour ce duel
      await query(
        'DELETE FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
        [gameSessionId, duelIndex]
      );

      console.log(`✅ Duel changé vers index ${nextDuelIndex}`);

      return NextResponse.json({
        success: true,
        continueClicks: totalContinues,
        readyToAdvance: true
      });
    }

    return NextResponse.json({
      success: true,
      continueClicks: totalContinues,
      readyToAdvance: false
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement du clic Continuer:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
