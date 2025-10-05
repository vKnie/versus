import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { queryOne, query } from '@/lib/db';
import { sessionCache } from '@/lib/session-cache';

interface User {
  id: number;
  name: string;
  password: string;
}

// Vérifier que NEXTAUTH_SECRET est défini et sécurisé
if (!process.env.NEXTAUTH_SECRET) {
  throw new Error('NEXTAUTH_SECRET must be set in environment variables');
}

if (process.env.NEXTAUTH_SECRET === 'your-super-secret-key-change-in-production') {
  throw new Error('NEXTAUTH_SECRET must be changed from the default value. Generate a secure random string.');
}

if (process.env.NEXTAUTH_SECRET.length < 32) {
  throw new Error('NEXTAUTH_SECRET must be at least 32 characters long for security');
}

const handler = NextAuth({
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await queryOne<User>(
          'SELECT * FROM users WHERE name = ?',
          [credentials.email]
        );

        if (!user || !await bcrypt.compare(credentials.password, user.password)) {
          return null;
        }

        return {
          id: user.id.toString(),
          email: user.name,
          name: user.name,
        };
      }
    })
  ],
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;

        // ✅ Créer la session EN DB immédiatement lors de la connexion
        const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

        // Supprimer les anciennes sessions de cet utilisateur
        await query('DELETE FROM sessions WHERE user_id = ?', [user.id]);

        // Créer une nouvelle session fraîche
        await query(
          'INSERT INTO sessions (session_token, user_id, expires) VALUES (?, ?, ?)',
          [`session_${user.id}_${Date.now()}`, user.id, expires]
        );

        console.log(`✅ Session DB créée pour l'utilisateur ${user.name} (ID: ${user.id})`);
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.id) {
        session.user.id = token.id as string;

        // ✅ OPTIMIZED: Use session cache to reduce database queries
        const sessionToken = `session_${token.id}_cache`;
        const cachedSession = sessionCache.get(sessionToken);

        if (!cachedSession) {
          // Cache miss - verify in database
          const dbSession: any = await queryOne(
            'SELECT user_id, expires FROM sessions WHERE user_id = ? AND expires > NOW()',
            [token.id]
          );

          // If session doesn't exist in DB, invalidate
          if (!dbSession) {
            console.log(`⚠️ Session expirée ou supprimée pour l'utilisateur ${token.id}`);
            throw new Error('Session invalidée');
          }

          // Cache the session for future requests
          sessionCache.set(
            sessionToken,
            parseInt(token.id as string),
            session.user.name || '',
            new Date(dbSession.expires)
          );
        }
      }
      return session;
    }
  },
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };