import { NextRequest, NextResponse } from 'next/server';

interface RateLimitData {
  count: number;
  resetTime: number;
}

const rateLimit = new Map<string, RateLimitData>();

// Nettoyer les anciennes entrées toutes les 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimit.entries()) {
    if (now > data.resetTime) {
      rateLimit.delete(key);
    }
  }
}, 10 * 60 * 1000);

export function withRateLimit(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  maxRequests = 10,
  windowMs = 60000
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const ip = req.headers.get('x-forwarded-for') ||
               req.headers.get('x-real-ip') ||
               'unknown';

    const now = Date.now();
    const userLimit = rateLimit.get(ip);

    if (userLimit && now < userLimit.resetTime) {
      if (userLimit.count >= maxRequests) {
        return NextResponse.json(
          { error: 'Trop de requêtes. Veuillez réessayer plus tard.' },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil((userLimit.resetTime - now) / 1000))
            }
          }
        );
      }
      userLimit.count++;
    } else {
      rateLimit.set(ip, { count: 1, resetTime: now + windowMs });
    }

    return handler(req, ...args);
  };
}
