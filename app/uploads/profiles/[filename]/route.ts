import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'profiles', filename);

    // Lire le fichier
    const fileBuffer = await readFile(filePath);

    // Déterminer le type MIME basé sur l'extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp'
    };
    const contentType = mimeTypes[ext || ''] || 'application/octet-stream';

    // Retourner l'image avec les bons headers
    return new NextResponse(Buffer.from(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
    return NextResponse.json({ error: 'Image non trouvée' }, { status: 404 });
  }
}
