'use client';

import { useState, useEffect } from 'react';
import { Settings, X } from 'lucide-react';
import Avatar from './Avatar';

interface GameMasterMenuProps {
  roomId: number;
  gameSessionId: number;
  onExcludePlayer: (userId: number) => void;
  currentUserName: string;
}

interface RoomMember {
  id: number;
  name: string;
  profile_picture_url?: string | null;
  joined_at?: string;
}

export default function GameMasterMenu({ roomId, onExcludePlayer, currentUserName }: GameMasterMenuProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [members, setMembers] = useState<RoomMember[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rooms/members?roomId=${roomId}`);
      if (response.ok) {
        const data = await response.json();
        console.log('Membres récupérés:', data);

        // L'API retourne directement le tableau, pas un objet avec .members
        if (Array.isArray(data)) {
          setMembers(data);
          console.log('Membres définis:', data);
        } else {
          console.error('data n\'est pas un tableau:', data);
          setMembers([]);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des membres:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (showMenu) {
      fetchMembers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showMenu, roomId]);

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 hover:bg-zinc-700/50 transition-colors cursor-pointer flex items-center gap-2"
        title="Gestion de la partie"
      >
        <Settings className="w-4 h-4 text-zinc-400" />
        <span className="text-sm text-zinc-400">Gérer</span>
      </button>

      {showMenu && (
        <>
          {/* Overlay pour fermer le menu en cliquant à l'extérieur */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />

          {/* Menu déroulant */}
          <div className="absolute top-full right-0 mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-zinc-200">Gestion de la partie</h3>
              <button
                onClick={() => setShowMenu(false)}
                className="p-1 hover:bg-zinc-700/50 rounded transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-zinc-400 mb-3">Joueurs dans la partie :</p>

              {loading ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">Chargement...</p>
              ) : members.length === 0 ? (
                <p className="text-xs text-zinc-500 italic text-center py-4">Aucun joueur trouvé</p>
              ) : (
                members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-2 bg-zinc-800/50 rounded hover:bg-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar src={member.profile_picture_url} name={member.name} size="xs" />
                      <span className="text-sm text-zinc-200">{member.name}</span>
                      {member.name === currentUserName && (
                        <span className="text-xs text-purple-400">(vous)</span>
                      )}
                    </div>
                    {member.name !== currentUserName && (
                      <button
                        onClick={() => {
                          onExcludePlayer(member.id);
                          setShowMenu(false);
                        }}
                        className="px-2 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors cursor-pointer"
                      >
                        Exclure
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
