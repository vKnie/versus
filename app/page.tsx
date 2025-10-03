'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Avatar from '@/components/Avatar';
import { useSocket, useGameRoom } from '@/lib/useSocket';

interface OnlineUser {
  name: string;
  in_game: boolean;
  connected_since: string;
  profile_picture_url?: string | null;
}

interface OnlineUsersResponse {
  count: number;
  users: OnlineUser[];
}

interface Message {
  id: number;
  message: string;
  created_at: string;
  username: string;
  profile_picture_url?: string | null;
}

interface Room {
  id: number;
  name: string;
  created_at: string;
  created_by_name: string;
  member_count: number;
}

interface GameConfig {
  id: string;
  file_name: string;
  file_path: string;
  created_by: string;
  created_at: string;
}

interface RoomMember {
  id: number;
  name: string;
  joined_at: string;
  profile_picture_url?: string | null;
}

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const configDropdownRef = useRef<HTMLDivElement>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [gameConfigs, setGameConfigs] = useState<GameConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [roomMembers, setRoomMembers] = useState<RoomMember[]>([]);
  const [userRoom, setUserRoom] = useState<{ inRoom: boolean; room: any } | null>(null);
  const [canSendMessage, setCanSendMessage] = useState(true);
  const [cooldownTime, setCooldownTime] = useState(0);
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [gameSession, setGameSession] = useState<{ inGame: boolean; roomName?: string; gameSessionId?: number } | null>(null);
  const [currentUserProfile, setCurrentUserProfile] = useState<{ profile_picture_url?: string | null }>({});

  // ✅ WebSocket connection
  const { socket, isConnected } = useSocket();

  // ✅ Rejoindre automatiquement la room socket du salon
  useGameRoom(userRoom?.inRoom ? userRoom.room.id : null, session?.user?.name || '');

  // ✅ Notifier IMMÉDIATEMENT la connexion (une fois que socket + session sont prêts)
  const hasNotifiedRef = useRef(false);

  useEffect(() => {
    if (socket && isConnected && session && !hasNotifiedRef.current) {
      hasNotifiedRef.current = true;

      // Délai réduit car la session est créée dans le callback jwt de NextAuth
      setTimeout(() => {
        socket.emit('refresh_online_users');
      }, 300);
    }
  }, [socket, isConnected, session]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
    }
  }, [session, status, router]);

  const fetchMessages = async () => {
    try {
      const response = await fetch('/api/chat/messages');
      if (response.ok) {
        setMessages(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des messages:', error);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending || !canSendMessage) return;

    setSending(true);
    setCanSendMessage(false);

    try {
      const response = await fetch('/api/chat/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: newMessage.trim() }),
      });

      if (response.ok) {
        const data = await response.json();

        // Ajouter le nouveau message à la liste localement
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }

        setNewMessage('');

        // ✅ Émettre événement WebSocket pour notifier les AUTRES utilisateurs
        socket?.emit('chat_message', {
          message: newMessage.trim(),
          username: session?.user?.name,
        });

        // Démarrer le cooldown de 2 secondes
        setCooldownTime(2);
        const cooldownInterval = setInterval(() => {
          setCooldownTime((prev) => {
            if (prev <= 1) {
              clearInterval(cooldownInterval);
              setCanSendMessage(true);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    } catch (error) {
      console.error('Erreur lors de l\'envoi du message:', error);
      setCanSendMessage(true);
    } finally {
      setSending(false);
    }
  };

  const fetchRooms = async () => {
    try {
      const response = await fetch('/api/rooms/list');
      if (response.ok) {
        setRooms(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des salons:', error);
    }
  };

  const fetchGameConfigs = async () => {
    try {
      const response = await fetch('/api/configurations/list');
      if (response.ok) {
        setGameConfigs(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des configurations:', error);
    }
  };

  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/users/me');
      if (response.ok) {
        const data = await response.json();
        setUserRoles(data.roles || []);
        setCurrentUserProfile({ profile_picture_url: data.profile_picture_url });
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du rôle utilisateur:', error);
    }
  };

  const checkGameSession = async () => {
    try {
      const response = await fetch('/api/game/check-session');
      if (response.ok) {
        const data = await response.json();
        setGameSession(data);
      }
    } catch (error) {
      console.error('Erreur lors de la vérification de la session de jeu:', error);
    }
  };

  const createRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim() || creatingRoom) return;

    setCreatingRoom(true);
    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: newRoomName.trim(),
          configId: null
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setNewRoomName('');

        // ✅ Émettre événements WebSocket pour notifier tous les clients
        socket?.emit('rooms_changed');
        socket?.emit('room_members_changed', { roomId: data.roomId });

        fetchRooms();
        fetchUserRoom();
      }
    } catch (error) {
      console.error('Erreur lors de la création du salon:', error);
    } finally {
      setCreatingRoom(false);
    }
  };

  const joinRoom = async (roomId: number) => {
    try {
      const response = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      });

      if (response.ok) {
        // Attendre un peu pour que l'API termine l'insertion
        await new Promise(r => setTimeout(r, 200));

        // ✅ Émettre événements WebSocket pour notifier tous les clients
        socket?.emit('rooms_changed');
        socket?.emit('room_members_changed', { roomId });

        fetchRooms();
        fetchUserRoom();
      }
    } catch (error) {
      console.error('Erreur lors de la tentative de rejoindre le salon:', error);
    }
  };

  const fetchRoomMembers = async (roomId: number) => {
    try {
      const response = await fetch(`/api/rooms/members?roomId=${roomId}`);
      if (response.ok) {
        setRoomMembers(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des membres:', error);
    }
  };

  const fetchUserRoom = async () => {
    try {
      const response = await fetch('/api/rooms/user-room');
      if (response.ok) {
        setUserRoom(await response.json());
      }
    } catch (error) {
      console.error('Erreur lors de la vérification du salon:', error);
    }
  };

  const deleteRoom = async (roomId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce salon ?')) return;

    try {
      const response = await fetch('/api/rooms/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId }),
      });

      if (response.ok) {
        // ✅ Émettre événements WebSocket pour notifier tous les clients
        socket?.emit('rooms_changed');
        socket?.emit('room_members_changed', { roomId });

        fetchRooms();
        fetchUserRoom();
        setSelectedRoom(null);
      }
    } catch (error) {
      console.error('Erreur lors de la suppression du salon:', error);
    }
  };

  const leaveRoom = async () => {
    if (!confirm('Êtes-vous sûr de vouloir quitter ce salon ?')) return;

    try {
      const response = await fetch('/api/rooms/leave', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        const roomId = userRoom?.room?.id;

        // ✅ Émettre événements WebSocket pour notifier tous les clients
        socket?.emit('rooms_changed');
        if (roomId) {
          socket?.emit('room_members_changed', { roomId });
        }

        fetchRooms();
        fetchUserRoom();
        setSelectedRoom(null);
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de la sortie du salon');
      }
    } catch (error) {
      console.error('Erreur lors de la sortie du salon:', error);
    }
  };

  const kickMember = async (targetUserId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir expulser ce membre ?')) return;

    const roomId = userRoom?.room?.id;
    if (!roomId) return;

    try {
      const response = await fetch('/api/rooms/kick', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, targetUserId }),
      });

      if (response.ok) {
        // ✅ Émettre événements WebSocket pour notifier tous les clients
        socket?.emit('rooms_changed');
        socket?.emit('room_members_changed', { roomId });

        fetchRoomMembers(roomId);
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de l\'expulsion du membre');
      }
    } catch (error) {
      console.error('Erreur lors de l\'expulsion du membre:', error);
    }
  };

  // ✅ WebSocket - Écouter les mises à jour en temps réel
  useEffect(() => {
    if (!socket || !session) return;

    // Écouter les messages du chat
    socket.on('chat_update', (data: { messages: any[] }) => {
      // Convertir createdAt en created_at (serveur envoie createdAt, frontend attend created_at)
      const formattedMessages = data.messages.map(msg => ({
        id: msg.id,
        message: msg.message,
        username: msg.username,
        profile_picture_url: msg.profile_picture_url || msg.profilePictureUrl,
        created_at: msg.created_at || msg.createdAt, // Support des deux formats
      }));
      setMessages(formattedMessages);
    });

    // Écouter les updates de rooms
    socket.on('rooms_update', (data: { rooms: Room[] }) => {
      setRooms(data.rooms);
    });

    // Écouter les updates de room members
    socket.on('room_members_update', (data: { roomId: number; members: any[] }) => {
      // Convertir les formats pour compatibilité
      const formattedMembers = data.members.map(m => ({
        id: m.id,
        name: m.name,
        profile_picture_url: m.profile_picture_url || m.profilePictureUrl,
        joined_at: m.joined_at || m.joinedAt,
        in_game: m.in_game || m.inGame,
      }));

      // Mettre à jour si c'est la room sélectionnée ou la room de l'utilisateur
      if (selectedRoom === data.roomId || userRoom?.room?.id === data.roomId) {
        setRoomMembers(formattedMembers);

        // Vérifier si l'utilisateur actuel a été expulsé
        if (userRoom?.room?.id === data.roomId) {
          const isStillMember = data.members.some(m => m.name === session?.user?.name);
          if (!isStillMember) {
            // L'utilisateur a été expulsé
            alert('Vous avez été expulsé du salon');
            fetchUserRoom();
            setSelectedRoom(null);
          }
        }
      }
    });

    // Écouter le démarrage de partie pour rediriger automatiquement
    socket.on('game_started', (data: { roomId: number; roomName: string; gameSessionId: number }) => {
      // Vérifier si l'utilisateur est dans ce salon avant de rediriger
      if (userRoom?.inRoom && userRoom.room.id === data.roomId) {
        const gameUrl = `/game/${encodeURIComponent(data.roomName)}`;
        window.location.href = gameUrl; // Force un reload complet de la page
      }
    });

    // Écouter les updates d'utilisateurs en ligne
    socket.on('online_users_update', (data: { count: number; users: OnlineUser[] }) => {
      setOnlineUsers({
        count: data.count,
        users: data.users,
      });
    });

    // Nettoyage
    return () => {
      socket.off('chat_update');
      socket.off('rooms_update');
      socket.off('room_members_update');
      socket.off('game_started');
      socket.off('online_users_update');
    };
  }, [socket, session, selectedRoom, userRoom?.room?.id, router]);

  // ✅ Chargement initial (une seule fois, sans polling)
  useEffect(() => {
    if (!session) return;

    const fetchOnlineUsers = async () => {
      try {
        const response = await fetch('/api/users/online');
        if (response.ok) {
          setOnlineUsers(await response.json());
        }
      } finally {
        setLoading(false);
      }
    };

    // Chargement initial seulement
    fetchOnlineUsers();
    fetchMessages();
    fetchRooms();
    fetchUserRoom();
    fetchGameConfigs();
    fetchUserRole();
    checkGameSession();

    // ❌ POLLING SUPPRIMÉ - WebSocket gère les mises à jour
  }, [session]);

  // ✅ Chargement initial des room members (sans polling, WebSocket prend le relais)
  useEffect(() => {
    if (selectedRoom) {
      fetchRoomMembers(selectedRoom);
    }
  }, [selectedRoom]);

  useEffect(() => {
    if (userRoom?.inRoom && userRoom?.room?.id) {
      fetchRoomMembers(userRoom.room.id);
    }
  }, [userRoom?.inRoom, userRoom?.room?.id]);

  // Auto-scroll vers le bas quand de nouveaux messages arrivent
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fermer le dropdown quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (configDropdownRef.current && !configDropdownRef.current.contains(event.target as Node)) {
        setShowConfigDropdown(false);
      }
    };

    if (showConfigDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showConfigDropdown]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Chat compact */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl shadow-xl flex flex-col h-[400px] lg:col-span-2">
            {/* En-tête du chat */}
            <div className="p-4 border-b border-zinc-800/60">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                Chat en direct
              </h3>
            </div>

            {/* Zone des messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-zinc-500 text-sm">Aucun message...</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.id} className={`flex gap-2 ${
                    message.username === session.user?.name ? 'justify-end' : 'justify-start'
                  }`}>
                    {message.username !== session.user?.name && (
                      <Avatar src={message.profile_picture_url} name={message.username} size="sm" />
                    )}
                    <div className="max-w-[80%]">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`font-medium text-xs ${
                          message.username === session.user?.name
                            ? 'text-blue-400'
                            : 'text-emerald-400'
                        }`}>
                          {message.username}
                        </span>
                        <span className="text-zinc-500 text-xs">
                          {new Date(message.created_at).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <div className={`px-3 py-2 rounded-lg text-sm break-words ${
                        message.username === session.user?.name
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-200'
                      }`}>
                        {message.message}
                      </div>
                    </div>
                    {message.username === session.user?.name && (
                      <Avatar src={message.profile_picture_url} name={message.username} size="sm" />
                    )}
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Zone de saisie */}
            <div className="p-4 border-t border-zinc-800/60">
              <form onSubmit={sendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder={!canSendMessage ? `Attendez ${cooldownTime}s...` : "Tapez votre message..."}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 text-sm transition-all"
                  style={{ outline: 'none' }}
                  maxLength={500}
                  disabled={sending || !canSendMessage}
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim() || sending || !canSendMessage}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer"
                >
                  {!canSendMessage ? `${cooldownTime}s` : sending ? 'Envoi...' : 'Envoyer'}
                </button>
              </form>
            </div>
          </div>

          {/* Utilisateurs en ligne */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl">
            <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
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
                  <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar">
                    {onlineUsers.users.map((user, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-zinc-800/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Avatar src={user.profile_picture_url} name={user.name} size="xs" />
                          <span className={`w-2 h-2 rounded-full ${user.in_game ? 'bg-orange-400' : 'bg-emerald-400'}`}></span>
                          <span className="text-zinc-200 font-medium text-sm">{user.name}</span>
                          {user.in_game && (
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
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Section des salons */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl lg:col-span-2">
            <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-400 rounded-full"></span>
              Salons de jeux
            </h3>

            {/* Message si l'utilisateur est dans un salon */}
            {userRoom?.inRoom && (
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
                        <button
                          onClick={() => {
                            const gameUrl = `/game/${encodeURIComponent(gameSession.roomName!)}`;
                            window.location.href = gameUrl; // Force un reload complet de la page
                          }}
                          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap animate-pulse"
                        >
                          Rejoindre
                        </button>
                      )}
                      {!gameSession?.inGame && !userRoom?.room?.isCreator && (
                        <button
                          onClick={leaveRoom}
                          className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                        >
                          Quitter
                        </button>
                      )}
                      {userRoom?.room?.isCreator && !gameSession?.inGame && (
                        <>
                          <button
                            onClick={async () => {
                              if (!selectedConfigId) {
                                alert('Veuillez sélectionner une configuration de jeu');
                                return;
                              }

                              try {
                                const response = await fetch('/api/game/start', {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                  },
                                  body: JSON.stringify({
                                    roomId: userRoom.room.id,
                                    configId: selectedConfigId,
                                  }),
                                });

                                if (response.ok) {
                                  const data = await response.json();

                                  // Émettre l'événement socket pour rediriger tous les membres
                                  socket?.emit('game_started', {
                                    roomId: data.roomId,
                                    roomName: data.roomName,
                                    gameSessionId: data.gameSessionId
                                  });

                                  // Rediriger vers la page de jeu avec reload
                                  const gameUrl = `/game/${encodeURIComponent(userRoom.room.name)}`;
                                  window.location.href = gameUrl;
                                } else {
                                  const error = await response.json();
                                  alert(error.error || 'Erreur lors du démarrage de la partie');
                                }
                              } catch (error) {
                                console.error('Erreur lors du démarrage de la partie:', error);
                                alert('Erreur lors du démarrage de la partie');
                              }
                            }}
                            disabled={!selectedConfigId}
                            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                          >
                            Commencer la partie
                          </button>
                          <button
                            onClick={() => deleteRoom(userRoom.room.id)}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
                          >
                            Supprimer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {gameConfigs.length > 0 && userRoom?.room?.isCreator && !gameSession?.inGame && (
                    <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4">
                      <label className="block text-sm font-medium text-zinc-300 mb-2.5">
                        Configuration de jeu
                      </label>
                      <div className="relative" ref={configDropdownRef}>
                        <button
                          onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                          className="w-full px-3 py-2.5 bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all cursor-pointer text-left flex items-center justify-between"
                        >
                          <span className={selectedConfigId ? 'text-zinc-200' : 'text-zinc-400'}>
                            {selectedConfigId
                              ? gameConfigs.find(c => c.id === selectedConfigId)?.file_name
                              : 'Aucune configuration sélectionnée'}
                          </span>
                          <svg
                            className={`w-3 h-3 transition-transform ${showConfigDropdown ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 12 8"
                          >
                            <path d="M1 1L6 6L11 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>

                        {showConfigDropdown && (
                          <div className="absolute z-10 w-full mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                            <div
                              onClick={() => {
                                setSelectedConfigId('');
                                setShowConfigDropdown(false);
                              }}
                              className="px-3 py-2.5 text-sm text-zinc-400 hover:bg-purple-600 hover:text-white cursor-pointer transition-colors"
                            >
                              Aucune configuration sélectionnée
                            </div>
                            {gameConfigs.map((config) => (
                              <div
                                key={config.id}
                                onClick={() => {
                                  setSelectedConfigId(config.id);
                                  setShowConfigDropdown(false);
                                }}
                                className={`px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                                  selectedConfigId === config.id
                                    ? 'bg-purple-600 text-white'
                                    : 'text-zinc-200 hover:bg-purple-600 hover:text-white'
                                }`}
                              >
                                {config.file_name}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">
                        Choisissez une configuration pour lancer le jeu
                      </p>
                    </div>
                  )}

                  {/* Membres du salon */}
                  <div className={`bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-4 ${!(gameConfigs.length > 0 && userRoom?.room?.isCreator && !gameSession?.inGame) ? 'lg:col-span-2' : ''}`}>
                    <h4 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                      <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                      Membres du salon ({roomMembers.length})
                    </h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                      {roomMembers.map((member) => (
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
                            {userRoom?.room?.isCreator && member.id !== session?.user?.id && !gameSession?.inGame && (
                              <button
                                onClick={() => kickMember(member.id)}
                                className="px-2 py-1 bg-red-600/80 hover:bg-red-600 text-white text-xs rounded transition-colors cursor-pointer"
                                title="Expulser ce membre"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Formulaire de création de salon */}
            {!userRoom?.inRoom && (userRoles.includes('room_creator') || userRoles.includes('admin')) && (
              <form onSubmit={createRoom} className="mb-6">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    placeholder="Nom du salon..."
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 focus:border-purple-500 text-sm transition-all"
                    maxLength={50}
                    disabled={creatingRoom}
                  />
                  <button
                    type="submit"
                    disabled={!newRoomName.trim() || creatingRoom}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors text-sm cursor-pointer"
                  >
                    {creatingRoom ? 'Création...' : 'Créer'}
                  </button>
                </div>
              </form>
            )}

            {/* Liste des salons */}
            <div className="space-y-2">
              {rooms.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500 text-sm">Aucun salon disponible</p>
                  <p className="text-zinc-600 text-xs mt-1">Créez le premier salon !</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rooms.map((room) => {
                    const isCreator = userRoom?.room?.id === room.id && userRoom?.room?.isCreator;
                    const isMember = userRoom?.room?.id === room.id;

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
                            </div>
                            <div className="text-xs text-zinc-500">
                              Créé par <span className="text-purple-400">{room.created_by_name}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                              className="px-3 py-1.5 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-300 text-xs font-medium rounded transition-colors cursor-pointer"
                            >
                              {selectedRoom === room.id ? 'Masquer' : 'Voir'}
                            </button>

                            {!userRoom?.inRoom && (
                              <button
                                onClick={() => joinRoom(room.id)}
                                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded transition-colors cursor-pointer"
                              >
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
              )}
            </div>
          </div>

          {/* Informations de session */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-5 shadow-xl">
            <h3 className="font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
              Votre session
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <Avatar
                    src={currentUserProfile.profile_picture_url}
                    name={session.user?.name || ''}
                    size="lg"
                  />
                  <div>
                    <p className="text-zinc-200 font-semibold text-base">{session.user?.name}</p>
                    <p className="text-emerald-400 text-xs font-medium flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
                      En ligne
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    // Nettoyer la session et notifier le serveur
                    await fetch('/api/auth/signout-cleanup', { method: 'POST' });
                    // Notifier les autres clients
                    socket?.emit('refresh_online_users');
                    signOut();
                  }}
                  className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap"
                >
                  Déconnexion
                </button>
              </div>

              {(userRoles.includes('config_creator') || userRoles.includes('admin') || userRoles.includes('admin')) && (
                <div className="flex gap-2">
                  {(userRoles.includes('config_creator') || userRoles.includes('admin')) && (
                    <button
                      onClick={() => router.push('/configuration')}
                      className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer hover:shadow-lg"
                    >
                      Configuration
                    </button>
                  )}
                  {userRoles.includes('admin') && (
                    <button
                      onClick={() => router.push('/admin')}
                      className="flex-1 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer hover:shadow-lg"
                    >
                      Administration
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
