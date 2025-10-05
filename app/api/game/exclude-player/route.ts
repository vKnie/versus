import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName, getPool } from '@/lib/db';

export async function POST(req: NextRequest) {
  let connection;

  try {
    console.log('🚫 [EXCLUDE] Début de l\'exclusion');

    const session = await getServerSession();
    if (!session || !session.user?.name) {
      console.log('🚫 [EXCLUDE] Non autorisé - pas de session');
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { gameSessionId, userId, roomId } = await req.json();
    console.log('🚫 [EXCLUDE] Données reçues:', { gameSessionId, userId, roomId });

    if (!gameSessionId || !userId || !roomId) {
      console.log('🚫 [EXCLUDE] Données manquantes');
      return NextResponse.json({ error: 'Données manquantes' }, { status: 400 });
    }

    const currentUserId = await getUserIdByName(session.user.name);
    console.log('🚫 [EXCLUDE] Current user ID:', currentUserId);

    if (!currentUserId) {
      console.log('🚫 [EXCLUDE] Utilisateur non trouvé');
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    connection = await getPool().getConnection();
    console.log('🚫 [EXCLUDE] Connexion DB obtenue');

    // Vérifier que l'utilisateur est bien le maître du jeu (créateur de la room)
    const [roomInfo]: any = await connection.execute(
      'SELECT r.created_by FROM rooms r WHERE r.id = ?',
      [roomId]
    );
    console.log('🚫 [EXCLUDE] Room info:', roomInfo);

    if (roomInfo.length === 0) {
      console.log('🚫 [EXCLUDE] Room non trouvée');
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    if (roomInfo[0].created_by !== currentUserId) {
      console.log('🚫 [EXCLUDE] Pas le maître du jeu');
      return NextResponse.json({ error: 'Seul le maître du jeu peut exclure des joueurs' }, { status: 403 });
    }

    // Ne pas permettre au maître du jeu de s'exclure lui-même
    if (userId === currentUserId) {
      console.log('🚫 [EXCLUDE] Tentative de s\'exclure soi-même');
      return NextResponse.json({ error: 'Vous ne pouvez pas vous exclure vous-même' }, { status: 400 });
    }

    // ✅ Démarrer une transaction pour garantir l'atomicité
    console.log('🚫 [EXCLUDE] Début de la transaction');
    await connection.beginTransaction();

    // 1. Mettre à jour le statut in_game de l'utilisateur
    console.log('🚫 [EXCLUDE] Mise à jour du statut in_game');
    await connection.execute(
      'UPDATE users SET in_game = false WHERE id = ?',
      [userId]
    );

    // 2. Supprimer le joueur de room_members
    console.log('🚫 [EXCLUDE] Suppression de room_members');
    await connection.execute(
      'DELETE FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    // 3. Supprimer tous les votes du joueur pour cette session
    console.log('🚫 [EXCLUDE] Suppression des votes');
    await connection.execute(
      'DELETE FROM votes WHERE game_session_id = ? AND user_id = ?',
      [gameSessionId, userId]
    );

    // 4. Supprimer les clics "continuer" du joueur (si les tables existent)
    try {
      console.log('🚫 [EXCLUDE] Suppression des tiebreaker_continues');
      await connection.execute(
        'DELETE FROM tiebreaker_continues WHERE game_session_id = ? AND user_id = ?',
        [gameSessionId, userId]
      );
    } catch (e: any) {
      console.log('⚠️ [EXCLUDE] Table tiebreaker_continues inexistante ou erreur:', e.message);
    }

    try {
      console.log('🚫 [EXCLUDE] Suppression des normal_continues');
      await connection.execute(
        'DELETE FROM normal_continues WHERE game_session_id = ? AND user_id = ?',
        [gameSessionId, userId]
      );
    } catch (e: any) {
      console.log('⚠️ [EXCLUDE] Table normal_continues inexistante ou erreur:', e.message);
    }

    // ✅ Commit de la transaction
    console.log('🚫 [EXCLUDE] Commit de la transaction');
    await connection.commit();

    console.log('✅ [EXCLUDE] Joueur exclu avec succès');
    return NextResponse.json({
      success: true,
      message: 'Joueur exclu avec succès'
    });
  } catch (error: any) {
    console.error('❌ [EXCLUDE] Erreur complète:', error);
    console.error('❌ [EXCLUDE] Stack:', error.stack);

    if (connection) {
      try {
        await connection.rollback();
        console.log('🔄 [EXCLUDE] Rollback effectué');
      } catch (rollbackError) {
        console.error('❌ [EXCLUDE] Erreur lors du rollback:', rollbackError);
      }
    }

    return NextResponse.json({
      error: 'Erreur serveur',
      details: error.message
    }, { status: 500 });
  } finally {
    if (connection) {
      connection.release();
      console.log('🔓 [EXCLUDE] Connexion DB libérée');
    }
  }
}
