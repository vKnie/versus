'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import Avatar from '@/components/Avatar';
import { useGameRoom } from '@/lib/useSocket';

interface VoteDetail {
  userId: number;
  name: string;
  profilePictureUrl?: string | null;
  itemVoted: string;
}

interface TieBreaker {
  duelIndex: number;
  winner: string;
  item1: string;
  item2: string;
  coinFlip: 'heads' | 'tails';
  votes: number;
}

interface ProposedByUser {
  name: string;
  profilePictureUrl?: string | null;
}

interface GameState {
  gameSessionId: number;
  status: string;
  currentDuelIndex: number;
  totalDuels: number;
  currentDuel: {
    item1: {
      name: string;
      youtubeLink: string;
      proposedBy: ProposedByUser[];
    };
    item2: {
      name: string;
      youtubeLink: string;
      proposedBy: ProposedByUser[];
    };
  };
  votes: number;
  voteDetails: VoteDetail[];
  totalPlayers: number;
  hasVoted: boolean;
  userVote: string | null;
  videoStartTime: string | null;
  allVoted: boolean;
  tieBreaker: TieBreaker | null;
  continueClicks?: number;
  userHasContinued?: boolean;
  isGameMaster: boolean;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export default function GamePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const roomName = params.roomName as string;

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [roomId, setRoomId] = useState<number | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingVote, setPendingVote] = useState<string | null>(null);
  const [showCoinFlip, setShowCoinFlip] = useState(false);
  const [coinFlipping, setCoinFlipping] = useState(false);
  const [showContinueButton, setShowContinueButton] = useState(false);
  const [continueButtonEnabled, setContinueButtonEnabled] = useState(false);
  const [clickingContinue, setClickingContinue] = useState(false);
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  const [normalContinueClicks, setNormalContinueClicks] = useState(0);

  const player1Ref = useRef<any>(null);
  const player2Ref = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);
  const [globalVolume, setGlobalVolume] = useState(100);

  // ✅ WebSocket - Connexion à la game room
  const { socket, isConnected } = useGameRoom(roomId, session?.user?.name || 'Anonymous');

  // Charger l'API YouTube
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        setYtReady(true);
      };
    } else {
      setYtReady(true);
    }
  }, []);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    // Récupérer le roomId depuis le nom
    fetchRoomId();
  }, [session, status, router, roomName]);

  const fetchRoomId = async () => {
    try {
      const response = await fetch('/api/rooms/list');
      if (response.ok) {
        const rooms = await response.json();
        const room = rooms.find((r: any) => r.name === decodeURIComponent(roomName));
        if (room) {
          setRoomId(room.id);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la récupération du salon:', error);
    }
  };

  // ✅ WebSocket - Écouter les mises à jour en temps réel
  useEffect(() => {
    if (!socket || !roomId) return;

    // Mise à jour des votes en temps réel
    socket.on('vote_update', (data: {
      votes: number;
      totalPlayers: number;
      allVoted: boolean;
      voteDetails: VoteDetail[];
      tieBreaker?: TieBreaker | null;
    }) => {
      console.log('📊 Vote update reçu:', data);
      setGameState((prev: any) => prev ? ({
        ...prev,
        votes: data.votes,
        totalPlayers: data.totalPlayers,
        allVoted: data.allVoted,
        voteDetails: data.voteDetails,
        tieBreaker: data.tieBreaker !== undefined ? data.tieBreaker : prev.tieBreaker,
      }) : prev);
    });

    // Changement de duel
    socket.on('duel_changed', (data: { duelIndex: number }) => {
      console.log('✅ CLIENT REÇOIT duel_changed:', data.duelIndex);
      console.log('🔄 Fermeture popup et rechargement état...');

      // Réinitialiser l'UI IMMÉDIATEMENT
      setShowCoinFlip(false);
      setShowContinueButton(false);
      setContinueButtonEnabled(false);
      setShowResultsPanel(false);
      setNormalContinueClicks(0);

      // Recharger l'état complet
      fetchGameState();

      console.log('✅ Popup fermée, état rechargé');
    });

    // Mise à jour tiebreaker continue
    socket.on('tiebreaker_continue_update', (data: {
      continueClicks: number;
      readyToAdvance: boolean;
    }) => {
      console.log('🎲 Tiebreaker update:', data);
      setGameState((prev: any) => prev ? ({
        ...prev,
        continueClicks: data.continueClicks,
      }) : prev);

      if (data.readyToAdvance) {
        // 2 personnes ont cliqué, préparer le changement
        setTimeout(() => {
          fetchGameState();
        }, 500);
      }
    });

    // Mise à jour continue normal (sans tiebreaker)
    socket.on('normal_continue_update', (data: {
      continueClicks: number;
      totalPlayers: number;
      readyToAdvance: boolean;
    }) => {
      console.log('👉 Normal continue update:', data);
      setNormalContinueClicks(data.continueClicks);

      if (data.readyToAdvance) {
        // Tous les joueurs ont cliqué, préparer le changement
        setTimeout(() => {
          fetchGameState();
        }, 500);
      }
    });

    // Partie terminée
    socket.on('game_ended', (data: { gameSessionId: number }) => {
      console.log('🏁 Partie terminée:', data.gameSessionId);
      router.push(`/results/${data.gameSessionId}`);
    });

    // Un joueur a rejoint
    socket.on('player_joined', (data: { username: string }) => {
      console.log('👤 Joueur rejoint:', data.username);
    });

    // 🎬 Synchronisation vidéo - Play
    socket.on('video_play', (data: { videoIndex: number; timestamp: number }) => {
      const player = data.videoIndex === 1 ? player1Ref.current : player2Ref.current;
      if (!player) return;

      if (typeof player.seekTo === 'function' && typeof player.playVideo === 'function') {
        player.seekTo(data.timestamp, true);
        setTimeout(() => {
          player.playVideo();
          // Vérifier et réessayer si nécessaire
          setTimeout(() => {
            if (player.getPlayerState && player.getPlayerState() !== 1) {
              player.playVideo();
            }
          }, 200);
        }, 150);
      }
    });

    // 🎬 Synchronisation vidéo - Pause
    socket.on('video_pause', (data: { videoIndex: number; timestamp: number }) => {
      const player = data.videoIndex === 1 ? player1Ref.current : player2Ref.current;
      if (!player) return;

      if (typeof player.seekTo === 'function' && typeof player.pauseVideo === 'function') {
        player.seekTo(data.timestamp, true);
        setTimeout(() => player.pauseVideo(), 150);
      }
    });

    // 🎬 Synchronisation vidéo - Seek
    socket.on('video_seek', (data: { videoIndex: number; timestamp: number }) => {
      const player = data.videoIndex === 1 ? player1Ref.current : player2Ref.current;
      if (!player) return;

      if (typeof player.seekTo === 'function') {
        player.seekTo(data.timestamp, true);
      }
    });

    // 🎬 Synchronisation vidéo - Vitesse
    socket.on('video_rate_change', (data: { videoIndex: number; playbackRate: number }) => {
      const player = data.videoIndex === 1 ? player1Ref.current : player2Ref.current;
      if (!player) return;

      if (typeof player.setPlaybackRate === 'function') {
        player.setPlaybackRate(data.playbackRate);
      }
    });

    // Nettoyage
    return () => {
      socket.off('vote_update');
      socket.off('duel_changed');
      socket.off('tiebreaker_continue_update');
      socket.off('normal_continue_update');
      socket.off('game_ended');
      socket.off('player_joined');
      socket.off('video_play');
      socket.off('video_pause');
      socket.off('video_seek');
      socket.off('video_rate_change');
    };
  }, [socket, roomId, router]);

  // ✅ Chargement initial seulement (pas de polling)
  useEffect(() => {
    if (!roomId) return;
    fetchGameState();
  }, [roomId]);

  // Initialiser les players YouTube quand le duel change
  useEffect(() => {
    if (!ytReady || !gameState?.currentDuel) return;
    initializePlayers(gameState.currentDuel);
  }, [ytReady, gameState?.currentDuelIndex]);

  // Afficher l'animation de pile ou face quand tous ont voté et qu'il y a égalité
  useEffect(() => {
    if (gameState?.allVoted && gameState?.tieBreaker && !showCoinFlip) {
      // Attendre 1 seconde avant d'afficher l'animation
      setTimeout(() => {
        setShowCoinFlip(true);
        setCoinFlipping(true);

        // Animation de flip pendant 3 secondes
        setTimeout(() => {
          setCoinFlipping(false);

          // Afficher le bouton "Continuer" après 6 secondes (3s animation + 3s délai)
          setTimeout(() => {
            setShowContinueButton(true);
            // Débloquer le bouton après 6 secondes au total (encore 3 secondes)
            setTimeout(() => {
              setContinueButtonEnabled(true);
            }, 3000);
          }, 3000);
        }, 3000);
      }, 1000);
    }

    // Afficher le panneau récapitulatif quand tous ont voté (sans égalité)
    if (gameState?.allVoted && !gameState?.tieBreaker && !showResultsPanel) {
      console.log('🎯 Affichage du panneau récapitulatif:', {
        allVoted: gameState.allVoted,
        tieBreaker: gameState.tieBreaker,
        showResultsPanel
      });
      setTimeout(() => {
        setShowResultsPanel(true);
        setNormalContinueClicks(0);
        // Activer le bouton après 2 secondes
        setTimeout(() => {
          setContinueButtonEnabled(true);
        }, 2000);
      }, 500);
    }

    // Réinitialiser quand on change de duel
    if (gameState && !gameState.allVoted) {
      setShowCoinFlip(false);
      setCoinFlipping(false);
      setShowContinueButton(false);
      setContinueButtonEnabled(false);
      setShowResultsPanel(false);
      setNormalContinueClicks(0);
    }
  }, [gameState?.allVoted, gameState?.tieBreaker, gameState?.currentDuelIndex]);

  const fetchGameState = async () => {
    if (!roomId) return;

    try {
      const response = await fetch(`/api/game/state?roomId=${roomId}`);
      if (response.ok) {
        const state = await response.json();

        // Si la partie est terminée, rediriger vers les résultats
        if (state.status === 'finished') {
          router.push(`/results/${state.gameSessionId}`);
          return;
        }

        setGameState(state);
      } else {
        // Pas de partie en cours, rediriger
        router.push('/');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'état du jeu:', error);
    } finally {
      setLoading(false);
    }
  };

  const extractYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  const initializePlayers = (duel: any) => {
    // Nettoyer les anciens players avant d'en créer de nouveaux (fix memory leak)
    if (player1Ref.current) {
      try {
        player1Ref.current.destroy();
      } catch (e) {
        console.error('Error destroying player1:', e);
      }
      player1Ref.current = null;
    }
    if (player2Ref.current) {
      try {
        player2Ref.current.destroy();
      } catch (e) {
        console.error('Error destroying player2:', e);
      }
      player2Ref.current = null;
    }

    const videoId1 = extractYouTubeId(duel.item1.youtubeLink);
    const videoId2 = extractYouTubeId(duel.item2.youtubeLink);

    // Écouteurs pour synchronisation automatique (Maître du jeu uniquement)
    const setupSyncListeners = (player: any, videoIndex: number) => {
      if (!gameState?.isGameMaster) return;

      let lastState = -1;

      const onStateChange = (event: any) => {
        const state = event.data;
        const currentTime = player.getCurrentTime ? player.getCurrentTime() : 0;

        // 1 = playing, 2 = paused
        if (state === 1 && lastState !== 1) {
          socket?.emit('video_play', { roomId, videoIndex, timestamp: currentTime });
        } else if (state === 2 && lastState !== 2) {
          socket?.emit('video_pause', { roomId, videoIndex, timestamp: currentTime });
        }

        lastState = state;
      };

      player.addEventListener('onStateChange', onStateChange);
    };

    if (videoId1 && window.YT && window.YT.Player) {
      player1Ref.current = new window.YT.Player('player1', {
        height: '100%',
        width: '100%',
        videoId: videoId1,
        playerVars: {
          autoplay: 0,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            console.log('✅ Player 1 prêt');

            // Configurer les écouteurs de synchronisation
            setupSyncListeners(event.target, 1);

            // Pour les non-maîtres, mettre en pause au démarrage
            if (!gameState?.isGameMaster) {
              event.target.pauseVideo();
            }
          }
        }
      });
    }

    if (videoId2 && window.YT && window.YT.Player) {
      player2Ref.current = new window.YT.Player('player2', {
        height: '100%',
        width: '100%',
        videoId: videoId2,
        playerVars: {
          autoplay: 0,
          mute: 1,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          enablejsapi: 1,
        },
        events: {
          onReady: (event: any) => {
            console.log('✅ Player 2 prêt');

            // Configurer les écouteurs de synchronisation
            setupSyncListeners(event.target, 2);

            // Pour les non-maîtres, mettre en pause au démarrage
            if (!gameState?.isGameMaster) {
              event.target.pauseVideo();
            }
          }
        }
      });
    }
  };

  const handleVoteClick = (itemName: string) => {
    if (!gameState || voting || gameState.hasVoted) return;
    setPendingVote(itemName);
    setShowConfirmDialog(true);
  };

  const confirmVote = async () => {
    if (!gameState || !pendingVote || voting) return;

    setVoting(true);
    setShowConfirmDialog(false);

    try {
      const response = await fetch('/api/game/vote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
          itemVoted: pendingVote,
        }),
      });

      if (response.ok) {
        // Mettre à jour l'état local immédiatement
        setGameState((prev: any) => prev ? ({
          ...prev,
          hasVoted: true,
          userVote: pendingVote,
          votes: prev.votes + 1,
        }) : prev);

        // ✅ Émettre événement WebSocket pour notification instantanée
        socket?.emit('vote_cast', {
          roomId,
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
        });
      }
    } catch (error) {
      console.error('Erreur lors du vote:', error);
    } finally {
      setVoting(false);
      setPendingVote(null);
    }
  };

  const cancelVote = () => {
    setShowConfirmDialog(false);
    setPendingVote(null);
  };

  const handleContinueClick = async () => {
    if (!gameState || !continueButtonEnabled || clickingContinue || gameState.userHasContinued) return;

    setClickingContinue(true);

    try {
      const response = await fetch('/api/game/tiebreaker-continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Mettre à jour l'état local immédiatement
        setGameState((prev: any) => prev ? ({
          ...prev,
          continueClicks: data.continueClicks,
          userHasContinued: true,
        }) : prev);

        // ✅ Émettre événement WebSocket pour synchronisation temps réel
        socket?.emit('tiebreaker_continue', {
          roomId,
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
        });

        // Si au moins 2 personnes ont cliqué, on attend l'événement 'duel_changed' du WebSocket
        // pour fermer le popup et passer au duel suivant
      }
    } catch (error) {
      console.error('Erreur lors du clic Continuer:', error);
    } finally {
      setClickingContinue(false);
    }
  };

  const handleNormalContinue = async () => {
    if (!gameState || !continueButtonEnabled || clickingContinue) return;

    setClickingContinue(true);

    try {
      const response = await fetch('/api/game/normal-continue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
        }),
      });

      if (response.ok) {
        const data = await response.json();

        // Désactiver le bouton après le clic
        setContinueButtonEnabled(false);

        // ✅ Émettre événement WebSocket pour synchronisation temps réel
        socket?.emit('normal_continue', {
          roomId,
          gameSessionId: gameState.gameSessionId,
          duelIndex: gameState.currentDuelIndex,
        });

        // Le WebSocket enverra l'événement 'duel_changed' quand tous auront cliqué
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors du clic Continuer');
        setContinueButtonEnabled(true);
      }
    } catch (error) {
      console.error('Erreur lors du clic Continuer:', error);
      setContinueButtonEnabled(true);
    } finally {
      setClickingContinue(false);
    }
  };

  // 🔊 Contrôle du volume global (pour tout le monde)
  const handleGlobalVolumeChange = (volume: number) => {
    setGlobalVolume(volume);

    // Appliquer le volume aux deux players et unmute si volume > 0
    if (player1Ref.current && typeof player1Ref.current.setVolume === 'function') {
      player1Ref.current.setVolume(volume);
      if (volume > 0 && typeof player1Ref.current.unMute === 'function') {
        player1Ref.current.unMute();
      }
    }
    if (player2Ref.current && typeof player2Ref.current.setVolume === 'function') {
      player2Ref.current.setVolume(volume);
      if (volume > 0 && typeof player2Ref.current.unMute === 'function') {
        player2Ref.current.unMute();
      }
    }
  };

  // Nettoyer les players lors du démontage du composant
  useEffect(() => {
    return () => {
      if (player1Ref.current) {
        try {
          player1Ref.current.destroy();
        } catch (e) {
          console.error('Error destroying player1:', e);
        }
        player1Ref.current = null;
      }
      if (player2Ref.current) {
        try {
          player2Ref.current.destroy();
        } catch (e) {
          console.error('Error destroying player2:', e);
        }
        player2Ref.current = null;
      }
    };
  }, []); // Seulement au démontage du composant

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Chargement...</div>
      </div>
    );
  }

  if (!session || !gameState) {
    return null;
  }

  if (gameState.status === 'finished') {
    // Rediriger vers la page des résultats
    router.push(`/results/${gameState.gameSessionId}`);
    return null;
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      {/* Note: Les overlays YouTube ne peuvent pas être masqués via CSS externe car ils sont dans une iframe avec CORS.
          La couche de protection transparente empêche tous les clics, rendant les overlays inutilisables. */}
      <style jsx global>{`
        /* Cacher le curseur pointer sur les vidéos pour montrer qu'elles ne sont pas cliquables */
        #player1, #player2 {
          cursor: default !important;
        }
        #player1 *, #player2 * {
          cursor: default !important;
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-zinc-200 break-words">{decodeURIComponent(roomName)}</h1>
            <p className="text-sm text-zinc-500">
              Duel {gameState.currentDuelIndex + 1} / {gameState.totalDuels}
            </p>
          </div>
          <div className="flex flex-col sm:items-end gap-2">
            <div className="sm:text-right">
              <p className="text-sm text-zinc-400">
                Votes: {gameState.votes} / {gameState.totalPlayers}
              </p>
              {gameState.allVoted && (
                <p className="text-sm text-emerald-400">En attente du prochain duel...</p>
              )}
            </div>
            {/* Contrôle de volume global */}
            <div className="bg-zinc-800/50 px-4 py-2 rounded-lg border border-zinc-700/50">
              <div className="flex items-center gap-3 min-w-[200px]">
                <span className="text-zinc-400 text-sm">🔊</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={globalVolume}
                  onChange={(e) => handleGlobalVolumeChange(parseInt(e.target.value))}
                  className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                  title="Volume global"
                />
                <span className="text-zinc-400 text-xs w-8 text-right">{globalVolume}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Duels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Item 1 */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="aspect-video bg-black relative">
              <div id="player1" className="w-full h-full"></div>
              {/* Couche transparente pour bloquer les clics sur la vidéo */}
              <div className="absolute inset-0 pointer-events-auto bg-transparent"></div>
              {gameState.isGameMaster && (
                <div className="absolute top-2 left-2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 z-10 pointer-events-none">
                  <span>👑</span> Maître du Jeu
                </div>
              )}
            </div>

            {/* Contrôles vidéo pour le maître du jeu */}
            {gameState.isGameMaster && (
              <div className="bg-zinc-800/50 p-3 border-b border-zinc-700/50">
                <div className="flex flex-wrap gap-2 items-center justify-center">
                  <button
                    onClick={() => {
                      const player = player1Ref.current;
                      if (player && player.getCurrentTime && player.seekTo) {
                        const currentTime = player.getCurrentTime();
                        const newTime = Math.max(0, currentTime - 10);
                        player.seekTo(newTime, true);
                        socket?.emit('video_seek', { roomId, videoIndex: 1, timestamp: newTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Reculer de 10s"
                  >
                    ⏪ -10s
                  </button>
                  <button
                    onClick={() => {
                      const player = player1Ref.current;
                      if (player && player.getCurrentTime && player.pauseVideo) {
                        const currentTime = player.getCurrentTime();
                        player.pauseVideo();
                        socket?.emit('video_pause', { roomId, videoIndex: 1, timestamp: currentTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Pause"
                  >
                    ⏸️ Pause
                  </button>
                  <button
                    onClick={() => {
                      const player = player1Ref.current;
                      if (player && player.getCurrentTime && player.playVideo) {
                        const currentTime = player.getCurrentTime();
                        player.playVideo();
                        socket?.emit('video_play', { roomId, videoIndex: 1, timestamp: currentTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Lecture"
                  >
                    ▶️ Play
                  </button>
                  <button
                    onClick={() => {
                      const player = player1Ref.current;
                      if (player && player.getCurrentTime && player.seekTo) {
                        const currentTime = player.getCurrentTime();
                        const newTime = currentTime + 10;
                        player.seekTo(newTime, true);
                        socket?.emit('video_seek', { roomId, videoIndex: 1, timestamp: newTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Avancer de 10s"
                  >
                    ⏩ +10s
                  </button>
                  <select
                    onChange={(e) => {
                      const player = player1Ref.current;
                      const rate = parseFloat(e.target.value);
                      if (player && player.setPlaybackRate) {
                        player.setPlaybackRate(rate);
                        socket?.emit('video_rate_change', { roomId, videoIndex: 1, playbackRate: rate });
                      }
                    }}
                    className="px-2 py-1.5 bg-zinc-700 text-white text-xs rounded cursor-pointer"
                    defaultValue="1"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
              </div>
            )}

            <div className="p-6">
              <h2 className="text-xl font-semibold text-zinc-200 mb-2">
                {gameState.currentDuel.item1.name}
              </h2>
              <div className="mb-4">
                <p className="text-xs text-zinc-400 mb-2">Proposé par :</p>
                <div className="flex flex-wrap gap-2">
                  {gameState.currentDuel.item1.proposedBy.map((person, i) => (
                    <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded-full pr-2 py-0.5">
                      <Avatar src={person.profilePictureUrl} name={person.name} size="xs" />
                      <span className="text-xs text-zinc-300">{person.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleVoteClick(gameState.currentDuel.item1.name)}
                disabled={gameState.hasVoted || voting}
                className={`w-full px-6 py-3 font-medium rounded-lg transition-colors cursor-pointer ${
                  gameState.userVote === gameState.currentDuel.item1.name
                    ? 'bg-emerald-600 text-white'
                    : gameState.hasVoted
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {gameState.userVote === gameState.currentDuel.item1.name
                  ? 'Voté ✓'
                  : gameState.hasVoted
                  ? 'Déjà voté'
                  : 'Voter pour cet item'}
              </button>
            </div>
          </div>

          {/* Item 2 */}
          <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl overflow-hidden">
            <div className="aspect-video bg-black relative">
              <div id="player2" className="w-full h-full"></div>
              {/* Couche transparente pour bloquer les clics sur la vidéo */}
              <div className="absolute inset-0 pointer-events-auto bg-transparent"></div>
              {gameState.isGameMaster && (
                <div className="absolute top-2 left-2 bg-amber-600 text-white text-xs px-2 py-1 rounded-full font-medium flex items-center gap-1 z-10 pointer-events-none">
                  <span>👑</span> Maître du Jeu
                </div>
              )}
            </div>

            {/* Contrôles vidéo pour le maître du jeu */}
            {gameState.isGameMaster && (
              <div className="bg-zinc-800/50 p-3 border-b border-zinc-700/50">
                <div className="flex flex-wrap gap-2 items-center justify-center">
                  <button
                    onClick={() => {
                      const player = player2Ref.current;
                      if (player && player.getCurrentTime && player.seekTo) {
                        const currentTime = player.getCurrentTime();
                        const newTime = Math.max(0, currentTime - 10);
                        player.seekTo(newTime, true);
                        socket?.emit('video_seek', { roomId, videoIndex: 2, timestamp: newTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Reculer de 10s"
                  >
                    ⏪ -10s
                  </button>
                  <button
                    onClick={() => {
                      const player = player2Ref.current;
                      if (player && player.getCurrentTime && player.pauseVideo) {
                        const currentTime = player.getCurrentTime();
                        player.pauseVideo();
                        socket?.emit('video_pause', { roomId, videoIndex: 2, timestamp: currentTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Pause"
                  >
                    ⏸️ Pause
                  </button>
                  <button
                    onClick={() => {
                      const player = player2Ref.current;
                      if (player && player.getCurrentTime && player.playVideo) {
                        const currentTime = player.getCurrentTime();
                        player.playVideo();
                        socket?.emit('video_play', { roomId, videoIndex: 2, timestamp: currentTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Lecture"
                  >
                    ▶️ Play
                  </button>
                  <button
                    onClick={() => {
                      const player = player2Ref.current;
                      if (player && player.getCurrentTime && player.seekTo) {
                        const currentTime = player.getCurrentTime();
                        const newTime = currentTime + 10;
                        player.seekTo(newTime, true);
                        socket?.emit('video_seek', { roomId, videoIndex: 2, timestamp: newTime });
                      }
                    }}
                    className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded transition-colors cursor-pointer"
                    title="Avancer de 10s"
                  >
                    ⏩ +10s
                  </button>
                  <select
                    onChange={(e) => {
                      const player = player2Ref.current;
                      const rate = parseFloat(e.target.value);
                      if (player && player.setPlaybackRate) {
                        player.setPlaybackRate(rate);
                        socket?.emit('video_rate_change', { roomId, videoIndex: 2, playbackRate: rate });
                      }
                    }}
                    className="px-2 py-1.5 bg-zinc-700 text-white text-xs rounded cursor-pointer"
                    defaultValue="1"
                  >
                    <option value="0.5">0.5x</option>
                    <option value="1">1x</option>
                    <option value="1.25">1.25x</option>
                    <option value="1.5">1.5x</option>
                    <option value="2">2x</option>
                  </select>
                </div>
              </div>
            )}

            <div className="p-6">
              <h2 className="text-xl font-semibold text-zinc-200 mb-2">
                {gameState.currentDuel.item2.name}
              </h2>
              <div className="mb-4">
                <p className="text-xs text-zinc-400 mb-2">Proposé par :</p>
                <div className="flex flex-wrap gap-2">
                  {gameState.currentDuel.item2.proposedBy.map((person, i) => (
                    <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded-full pr-2 py-0.5">
                      <Avatar src={person.profilePictureUrl} name={person.name} size="xs" />
                      <span className="text-xs text-zinc-300">{person.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={() => handleVoteClick(gameState.currentDuel.item2.name)}
                disabled={gameState.hasVoted || voting}
                className={`w-full px-6 py-3 font-medium rounded-lg transition-colors cursor-pointer ${
                  gameState.userVote === gameState.currentDuel.item2.name
                    ? 'bg-emerald-600 text-white'
                    : gameState.hasVoted
                    ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white'
                }`}
              >
                {gameState.userVote === gameState.currentDuel.item2.name
                  ? 'Voté ✓'
                  : gameState.hasVoted
                  ? 'Déjà voté'
                  : 'Voter pour cet item'}
              </button>
            </div>
          </div>
        </div>

        {/* Dialog de confirmation de vote */}
        {showConfirmDialog && pendingVote && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-zinc-200 mb-4">Confirmer votre vote</h3>
              <p className="text-zinc-400 mb-6">
                Êtes-vous sûr de vouloir voter pour :<br />
                <span className="text-purple-400 font-semibold text-lg">{pendingVote}</span> ?
              </p>
              <p className="text-xs text-zinc-500 mb-6">
                ⚠️ Vous ne pourrez pas changer votre vote une fois confirmé.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={cancelVote}
                  className="flex-1 px-4 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 font-medium rounded-lg transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  onClick={confirmVote}
                  disabled={voting}
                  className="flex-1 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg transition-colors cursor-pointer"
                >
                  {voting ? 'Envoi...' : 'Confirmer le vote'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Animation de Pile ou Face */}
        {showCoinFlip && gameState?.tieBreaker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-200 mb-1">
                  Tie Breaker
                </h3>
                <p className="text-zinc-400 text-xs sm:text-sm">
                  Duel {gameState.currentDuelIndex + 1} - Égalité {gameState.tieBreaker.votes}-{gameState.tieBreaker.votes}
                </p>
              </div>

              {/* Les deux items en compétition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
                  !coinFlipping && gameState.tieBreaker.winner === gameState.tieBreaker.item1
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-700/50'
                }`}>
                  <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
                    {gameState.tieBreaker.item1}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">
                      {gameState.tieBreaker.votes} {gameState.tieBreaker.votes > 1 ? 'votes' : 'vote'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gameState.voteDetails
                        .filter(v => v.itemVoted === gameState.tieBreaker?.item1)
                        .map((voter) => (
                          <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                            <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                            <span className="text-xs text-zinc-300">{voter.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {!coinFlipping && gameState.tieBreaker.winner === gameState.tieBreaker.item1 && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-emerald-400">✓ Gagnant</span>
                    </div>
                  )}
                </div>
                <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
                  !coinFlipping && gameState.tieBreaker.winner === gameState.tieBreaker.item2
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-700/50'
                }`}>
                  <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
                    {gameState.tieBreaker.item2}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">
                      {gameState.tieBreaker.votes} {gameState.tieBreaker.votes > 1 ? 'votes' : 'vote'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gameState.voteDetails
                        .filter(v => v.itemVoted === gameState.tieBreaker?.item2)
                        .map((voter) => (
                          <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                            <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                            <span className="text-xs text-zinc-300">{voter.name}</span>
                          </div>
                        ))}
                    </div>
                  </div>
                  {!coinFlipping && gameState.tieBreaker.winner === gameState.tieBreaker.item2 && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-emerald-400">✓ Gagnant</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Animation de la pièce */}
              <div className="mb-4 sm:mb-6 flex justify-center">
                <div
                  className={`text-6xl sm:text-8xl ${coinFlipping ? 'animate-spin' : ''}`}
                  style={{
                    animationDuration: coinFlipping ? '0.3s' : '1s',
                  }}
                >
                  🪙
                </div>
              </div>

              {!coinFlipping && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 sm:p-4">
                    <p className="text-xs text-zinc-400 mb-1">Résultat du lancer</p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-200">
                      {gameState.tieBreaker.coinFlip === 'heads' ? 'Pile' : 'Face'}
                    </p>
                  </div>

                  <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg p-3 sm:p-4">
                    <p className="text-xs text-zinc-400 mb-1">Gagnant</p>
                    <p className="text-lg sm:text-xl font-semibold text-zinc-200 break-words">
                      {gameState.tieBreaker.winner}
                    </p>
                  </div>

                  {showContinueButton && (
                    <div className="mt-4 sm:mt-6">
                      <button
                        onClick={handleContinueClick}
                        disabled={!continueButtonEnabled || clickingContinue || gameState.userHasContinued}
                        className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 font-medium rounded-lg transition-all text-sm sm:text-base cursor-pointer ${
                          gameState.userHasContinued
                            ? 'bg-emerald-600 text-white cursor-default'
                            : continueButtonEnabled
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                        }`}
                      >
                        {gameState.userHasContinued
                          ? `✓ En attente (${gameState.continueClicks || 0}/${gameState.totalPlayers})`
                          : clickingContinue
                          ? 'Chargement...'
                          : continueButtonEnabled
                          ? `Continuer (${gameState.continueClicks || 0}/${gameState.totalPlayers})`
                          : 'Continuer...'}
                      </button>
                      <p className="text-xs text-zinc-500 mt-2 text-center">
                        Tous les joueurs doivent cliquer pour passer au duel suivant
                      </p>
                    </div>
                  )}
                </div>
              )}

              {coinFlipping && (
                <div className="text-center">
                  <p className="text-zinc-300 text-sm sm:text-base font-medium">
                    Tirage au sort en cours...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Panneau récapitulatif normal (sans tiebreaker) */}
        {showResultsPanel && gameState && !gameState.tieBreaker && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="mb-4 sm:mb-6">
                <h3 className="text-xl sm:text-2xl font-bold text-zinc-200 mb-1">
                  Résultats du duel {gameState.currentDuelIndex + 1}
                </h3>
                <p className="text-zinc-400 text-xs sm:text-sm">
                  Tous les joueurs ont voté
                </p>
              </div>

              {/* Les deux items en compétition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
                {/* Item 1 */}
                <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
                  gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length >
                  gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-700/50'
                }`}>
                  <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
                    {gameState.currentDuel.item1.name}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length}{' '}
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length > 1 ? 'votes' : 'vote'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gameState.voteDetails
                        .filter(v => v.itemVoted === gameState.currentDuel.item1.name)
                        .map((voter) => (
                          <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                            <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                            <span className="text-xs text-zinc-300">{voter.name}</span>
                          </div>
                        ))}
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length === 0 && (
                        <span className="text-xs text-zinc-500 italic">Aucun vote</span>
                      )}
                    </div>
                  </div>
                  {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length >
                   gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-emerald-400">✓ Gagnant</span>
                    </div>
                  )}
                </div>

                {/* Item 2 */}
                <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
                  gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length >
                  gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-700/50'
                }`}>
                  <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
                    {gameState.currentDuel.item2.name}
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400">
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length}{' '}
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length > 1 ? 'votes' : 'vote'}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {gameState.voteDetails
                        .filter(v => v.itemVoted === gameState.currentDuel.item2.name)
                        .map((voter) => (
                          <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                            <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                            <span className="text-xs text-zinc-300">{voter.name}</span>
                          </div>
                        ))}
                      {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length === 0 && (
                        <span className="text-xs text-zinc-500 italic">Aucun vote</span>
                      )}
                    </div>
                  </div>
                  {gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item2.name).length >
                   gameState.voteDetails.filter(v => v.itemVoted === gameState.currentDuel.item1.name).length && (
                    <div className="mt-3">
                      <span className="text-xs font-medium text-emerald-400">✓ Gagnant</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bouton Continuer */}
              <div className="text-center">
                <button
                  onClick={() => handleNormalContinue()}
                  disabled={!continueButtonEnabled || clickingContinue}
                  className={`px-6 py-3 font-medium rounded-lg transition-all cursor-pointer ${
                    continueButtonEnabled
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {clickingContinue
                    ? 'Chargement...'
                    : continueButtonEnabled
                    ? `Continuer (${normalContinueClicks}/${gameState.totalPlayers})`
                    : 'Continuer...'}
                </button>
                <p className="text-xs text-zinc-500 mt-2">
                  Tous les joueurs doivent cliquer pour passer au duel suivant
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
