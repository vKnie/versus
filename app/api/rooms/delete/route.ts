import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: 'ID du salon requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur a le rôle room_creator ou admin
    const hasRoomCreator = await userHasRole(userId, 'room_creator');
    const hasAdmin = await userHasRole(userId, 'admin');

    if (!hasRoomCreator && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'avez pas la permission de supprimer des salons' }, { status: 403 });
    }

    // Vérifier que l'utilisateur est bien le créateur du salon (sauf si admin)
    const rooms: any = await query(
      'SELECT id, created_by FROM rooms WHERE id = ?',
      [roomId]
    );

    if (rooms.length === 0) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    // Seul le créateur ou un admin peut supprimer
    if (rooms[0].created_by !== userId && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'êtes pas autorisé à supprimer ce salon' }, { status: 403 });
    }

    // Supprimer le salon (les membres seront automatiquement supprimés grâce à ON DELETE CASCADE)
    await query('DELETE FROM rooms WHERE id = ?', [roomId]);

    return NextResponse.json({
      success: true,
      message: 'Salon supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du salon:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}