# Versus - Plateforme de Jeu Multijoueur en Temps Réel

![Next.js](https://img.shields.io/badge/Next.js-15.5.4-black?style=flat&logo=next.js)
![React](https://img.shields.io/badge/React-19.1.0-blue?style=flat&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat&logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-18.x+-green?style=flat&logo=node.js)
![MySQL](https://img.shields.io/badge/MySQL-8.x-orange?style=flat&logo=mysql)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8.1-black?style=flat&logo=socket.io)
![License](https://img.shields.io/badge/License-Proprietary-red?style=flat)

## Description

**Versus** est une application web interactive permettant à plusieurs joueurs de s'affronter dans des duels de votes sur des contenus YouTube en temps réel. Les utilisateurs créent des salons, invitent des amis et votent pour leurs contenus préférés dans un système de tournoi *bracket*.

> [!IMPORTANT]
> Cette application nécessite une base de données MySQL et un serveur Node.js pour fonctionner correctement.

## Fonctionnalités Principales

### Gestion des Utilisateurs
- [x] **Authentification sécurisée** avec NextAuth.js
- [x] **Système de rôles** : `admin`, `config_creator`, `room_creator`
- [x] **Profils personnalisés** avec photo de profil
- [x] **Gestion des sessions** en temps réel
- [x] **Liste des utilisateurs en ligne** avec statut (_En jeu_ / _Disponible_)

### Salons de Jeu
- [x] **Création de salons privés** par les utilisateurs autorisés
- [x] **Système d'invitation** et de gestion des membres
- [x] **Chat en direct** dans chaque salon
- [x] **Expulsion de membres** (pour le créateur)
- [x] **Suppression de salons** (pour le créateur)

### Système de Jeu
- [x] **Duels vidéo YouTube** en format tournoi
- [x] **Votes synchronisés** entre tous les joueurs
- [x] **Lecteurs vidéo intégrés** avec contrôles synchronisés
- [x] **Système de tie-breaker** automatique en cas d'égalité
- [x] **Menu Game Master** pour gérer la partie (exclusion de joueurs, etc.)
- [x] **Synchronisation vidéo** : play, pause, seek, vitesse de lecture
- [x] **Résultats détaillés** avec historique des votes

### Chat Global
- [x] **Messagerie en temps réel** pour tous les utilisateurs
- [x] **Cooldown anti-spam** (2 secondes entre chaque message)
- [x] **Affichage des profils** avec avatars
- [x] **Horodatage** des messages

### Configuration & Administration
- [x] **Interface de configuration** pour créer des tournois personnalisés
- [x] **Upload de fichiers JSON** pour définir les duels
- [x] **Gestion des utilisateurs** (création, suppression, modification de rôles)
- [x] **Nettoyage automatique** des sessions expirées

## Architecture Technique

### Stack Technologique

| Catégorie | Technologies |
|-----------|--------------|
| **Frontend** | Next.js 15.5.4, React 19.1.0, TypeScript, Tailwind CSS 4 |
| **Backend** | Node.js, Next.js API Routes, Socket.IO Server, NextAuth.js |
| **Base de données** | MySQL 8.x avec mysql2 |
| **Sécurité** | bcryptjs, NextAuth Sessions, Rate Limiting |
| **Temps réel** | Socket.IO (Client & Server) |
| **Dev Tools** | tsx, ESLint, dotenv |

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

> [!NOTE]
> Assurez-vous d'avoir Node.js >= 18.x et MySQL >= 8.x installés avant de commencer.

### Prérequis
- **Node.js** >= 18.x
- **MySQL** >= 8.x
- **npm** ou **yarn**

### Étapes d'Installation

1. **Cloner le repository**
```bash
git clone https://github.com/vKnie/versus
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

Éditer [`.env.local`](.env.local) avec vos informations :
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

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| **users** | Utilisateurs et leurs informations | `id`, `username`, `email`, `password`, `role` |
| **sessions** | Sessions d'authentification NextAuth | `sessionToken`, `userId`, `expires` |
| **rooms** | Salons de jeu | `id`, `name`, `creatorId`, `configId` |
| **room_members** | Membres des salons | `roomId`, `userId`, `joinedAt` |
| **game_sessions** | Sessions de jeu actives | `id`, `roomId`, `status`, `currentDuelIndex` |
| **votes** | Votes des joueurs | `gameSessionId`, `userId`, `itemId` |
| **messages** | Messages du chat global | `id`, `userId`, `content`, `timestamp` |
| **user_roles** | Rôles des utilisateurs | `userId`, `role` |
| **game_configurations** | Configurations de tournois | `id`, `name`, `filePath`, `createdBy` |
| **normal_continues** | Clics de continuation normale | `gameSessionId`, `userId` |
| **tiebreaker_continues** | Clics de continuation après tie-breaker | `gameSessionId`, `userId` |

> [!WARNING]
> Le schéma de base de données complet doit être importé manuellement. Référez-vous à la documentation SQL du projet.

## Configuration

### Créer une Configuration de Jeu

1. Se connecter en tant qu'`admin` ou `config_creator`
2. Accéder à [/configuration](http://localhost:3000/configuration)
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

> [!NOTE]
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

> [!CAUTION]
> Le créateur d'un salon ne peut pas le quitter sans le supprimer. Assurez-vous de vouloir créer un salon avant de confirmer.

### Pour les Administrateurs

1. **Accéder au panel d'administration** ([/admin](http://localhost:3000/admin))
2. **Gérer les utilisateurs** : création, suppression, rôles
3. **Nettoyer les données** : sessions expirées, logs anciens
4. **Configurer les rôles** pour autoriser la création de salons/configs

> [!WARNING]
> Les actions d'administration sont irréversibles. Soyez prudent lors de la suppression d'utilisateurs ou de données.

## Sécurité

- [x] **Authentification sécurisée** avec `bcrypt`
- [x] **Sessions HTTP-only cookies** via NextAuth
- [x] **Protection CSRF** intégrée
- [x] **Rate limiting** sur les endpoints sensibles (chat)
- [x] **Validation des entrées** côté serveur
- [x] **Headers de sécurité** configurés dans Next.js
- [x] **SQL préparé** pour prévenir les injections SQL

> [!IMPORTANT]
> En production, configurez toujours HTTPS et utilisez des mots de passe complexes pour la base de données.

## WebSocket Events

### Événements Client → Serveur

| Événement | Description | Paramètres |
|-----------|-------------|------------|
| `join_game_room` | Rejoindre un salon de jeu | `roomName`, `userId` |
| `leave_game_room` | Quitter un salon de jeu | `roomName` |
| `vote_cast` | Émettre un vote | `gameSessionId`, `itemId` |
| `chat_message` | Envoyer un message | `content`, `userId` |
| `game_started` | Démarrer une partie | `roomId` |
| `game_cancelled` | Annuler une partie | `gameSessionId` |
| `video_play/pause/seek/rate_change` | Contrôles vidéo | `timestamp`, `rate` |
| `player_excluded` | Exclure un joueur | `userId`, `gameSessionId` |
| `rooms_changed` | Notifier un changement de salons | - |
| `room_members_changed` | Notifier un changement de membres | `roomId` |
| `tiebreaker_continue` | Continuer après tie-breaker | `gameSessionId` |
| `normal_continue` | Continuer après un duel | `gameSessionId` |

### Événements Serveur → Client

| Événement | Description | Données retournées |
|-----------|-------------|-------------------|
| `online_users_update` | Mise à jour des utilisateurs en ligne | Liste des utilisateurs |
| `chat_update` | Nouveaux messages du chat | Messages récents |
| `rooms_update` | Mise à jour des salons | Liste des salons |
| `room_members_update` | Mise à jour des membres | Membres du salon |
| `vote_update` | Mise à jour des votes | Votes actuels |
| `duel_changed` | Changement de duel | Nouveau duel |
| `game_ended` | Fin de partie | Résultats finaux |
| `game_cancelled` | Partie annulée | Raison |
| `game_started` | Partie démarrée | Configuration |
| `video_play/pause/seek/rate_change` | Synchronisation vidéo | État vidéo |
| `player_excluded` | Joueur exclu | `userId` |
| `tiebreaker_continue_update` | Update tie-breaker | État tie-breaker |
| `normal_continue_update` | Update continuation normale | État continuation |

> [!NOTE]
> Les événements WebSocket sont automatiquement gérés par Socket.IO avec reconnexion automatique en cas de déconnexion.

## Logs

Les logs sont stockés dans le dossier [`logs/`](logs/) avec rotation quotidienne[^1] :
- **Format** : `app-YYYY-MM-DD.log`
- **Catégories** : `AUTH`, `DATABASE`, `GAME`, `SOCKET`, `API`, `SYSTEM`
- **Niveaux** : `DEBUG`, `INFO`, `WARN`, `ERROR`

> [!TIP]
> En développement, seuls les logs INFO, WARN et ERROR sont affichés en console. Les logs DEBUG sont uniquement écrits dans les fichiers.

## Licence

Ce projet est sous licence propriétaire. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

***Tous droits réservés*** © 2025 **Kevin**

## Support

Pour toute question ou problème :
- Créer une issue sur le repository

## Ressources Utiles

| Documentation | Lien |
|---------------|------|
| **Next.js** | [nextjs.org/docs](https://nextjs.org/docs) |
| **Socket.IO** | [socket.io/docs/v4](https://socket.io/docs/v4/) |
| **NextAuth.js** | [next-auth.js.org](https://next-auth.js.org/) |
| **MySQL** | [dev.mysql.com/doc](https://dev.mysql.com/doc/) |
| **TypeScript** | [typescriptlang.org/docs](https://www.typescriptlang.org/docs/) |
