import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const userInfo: any = await query(
      'SELECT id, name, in_game, profile_picture_url, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (userInfo.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Récupérer les rôles de l'utilisateur
    const userRoles: any = await query(
      'SELECT role FROM user_roles WHERE user_id = ?',
      [userId]
    );

    const roles = userRoles.map((r: any) => r.role);

    return NextResponse.json({
      ...userInfo[0],
      roles: roles
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des informations utilisateur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
