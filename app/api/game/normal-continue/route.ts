import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName } from '@/lib/db';
import { handleContinueClick } from '@/lib/game-progression';
import { logger } from '@/lib/logger';

// ✅ OPTIMIZED: Refactored to use shared game progression logic
export async function POST(req: NextRequest) {
  let username: string | undefined;
  const startTime = Date.now();

  try {
    const session = await getServerSession();
    username = session?.user?.name;

    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { gameSessionId, duelIndex } = await req.json();

    // ✅ Input validation
    if (!gameSessionId || duelIndex === undefined) {
      return NextResponse.json({ error: 'gameSessionId et duelIndex requis' }, { status: 400 });
    }

    if (typeof gameSessionId !== 'number' || typeof duelIndex !== 'number') {
      return NextResponse.json({ error: 'Types invalides' }, { status: 400 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // ✅ Use shared continue handler - requires ALL players to click
    const result = await handleContinueClick(
      gameSessionId,
      duelIndex,
      userId,
      'normal_continues',
      'all' // Requires all players to continue
    );

    const duration = Date.now() - startTime;
    logger.api.request('POST', '/api/game/normal-continue', 200, duration, username);

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    // Handle duplicate click
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ error: 'Vous avez déjà cliqué pour continuer' }, { status: 400 });
    }

    const duration = Date.now() - startTime;
    logger.api.error('POST', '/api/game/normal-continue', error, username);

    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
