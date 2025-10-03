// Types pour le système utilisateur

export interface User {
  id: number;
  name: string;
  password: string;
  profile_picture_url: string | null;
  in_game: boolean;
  created_at: string;
}

export interface UserRole {
  id: number;
  user_id: number;
  role: 'admin' | 'room_creator' | 'config_creator';
  created_at: string;
}

export interface Session {
  id: number;
  session_token: string;
  user_id: number;
  expires: Date;
  created_at: string;
  updated_at: string;
}

export interface OnlineUser {
  id: number;
  name: string;
  profilePictureUrl: string | null;
}
