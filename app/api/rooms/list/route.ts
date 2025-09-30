import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer tous les salons avec le nombre de membres
    const rooms = await query(`
      SELECT
        r.id,
        r.name,
        r.created_at,
        u.name as created_by_name,
        COUNT(rm.user_id) as member_count
      FROM rooms r
      JOIN users u ON r.created_by = u.id
      LEFT JOIN room_members rm ON r.id = rm.room_id
      GROUP BY r.id, r.name, r.created_at, u.name
      ORDER BY r.created_at DESC
    `);

    return NextResponse.json(rooms);
  } catch (error) {
    console.error('Erreur lors de la récupération des salons:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}