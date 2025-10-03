import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { query, getUserIdByName, userHasRole } from '@/lib/db';
import bcrypt from 'bcryptjs';

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

    const { username, password, profilePictureUrl, roles } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Nom d\'utilisateur et mot de passe requis' }, { status: 400 });
    }

    // Validation du mot de passe
    if (password.length < 8) {
      return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return NextResponse.json({
        error: 'Le mot de passe doit contenir au moins une majuscule, une minuscule et un chiffre'
      }, { status: 400 });
    }

    // Validation du nom d'utilisateur
    if (username.length < 3 || username.length > 50) {
      return NextResponse.json({ error: 'Le nom d\'utilisateur doit contenir entre 3 et 50 caractères' }, { status: 400 });
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return NextResponse.json({
        error: 'Le nom d\'utilisateur ne peut contenir que des lettres, chiffres, tirets et underscores'
      }, { status: 400 });
    }

    // Vérifier si l'utilisateur existe déjà
    const existingUser: any = await query(
      'SELECT id FROM users WHERE name = ?',
      [username]
    );

    if (existingUser.length > 0) {
      return NextResponse.json({ error: 'Cet utilisateur existe déjà' }, { status: 400 });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const result: any = await query(
      'INSERT INTO users (name, password, profile_picture_url) VALUES (?, ?, ?)',
      [username, hashedPassword, profilePictureUrl || null]
    );

    const newUserId = result.insertId;

    // Ajouter les rôles si fournis
    if (roles && Array.isArray(roles) && roles.length > 0) {
      for (const role of roles) {
        if (['config_creator', 'room_creator', 'admin'].includes(role)) {
          await query(
            'INSERT INTO user_roles (user_id, role) VALUES (?, ?)',
            [newUserId, role]
          );
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Utilisateur créé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
