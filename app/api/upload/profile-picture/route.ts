import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { getUserIdByName, userHasRole } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileTypeFromBuffer } from 'file-type';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

export async function POST(req: NextRequest) {
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

    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 });
    }

    // Validation de la taille
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: 'Fichier trop volumineux. Taille maximum : 5MB'
      }, { status: 400 });
    }

    // Lire le contenu du fichier
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Vérifier le type réel du fichier via son magic number (sécurité renforcée)
    const fileType = await fileTypeFromBuffer(buffer);

    if (!fileType || !ALLOWED_TYPES.includes(fileType.mime)) {
      return NextResponse.json({
        error: 'Type de fichier non autorisé. Utilisez JPG, PNG, WebP ou GIF.'
      }, { status: 400 });
    }

    if (!ALLOWED_EXTENSIONS.includes(fileType.ext)) {
      return NextResponse.json({
        error: 'Extension de fichier non autorisée.'
      }, { status: 400 });
    }

    // Créer le répertoire uploads/profiles s'il n'existe pas
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');
    await mkdir(uploadsDir, { recursive: true });

    // Générer un nom de fichier unique et sécurisé basé sur le vrai type
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileName = `${randomName}.${fileType.ext}`;
    const filePath = path.join(uploadsDir, fileName);

    // Écrire le fichier
    await writeFile(filePath, buffer);

    // Retourner l'URL publique
    const publicUrl = `/uploads/profiles/${fileName}`;

    return NextResponse.json({
      success: true,
      url: publicUrl,
      message: 'Image téléchargée avec succès'
    });
  } catch (error) {
    console.error('Erreur lors du téléchargement de l\'image:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
