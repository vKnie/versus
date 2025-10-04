import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(req: NextRequest) {
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

    const { userId: targetUserId } = await req.json();

    if (!targetUserId) {
      return NextResponse.json({ error: 'ID utilisateur requis' }, { status: 400 });
    }

    // Récupérer l'URL actuelle de la photo de profil
    const result = await query(
      'SELECT profile_picture_url FROM users WHERE id = ?',
      [targetUserId]
    );

    if (result.length === 0) {
      return NextResponse.json({ error: 'Utilisateur non trouvé' }, { status: 404 });
    }

    const currentPictureUrl = result[0].profile_picture_url;

    // Si une photo existe et qu'elle est locale, la supprimer
    if (currentPictureUrl && currentPictureUrl.startsWith('/uploads/profiles/')) {
      try {
        const fileName = currentPictureUrl.split('/').pop();
        const filePath = path.join(process.cwd(), 'public', 'uploads', 'profiles', fileName);
        await unlink(filePath);
      } catch (error) {
        console.error('Erreur lors de la suppression du fichier:', error);
        // Continuer même si le fichier n'existe pas
      }
    }

    // Mettre à jour la base de données
    await query(
      'UPDATE users SET profile_picture_url = NULL WHERE id = ?',
      [targetUserId]
    );

    return NextResponse.json({
      success: true,
      message: 'Photo de profil supprimée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression de la photo de profil:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
