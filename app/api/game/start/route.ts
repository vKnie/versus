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

    const { roomId, configId } = await req.json();

    if (!roomId || !configId) {
      return NextResponse.json({ error: 'roomId et configId requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur a le rôle room_creator ou admin
    const hasRoomCreator = await userHasRole(userId, 'room_creator');
    const hasAdmin = await userHasRole(userId, 'admin');

    if (!hasRoomCreator && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'avez pas la permission de démarrer des parties' }, { status: 403 });
    }

    // Vérifier que l'utilisateur est le créateur du salon
    const roomCheck: any = await query(
      'SELECT created_by FROM rooms WHERE id = ?',
      [roomId]
    );

    if (roomCheck.length === 0) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    // Seul le créateur ou un admin peut démarrer
    if (roomCheck[0].created_by !== userId && !hasAdmin) {
      return NextResponse.json({ error: 'Seul le créateur peut démarrer la partie' }, { status: 403 });
    }

    // Récupérer la configuration
    const configResult: any = await query(
      'SELECT file_path FROM game_configurations WHERE id = ?',
      [configId]
    );

    if (configResult.length === 0) {
      return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
    }

    // Lire le fichier de configuration avec validation du chemin
    const filePath = configResult[0].file_path.replace(/^\//, ''); // Enlever le slash initial
    const publicDir = path.join(process.cwd(), 'public');
    const configPath = path.join(publicDir, filePath);

    // Validation de sécurité : vérifier que le chemin résolu est bien dans /public
    const resolvedPath = path.resolve(configPath);
    if (!resolvedPath.startsWith(publicDir)) {
      return NextResponse.json({ error: 'Chemin de fichier invalide' }, { status: 400 });
    }

    const configContent = await fs.readFile(configPath, 'utf-8');
    const configData = JSON.parse(configContent);

    // Enrichir les items avec les photos de profil
    const items = await Promise.all(configData.items.map(async (item: any) => {
      const proposedByWithPhotos = await Promise.all(
        item.proposedBy.map(async (personName: string) => {
          const userResult: any = await query(
            'SELECT name, profile_picture_url FROM users WHERE name = ?',
            [personName]
          );
          if (userResult.length > 0) {
            return {
              name: userResult[0].name,
              profilePictureUrl: userResult[0].profile_picture_url
            };
          }
          return { name: personName, profilePictureUrl: null };
        })
      );

      return {
        ...item,
        proposedBy: proposedByWithPhotos
      };
    }));

    // Mélanger les items pour un ordre aléatoire au départ
    for (let i = items.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [items[i], items[j]] = [items[j], items[i]];
    }

    // Si le nombre d'items n'est pas une puissance de 2, on complète avec des "bye" (passages automatiques)
    const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(items.length)));
    const byesNeeded = nextPowerOf2 - items.length;

    // Créer le bracket initial (premier tour)
    const duels: Array<{ item1: any; item2: any; round: number; matchIndex: number }> = [];
    let matchIndex = 0;

    // Ajouter les vrais matchs
    for (let i = 0; i < items.length; i += 2) {
      if (i + 1 < items.length) {
        duels.push({
          item1: items[i],
          item2: items[i + 1],
          round: 1,
          matchIndex: matchIndex++
        });
      }
    }

    // Calculer le nombre total de rounds
    const totalRounds = Math.ceil(Math.log2(items.length));

    // Créer la session de jeu avec les métadonnées du tournoi
    const tournamentData = {
      roomId,
      roomName: (await query('SELECT name FROM rooms WHERE id = ?', [roomId]))[0].name,
      configId,
      duels: duels,
      currentRound: 1,
      totalRounds: totalRounds,
      winners: [] as any[],
      allItems: items
    };

    const gameSessionResult: any = await query(
      `INSERT INTO game_sessions (status, current_duel_index, duels_data)
       VALUES ('in_progress', 0, ?)`,
      [JSON.stringify(tournamentData)]
    );

    // Mettre tous les membres du salon en status "in_game"
    await query(
      `UPDATE users u
       JOIN room_members rm ON u.id = rm.user_id
       SET u.in_game = TRUE
       WHERE rm.room_id = ?`,
      [roomId]
    );

    // Récupérer le nom du salon pour la redirection
    const roomName = (await query('SELECT name FROM rooms WHERE id = ?', [roomId]))[0].name;

    return NextResponse.json({
      success: true,
      gameSessionId: gameSessionResult.insertId,
      roomId,
      roomName,
      totalDuels: duels.length,
      totalRounds: totalRounds,
      message: 'Partie démarrée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du démarrage de la partie:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
