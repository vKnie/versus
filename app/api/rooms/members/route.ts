import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'ID du salon requis' }, { status: 400 });
    }

    // Récupérer les membres du salon
    const members = await query(`
      SELECT
        u.id,
        u.name,
        u.profile_picture_url,
        rm.joined_at
      FROM room_members rm
      JOIN users u ON rm.user_id = u.id
      WHERE rm.room_id = ?
      ORDER BY rm.joined_at ASC
    `, [roomId]);

    return NextResponse.json(members);
  } catch (error) {
    console.error('Erreur lors de la récupération des membres:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}