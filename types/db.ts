// Types pour les résultats de requêtes DB

export interface DBUser {
  id: number;
  name: string;
  password: string;
  in_game: boolean;
  profile_picture_url: string | null;
  created_at: Date;
}

export interface DBSession {
  id: number;
  session_token: string;
  user_id: number;
  expires: Date;
  created_at: Date;
}

export interface DBRoom {
  id: number;
  name: string;
  created_by: number;
  created_at: Date;
}

export interface DBRoomMember {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: Date;
}

export interface DBGameSession {
  id: number;
  status: 'in_progress' | 'finished';
  current_duel_index: number;
  duels_data: string; // JSON stringifié
  created_at: Date;
}

export interface DBVote {
  id: number;
  game_session_id: number;
  user_id: number;
  duel_index: number;
  item_voted: string;
  created_at: Date;
}

export interface DBGameResult {
  id: number;
  game_session_id: number;
  winner_item: string;
  created_at: Date;
}

export interface DBMessage {
  id: number;
  user_id: number;
  message: string;
  created_at: Date;
}

export interface DBGameConfiguration {
  id: number;
  name: string;
  file_path: string;
  created_by: number;
  created_at: Date;
}

export interface DBUserRole {
  id: number;
  user_id: number;
  role: 'admin' | 'room_creator' | 'config_creator';
}

// Types pour les résultats de requêtes avec JOIN
export interface DBUserWithRoles extends DBUser {
  roles: string[];
}

export interface DBMessageWithUser extends DBMessage {
  username: string;
  profile_picture_url: string | null;
}

export interface DBOnlineUser {
  name: string;
  in_game: boolean;
  profile_picture_url: string | null;
  connected_since: Date;
}

// Types pour les comptages
export interface DBCount {
  count: number;
}

// Types pour les résultats MySQL
export interface MySQLResultSetHeader {
  affectedRows: number;
  insertId: number;
  warningStatus: number;
}
