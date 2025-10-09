'use client';

import Avatar from '@/components/Avatar';
import { UserCheck, LogOut, Settings, Shield } from 'lucide-react';
import { Socket } from 'socket.io-client';

interface UserSessionSectionProps {
  username: string;
  profilePictureUrl?: string | null;
  userRoles: string[];
  socket: Socket | null;
  onSignOut: () => void;
  onNavigateToConfig: () => void;
  onNavigateToAdmin: () => void;
}

export default function UserSessionSection({
  username,
  profilePictureUrl,
  userRoles,
  socket,
  onSignOut,
  onNavigateToConfig,
  onNavigateToAdmin,
}: UserSessionSectionProps) {
  const canAccessConfig = userRoles.includes('config_creator') || userRoles.includes('admin');
  const canAccessAdmin = userRoles.includes('admin');

  return (
    <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl">
      <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        <UserCheck className="w-4 h-4 text-emerald-400" />
        Votre session
      </h3>
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <Avatar
              src={profilePictureUrl}
              name={username}
              size="lg"
            />
            <div>
              <p className="text-zinc-200 font-semibold text-base">{username}</p>
              <p className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                En ligne
              </p>
            </div>
          </div>
          <button
            onClick={onSignOut}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            Déconnexion
          </button>
        </div>

        {(canAccessConfig || canAccessAdmin) && (
          <div className="flex gap-2">
            {canAccessConfig && (
              <button
                onClick={onNavigateToConfig}
                className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Configuration
              </button>
            )}
            {canAccessAdmin && (
              <button
                onClick={onNavigateToAdmin}
                className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Shield className="w-4 h-4" />
                Administration
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
