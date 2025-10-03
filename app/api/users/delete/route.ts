import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';

export async function DELETE(req: NextRequest) {
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

    const { userId: targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'userId requis' }, { status: 400 });
    }

    // Empêcher l'admin de se supprimer lui-même
    if (userId === targetUserId) {
      return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
    }

    // Supprimer l'utilisateur (les contraintes CASCADE supprimeront automatiquement les dépendances)
    await query(
      'DELETE FROM users WHERE id = ?',
      [targetUserId]
    );

    return NextResponse.json({
      success: true,
      message: 'Utilisateur supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de l\'utilisateur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
