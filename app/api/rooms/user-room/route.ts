import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer l'ID de l'utilisateur
    const users: any = await query('SELECT id FROM users WHERE name = ?', [session.user?.name]);

    if (users.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userId = users[0].id;

    // Vérifier si l'utilisateur est membre d'un salon
    const membership: any = await query(`
      SELECT
        r.id,
        r.name,
        r.created_by,
        rm.joined_at
      FROM room_members rm
      JOIN rooms r ON rm.room_id = r.id
      WHERE rm.user_id = ?
      LIMIT 1
    `, [userId]);

    if (membership.length === 0) {
      return NextResponse.json({ inRoom: false, room: null });
    }

    return NextResponse.json({
      inRoom: true,
      room: {
        id: membership[0].id,
        name: membership[0].name,
        isCreator: membership[0].created_by === userId,
        joined_at: membership[0].joined_at
      }
    });
  } catch (error) {
    console.error('Erreur lors de la vérification du salon:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}