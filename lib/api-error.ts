import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function handleApiError(error: unknown): NextResponse {
  console.error('API Error:', error);

  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code || 'UNKNOWN_ERROR'
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    // Ne pas exposer les détails des erreurs internes en production
    const isDev = process.env.NODE_ENV === 'development';
    return NextResponse.json(
      {
        error: isDev ? error.message : 'Erreur serveur interne',
        code: 'INTERNAL_SERVER_ERROR',
        ...(isDev && { stack: error.stack })
      },
      { status: 500 }
    );
  }

  return NextResponse.json(
    {
      error: 'Erreur serveur interne',
      code: 'INTERNAL_SERVER_ERROR'
    },
    { status: 500 }
  );
}

// Codes d'erreur standardisés
export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
} as const;
