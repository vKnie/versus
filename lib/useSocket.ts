import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Créer la connexion socket une seule fois
    if (!socket) {
      socket = io({
        path: '/socket.io',
        autoConnect: true,
      });

      socket.on('connect', () => {
        console.log('✅ Socket connecté:', socket?.id);
        setIsConnected(true);
      });

      socket.on('disconnect', () => {
        console.log('❌ Socket déconnecté');
        setIsConnected(false);
      });

      socket.on('connect_error', (error) => {
        console.error('Socket error:', error);
        setIsConnected(false);
      });
    }

    return () => {
      // Ne pas déconnecter, garder la connexion active
    };
  }, []);

  return { socket, isConnected };
}

// Hook pour rejoindre une room de jeu
export function useGameRoom(roomId: number | null, username: string) {
  const { socket, isConnected } = useSocket();

  useEffect(() => {
    if (!socket || !isConnected || !roomId) return;

    // Rejoindre la room
    socket.emit('join_game_room', { roomId, username });
    console.log(`🎮 Joined game room ${roomId}`);

    return () => {
      // Quitter la room au démontage
      socket.emit('leave_game_room', { roomId });
      console.log(`👋 Left game room ${roomId}`);
    };
  }, [socket, isConnected, roomId, username]);

  return { socket, isConnected };
}
