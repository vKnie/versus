# Versus - Plateforme de Jeu Multijoueur en Temps Réel

![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19.1.0-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18.x+-green?style=flat&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.x-orange?style=flat&logo=mysql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.1-black?style=flat&logo=socket.io)
![License](https://img.shields.io/badge/License-Proprietary-red?style=flat)

## Description

**Versus** est une application web interactive permettant à plusieurs joueurs de s'affronter dans des duels de votes sur des contenus YouTube en temps réel. Les utilisateurs créent des salons, invitent des amis et votent pour leurs contenus préférés dans un système de tournoi bracket.

> Cette application nécessite une base de données MySQL et un serveur Node.js pour fonctionner correctement.

## Fonctionnalités Principales

### Gestion des Utilisateurs
- **Authentification sécurisée** avec NextAuth.js
- **Système de rôles** : admin, config_creator, room_creator
- **Profils personnalisés** avec photo de profil
- **Gestion des sessions** en temps réel
- **Liste des utilisateurs en ligne** avec statut (En jeu / Disponible)

### Salons de Jeu
- **Création de salons privés** par les utilisateurs autorisés
- **Système d'invitation** et de gestion des membres
- **Chat en direct** dans chaque salon
- **Expulsion de membres** (pour le créateur)
- **Suppression de salons** (pour le créateur)

### Système de Jeu
- **Duels vidéo YouTube** en format tournoi
- **Votes synchronisés** entre tous les joueurs
- **Lecteurs vidéo intégrés** avec contrôles synchronisés
- **Système de tie-breaker** automatique en cas d'égalité
- **Menu Game Master** pour gérer la partie (exclusion de joueurs, etc.)
- **Synchronisation vidéo** : play, pause, seek, vitesse de lecture
- **Résultats détaillés** avec historique des votes

### Chat Global
- **Messagerie en temps réel** pour tous les utilisateurs
- **Cooldown anti-spam** (2 secondes entre chaque message)
- **Affichage des profils** avec avatars
- **Horodatage** des messages

### Configuration & Administration
- **Interface de configuration** pour créer des tournois personnalisés
- **Upload de fichiers JSON** pour définir les duels
- **Gestion des utilisateurs** (création, suppression, modification de rôles)
- **Nettoyage automatique** des sessions expirées

## Architecture Technique

### Stack Technologique

#### Frontend
- [**Next.js 15.5.4**](https://nextjs.org/) - Framework React avec App Router
- [**React 19.1.0**](https://react.dev/) - Bibliothèque UI
- [**TypeScript**](https://www.typescriptlang.org/) - Typage statique
- [**Tailwind CSS 4**](https://tailwindcss.com/) - Framework CSS utilitaire
- [**Lucide React**](https://lucide.dev/) - Icônes modernes
- [**Socket.IO Client**](https://socket.io/) - Communication temps réel

#### Backend
- [**Node.js**](https://nodejs.org/) avec serveur HTTP/HTTPS personnalisé
- [**Next.js API Routes**](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) - Endpoints REST
- [**Socket.IO Server**](https://socket.io/) - WebSockets pour le temps réel
- [**NextAuth.js**](https://next-auth.js.org/) - Authentification
- [**MySQL 2**](https://github.com/sidorares/node-mysql2) - Base de données relationnelle
- [**bcryptjs**](https://github.com/dcodeIO/bcrypt.js) - Hachage des mots de passe

#### Outils de Développement
- [**tsx**](https://github.com/privatenumber/tsx) - Exécution TypeScript pour le serveur
- [**ESLint**](https://eslint.org/) - Linting du code
- [**dotenv**](https://github.com/motdotla/dotenv) - Gestion des variables d'environnement

### Structure du Projet

```
versus/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes
│   │   ├── auth/                 # Authentification
│   │   ├── game/                 # Logique de jeu
│   │   ├── rooms/                # Gestion des salons
│   │   ├── users/                # Gestion des utilisateurs
│   │   ├── chat/                 # Messagerie
│   │   ├── configurations/       # Configurations de jeu
│   │   └── upload/               # Upload de fichiers
│   ├── game/[roomName]/          # Page de jeu dynamique
│   ├── results/[gameSessionId]/  # Page de résultats
│   ├── admin/                    # Panel d'administration
│   ├── configuration/            # Interface de configuration
│   ├── login/                    # Page de connexion
│   └── page.tsx                  # Page d'accueil
├── components/                   # Composants React réutilisables
│   ├── Avatar.tsx
│   └── GameMasterMenu.tsx
├── lib/                          # Utilitaires et bibliothèques
│   ├── db.ts                     # Configuration MySQL
│   ├── logger.ts                 # Système de logs
│   ├── useSocket.ts              # Hook Socket.IO
│   ├── game-utils.ts             # Utilitaires de jeu
│   ├── game-progression.ts       # Logique de progression
│   ├── cleanup.ts                # Nettoyage automatique
│   ├── config-cache.ts           # Cache de configuration
│   ├── session-cache.ts          # Cache de sessions
│   └── rate-limit.ts             # Limitation de taux
├── types/                        # Définitions TypeScript
│   ├── next-auth.d.ts
│   ├── user.ts
│   ├── game.ts
│   └── db.ts
├── public/                       # Fichiers statiques
│   ├── uploads/                  # Photos de profil
│   ├── configs/                  # Fichiers de configuration
│   └── game_history/             # Historique des parties
├── server.ts                     # Serveur Node.js personnalisé
├── tsconfig.json                 # Configuration TypeScript
├── next.config.ts                # Configuration Next.js
├── tailwind.config.js            # Configuration Tailwind
├── package.json                  # Dépendances npm
└── .env.example                  # Exemple de variables d'environnement
```

## Installation

> Assurez-vous d'avoir Node.js >= 18.x et MySQL >= 8.x installés avant de commencer.

### Prérequis
- **Node.js** >= 18.x
- **MySQL** >= 8.x
- **npm** ou **yarn**

### Étapes d'Installation

1. **Cloner le repository**
```bash
git clone <repository-url>
cd versus
```

2. **Installer les dépendances**
```bash
npm install
```

3. **Configurer la base de données**
```bash
# Créer la base de données MySQL
mysql -u root -p
CREATE DATABASE versus_db;
```

4. **Configurer les variables d'environnement**
```bash
cp .env.example .env.local
```

Éditer `.env.local` avec vos informations :
```env
# NextAuth Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<générer-avec-openssl-rand-base64-32>

# Database Configuration
DB_HOST=localhost
DB_USER=versus_user
DB_PASSWORD=votre_mot_de_passe
DB_NAME=versus_db
DB_PORT=3306

# HTTPS Configuration (optionnel)
USE_HTTPS=false
SSL_KEY_PATH=./certs/privkey.pem
SSL_CERT_PATH=./certs/fullchain.pem
```

> [!TIP]
> Pour générer une clé `NEXTAUTH_SECRET` sécurisée, utilisez : `openssl rand -base64 32`

5. **Importer le schéma de base de données**
```bash
# Créer les tables nécessaires (à adapter selon votre schéma SQL)
mysql -u versus_user -p versus_db < schema.sql
```

6. **Lancer l'application**

**Mode développement :**
```bash
npm run dev
```

**Mode production :**
```bash
npm run build
npm run start
```

L'application sera accessible sur `http://localhost:3000`

## Base de Données

### Tables Principales

- **users** : Utilisateurs et leurs informations
- **sessions** : Sessions d'authentification NextAuth
- **rooms** : Salons de jeu
- **room_members** : Membres des salons
- **game_sessions** : Sessions de jeu actives
- **votes** : Votes des joueurs
- **messages** : Messages du chat global
- **user_roles** : Rôles des utilisateurs
- **game_configurations** : Configurations de tournois
- **normal_continues** : Clics de continuation normale
- **tiebreaker_continues** : Clics de continuation après tie-breaker

> Le schéma de base de données complet doit être importé manuellement. Référez-vous à la documentation SQL du projet.

## Configuration

### Créer une Configuration de Jeu

1. Se connecter en tant qu'admin ou config_creator
2. Accéder à `/configuration`
3. Créer un fichier JSON avec la structure suivante :

```json
{
  "items": [
    {
      "name": "Contenu 1",
      "youtubeLink": "https://www.youtube.com/watch?v=VIDEO_ID_1",
      "proposedBy": ["Joueur1"]
    },
    {
      "name": "Contenu 2",
      "youtubeLink": "https://www.youtube.com/watch?v=VIDEO_ID_2",
      "proposedBy": ["Joueur2"]
    }
  ]
}
```

4. Uploader le fichier via l'interface

> Vous pouvez créer des tournois avec un nombre de participants flexible. L'algorithme créera automatiquement un bracket équilibré.

## Utilisation

### Pour les Joueurs

1. **Se connecter** avec vos identifiants
2. **Rejoindre ou créer un salon** depuis la page d'accueil
3. **Attendre** que le créateur lance la partie
4. **Voter** pour vos contenus préférés
5. **Profiter** de la synchronisation vidéo en temps réel

### Pour les Créateurs de Salon

1. **Créer un salon** depuis la page d'accueil
2. **Sélectionner une configuration** de jeu
3. **Attendre** que les joueurs rejoignent
4. **Lancer la partie** quand tout le monde est prêt
5. **Utiliser le menu Game Master** pour gérer la partie si nécessaire

> Le créateur d'un salon ne peut pas le quitter sans le supprimer. Assurez-vous de vouloir créer un salon avant de confirmer.

### Pour les Administrateurs

1. **Accéder au panel d'administration** (`/admin`)
2. **Gérer les utilisateurs** : création, suppression, rôles
3. **Nettoyer les données** : sessions expirées, logs anciens
4. **Configurer les rôles** pour autoriser la création de salons/configs

> Les actions d'administration sont irréversibles. Soyez prudent lors de la suppression d'utilisateurs ou de données.

## Sécurité

- **Authentification sécurisée** avec bcrypt
- **Sessions HTTP-only cookies** via NextAuth
- **Protection CSRF** intégrée
- **Rate limiting** sur les endpoints sensibles (chat)
- **Validation des entrées** côté serveur
- **Headers de sécurité** configurés dans Next.js
- **SQL préparé** pour prévenir les injections SQL

> En production, configurez toujours HTTPS et utilisez des mots de passe complexes pour la base de données.

## WebSocket Events

### Événements Client → Serveur
- `join_game_room` : Rejoindre un salon de jeu
- `leave_game_room` : Quitter un salon de jeu
- `vote_cast` : Émettre un vote
- `chat_message` : Envoyer un message
- `game_started` : Démarrer une partie
- `game_cancelled` : Annuler une partie
- `video_play/pause/seek/rate_change` : Contrôles vidéo
- `player_excluded` : Exclure un joueur
- `rooms_changed` : Notifier un changement de salons
- `room_members_changed` : Notifier un changement de membres
- `tiebreaker_continue` : Continuer après tie-breaker
- `normal_continue` : Continuer après un duel

### Événements Serveur → Client
- `online_users_update` : Mise à jour des utilisateurs en ligne
- `chat_update` : Nouveaux messages du chat
- `rooms_update` : Mise à jour des salons
- `room_members_update` : Mise à jour des membres
- `vote_update` : Mise à jour des votes
- `duel_changed` : Changement de duel
- `game_ended` : Fin de partie
- `game_cancelled` : Partie annulée
- `game_started` : Partie démarrée
- `video_play/pause/seek/rate_change` : Synchronisation vidéo
- `player_excluded` : Joueur exclu
- `tiebreaker_continue_update` : Update tie-breaker
- `normal_continue_update` : Update continuation normale

> Les événements WebSocket sont automatiquement gérés par Socket.IO avec reconnexion automatique en cas de déconnexion.

## Logs

Les logs sont stockés dans le dossier `logs/` avec rotation quotidienne :
- Format : `app-YYYY-MM-DD.log`
- Catégories : AUTH, DATABASE, GAME, SOCKET, API, SYSTEM
- Niveaux : DEBUG, INFO, WARN, ERROR

> En développement, seuls les logs INFO, WARN et ERROR sont affichés en console. Les logs DEBUG sont uniquement écrits dans les fichiers.

## Licence

Ce projet est sous licence propriétaire. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

Tous droits réservés © 2025 Kevin

## Support

Pour toute question ou problème :
- Créer une issue sur le repository

## Ressources Utiles

- [Documentation Next.js](https://nextjs.org/docs)
- [Documentation Socket.IO](https://socket.io/docs/v4/)
- [Documentation NextAuth.js](https://next-auth.js.org/)
- [Documentation MySQL](https://dev.mysql.com/doc/)
- [Documentation TypeScript](https://www.typescriptlang.org/docs/)

