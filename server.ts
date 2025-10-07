import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables first
config({ path: resolve(process.cwd(), '.env.local') });

import { createServer as createHttpServer } from 'http';
import { createServer as createHttpsServer } from 'https';
import { readFileSync, existsSync } from 'fs';
import { parse } from 'url';
import next from 'next';
import { Server as SocketIOServer } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type { Server as HTTPSServer } from 'https';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

// ✅ Configuration HTTPS (optionnel - décommenter pour activer)
const useHttps = process.env.USE_HTTPS === 'true';
let httpsOptions: { key: Buffer; cert: Buffer } | null = null;

if (useHttps) {
  try {
    const keyPath = process.env.SSL_KEY_PATH || './certs/privkey.pem';
    const certPath = process.env.SSL_CERT_PATH || './certs/fullchain.pem';

    if (existsSync(keyPath) && existsSync(certPath)) {
      httpsOptions = {
        key: readFileSync(keyPath),
        cert: readFileSync(certPath),
      };
      console.log('✅ HTTPS activé');
    } else {
      console.log('ℹ️  Certificats SSL non trouvés, retour en HTTP');
    }
  } catch (error: any) {
    console.error('❌ Erreur lors du chargement des certificats SSL:', error.message);
    console.log('ℹ️  Retour en HTTP');
  }
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface OnlineUser {
  name: string;
  in_game: boolean;
  profile_picture_url: string | null;
  connected_since: Date;
}

interface RoomMember {
  id: number;
  name: string;
  profile_picture_url: string | null;
  in_game: boolean;
}

interface Vote {
  item_voted: string;
  name: string;
  profile_picture_url: string | null;
  user_id: number;
}

interface GameSession {
  id: number;
  status: string;
  current_duel_index: number;
  duels_data: string;
}

interface Message {
  id: number;
  message: string;
  created_at: Date;
  name: string;
  profile_picture_url: string | null;
}

interface Room {
  id: number;
  name: string;
  created_by: number;
  config_id: number | null;
  creator_name: string;
  member_count: number;
}

// ✅ Dynamic imports after env is loaded
app.prepare().then(async () => {
  const { getPool } = await import('./lib/db');
  const { logger } = await import('./lib/logger');
  const pool = getPool();
  // ✅ Créer le serveur HTTP ou HTTPS selon la config
  const httpServer: HTTPServer | HTTPSServer = httpsOptions
    ? createHttpsServer(httpsOptions, async (req, res) => {
        try {
          const parsedUrl = parse(req.url || '', true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('Error handling request:', err);
          res.statusCode = 500;
          res.end('Internal server error');
        }
      })
    : createHttpServer(async (req, res) => {
        try {
          const parsedUrl = parse(req.url || '', true);
          await handle(req, res, parsedUrl);
        } catch (err) {
          console.error('Error handling request:', err);
          res.statusCode = 500;
          res.end('Internal server error');
        }
      });

  // Initialiser Socket.IO
  const protocol = httpsOptions ? 'https' : 'http';
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || `${protocol}://localhost:${port}`,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', async (socket) => {
    const connectedUsersCount = io.engine.clientsCount;
    logger.socket.connected(socket.id, connectedUsersCount);

    // ✅ Broadcaster les utilisateurs en ligne à tous
    const broadcastOnlineUsers = async () => {
      try {
        const [onlineUsers] = await pool.execute<any[]>(
          `SELECT u.name, u.in_game, u.profile_picture_url, s.created_at as connected_since
           FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.expires > NOW()
           ORDER BY s.created_at DESC`
        );

        io.emit('online_users_update', {
          count: onlineUsers.length,
          users: (onlineUsers as OnlineUser[]).map(u => ({
            name: u.name,
            in_game: u.in_game,
            profile_picture_url: u.profile_picture_url,
            connected_since: u.connected_since,
          })),
        });

        logger.socket.eventEmitted('online_users_update', undefined, onlineUsers.length);
      } catch (error) {
        logger.db.error('broadcastOnlineUsers', error);
      }
    };

    // Rejoindre une room de jeu
    socket.on('join_game_room', async (data: { roomId: number; username: string }) => {
      const { roomId, username } = data;
      const roomName = `game_room_${roomId}`;

      await socket.join(roomName);
      logger.socket.roomJoined(socket.id, roomName, username);

      socket.to(roomName).emit('player_joined', { username });

      // ✅ Émettre la liste des membres à tout le monde
      try {
        const [members] = await pool.execute<any[]>(
          `SELECT u.id, u.name, u.profile_picture_url, u.in_game
           FROM room_members rm
           JOIN users u ON rm.user_id = u.id
           WHERE rm.room_id = ?`,
          [roomId]
        );

        io.to(roomName).emit('room_members_update', {
          roomId,
          members: (members as RoomMember[]).map((m) => ({
            id: m.id,
            name: m.name,
            profilePictureUrl: m.profile_picture_url,
            inGame: m.in_game,
          })),
        });
      } catch (error) {
        console.error('Error fetching room members:', error);
      }
    });

    // Quitter une room de jeu
    socket.on('leave_game_room', async (data: { roomId: number }) => {
      const { roomId } = data;
      const roomName = `game_room_${roomId}`;

      await socket.leave(roomName);
      console.log(`👋 Client a quitté la room ${roomName}`);
    });

    // ✅ OPTIMIZED: Vote émis - Cache data and avoid duplicate queries
    socket.on('vote_cast', async (data: { roomId: number; gameSessionId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;
      let cachedState: any = null;

      const broadcast = async () => {
        const [gameSession] = await pool.execute<any[]>(
          `SELECT id, status, current_duel_index, duels_data FROM game_sessions WHERE id = ?`,
          [data.gameSessionId]
        );

        if (gameSession.length === 0) return null;

        const session = gameSession[0] as GameSession;
        const currentDuelIndex = session.current_duel_index;
        const tournamentData = JSON.parse(session.duels_data);

        const [votes] = await pool.execute<any[]>(
          `SELECT v.item_voted, u.name, u.profile_picture_url, v.user_id FROM votes v
           JOIN users u ON v.user_id = u.id
           WHERE v.game_session_id = ? AND v.duel_index = ?`,
          [data.gameSessionId, currentDuelIndex]
        );

        const [totalPlayers] = await pool.execute<any[]>(
          `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
          [data.roomId]
        );

        const allVoted = votes.length === totalPlayers[0].count;
        const tieBreakers = tournamentData.tieBreakers || [];
        const tieBreaker = tieBreakers.find((tb: any) => tb.duelIndex === currentDuelIndex);

        const voteDetails = (votes as Vote[]).map(v => ({
          userId: v.user_id,
          name: v.name,
          profilePictureUrl: v.profile_picture_url,
          itemVoted: v.item_voted,
        }));

        io.to(roomName).emit('vote_update', {
          votes: votes.length,
          totalPlayers: totalPlayers[0].count,
          allVoted,
          voteDetails,
          tieBreaker: tieBreaker || null,
        });

        logger.socket.eventEmitted('vote_update', roomName, votes.length);

        return {
          allVoted,
          tieBreaker,
          currentDuelIndex,
          status: session.status,
          voteDetails,
          totalPlayers: totalPlayers[0].count
        };
      };

      try {
        // Initial broadcast
        cachedState = await broadcast();
        if (!cachedState) return;

        // ✅ Only re-query if all voted (to check for tiebreaker resolution)
        // Use cached data for immediate broadcast instead of re-querying
        if (cachedState.allVoted) {
          setTimeout(async () => {
            const [gameSession] = await pool.execute<any[]>(
              `SELECT status, current_duel_index, duels_data FROM game_sessions WHERE id = ?`,
              [data.gameSessionId]
            );

            if (gameSession.length === 0) return;

            const session = gameSession[0] as GameSession;
            const currentDuelIndex = session.current_duel_index;
            const tournamentData = JSON.parse(session.duels_data);
            const tieBreakers = tournamentData.tieBreakers || [];
            const tieBreaker = tieBreakers.find((tb: any) => tb.duelIndex === currentDuelIndex);

            // Check if duel advanced
            if (!tieBreaker && currentDuelIndex > data.duelIndex) {
              io.to(roomName).emit('duel_changed', { duelIndex: currentDuelIndex });
              logger.game.duelAdvanced(data.gameSessionId, data.duelIndex, currentDuelIndex);
            }

            // Check if game finished
            if (session.status === 'finished') {
              io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
              logger.game.finished(data.gameSessionId, 'Unknown', 0);
            }

            // ✅ If tiebreaker appeared, re-broadcast with updated info
            if (tieBreaker && !cachedState.tieBreaker) {
              io.to(roomName).emit('vote_update', {
                votes: cachedState.voteDetails.length,
                totalPlayers: cachedState.totalPlayers,
                allVoted: true,
                voteDetails: cachedState.voteDetails,
                tieBreaker,
              });
            }
          }, 500);
        }
      } catch (error) {
        logger.socket.error('vote_cast', error, socket.id);
      }
    });

    // ✅ OPTIMIZED: Tiebreaker continue - Use database trigger/polling instead of arbitrary delay
    socket.on('tiebreaker_continue', async (data: { roomId: number; gameSessionId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        // ✅ Poll for state change instead of arbitrary delay
        // The API route handles the logic, we just need to broadcast the result
        const checkStateAndBroadcast = async (retries = 0): Promise<void> => {
          const [continueCount] = await pool.execute<any[]>(
            'SELECT COUNT(*) as count FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
            [data.gameSessionId, data.duelIndex]
          );

          const count = continueCount[0].count || 0;

          io.to(roomName).emit('tiebreaker_continue_update', {
            continueClicks: count,
            readyToAdvance: count >= 2,
          });

          // Check game state
          const [gameSession] = await pool.execute<any[]>(
            `SELECT id, status, current_duel_index FROM game_sessions WHERE id = ?`,
            [data.gameSessionId]
          );

          if (gameSession.length === 0) return;

          const session = gameSession[0] as GameSession;
          const currentDuelIndex = session.current_duel_index;

          // Duel changed
          if (currentDuelIndex > data.duelIndex) {
            io.to(roomName).emit('duel_changed', { duelIndex: currentDuelIndex });
            logger.game.duelAdvanced(data.gameSessionId, data.duelIndex, currentDuelIndex);
            return; // Done
          }

          // Game finished
          if (session.status === 'finished') {
            io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
            logger.game.finished(data.gameSessionId, 'Unknown', 0);
            return; // Done
          }

          // If count >= 2 but duel hasn't changed yet, retry once after short delay
          // This handles race condition where API is still processing
          if (count >= 2 && retries < 3) {
            setTimeout(() => checkStateAndBroadcast(retries + 1), 200);
          }
        };

        await checkStateAndBroadcast();
      } catch (error) {
        logger.socket.error('tiebreaker_continue', error, socket.id);
      }
    });

    // ✅ OPTIMIZED: Normal continue - Use polling instead of arbitrary delay
    socket.on('normal_continue', async (data: { roomId: number; gameSessionId: number; duelIndex: number }) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        const checkStateAndBroadcast = async (retries = 0): Promise<void> => {
          // Get click count and total players in parallel
          const [[continueCount], [totalPlayers]] = await Promise.all([
            pool.execute<any[]>(
              'SELECT COUNT(*) as count FROM normal_continues WHERE game_session_id = ? AND duel_index = ?',
              [data.gameSessionId, data.duelIndex]
            ),
            pool.execute<any[]>(
              `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
              [data.roomId]
            )
          ]);

          const count = continueCount[0].count || 0;
          const total = totalPlayers[0].count || 0;

          io.to(roomName).emit('normal_continue_update', {
            continueClicks: count,
            totalPlayers: total,
            readyToAdvance: count >= total,
          });

          // Check game state
          const [gameSession] = await pool.execute<any[]>(
            `SELECT id, status, current_duel_index FROM game_sessions WHERE id = ?`,
            [data.gameSessionId]
          );

          if (gameSession.length === 0) return;

          const session = gameSession[0] as GameSession;
          const currentDuelIndex = session.current_duel_index;

          // Duel changed
          if (currentDuelIndex > data.duelIndex) {
            io.to(roomName).emit('duel_changed', { duelIndex: currentDuelIndex });
            logger.game.duelAdvanced(data.gameSessionId, data.duelIndex, currentDuelIndex);
            return; // Done
          }

          // Game finished
          if (session.status === 'finished') {
            io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
            logger.game.finished(data.gameSessionId, 'Unknown', 0);
            return; // Done
          }

          // If all clicked but duel hasn't changed yet, retry after short delay
          if (count >= total && retries < 3) {
            setTimeout(() => checkStateAndBroadcast(retries + 1), 200);
          }
        };

        await checkStateAndBroadcast();
      } catch (error) {
        logger.socket.error('normal_continue', error, socket.id);
      }
    });

    // ✅ OPTIMIZED: Chat - Poll for new messages instead of arbitrary delay
    socket.on('chat_message', async () => {
      try {
        const checkAndBroadcast = async (retries = 0): Promise<void> => {
          const [messages] = await pool.execute<any[]>(
            `SELECT m.id, m.message, m.created_at, u.name, u.profile_picture_url
             FROM messages m
             JOIN users u ON m.user_id = u.id
             ORDER BY m.created_at DESC
             LIMIT 50`
          );

          // If no messages yet and haven't retried too many times, wait and retry
          if (messages.length === 0 && retries < 2) {
            setTimeout(() => checkAndBroadcast(retries + 1), 200);
            return;
          }

          const formattedMessages = (messages as Message[]).reverse().map((msg) => ({
            id: msg.id,
            message: msg.message,
            username: msg.name,
            profile_picture_url: msg.profile_picture_url,
            created_at: msg.created_at,
          }));

          io.emit('chat_update', {
            messages: formattedMessages,
          });
        };

        await checkAndBroadcast();
      } catch (error) {
        logger.socket.error('chat_message', error, socket.id);
      }
    });

    // Partie terminée
    socket.on('game_finished', (data: { roomId: number; gameSessionId: number }) => {
      const roomName = `game_room_${data.roomId}`;
      io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
      console.log(`🏁 Game finished: ${data.gameSessionId}`);
    });

    // Partie annulée par le créateur
    socket.on('game_cancelled', (data: { roomId: number }) => {
      const { roomId } = data;
      const roomSocketName = `game_room_${roomId}`;

      // Notifier tous les membres du salon
      io.to(roomSocketName).emit('game_cancelled', { roomId });

      // Notifier globalement pour mettre à jour la page d'accueil
      io.emit('game_cancelled', { roomId });

      console.log(`🚫 Partie annulée pour le salon ${roomId}`);
    });

    // ✅ Partie démarrée - Rediriger tous les membres du salon
    socket.on('game_started', (data: { roomId: number; roomName: string; gameSessionId: number }) => {
      const { roomId, roomName, gameSessionId } = data;
      const roomSocketName = `game_room_${roomId}`;

      // Broadcaster globalement à tous les clients
      io.emit('game_started', {
        roomId,
        roomName,
        gameSessionId
      });

      logger.game.started(roomId, gameSessionId, 0, 'System');
    });

    // 🎬 Synchronisation vidéo - Play
    socket.on('video_play', (data: { roomId: number; videoIndex: number; timestamp: number }) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_play', {
        videoIndex,
        timestamp
      });

      console.log(`▶️ Play vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Pause
    socket.on('video_pause', (data: { roomId: number; videoIndex: number; timestamp: number }) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_pause', {
        videoIndex,
        timestamp
      });

      console.log(`⏸️ Pause vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Seek (avancer/reculer)
    socket.on('video_seek', (data: { roomId: number; videoIndex: number; timestamp: number }) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_seek', {
        videoIndex,
        timestamp
      });

      console.log(`⏩ Seek vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Vitesse de lecture
    socket.on('video_rate_change', (data: { roomId: number; videoIndex: number; playbackRate: number }) => {
      const { roomId, videoIndex, playbackRate } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_rate_change', {
        videoIndex,
        playbackRate
      });

      console.log(`⚡ Vitesse vidéo ${videoIndex} changée à ${playbackRate}x`);
    });

    // 🚫 Joueur exclu de la partie
    socket.on('player_excluded', async (data: { roomId: number; userId: number; gameSessionId: number }) => {
      const { roomId, userId, gameSessionId } = data;
      const roomName = `game_room_${roomId}`;

      // Notifier tous les joueurs de la room
      io.to(roomName).emit('player_excluded', {
        userId,
        gameSessionId
      });

      logger.game.playerExcluded(gameSessionId, userId, 'GameMaster');
    });

    // ✅ Room créée/supprimée/modifiée - Broadcaster à tous
    socket.on('rooms_changed', async () => {
      try {
        const [rooms] = await pool.execute<any[]>(
          `SELECT r.id, r.name, r.created_by, r.config_id, u.name as creator_name,
                  (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
           FROM rooms r
           JOIN users u ON r.created_by = u.id`
        );

        io.emit('rooms_update', {
          rooms: (rooms as Room[]).map((r) => ({
            id: r.id,
            name: r.name,
            createdBy: r.created_by,
            creatorName: r.creator_name,
            configId: r.config_id,
            memberCount: r.member_count,
          })),
        });

        console.log(`🏠 Rooms update broadcasted (${rooms.length} rooms)`);
      } catch (error) {
        console.error('Error fetching rooms:', error);
      }
    });

    // ✅ OPTIMIZED: Room members changed - Poll instead of arbitrary delay
    socket.on('room_members_changed', async (data: { roomId: number }) => {
      const { roomId } = data;
      try {
        const checkAndBroadcast = async (): Promise<void> => {
          const [members] = await pool.execute<any[]>(
            `SELECT u.id, u.name, u.profile_picture_url, rm.joined_at, u.in_game
             FROM room_members rm
             JOIN users u ON rm.user_id = u.id
             WHERE rm.room_id = ?`,
            [roomId]
          );

          const formattedMembers = (members as any[]).map((m) => ({
            id: m.id,
            name: m.name,
            profile_picture_url: m.profile_picture_url,
            joined_at: m.joined_at,
            in_game: m.in_game,
          }));

          io.emit('room_members_update', {
            roomId,
            members: formattedMembers,
          });
        };

        // Immediate broadcast (API is usually fast enough)
        await checkAndBroadcast();
      } catch (error) {
        logger.socket.error('room_members_changed', error, socket.id);
      }
    });

    // ✅ Événement pour rafraîchir manuellement les utilisateurs en ligne
    socket.on('refresh_online_users', async () => {
      // Délai réduit car la session est créée dans le callback jwt
      await new Promise(r => setTimeout(r, 200));
      await broadcastOnlineUsers();
    });

    socket.on('disconnect', async () => {
      const connectedUsersCount = io.engine.clientsCount;
      logger.socket.disconnected(socket.id, connectedUsersCount);

      // Attendre un peu pour que la session soit nettoyée
      setTimeout(async () => {
        await broadcastOnlineUsers();
      }, 1000);
    });
  });

  httpServer
    .once('error', (err) => {
      logger.system.error('HTTP Server', err);
      process.exit(1);
    })
    .listen(port, () => {
      logger.system.startup(port, process.env.NODE_ENV || 'development');
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.system.shutdown();
    httpServer.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    logger.system.shutdown();
    httpServer.close(() => {
      process.exit(0);
    });
  });
});
