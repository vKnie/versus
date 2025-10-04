require('dotenv').config({ path: '.env.local' });

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');
const mysql = require('mysql2/promise');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

// ✅ Configuration DB - Les mêmes paramètres que lib/db.ts
// Note: On doit recréer le pool ici car server.js est en CommonJS et ne peut pas importer du TypeScript
// IMPORTANT: Garder la même config que lib/db.ts pour éviter les incohérences
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: parseInt(process.env.DB_PORT || '3306'),
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  idleTimeout: 60000,
  maxIdle: 5,
};

const pool = mysql.createPool(dbConfig);

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  // Initialiser Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || `http://localhost:${port}`,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
  });

  io.on('connection', async (socket) => {
    console.log(`✅ Client connecté: ${socket.id}`);

    // ✅ Broadcaster les utilisateurs en ligne à tous
    const broadcastOnlineUsers = async () => {
      try {
        const [onlineUsers] = await pool.execute(
          `SELECT u.name, u.in_game, u.profile_picture_url, s.created_at as connected_since
           FROM sessions s
           JOIN users u ON s.user_id = u.id
           WHERE s.expires > NOW()
           ORDER BY s.created_at DESC`
        );

        io.emit('online_users_update', {
          count: onlineUsers.length,
          users: onlineUsers.map(u => ({
            name: u.name,
            in_game: u.in_game,
            profile_picture_url: u.profile_picture_url,
            connected_since: u.connected_since,
          })),
        });

        console.log(`👥 Online users broadcasted: ${onlineUsers.length} users`);
      } catch (error) {
        console.error('Error broadcasting online users:', error);
      }
    };

    // Rejoindre une room de jeu
    socket.on('join_game_room', async (data) => {
      const { roomId, username } = data;
      const roomName = `game_room_${roomId}`;

      await socket.join(roomName);
      console.log(`👤 ${username} a rejoint la room ${roomName}`);

      socket.to(roomName).emit('player_joined', { username });

      // ✅ Émettre la liste des membres à tout le monde
      try {
        const [members] = await pool.execute(
          `SELECT u.id, u.name, u.profile_picture_url, u.in_game
           FROM room_members rm
           JOIN users u ON rm.user_id = u.id
           WHERE rm.room_id = ?`,
          [roomId]
        );

        io.to(roomName).emit('room_members_update', {
          roomId,
          members: members.map((m) => ({
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
    socket.on('leave_game_room', async (data) => {
      const { roomId } = data;
      const roomName = `game_room_${roomId}`;

      await socket.leave(roomName);
      console.log(`👋 Client a quitté la room ${roomName}`);
    });

    // Vote émis - broadcaster IMMÉDIATEMENT puis vérifier
    socket.on('vote_cast', async (data) => {
      const roomName = `game_room_${data.roomId}`;

      const broadcast = async (delay = 0) => {
        if (delay > 0) await new Promise(r => setTimeout(r, delay));

        const [gameSession] = await pool.execute(
          `SELECT id, status, current_duel_index, duels_data FROM game_sessions WHERE id = ?`,
          [data.gameSessionId]
        );

        if (gameSession.length === 0) return null;

        const currentDuelIndex = gameSession[0].current_duel_index;
        const tournamentData = JSON.parse(gameSession[0].duels_data);

        const [votes] = await pool.execute(
          `SELECT v.item_voted, u.name, u.profile_picture_url, v.user_id FROM votes v
           JOIN users u ON v.user_id = u.id
           WHERE v.game_session_id = ? AND v.duel_index = ?`,
          [data.gameSessionId, currentDuelIndex]
        );

        const [totalPlayers] = await pool.execute(
          `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
          [data.roomId]
        );

        const allVoted = votes.length === totalPlayers[0].count;
        const tieBreakers = tournamentData.tieBreakers || [];
        const tieBreaker = tieBreakers.find(tb => tb.duelIndex === currentDuelIndex);

        io.to(roomName).emit('vote_update', {
          votes: votes.length,
          totalPlayers: totalPlayers[0].count,
          allVoted,
          voteDetails: votes.map(v => ({
            userId: v.user_id,
            name: v.name,
            profilePictureUrl: v.profile_picture_url,
            itemVoted: v.item_voted,
          })),
          tieBreaker: tieBreaker || null,
        });

        console.log(`📊 ${votes.length}/${totalPlayers[0].count}${tieBreaker ? ' 🎲' : ''}`);

        return { allVoted, tieBreaker, currentDuelIndex, status: gameSession[0].status };
      };

      try {
        // Broadcast immédiat
        const state = await broadcast(0);
        if (!state) return;

        // Si tous votés, re-vérifier après 500ms pour tiebreaker
        if (state.allVoted) {
          setTimeout(async () => {
            const newState = await broadcast(0);
            if (!newState) return;

            if (!newState.tieBreaker && newState.currentDuelIndex > data.duelIndex) {
              io.to(roomName).emit('duel_changed', { duelIndex: newState.currentDuelIndex });
              console.log(`🆕 Duel → ${newState.currentDuelIndex}`);
            }

            if (newState.status === 'finished') {
              io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
              console.log(`🏁 Finished`);
            }
          }, 500);
        }
      } catch (error) {
        console.error('❌ vote_cast:', error);
      }
    });

    // Tiebreaker continue
    socket.on('tiebreaker_continue', async (data) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        // Attendre que l'API enregistre le clic et potentiellement change le duel
        await new Promise(r => setTimeout(r, 300));

        // 1. Compter les clics et broadcaster
        const [continueCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM tiebreaker_continues WHERE game_session_id = ? AND duel_index = ?',
          [data.gameSessionId, data.duelIndex]
        );

        const count = continueCount[0].count || 0;

        io.to(roomName).emit('tiebreaker_continue_update', {
          continueClicks: count,
          readyToAdvance: count >= 2,
        });

        console.log(`🎲 ${count}/2 clics`);

        // 2. TOUJOURS vérifier si le duel a changé (l'API a pu nettoyer les clics)
        const [gameSession] = await pool.execute(
          `SELECT id, status, current_duel_index FROM game_sessions WHERE id = ?`,
          [data.gameSessionId]
        );

        if (gameSession.length === 0) return;

        const currentDuelIndex = gameSession[0].current_duel_index;

        console.log(`🔍 Vérif: duelIndex actuel=${currentDuelIndex}, attendu=${data.duelIndex}`);

        // Si le duel a changé, notifier TOUS les joueurs
        if (currentDuelIndex > data.duelIndex) {
          io.to(roomName).emit('duel_changed', { duelIndex: currentDuelIndex });
          console.log(`✅ DUEL CHANGÉ → ${currentDuelIndex} - Broadcast duel_changed à tous!`);
        }

        // Vérifier si la partie est terminée
        if (gameSession[0].status === 'finished') {
          io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
          console.log(`🏁 PARTIE TERMINÉE`);
        }
      } catch (error) {
        console.error('❌ tiebreaker_continue:', error);
      }
    });

    // Normal continue (sans tiebreaker)
    socket.on('normal_continue', async (data) => {
      const roomName = `game_room_${data.roomId}`;

      try {
        // Attendre que l'API enregistre le clic
        await new Promise(r => setTimeout(r, 300));

        // Compter les clics
        const [continueCount] = await pool.execute(
          'SELECT COUNT(*) as count FROM normal_continues WHERE game_session_id = ? AND duel_index = ?',
          [data.gameSessionId, data.duelIndex]
        );

        // Compter le nombre total de joueurs
        const [totalPlayers] = await pool.execute(
          `SELECT COUNT(*) as count FROM room_members WHERE room_id = ?`,
          [data.roomId]
        );

        const count = continueCount[0].count || 0;
        const total = totalPlayers[0].count || 0;

        io.to(roomName).emit('normal_continue_update', {
          continueClicks: count,
          totalPlayers: total,
          readyToAdvance: count >= total,
        });

        console.log(`👉 ${count}/${total} clics continue`);

        // Vérifier si le duel a changé
        const [gameSession] = await pool.execute(
          `SELECT id, status, current_duel_index FROM game_sessions WHERE id = ?`,
          [data.gameSessionId]
        );

        if (gameSession.length === 0) return;

        const currentDuelIndex = gameSession[0].current_duel_index;

        // Si le duel a changé, notifier tous les joueurs
        if (currentDuelIndex > data.duelIndex) {
          io.to(roomName).emit('duel_changed', { duelIndex: currentDuelIndex });
          console.log(`✅ DUEL CHANGÉ → ${currentDuelIndex}`);
        }

        // Vérifier si la partie est terminée
        if (gameSession[0].status === 'finished') {
          io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
          console.log(`🏁 PARTIE TERMINÉE`);
        }
      } catch (error) {
        console.error('❌ normal_continue:', error);
      }
    });

    // Chat
    socket.on('chat_message', async (data) => {
      try {
        // Attendre que l'API ait enregistré le message
        await new Promise(r => setTimeout(r, 500));

        const [messages] = await pool.execute(
          `SELECT m.id, m.message, m.created_at, u.name, u.profile_picture_url
           FROM messages m
           JOIN users u ON m.user_id = u.id
           ORDER BY m.created_at ASC
           LIMIT 50`
        );

        const formattedMessages = messages.map((msg) => ({
          id: msg.id,
          message: msg.message,
          username: msg.name,
          profile_picture_url: msg.profile_picture_url,
          created_at: msg.created_at,
        }));

        io.emit('chat_update', {
          messages: formattedMessages,
        });
      } catch (error) {
        console.error('❌ chat_message:', error);
      }
    });

    // Partie terminée
    socket.on('game_finished', (data) => {
      const roomName = `game_room_${data.roomId}`;
      io.to(roomName).emit('game_ended', { gameSessionId: data.gameSessionId });
      console.log(`🏁 Game finished: ${data.gameSessionId}`);
    });

    // Partie annulée par le créateur
    socket.on('game_cancelled', (data) => {
      const { roomId } = data;
      const roomSocketName = `game_room_${roomId}`;

      // Notifier tous les membres du salon
      io.to(roomSocketName).emit('game_cancelled', { roomId });

      // Notifier globalement pour mettre à jour la page d'accueil
      io.emit('game_cancelled', { roomId });

      console.log(`🚫 Partie annulée pour le salon ${roomId}`);
    });

    // ✅ Partie démarrée - Rediriger tous les membres du salon
    socket.on('game_started', (data) => {
      const { roomId, roomName, gameSessionId } = data;
      const roomSocketName = `game_room_${roomId}`;

      // Broadcaster globalement à tous les clients
      io.emit('game_started', {
        roomId,
        roomName,
        gameSessionId
      });

      console.log(`🎮 Partie démarrée: ${roomName} (session ${gameSessionId})`);
    });

    // 🎬 Synchronisation vidéo - Play
    socket.on('video_play', (data) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_play', {
        videoIndex,
        timestamp
      });

      console.log(`▶️ Play vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Pause
    socket.on('video_pause', (data) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_pause', {
        videoIndex,
        timestamp
      });

      console.log(`⏸️ Pause vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Seek (avancer/reculer)
    socket.on('video_seek', (data) => {
      const { roomId, videoIndex, timestamp } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_seek', {
        videoIndex,
        timestamp
      });

      console.log(`⏩ Seek vidéo ${videoIndex} à ${timestamp}s`);
    });

    // 🎬 Synchronisation vidéo - Vitesse de lecture
    socket.on('video_rate_change', (data) => {
      const { roomId, videoIndex, playbackRate } = data;
      const roomName = `game_room_${roomId}`;

      io.to(roomName).emit('video_rate_change', {
        videoIndex,
        playbackRate
      });

      console.log(`⚡ Vitesse vidéo ${videoIndex} changée à ${playbackRate}x`);
    });

    // ✅ Room créée/supprimée/modifiée - Broadcaster à tous
    socket.on('rooms_changed', async () => {
      try {
        const [rooms] = await pool.execute(
          `SELECT r.id, r.name, r.created_by, r.config_id, u.name as creator_name,
                  (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
           FROM rooms r
           JOIN users u ON r.created_by = u.id`
        );

        io.emit('rooms_update', {
          rooms: rooms.map((r) => ({
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

    // ✅ Membre a rejoint ou quitté un salon - Mettre à jour les membres
    socket.on('room_members_changed', async (data) => {
      const { roomId } = data;
      try {
        // Attendre que l'API ait terminé l'insertion/suppression
        await new Promise(r => setTimeout(r, 300));

        const [members] = await pool.execute(
          `SELECT u.id, u.name, u.profile_picture_url, rm.joined_at, u.in_game
           FROM room_members rm
           JOIN users u ON rm.user_id = u.id
           WHERE rm.room_id = ?`,
          [roomId]
        );

        const formattedMembers = members.map((m) => ({
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
      } catch (error) {
        console.error('❌ room_members_changed:', error);
      }
    });

    // ✅ Événement pour rafraîchir manuellement les utilisateurs en ligne
    socket.on('refresh_online_users', async () => {
      // Délai réduit car la session est créée dans le callback jwt
      await new Promise(r => setTimeout(r, 200));
      await broadcastOnlineUsers();
    });

    socket.on('disconnect', async () => {
      console.log(`❌ Client déconnecté: ${socket.id}`);

      // Attendre un peu pour que la session soit nettoyée
      setTimeout(async () => {
        await broadcastOnlineUsers();
      }, 1000);
    });
  });

  httpServer
    .once('error', (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
      console.log(`> Socket.IO server running`);
    });
});
