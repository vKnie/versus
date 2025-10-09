'use client';

import Avatar from '@/components/Avatar';
import { UserCheck } from 'lucide-react';
import { OnlineUsersResponse } from '@/types';

interface OnlineUsersSectionProps {
  onlineUsers: OnlineUsersResponse | null;
  loading: boolean;
}

export default function OnlineUsersSection({ onlineUsers, loading }: OnlineUsersSectionProps) {
  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl">
      <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-blue-400" />
        Utilisateurs connectés
      </h3>
      <div>
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-blue-400 rounded-full animate-spin"></div>
            <p className="text-zinc-500 text-sm">Chargement...</p>
          </div>
        ) : onlineUsers ? (
          <div className="space-y-4">
            <div className="bg-zinc-800/50 rounded-lg p-3">
              <p className="text-zinc-300 text-sm font-medium">
                {onlineUsers.count} {onlineUsers.count > 1 ? 'utilisateurs connectés' : 'utilisateur connecté'}
              </p>
            </div>
            <div className="space-y-2">
              {onlineUsers.users.map((user, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Avatar src={user.profile_picture_url} name={user.name} size="xs" />
                    <span className={`w-2 h-2 rounded-full ${!!user.in_game ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
                    <span className="text-zinc-200 font-medium text-sm">{user.name}</span>
                    {!!user.in_game && (
                      <span className="text-xs bg-orange-900/30 text-orange-400 px-2 py-0.5 rounded">En jeu</span>
                    )}
                  </div>
                  <span className="text-zinc-500 text-xs">
                    {new Date(user.connected_since).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">Erreur lors du chargement</p>
        )}
      </div>
    </div>
  );
}
