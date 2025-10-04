import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: 'roomId requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est le créateur du salon
    const roomCheck: any = await query(
      'SELECT created_by FROM rooms WHERE id = ?',
      [roomId]
    );

    if (roomCheck.length === 0) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    if (roomCheck[0].created_by !== userId) {
      return NextResponse.json({ error: 'Seul le créateur peut annuler la partie' }, { status: 403 });
    }

    // Récupérer la session de jeu en cours pour ce salon
    const gameSession: any = await query(
      `SELECT gs.id
       FROM game_sessions gs
       JOIN JSON_TABLE(
         gs.duels_data,
         '$' COLUMNS(roomId INT PATH '$.roomId')
       ) AS jt
       WHERE jt.roomId = ? AND gs.status = 'in_progress'
       LIMIT 1`,
      [roomId]
    );

    if (gameSession.length === 0) {
      return NextResponse.json({ error: 'Aucune partie en cours pour ce salon' }, { status: 404 });
    }

    const gameSessionId = gameSession[0].id;

    // 1. Supprimer tous les votes de cette session
    await query(
      'DELETE FROM votes WHERE game_session_id = ?',
      [gameSessionId]
    );

    // 2. Supprimer la session de jeu
    await query(
      'DELETE FROM game_sessions WHERE id = ?',
      [gameSessionId]
    );

    // 3. Remettre tous les membres du salon en statut "not in game"
    await query(
      `UPDATE users u
       JOIN room_members rm ON u.id = rm.user_id
       SET u.in_game = FALSE
       WHERE rm.room_id = ?`,
      [roomId]
    );

    return NextResponse.json({
      success: true,
      message: 'Partie annulée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'annulation de la partie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
