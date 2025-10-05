import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();

    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 400 });
    }

    await query('DELETE FROM sessions WHERE user_id = ?', [userId]);

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}