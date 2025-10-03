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
      return NextResponse.json({ error: 'gameSessionId et duelIndex requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier si l'utilisateur a déjà cliqué pour continuer ce duel
    const existing: any = await query(
      `SELECT * FROM normal_continues WHERE game_session_id = ? AND duel_index = ? AND user_id = ?`,
      [gameSessionId, duelIndex, userId]
    );

    if (existing.length > 0) {
      return NextResponse.json({ error: 'Vous avez déjà cliqué pour continuer' }, { status: 400 });
    }

    // Enregistrer le clic
    await query(
      `INSERT INTO normal_continues (game_session_id, duel_index, user_id) VALUES (?, ?, ?)`,
      [gameSessionId, duelIndex, userId]
    );

    // Compter le nombre de clics pour ce duel
    const clicks: any = await query(
      `SELECT COUNT(*) as count FROM normal_continues WHERE game_session_id = ? AND duel_index = ?`,
      [gameSessionId, duelIndex]
    );

    // Récupérer la session de jeu
    const gameSession: any = await query(
      `SELECT duels_data FROM game_sessions WHERE id = ?`,
      [gameSessionId]
    );

    if (gameSession.length === 0) {
      return NextResponse.json({ error: 'Session de jeu non trouvée' }, { status: 404 });
    }

    const tournamentData = JSON.parse(gameSession[0].duels_data);
    const roomId = tournamentData.roomId;

    // Compter le nombre total de joueurs dans la room
    const totalPlayers: any = await query(
      `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
      [roomId]
    );

    const continueClicks = clicks[0].count;
    const totalCount = totalPlayers[0].count;

    // Si tous les joueurs ont cliqué, passer au duel suivant
    if (continueClicks >= totalCount) {
      const nextDuelInfo = tournamentData.nextDuelInfo;
      const nextDuelIndex = nextDuelInfo.nextDuelIndex;
      const duelsCompleted = nextDuelInfo.duelsCompleted;
      const duelsInCurrentRound = nextDuelInfo.duelsInCurrentRound;

      const currentDuels = tournamentData.duels;
      const currentRound = tournamentData.currentRound;

      // Vérifier si tous les duels du round actuel sont terminés
      if (duelsCompleted === duelsInCurrentRound) {
        // Round terminé, créer les matchs du prochain round
        if (tournamentData.winners.length === 1) {
          // Le tournoi est terminé ! Sauvegarder tout dans un fichier avant nettoyage
          await saveGameHistory(gameSessionId, tournamentData, roomId);

          // Mettre à jour le statut
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

          // Supprimer le salon maintenant que la partie est terminée
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

      // Supprimer tous les clics de continuer pour ce duel
      await query(
        `DELETE FROM normal_continues WHERE game_session_id = ? AND duel_index = ?`,
        [gameSessionId, duelIndex]
      );
    }

    return NextResponse.json({
      success: true,
      continueClicks,
      totalPlayers: totalCount,
      allContinued: continueClicks >= totalCount
    });
  } catch (error) {
    console.error('Erreur lors du clic continuer:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
