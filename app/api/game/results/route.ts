import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const gameSessionId = searchParams.get('gameSessionId');

    if (!gameSessionId) {
      return NextResponse.json({ error: 'gameSessionId requis' }, { status: 400 });
    }

    // Récupérer le chemin du fichier historique
    const finalResult: any = await query(
      'SELECT history_file FROM game_results WHERE game_session_id = ?',
      [gameSessionId]
    );

    if (finalResult.length === 0) {
      return NextResponse.json({ error: 'Résultats non trouvés' }, { status: 404 });
    }

    // Lire depuis le fichier historique
    try {
      const historyPath = path.join(process.cwd(), 'public', finalResult[0].history_file);
      const historyContent = await fs.readFile(historyPath, 'utf-8');
      const historyData = JSON.parse(historyContent);

      return NextResponse.json(historyData);
    } catch (fileError) {
      console.error('Erreur lors de la lecture du fichier historique:', fileError);
      return NextResponse.json({ error: 'Fichier historique introuvable' }, { status: 404 });
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des résultats:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
