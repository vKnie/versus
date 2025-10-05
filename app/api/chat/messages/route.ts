import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const messages = await query(`
      SELECT
        m.id,
        m.message,
        m.created_at,
        u.name as username,
        u.profile_picture_url
      FROM messages m
      JOIN users u ON m.user_id = u.id
      ORDER BY m.created_at ASC
      LIMIT 50
    `);

    return NextResponse.json(messages);
  } catch (_error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}