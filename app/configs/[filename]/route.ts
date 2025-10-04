import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(process.cwd(), 'public', 'configs', filename);

    // Lire le fichier JSON
    const fileContent = await readFile(filePath, 'utf-8');

    // Retourner le JSON avec les bons headers
    return new NextResponse(fileContent, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300', // 5 minutes de cache pour les configs
      },
    });
  } catch (error) {
    console.error('Erreur lors du chargement de la configuration:', error);
    return NextResponse.json({ error: 'Configuration non trouvée' }, { status: 404 });
  }
}
