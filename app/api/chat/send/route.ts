import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';
import { withRateLimit } from '@/lib/rate-limit';
import validator from 'validator';

async function handleSendMessage(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }

    // Sanitiser le message de manière robuste
    let sanitizedMessage = message.trim();

    // Échapper tous les caractères HTML dangereux
    sanitizedMessage = validator.escape(sanitizedMessage);

    // Limiter à 500 caractères
    sanitizedMessage = sanitizedMessage.substring(0, 500);

    if (sanitizedMessage.length === 0) {
      return NextResponse.json({ error: 'Message invalide' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 400 });
    }

    const result: any = await query(
      'INSERT INTO messages (user_id, message, created_at) VALUES (?, ?, NOW())',
      [userId, sanitizedMessage]
    );

    // Récupérer le message qu'on vient d'insérer avec toutes ses infos
    const newMessage: any = await query(
      `SELECT m.id, m.message, m.created_at, u.name as username, u.profile_picture_url
       FROM messages m
       JOIN users u ON m.user_id = u.id
       WHERE m.id = ?`,
      [result.insertId]
    );

    return NextResponse.json({
      success: true,
      message: newMessage[0]
    });
  } catch (_error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// Appliquer rate limiting : 30 messages max par minute (anti-spam)
export const POST = withRateLimit(handleSendMessage, 30, 60000);