import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { roomId } = await req.json();

    if (!roomId) {
      return NextResponse.json({ error: 'ID du salon requis' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier si l'utilisateur est déjà dans un salon
    const existingMembership: any = await query(
      'SELECT id FROM room_members WHERE user_id = ?',
      [userId]
    );

    if (existingMembership.length > 0) {
      return NextResponse.json({ error: 'Vous êtes déjà dans un salon' }, { status: 400 });
    }

    // Vérifier si le salon existe
    const rooms: any = await query('SELECT id FROM rooms WHERE id = ?', [roomId]);

    if (rooms.length === 0) {
      return NextResponse.json({ error: 'Salon non trouvé' }, { status: 404 });
    }

    // Vérifier si l'utilisateur est déjà membre
    const existingMember: any = await query(
      'SELECT id FROM room_members WHERE room_id = ? AND user_id = ?',
      [roomId, userId]
    );

    if (existingMember.length > 0) {
      return NextResponse.json({ error: 'Vous êtes déjà membre de ce salon' }, { status: 400 });
    }

    // Ajouter l'utilisateur au salon
    await query(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, userId]
    );

    return NextResponse.json({
      success: true,
      message: 'Vous avez rejoint le salon avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de l\'adhésion au salon:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}