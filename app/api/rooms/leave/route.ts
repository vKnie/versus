import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est dans un salon
    const membership: any = await query(
      'SELECT rm.id, rm.room_id, r.created_by FROM room_members rm JOIN rooms r ON rm.room_id = r.id WHERE rm.user_id = ?',
      [userId]
    );

    if (membership.length === 0) {
      return NextResponse.json({ error: 'Vous n\'êtes pas dans un salon' }, { status: 400 });
    }

    const roomId = membership[0].room_id;
    const isCreator = membership[0].created_by === userId;

    // Si c'est le créateur, vérifier s'il y a d'autres membres
    if (isCreator) {
      const otherMembers: any = await query(
        'SELECT COUNT(*) as count FROM room_members WHERE room_id = ? AND user_id != ?',
        [roomId, userId]
      );

      if (otherMembers[0].count > 0) {
        return NextResponse.json({
          error: 'Vous êtes le créateur et il y a encore des membres. Supprimez le salon ou attendez que tous partent.'
        }, { status: 400 });
      }

      // Si seul, supprimer le salon entier
      await query('DELETE FROM rooms WHERE id = ?', [roomId]);

      return NextResponse.json({
        success: true,
        roomDeleted: true,
        message: 'Salon supprimé avec succès'
      });
    }

    // Retirer le membre du salon
    await query('DELETE FROM room_members WHERE room_id = ? AND user_id = ?', [roomId, userId]);

    return NextResponse.json({
      success: true,
      roomDeleted: false,
      message: 'Vous avez quitté le salon'
    });
  } catch (error) {
    console.error('Erreur lors de la sortie du salon:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
