-- Création de la base de données versus_db
CREATE DATABASE IF NOT EXISTS versus_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Création de l'utilisateur pour l'application
CREATE USER IF NOT EXISTS 'versus_user'@'localhost' IDENTIFIED BY 'azerty123';
GRANT ALL PRIVILEGES ON versus_db.* TO 'versus_user'@'localhost';
FLUSH PRIVILEGES;

USE versus_db;

-- Table des utilisateurs
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL UNIQUE,
    profile_picture_url VARCHAR(500) DEFAULT NULL,
    in_game BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    -- ✅ OPTIMISATION: Index pour recherche par nom (getUserIdByName)
    INDEX idx_users_name (name),
    -- ✅ OPTIMISATION: Index pour filtrer par statut de jeu
    INDEX idx_users_in_game (in_game)
);

-- Table des rôles utilisateur
CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role ENUM('config_creator', 'room_creator', 'admin') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role),
    INDEX idx_user_id (user_id),
    -- ✅ OPTIMISATION: Index pour recherche par rôle
    INDEX idx_user_roles_role (role),
    -- ✅ OPTIMISATION: Index composite pour vérification user+role (userHasRole)
    INDEX idx_user_roles_user_role (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des sessions pour voir les utilisateurs connectés
CREATE TABLE IF NOT EXISTS sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_token VARCHAR(255) NOT NULL UNIQUE,
    user_id INT NOT NULL,
    expires TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_session_token (session_token),
    INDEX idx_expires (expires),
    -- ✅ OPTIMISATION: Index composite pour validation de session (broadcastOnlineUsers)
    INDEX idx_sessions_user_expires (user_id, expires),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des messages de chat
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_id (user_id),
    INDEX idx_created_at (created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des configurations de jeu (créée en premier car rooms a une clé étrangère vers elle)
CREATE TABLE IF NOT EXISTS game_configurations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    created_by INT NOT NULL,
    file_path VARCHAR(255) NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_created_by (created_by),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des salons
CREATE TABLE IF NOT EXISTS rooms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_by INT NOT NULL,
    config_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- ✅ OPTIMISATION: Index pour recherche par créateur
    INDEX idx_rooms_creator (created_by),
    -- ✅ OPTIMISATION: Index pour recherche par config
    INDEX idx_rooms_config (config_id),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (config_id) REFERENCES game_configurations(id) ON DELETE SET NULL
);

-- Table des membres des salons
CREATE TABLE IF NOT EXISTS room_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    room_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_room_user (room_id, user_id),
    -- ✅ OPTIMISATION: Index pour récupérer tous les membres d'un salon (très fréquent)
    INDEX idx_room_members_room (room_id),
    -- ✅ OPTIMISATION: Index pour récupérer les salons d'un utilisateur
    INDEX idx_room_members_user (user_id),
    -- ✅ OPTIMISATION: Index composite pour vérifier si user est dans room
    INDEX idx_room_members_room_user (room_id, user_id),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des sessions de jeu (simplifiée - tout est dans le fichier historique)
CREATE TABLE IF NOT EXISTS game_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    status ENUM('in_progress', 'finished') DEFAULT 'in_progress',
    current_duel_index INT DEFAULT 0,
    duels_data JSON NOT NULL,
    video_start_time TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- ✅ OPTIMISATION: Index pour filtrer par statut
    INDEX idx_game_sessions_status (status),
    -- ✅ OPTIMISATION: Index pour recherche par duel actuel
    INDEX idx_game_sessions_duel_index (current_duel_index),
    -- ✅ OPTIMISATION: Index composite pour recherche status+duel
    INDEX idx_game_sessions_status_duel (status, current_duel_index)
);

-- Table des votes temporaires (nettoyés après sauvegarde historique)
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_session_id INT NOT NULL,
    user_id INT NOT NULL,
    duel_index INT NOT NULL,
    item_voted VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_vote (game_session_id, user_id, duel_index),
    -- ✅ OPTIMISATION: Index composite pour récupérer tous les votes d'un duel (le plus fréquent)
    INDEX idx_votes_session_duel (game_session_id, duel_index),
    -- ✅ OPTIMISATION: Index pour recherche par utilisateur
    INDEX idx_votes_user (user_id),
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table pour tracker les clics "Continuer" après un tie-breaker
CREATE TABLE IF NOT EXISTS tiebreaker_continues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_session_id INT NOT NULL,
    duel_index INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_continue (game_session_id, duel_index, user_id),
    -- ✅ OPTIMISATION: Index composite pour compter les clics sur un duel
    INDEX idx_tiebreaker_continues_session_duel (game_session_id, duel_index),
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table pour tracker les clics "Continuer" normaux (sans tie-breaker)
CREATE TABLE IF NOT EXISTS normal_continues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_session_id INT NOT NULL,
    duel_index INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_normal_continue (game_session_id, duel_index, user_id),
    -- ✅ OPTIMISATION: Index composite pour compter les clics sur un duel
    INDEX idx_normal_continues_session_duel (game_session_id, duel_index),
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Table des résultats (stocke uniquement le lien vers le fichier historique)
CREATE TABLE IF NOT EXISTS game_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    game_session_id INT NOT NULL UNIQUE,
    history_file VARCHAR(255) NOT NULL,
    winner VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_game_session_id (game_session_id),
    FOREIGN KEY (game_session_id) REFERENCES game_sessions(id) ON DELETE CASCADE
);

-- Insertion d'un utilisateur de test avec tous les rôles
-- Pseudo: kevin, Mot de passe: azerty123
INSERT INTO users (password, name) VALUES
('$2b$12$XKYKBbZGH49MwJjrih2ZWeYOW.SCf44i5KnteE3.A2SxSpaoR2FmG', 'kevin');

-- Donner tous les rôles à l'utilisateur kevin
INSERT INTO user_roles (user_id, role) VALUES
(1, 'config_creator'),
(1, 'room_creator'),
(1, 'admin');