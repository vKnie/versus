import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function GET(_req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier si l'utilisateur est dans un salon
    const userRoomResult: any = await query(
      `SELECT rm.room_id, r.name as room_name
       FROM room_members rm
       JOIN rooms r ON rm.room_id = r.id
       WHERE rm.user_id = ?`,
      [userId]
    );

    if (userRoomResult.length === 0) {
      return NextResponse.json({ inGame: false });
    }

    const roomId = userRoomResult[0].room_id;
    const roomName = userRoomResult[0].room_name;

    // Vérifier s'il existe une partie en cours pour ce salon
    const gameSessionResult: any = await query(
      `SELECT id, status, duels_data
       FROM game_sessions
       WHERE status = 'in_progress'
       AND JSON_EXTRACT(duels_data, '$.roomId') = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [roomId]
    );

    if (gameSessionResult.length > 0) {
      return NextResponse.json({
        inGame: true,
        roomName: roomName,
        gameSessionId: gameSessionResult[0].id
      });
    }

    return NextResponse.json({ inGame: false });
  } catch (error) {
    console.error('Erreur lors de la vérification de la session de jeu:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
