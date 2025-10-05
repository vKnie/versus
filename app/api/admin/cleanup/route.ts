import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName, userHasRole } from '@/lib/db';
import { cleanupOldData } from '@/lib/cleanup';

export async function POST(_req: NextRequest) {
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

    // Exécuter le nettoyage
    const result = await cleanupOldData();

    return NextResponse.json({
      success: true,
      message: 'Nettoyage effectué avec succès',
      stats: result
    });
  } catch (error) {
    console.error('Erreur lors du nettoyage:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
