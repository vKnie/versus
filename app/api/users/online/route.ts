import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Nettoyer les sessions expirées puis récupérer les actives
    await query('DELETE FROM sessions WHERE expires <= NOW()');

    const onlineUsers = await query(`
      SELECT u.name, u.in_game, u.profile_picture_url, s.created_at as connected_since
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires > NOW()
      ORDER BY s.created_at DESC
    `);

    return NextResponse.json({
      count: onlineUsers.length,
      users: onlineUsers
    });

  } catch (_error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}