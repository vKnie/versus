'use client';

import { LogIn, LogOut, Play, Trash2, X } from 'lucide-react';
import GameConfigSelector from '@/components/GameConfigSelector';
import RoomMembers from '@/components/RoomMembers';
import { RoomMember, GameConfig } from '@/types';
import { Socket } from 'socket.io-client';

interface UserRoomInfoProps {
  userRoom: { inRoom: boolean; room: any } | null;
  roomMembers: RoomMember[];
  gameSession: { inGame: boolean; roomName?: string; gameSessionId?: number } | null;
  gameConfigs: GameConfig[];
  selectedConfigId: string;
  showConfigDropdown: boolean;
  currentUserId?: number;
  socket: Socket | null;
  onSelectConfig: (configId: string) => void;
  onToggleConfigDropdown: () => void;
  onCloseConfigDropdown: () => void;
  onLeaveRoom: () => void;
  onDeleteRoom: (roomId: number) => void;
  onStartGame: () => void;
  onCancelGame: () => void;
  onKickMember: (memberId: number) => void;
}

export default function UserRoomInfo({
  userRoom,
  roomMembers,
  gameSession,
  gameConfigs,
  selectedConfigId,
  showConfigDropdown,
  currentUserId,
  socket,
  onSelectConfig,
  onToggleConfigDropdown,
  onCloseConfigDropdown,
  onLeaveRoom,
  onDeleteRoom,
  onStartGame,
  onCancelGame,
  onKickMember,
}: UserRoomInfoProps) {
  if (!userRoom?.inRoom) return null;

  return (
    <div className="mb-4 space-y-3">
      <div className="bg-purple-900/30 border border-purple-700/50 rounded-lg p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <p className="text-sm text-purple-200 mb-2">
              Vous êtes dans le salon de jeu : <span className="font-semibold">{userRoom.room.name}</span>
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-purple-300 bg-purple-800/50 px-2 py-0.5 rounded">
                {roomMembers.length} {roomMembers.length > 1 ? 'membres' : 'membre'}
              </span>
              {gameSession?.inGame && gameSession?.roomName === userRoom.room.name && (
                <span className="text-xs text-orange-300 bg-orange-900/30 px-2 py-0.5 rounded animate-pulse">
                  En cours
                </span>
              )}
              {userRoom?.room?.isCreator && (
                <span className="text-xs text-emerald-300 bg-emerald-900/30 px-2 py-0.5 rounded">
                  Créateur
                </span>
              )}
              <span className="text-xs text-purple-300">
                Créé par <span className="text-purple-200 font-medium">{userRoom.room.created_by_name}</span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {gameSession?.inGame && gameSession?.roomName === userRoom.room.name && (
              <>
                <button
                  onClick={() => {
                    const gameUrl = `/game/${encodeURIComponent(gameSession.roomName!)}`;
                    window.location.href = gameUrl;
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap animate-pulse flex items-center gap-2"
                >
                  <LogIn className="w-4 h-4" />
                  Rejoindre
                </button>
                {userRoom?.room?.isCreator && (
                  <button
                    onClick={onCancelGame}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-2"
                  >
                    <X className="w-4 h-4" />
                    Annuler la partie
                  </button>
                )}
              </>
            )}
            {!gameSession?.inGame && !userRoom?.room?.isCreator && (
              <button
                onClick={onLeaveRoom}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                Quitter
              </button>
            )}
            {userRoom?.room?.isCreator && !gameSession?.inGame && (
              <>
                <button
                  onClick={onStartGame}
                  disabled={!selectedConfigId}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  Commencer la partie
                </button>
                <button
                  onClick={() => onDeleteRoom(userRoom.room.id)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Supprimer
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {gameConfigs.length > 0 && userRoom?.room?.isCreator && !gameSession?.inGame && (
          <GameConfigSelector
            gameConfigs={gameConfigs}
            selectedConfigId={selectedConfigId}
            showDropdown={showConfigDropdown}
            onSelectConfig={onSelectConfig}
            onToggleDropdown={onToggleConfigDropdown}
            onCloseDropdown={onCloseConfigDropdown}
          />
        )}

        {/* Membres du salon */}
        <div className={!(gameConfigs.length > 0 && userRoom?.room?.isCreator && !gameSession?.inGame) ? 'lg:col-span-2' : ''}>
          <RoomMembers
            members={roomMembers}
            isCreator={userRoom?.room?.isCreator || false}
            currentUserId={currentUserId}
            inGame={gameSession?.inGame || false}
            onKickMember={onKickMember}
          />
        </div>
      </div>
    </div>
  );
}
