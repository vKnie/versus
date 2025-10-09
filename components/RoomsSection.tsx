'use client';

import { Plus, Home as HomeIcon } from 'lucide-react';
import UserRoomInfo from '@/components/UserRoomInfo';
import RoomList from '@/components/RoomList';
import { Room, RoomMember, GameConfig } from '@/types';
import { Socket } from 'socket.io-client';

interface RoomsSectionProps {
  rooms: Room[];
  userRoom: { inRoom: boolean; room: any } | null;
  roomMembers: RoomMember[];
  gameSession: { inGame: boolean; roomName?: string; gameSessionId?: number } | null;
  gameConfigs: GameConfig[];
  selectedConfigId: string;
  showConfigDropdown: boolean;
  selectedRoom: number | null;
  newRoomName: string;
  creatingRoom: boolean;
  userRoles: string[];
  currentUserId?: number;
  socket: Socket | null;
  onSetNewRoomName: (name: string) => void;
  onCreateRoom: (e: React.FormEvent) => void;
  onSelectRoom: (roomId: number | null) => void;
  onJoinRoom: (roomId: number) => void;
  onLeaveRoom: () => void;
  onDeleteRoom: (roomId: number) => void;
  onStartGame: () => void;
  onCancelGame: () => void;
  onKickMember: (memberId: number) => void;
  onSelectConfig: (configId: string) => void;
  onToggleConfigDropdown: () => void;
  onCloseConfigDropdown: () => void;
}

export default function RoomsSection({
  rooms,
  userRoom,
  roomMembers,
  gameSession,
  gameConfigs,
  selectedConfigId,
  showConfigDropdown,
  selectedRoom,
  newRoomName,
  creatingRoom,
  userRoles,
  currentUserId,
  socket,
  onSetNewRoomName,
  onCreateRoom,
  onSelectRoom,
  onJoinRoom,
  onLeaveRoom,
  onDeleteRoom,
  onStartGame,
  onCancelGame,
  onKickMember,
  onSelectConfig,
  onToggleConfigDropdown,
  onCloseConfigDropdown,
}: RoomsSectionProps) {
  const canCreateRooms = userRoles.includes('room_creator') || userRoles.includes('admin');
  const canJoinRooms = !userRoom?.inRoom;

  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl lg:col-span-2">
      <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <HomeIcon className="w-4 h-4 text-purple-400" />
        Salons de jeux
      </h3>

      {/* Message si l'utilisateur est dans un salon */}
      <UserRoomInfo
        userRoom={userRoom}
        roomMembers={roomMembers}
        gameSession={gameSession}
        gameConfigs={gameConfigs}
        selectedConfigId={selectedConfigId}
        showConfigDropdown={showConfigDropdown}
        currentUserId={currentUserId}
        socket={socket}
        onSelectConfig={onSelectConfig}
        onToggleConfigDropdown={onToggleConfigDropdown}
        onCloseConfigDropdown={onCloseConfigDropdown}
        onLeaveRoom={onLeaveRoom}
        onDeleteRoom={onDeleteRoom}
        onStartGame={onStartGame}
        onCancelGame={onCancelGame}
        onKickMember={onKickMember}
      />

      {/* Formulaire de création de salon */}
      {!userRoom?.inRoom && canCreateRooms && (
        <form onSubmit={onCreateRoom} className="mb-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={newRoomName}
              onChange={(e) => onSetNewRoomName(e.target.value)}
              placeholder="Nom du salon..."
              className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all"
              maxLength={50}
              disabled={creatingRoom}
            />
            <button
              type="submit"
              disabled={!newRoomName.trim() || creatingRoom}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer flex items-center gap-2"
            >
              {creatingRoom ? 'Création...' : (
                <>
                  <Plus className="w-4 h-4" />
                  Créer
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Liste des salons */}
      <RoomList
        rooms={rooms}
        userRoomId={userRoom?.room?.id || null}
        selectedRoom={selectedRoom}
        roomMembers={roomMembers}
        onSelectRoom={onSelectRoom}
        onJoinRoom={onJoinRoom}
        canJoinRooms={canJoinRooms}
      />
    </div>
  );
}
