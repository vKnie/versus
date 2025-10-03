import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { configId } = await req.json();

    if (!configId) {
      return NextResponse.json({ error: 'ID de configuration requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur a le rôle config_creator ou admin
    const hasConfigCreator = await userHasRole(userId, 'config_creator');
    const hasAdmin = await userHasRole(userId, 'admin');

    if (!hasConfigCreator && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'avez pas la permission de supprimer des configurations' }, { status: 403 });
    }

    // Vérifier que l'utilisateur est bien le créateur (sauf si admin)
    const configs: any = await query(
      'SELECT id, file_path, created_by FROM game_configurations WHERE id = ?',
      [configId]
    );

    if (configs.length === 0) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    // Seul le créateur ou un admin peut supprimer
    if (configs[0].created_by !== userId && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'êtes pas autorisé à supprimer cette configuration' }, { status: 403 });
    }

    const filePath = path.join(process.cwd(), 'public', configs[0].file_path);

    // Supprimer le fichier
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Erreur lors de la suppression du fichier:', error);
    }

    // Supprimer de la base de données
    await query('DELETE FROM game_configurations WHERE id = ?', [configId]);

    return NextResponse.json({
      success: true,
      message: 'Configuration supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la configuration:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}