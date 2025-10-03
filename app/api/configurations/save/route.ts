import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { configData, isEdit, configId } = await req.json();

    if (!configData) {
      return NextResponse.json({ error: 'Données de configuration requises' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur a le rôle config_creator ou admin
    const hasConfigCreator = await userHasRole(userId, 'config_creator');
    const hasAdmin = await userHasRole(userId, 'admin');

    if (!hasConfigCreator && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'avez pas la permission de créer des configurations' }, { status: 403 });
    }

    // Créer le dossier de configurations s'il n'existe pas
    const configsDir = path.join(process.cwd(), 'public', 'configs');
    try {
      await fs.access(configsDir);
    } catch {
      await fs.mkdir(configsDir, { recursive: true });
    }

    let fileName: string;
    let publicPath: string;

    if (isEdit && configId) {
      // Modification: récupérer le chemin existant
      const existingConfig: any = await query(
        'SELECT file_path FROM game_configurations WHERE id = ? AND created_by = ?',
        [configId, userId]
      );

      if (existingConfig.length === 0) {
        return NextResponse.json({ error: 'Configuration non trouvée ou non autorisée' }, { status: 404 });
      }

      publicPath = existingConfig[0].file_path;
      fileName = path.basename(publicPath);
    } else {
      // Nouvelle configuration: générer un nom de fichier unique
      fileName = `${configData.name.replace(/\s+/g, '_')}_${Date.now()}.json`;
      publicPath = `/configs/${fileName}`;
    }

    const filePath = path.join(configsDir, fileName);

    // Sauvegarder le fichier JSON
    await fs.writeFile(filePath, JSON.stringify(configData, null, 2), 'utf-8');

    // Enregistrer ou mettre à jour dans la base de données
    if (isEdit && configId) {
      await query(
        'UPDATE game_configurations SET file_name = ? WHERE id = ? AND created_by = ?',
        [configData.name, configId, userId]
      );
    } else {
      await query(
        'INSERT INTO game_configurations (created_by, file_path, file_name) VALUES (?, ?, ?)',
        [userId, publicPath, configData.name]
      );
    }

    return NextResponse.json({
      success: true,
      filePath: publicPath,
      message: 'Configuration sauvegardée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}