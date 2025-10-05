import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import { logger, LogCategory } from '@/lib/logger';

async function handleCreateRoom(req: NextRequest) {
  const startTime = Date.now();
  let username: string | undefined;

  try {
    const session = await getServerSession();
    username = session?.user?.name;
    if (!session || !session.user?.name) {
      logger.api.error('POST', '/api/rooms/create', new Error('Unauthorized'));
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

    // Vérifier que l'utilisateur a le rôle room_creator ou admin
    const hasRoomCreator = await userHasRole(userId, 'room_creator');
    const hasAdmin = await userHasRole(userId, 'admin');

    if (!hasRoomCreator && !hasAdmin) {
      return NextResponse.json({ error: 'Vous n\'avez pas la permission de créer des salons' }, { status: 403 });
    }

    // Vérifier si une partie est en cours
    const gameInProgress: any = await query(
      'SELECT id FROM game_sessions WHERE status = \'in_progress\'',
      []
    );

    if (gameInProgress.length > 0) {
      return NextResponse.json({ error: 'Une partie est déjà en cours. Impossible de créer un nouveau salon.' }, { status: 400 });
    }

    // Vérifier si un salon existe déjà
    const existingRoom: any = await query(
      'SELECT id FROM rooms',
      []
    );

    if (existingRoom.length > 0) {
      return NextResponse.json({ error: 'Un salon existe déjà. Impossible de créer un nouveau salon.' }, { status: 400 });
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

    const duration = Date.now() - startTime;
    logger.info(LogCategory.GAME, `Room created: ${roomName.trim()}`, { roomId, configId }, { username: session.user.name });
    logger.api.request('POST', '/api/rooms/create', 200, duration, session.user.name);

    return NextResponse.json({
      success: true,
      roomId,
      message: 'Salon créé avec succès'
    });
  } catch (error: any) {
    logger.api.error('POST', '/api/rooms/create', error, username);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Pas de rate limiting pour la création de salon
export const POST = handleCreateRoom;