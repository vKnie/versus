'use client';

import { useState } from 'react';
import Avatar from '@/components/Avatar';
import { UserPlus } from 'lucide-react';
import { Room, RoomMember } from '@/types';

interface RoomListProps {
  rooms: Room[];
  userRoomId: number | null;
  selectedRoom: number | null;
  roomMembers: RoomMember[];
  onSelectRoom: (roomId: number | null) => void;
  onJoinRoom: (roomId: number) => void;
  canJoinRooms: boolean;
}

export default function RoomList({
  rooms,
  userRoomId,
  selectedRoom,
  roomMembers,
  onSelectRoom,
  onJoinRoom,
  canJoinRooms,
}: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-zinc-500 text-sm">Aucun salon disponible</p>
        <p className="text-zinc-600 text-xs mt-1">Créez le premier salon !</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {rooms.map((room) => {
        const isMember = userRoomId === room.id;

        // Si c'est le salon de l'utilisateur, ne pas l'afficher dans la liste
        if (isMember) return null;

        return (
          <div
            key={room.id}
            className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 hover:border-purple-500/50 transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-zinc-200 text-sm">{room.name}</h4>
                  <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-0.5 rounded">
                    {room.member_count} {room.member_count > 1 ? 'membres' : 'membre'}
                  </span>
                  {!!room.has_active_game && (
                    <span className="text-xs text-orange-300 bg-orange-900/30 px-2 py-0.5 rounded animate-pulse">
                      En cours
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500">
                  Créé par <span className="text-purple-400">{room.created_by_name}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => onSelectRoom(selectedRoom === room.id ? null : room.id)}
                  className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded transition-colors cursor-pointer"
                >
                  {selectedRoom === room.id ? 'Masquer' : 'Voir'}
                </button>

                {canJoinRooms && !room.has_active_game && (
                  <button
                    onClick={() => onJoinRoom(room.id)}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Rejoindre
                  </button>
                )}
              </div>
            </div>

            {selectedRoom === room.id && !isMember && (
              <div className="border-t border-zinc-700/50 pt-3 mt-3">
                <p className="text-xs font-medium text-zinc-400 mb-2">Membres du salon :</p>
                <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                  {roomMembers.map((member) => (
                    <div key={member.id} className="flex items-center justify-between text-xs bg-zinc-700/30 rounded px-2 py-1.5">
                      <div className="flex items-center gap-2">
                        <Avatar src={member.profile_picture_url} name={member.name} size="xs" />
                        <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                        <span className="text-zinc-300">{member.name}</span>
                      </div>
                      <span className="text-zinc-500">
                        {new Date(member.joined_at).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
