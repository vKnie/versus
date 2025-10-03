// Types pour les modèles de la base de données

export type UserRole = 'config_creator' | 'room_creator' | 'admin';

export interface User {
  id: number;
  password: string;
  name: string;
  profile_picture_url?: string | null;
  in_game: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserRoleRecord {
  id: number;
  user_id: number;
  role: UserRole;
  created_at: Date;
}

export interface Session {
  id: number;
  session_token: string;
  user_id: number;
  expires: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Message {
  id: number;
  user_id: number;
  message: string;
  created_at: Date;
}

export interface GameConfiguration {
  id: number;
  created_by: number;
  file_path: string;
  file_name: string;
  created_at: Date;
}

export interface Room {
  id: number;
  name: string;
  created_by: number;
  config_id?: number | null;
  created_at: Date;
}

export interface RoomMember {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: Date;
}

export type GameSessionStatus = 'in_progress' | 'finished';

export interface GameSession {
  id: number;
  status: GameSessionStatus;
  current_duel_index: number;
  duels_data: string; // JSON string
  video_start_time?: Date | null;
  created_at: Date;
}

export interface Vote {
  id: number;
  game_session_id: number;
  user_id: number;
  duel_index: number;
  item_voted: string;
  created_at: Date;
}

export interface GameResult {
  id: number;
  game_session_id: number;
  history_file: string;
  winner: string;
  created_at: Date;
}

// Types utilitaires pour les requêtes

export interface UserWithRoles extends Omit<User, 'password'> {
  roles: UserRole[];
}

export interface MessageWithUser extends Message {
  user_name: string;
  user_profile_picture?: string | null;
}

export interface RoomWithDetails extends Room {
  created_by_name: string;
  member_count: number;
  config_name?: string | null;
}

export interface RoomMemberWithUser extends RoomMember {
  user_name: string;
  user_profile_picture?: string | null;
}
