import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer toutes les configurations
    const configurations = await query(`
      SELECT
        gc.id,
        gc.file_path,
        gc.file_name,
        gc.created_at,
        u.name as created_by
      FROM game_configurations gc
      JOIN users u ON gc.created_by = u.id
      ORDER BY gc.created_at DESC
    `);

    return NextResponse.json(configurations);
  } catch (error) {
    console.error('Erreur lors de la récupération des configurations:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}