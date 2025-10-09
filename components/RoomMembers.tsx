'use client';

import Avatar from '@/components/Avatar';
import { Users, UserMinus } from 'lucide-react';
import { RoomMember } from '@/types';

interface RoomMembersProps {
  members: RoomMember[];
  isCreator: boolean;
  currentUserId?: number;
  inGame: boolean;
  onKickMember: (memberId: number) => void;
}

export default function RoomMembers({
  members,
  isCreator,
  currentUserId,
  inGame,
  onKickMember,
}: RoomMembersProps) {
  return (
    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
      <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
        <Users className="w-4 h-4 text-emerald-400" />
        Membres du salon ({members.length})
      </h4>
      <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between text-xs bg-zinc-900/50 rounded px-3 py-2">
            <div className="flex items-center gap-2">
              <Avatar src={member.profile_picture_url} name={member.name} size="xs" />
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
              <span className="text-zinc-200 font-medium">{member.name}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-zinc-500">
                {new Date(member.joined_at).toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </span>
              {isCreator && member.id !== currentUserId && !inGame && (
                <button
                  onClick={() => onKickMember(member.id)}
                  className="px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded transition-colors cursor-pointer"
                  title="Expulser ce membre"
                >
                  <UserMinus className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
