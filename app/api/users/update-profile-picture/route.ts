import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import type { DBUser } from '@/types/db';

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

    const { userId: targetUserId, profilePictureUrl } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    // Récupérer l'ancienne photo de profil
    const userResult = await query<Pick<DBUser, 'profile_picture_url'>>(
      'SELECT profile_picture_url FROM users WHERE id = ?',
      [targetUserId]
    );

    if (userResult.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const oldProfilePictureUrl = userResult[0].profile_picture_url;

    // Supprimer l'ancienne image si elle existe et qu'elle est locale
    if (oldProfilePictureUrl && oldProfilePictureUrl.startsWith('/uploads/')) {
      try {
        const oldImagePath = path.join(process.cwd(), 'public', oldProfilePictureUrl);
        const resolvedPath = path.resolve(oldImagePath);
        const uploadsDir = path.resolve(path.join(process.cwd(), 'public', 'uploads'));

        // Vérifier que le chemin résolu reste dans le dossier uploads (protection path traversal)
        if (!resolvedPath.startsWith(uploadsDir)) {
          console.error(`⚠️ Tentative de path traversal détectée: ${oldProfilePictureUrl}`);
          return NextResponse.json({ error: 'Chemin de fichier invalide' }, { status: 400 });
        }

        await fs.unlink(oldImagePath);
        console.log(`✅ Ancienne image supprimée: ${oldProfilePictureUrl}`);
      } catch (error) {
        console.error('Erreur lors de la suppression de l\'ancienne image:', error);
        // Ne pas bloquer la mise à jour si la suppression échoue
      }
    }

    // Mettre à jour la photo de profil
    await query(
      'UPDATE users SET profile_picture_url = ? WHERE id = ?',
      [profilePictureUrl || null, targetUserId]
    );

    return NextResponse.json({
      success: true,
      message: 'Photo de profil mise à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la photo de profil:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
