'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSocket, useGameRoom } from '@/lib/useSocket';
import ChatSection from '@/components/ChatSection';
import OnlineUsersSection from '@/components/OnlineUsersSection';
import RoomsSection from '@/components/RoomsSection';
import UserSessionSection from '@/components/UserSessionSection';
import { OnlineUser, OnlineUsersResponse, Message, Room, GameConfig, RoomMember } from '@/types';

export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
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
        await response.json();
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

    // Écouter l'annulation de partie
    socket.on('game_cancelled', (data: { roomId: number }) => {
      console.log('🚫 Partie annulée reçue:', data);
      // Rafraîchir l'état pour tous les utilisateurs
      fetchUserRoom();
      checkGameSession();
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
      socket.off('game_cancelled');
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

  // Handler functions for RoomsSection
  const handleStartGame = async () => {
    if (!selectedConfigId) {
      alert('Veuillez sélectionner une configuration de jeu');
      return;
    }

    if (!userRoom?.room?.id) return;

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
  };

  const handleCancelGame = async () => {
    if (!confirm('Êtes-vous sûr de vouloir annuler la partie en cours ? Tous les votes seront perdus.')) {
      return;
    }

    if (!userRoom?.room?.id) return;

    try {
      const response = await fetch('/api/game/cancel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId: userRoom.room.id }),
      });

      if (response.ok) {
        // Notifier via WebSocket que la partie est annulée
        socket?.emit('game_cancelled', { roomId: userRoom.room.id });

        alert('Partie annulée avec succès !');

        // Recharger la page pour rafraîchir complètement l'état
        window.location.reload();
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de l\'annulation de la partie');
      }
    } catch (error) {
      console.error('Erreur lors de l\'annulation de la partie:', error);
    }
  };

  const handleSignOut = async () => {
    // Nettoyer la session et notifier le serveur
    await fetch('/api/auth/signout-cleanup', { method: 'POST' });
    // Notifier les autres clients
    socket?.emit('refresh_online_users');
    signOut();
  };

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
          <ChatSection
            messages={messages}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            onSendMessage={sendMessage}
            sending={sending}
            canSendMessage={canSendMessage}
            cooldownTime={cooldownTime}
            currentUsername={session.user?.name}
          />

          {/* Utilisateurs en ligne */}
          <OnlineUsersSection
            onlineUsers={onlineUsers}
            loading={loading}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Section des salons */}
          <RoomsSection
            rooms={rooms}
            userRoom={userRoom}
            roomMembers={roomMembers}
            gameSession={gameSession}
            gameConfigs={gameConfigs}
            selectedConfigId={selectedConfigId}
            showConfigDropdown={showConfigDropdown}
            selectedRoom={selectedRoom}
            newRoomName={newRoomName}
            creatingRoom={creatingRoom}
            userRoles={userRoles}
            currentUserId={Number(session?.user?.id)}
            socket={socket}
            onSetNewRoomName={setNewRoomName}
            onCreateRoom={createRoom}
            onSelectRoom={setSelectedRoom}
            onJoinRoom={joinRoom}
            onLeaveRoom={leaveRoom}
            onDeleteRoom={deleteRoom}
            onStartGame={handleStartGame}
            onCancelGame={handleCancelGame}
            onKickMember={kickMember}
            onSelectConfig={setSelectedConfigId}
            onToggleConfigDropdown={() => setShowConfigDropdown(!showConfigDropdown)}
            onCloseConfigDropdown={() => setShowConfigDropdown(false)}
          />

          {/* Informations de session */}
          <UserSessionSection
            username={session.user?.name || ''}
            profilePictureUrl={currentUserProfile.profile_picture_url}
            userRoles={userRoles}
            socket={socket}
            onSignOut={handleSignOut}
            onNavigateToConfig={() => router.push('/configuration')}
            onNavigateToAdmin={() => router.push('/admin')}
          />
        </div>
      </div>
    </div>
  );
}
