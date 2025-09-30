import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { roomName, configId } = await req.json();

    if (!roomName || roomName.trim().length === 0) {
      return NextResponse.json({ error: 'Le nom du salon est requis' }, { status: 400 });
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

    // Créer le salon
    const result: any = await query(
      'INSERT INTO rooms (name, created_by, config_id) VALUES (?, ?, ?)',
      [roomName.trim(), userId, configId || null]
    );

    const roomId = result.insertId;

    // Ajouter automatiquement le créateur comme membre du salon
    await query(
      'INSERT INTO room_members (room_id, user_id) VALUES (?, ?)',
      [roomId, userId]
    );

    return NextResponse.json({
      success: true,
      roomId,
      message: 'Salon créé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création du salon:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}