import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('v');

  if (!videoId) {
    return NextResponse.json({ error: 'Video ID required' }, { status: 400 });
  }

  try {
    // Récupérer les infos de la vidéo depuis YouTube (oEmbed API - pas besoin de clé API)
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;

    const response = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      return NextResponse.json({
        error: 'Video not found or not embeddable',
        embeddable: false
      }, { status: 404 });
    }

    const data = await response.json();

    return NextResponse.json({
      embeddable: true,
      title: data.title,
      author: data.author_name,
      thumbnail: data.thumbnail_url,
      html: data.html,
    });

  } catch (error) {
    return NextResponse.json({
      error: 'Failed to fetch video info',
      embeddable: false
    }, { status: 500 });
  }
}
