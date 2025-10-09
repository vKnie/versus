export interface OnlineUser {
  name: string;
  in_game: boolean;
  connected_since: string;
  profile_picture_url?: string | null;
}

export interface OnlineUsersResponse {
  count: number;
  users: OnlineUser[];
}

export interface Message {
  id: number;
  message: string;
  created_at: string;
  username: string;
  profile_picture_url?: string | null;
}

export interface Room {
  id: number;
  name: string;
  created_at: string;
  created_by_name: string;
  member_count: number;
  has_active_game: boolean;
}

export interface GameConfig {
  id: string;
  file_name: string;
  file_path: string;
  created_by: string;
  created_at: string;
}

export interface RoomMember {
  id: number;
  name: string;
  joined_at: string;
  profile_picture_url?: string | null;
}
