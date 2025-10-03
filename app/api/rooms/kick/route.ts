import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { roomId, targetUserId } = await req.json();

    if (!roomId || !targetUserId) {
      return NextResponse.json({ error: 'roomId et targetUserId requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Ne pas pouvoir se kicker soi-même
    if (userId === targetUserId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas vous expulser vous-même' }, { status: 400 });
    }

    // Vérifier que le salon existe
    const room: any = await query(
      'SELECT id, created_by FROM rooms WHERE id = ?',
      [roomId]
    );

    if (room.length === 0) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    const isCreator = room[0].created_by === userId;
    const isAdmin = await userHasRole(userId, 'admin');

    // Seul le créateur ou un admin peut kicker
    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Seul le créateur ou un admin peut expulser des membres' }, { status: 403 });
    }

    // Vérifier que la cible est bien dans le salon
    const targetMembership: any = await query(
      'SELECT id FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, targetUserId]
    );

    if (targetMembership.length === 0) {
      return NextResponse.json({ error: 'Cet utilisateur n\'est pas dans le salon' }, { status: 400 });
    }

    // Expulser le membre
    await query('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, targetUserId]);

    return NextResponse.json({
      success: true,
      message: 'Membre expulsé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'expulsion du membre:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
