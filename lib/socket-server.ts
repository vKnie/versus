import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { query, getUserIdByName } from '@/lib/db';

let io: SocketIOServer | null = null;

export function initSocketServer(httpServer: HTTPServer) {
  if (io) {
    return io;
  }

  io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    path: '/api/socket',
  });

  io.on('connection', (socket) => {
    console.log(`✅ Client connecté: ${socket.id}`);

    // Rejoindre une room de jeu
    socket.on('join_game_room', async (data: { roomId: number; username: string }) => {
      const { roomId, username } = data;
      const roomName = `game_room_${roomId}`;

      await socket.join(roomName);
      console.log(`👤 ${username} a rejoint la room ${roomName}`);

      // Notifier les autres joueurs
      socket.to(roomName).emit('player_joined', { username });
    });

    // Quitter une room de jeu
    socket.on('leave_game_room', async (data: { roomId: number }) => {
      const roomName = `game_room_${data.roomId}`;
      await socket.leave(roomName);
    });

    // Vote émis par un joueur
    socket.on('vote_cast', async (data: { roomId: number; gameSessionId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        // Récupérer l'état mis à jour
        const votes: any = await query(
          `SELECT v.item_voted, u.name, u.profile_picture_url, v.user_id
           FROM votes v
           JOIN users u ON v.user_id = u.id
           WHERE v.game_session_id = ? AND v.duel_index = ?`,
          [data.gameSessionId, data.duelIndex]
        );

        const totalPlayers: any = await query(
          `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
          [data.roomId]
        );

        const allVoted = votes.length === totalPlayers[0].count;

        // Broadcaster à tous les joueurs de la room
        io?.to(roomName).emit('vote_update', {
          votes: votes.length,
          totalPlayers: totalPlayers[0].count,
          allVoted,
          voteDetails: votes.map((v: any) => ({
            userId: v.user_id,
            name: v.name,
            profilePictureUrl: v.profile_picture_url,
            itemVoted: v.item_voted,
          })),
        });

        console.log(`📊 Vote update broadcasted to ${roomName}: ${votes.length}/${totalPlayers[0].count}`);
      } catch (error) {
        console.error('Error broadcasting vote:', error);
      }
    });

    // Mise à jour du tiebreaker continue
    socket.on('tiebreaker_continue', async (data: { roomId: number; gameSessionId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        const continueCount: any = await query(
          'SELECT COUNT(*) as count FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
          [data.gameSessionId, data.duelIndex]
        );

        io?.to(roomName).emit('tiebreaker_continue_update', {
          continueClicks: continueCount[0].count || 0,
          readyToAdvance: continueCount[0].count >= 2,
        });

        console.log(`🎲 Tiebreaker continue update: ${continueCount[0].count}/2`);
      } catch (error) {
        console.error('Error broadcasting tiebreaker continue:', error);
      }
    });

    // Nouveau duel démarré
    socket.on('new_duel_started', (data: { roomId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;
      io?.to(roomName).emit('duel_changed', { duelIndex: data.duelIndex });
      console.log(`🆕 New duel started: ${data.duelIndex}`);
    });

    // Chat message
    socket.on('chat_message', async (data: { message: string; username: string }) => {
      try {
        const messages: any = await query(
          `SELECT m.id, m.message, m.created_at, u.name, u.profile_picture_url
           FROM messages m
           JOIN users u ON m.user_id = u.id
           ORDER BY m.created_at DESC
           LIMIT 50`
        );

        io?.emit('chat_update', {
          messages: messages.map((msg: any) => ({
            id: msg.id,
            message: msg.message,
            username: msg.name,
            profilePictureUrl: msg.profile_picture_url,
            createdAt: msg.created_at,
          })),
        });

        console.log(`💬 Chat message from ${data.username}`);
      } catch (error) {
        console.error('Error broadcasting chat:', error);
      }
    });

    // Partie démarrée - broadcaster à tous les membres du salon
    socket.on('game_started', (data: { roomId: number; roomName: string; gameSessionId: number }) => {
      console.log('🎮 [SERVER] Événement game_started reçu:', JSON.stringify(data, null, 2));

      const roomName = `game_room_${data.roomId}`;
      console.log(`🎮 [SERVER] Broadcasting à la room: ${roomName}`);

      // Broadcaster à la room spécifique
      io?.to(roomName).emit('game_started', {
        roomId: data.roomId,
        roomName: data.roomName,
        gameSessionId: data.gameSessionId,
      });

      // Broadcaster aussi globalement pour être sûr que tous les membres reçoivent l'événement
      console.log('🎮 [SERVER] Broadcasting globalement à tous les clients');
      io?.emit('game_started', {
        roomId: data.roomId,
        roomName: data.roomName,
        gameSessionId: data.gameSessionId,
      });

      console.log(`🎮 [SERVER] Game started broadcasted - roomId: ${data.roomId}, roomName: ${data.roomName}, sessionId: ${data.gameSessionId}`);
    });

    // Partie terminée
    socket.on('game_finished', (data: { roomId: number; gameSessionId: number }) => {
      const roomName = `game_room_${data.roomId}`;
      io?.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
      console.log(`🏁 Game finished: ${data.gameSessionId}`);
    });

    socket.on('disconnect', () => {
      console.log(`❌ Client déconnecté: ${socket.id}`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
}
