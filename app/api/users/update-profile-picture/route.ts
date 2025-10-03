import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est admin
    const isAdmin = await userHasRole(userId, 'admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
    }

    const { userId: targetUserId, profilePictureUrl } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    // Mettre à jour la photo de profil
    await query(
      'UPDATE users SET profile_picture_url = ? WHERE id = ?',
      [profilePictureUrl || null, targetUserId]
    );

    return NextResponse.json({
      success: true,
      message: 'Photo de profil mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo de profil:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
