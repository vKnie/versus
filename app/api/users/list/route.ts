import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    // Récupérer tous les utilisateurs avec leurs rôles en une seule requête (fix N+1 query)
    const users: any = await query(`
      SELECT
        u.id,
        u.name,
        u.profile_picture_url,
        u.in_game,
        u.created_at,
        GROUP_CONCAT(ur.role) as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      GROUP BY u.id, u.name, u.profile_picture_url, u.in_game, u.created_at
      ORDER BY u.name ASC
    `);

    // Transformer la chaîne de rôles en tableau
    const usersWithRoles = users.map((user: any) => ({
      ...user,
      roles: user.roles ? user.roles.split(',') : []
    }));

    return NextResponse.json(usersWithRoles);
  } catch (error) {
    console.error('Erreur lors de la récupération des utilisateurs:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}