import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || message.trim().length === 0) {
      return NextResponse.json({ error: 'Message vide' }, { status: 400 });
    }

    if (message.length > 500) {
      return NextResponse.json({ error: 'Message trop long' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 400 });
    }

    await query(
      'INSERT INTO messages (user_id, message) VALUES (?, ?)',
      [userId, message.trim()]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}