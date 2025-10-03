import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName, userHasRole, updateUserRoles } from '@/lib/db';

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session || !session.user?.name) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const userId = await getUserIdByName(session.user.name);
    if (!userId) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    // Vérifier que l'utilisateur est admin
    const isAdmin = await userHasRole(userId, 'admin');
    if (!isAdmin) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });
    }

    const { userId: targetUserId, roles } = await req.json();

    if (!targetUserId || !roles) {
      return NextResponse.json({ error: 'userId et roles requis' }, { status: 400 });
    }

    if (!Array.isArray(roles)) {
      return NextResponse.json({ error: 'roles doit être un tableau' }, { status: 400 });
    }

    // Vérifier que tous les rôles sont valides
    const validRoles = ['config_creator', 'room_creator', 'admin'];
    for (const role of roles) {
      if (!validRoles.includes(role)) {
        return NextResponse.json({ error: `Rôle invalide: ${role}` }, { status: 400 });
      }
    }

    // Mettre à jour les rôles avec transaction pour éviter les race conditions
    await updateUserRoles(targetUserId, roles);

    return NextResponse.json({
      success: true,
      message: 'Rôles mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour des rôles:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
