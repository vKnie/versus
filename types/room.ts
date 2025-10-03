// Types pour le système de salons

export interface Room {
  id: number;
  name: string;
  created_by: number;
  config_id: number | null;
  created_at: string;
}

export interface RoomMember {
  id: number;
  room_id: number;
  user_id: number;
  joined_at: string;
}

export interface RoomWithMembers extends Room {
  memberCount: number;
  members?: {
    id: number;
    name: string;
    profilePictureUrl: string | null;
  }[];
}
