'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useGameRoom } from '@/lib/useSocket';
import GameHeader from '@/components/game/GameHeader';
import DuelItem from '@/components/game/DuelItem';
import VoteConfirmDialog from '@/components/game/VoteConfirmDialog';
import TieBreakerModal from '@/components/game/TieBreakerModal';
import ResultsPanel from '@/components/game/ResultsPanel';

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
  [x: string]: any;
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
  const [globalVolume, setGlobalVolume] = useState(() => {
    // Charger le volume sauvegardé depuis localStorage
    if (typeof window !== 'undefined') {
      const savedVolume = localStorage.getItem('gameVolume');
      return savedVolume ? parseInt(savedVolume, 10) : 100;
    }
    return 100;
  });

  // ✅ WebSocket - Connexion à la game room
  const { socket } = useGameRoom(roomId, session?.user?.name || 'Anonymous');

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

    // Partie annulée
    socket.on('game_cancelled', (data: { roomId: number }) => {
      console.log('🚫 Partie annulée:', data.roomId);
      alert('La partie a été annulée par le créateur du salon.');
      window.location.href = '/'; // Force un reload complet
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

    // 🚫 Joueur exclu de la partie
    socket.on('player_excluded', async (data: { userId: number; gameSessionId: number }) => {
      console.log('🚫 Événement player_excluded reçu:', data);

      try {
        // Récupérer l'utilisateur actuel
        const currentUserResponse = await fetch('/api/users/me');
        const currentUser = await currentUserResponse.json();
        console.log('🚫 Utilisateur actuel:', currentUser);
        console.log('🚫 Comparaison:', currentUser.id, '===', data.userId);

        // Si c'est moi qui ai été exclu, rediriger vers l'accueil
        if (currentUser.id === data.userId) {
          console.log('🚫 JE SUIS EXCLU - Redirection vers l\'accueil');
          alert('Vous avez été exclu de la partie par le maître du jeu.');
          window.location.href = '/';
          return;
        }

        console.log('🚫 Un autre joueur a été exclu - Rafraîchissement de l\'état');
        // Sinon, rafraîchir l'état de la partie
        await fetchGameState();
      } catch (error) {
        console.error('🚫 Erreur lors de la gestion de l\'exclusion:', error);
      }
    });

    // Nettoyage
    return () => {
      socket.off('vote_update');
      socket.off('duel_changed');
      socket.off('tiebreaker_continue_update');
      socket.off('normal_continue_update');
      socket.off('game_ended');
      socket.off('game_cancelled');
      socket.off('player_joined');
      socket.off('video_play');
      socket.off('video_pause');
      socket.off('video_seek');
      socket.off('video_rate_change');
      socket.off('player_excluded');
    };
  }, [socket, roomId, router]);

  // ✅ Chargement initial seulement (pas de polling)
  useEffect(() => {
    if (!roomId) return;
    fetchGameState();
  }, [roomId]);

  const handleExcludePlayer = async (userId: number) => {
    if (!gameState?.gameSessionId || !roomId) return;

    try {
      const response = await fetch('/api/game/exclude-player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          gameSessionId: gameState.gameSessionId,
          userId,
          roomId,
        }),
      });

      if (response.ok) {
        // Rafraîchir l'état de la partie
        await fetchGameState();

        // Notifier via WebSocket
        socket?.emit('player_excluded', {
          roomId,
          userId,
          gameSessionId: gameState.gameSessionId,
        });
      } else {
        const error = await response.json();
        alert(error.error || 'Erreur lors de l\'exclusion du joueur');
      }
    } catch (error) {
      console.error('Erreur lors de l\'exclusion du joueur:', error);
      alert('Erreur lors de l\'exclusion du joueur');
    }
  };

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
    // ✅ OPTIMIZED: Properly cleanup players to prevent memory leaks
    const destroyPlayer = (playerRef: React.MutableRefObject<any>, playerName: string) => {
      if (playerRef.current) {
        try {
          // Remove all event listeners first
          if (playerRef.current.removeEventListener) {
            playerRef.current.removeEventListener('onStateChange');
            playerRef.current.removeEventListener('onPlaybackRateChange');
          }

          // Stop video and destroy player
          if (typeof playerRef.current.stopVideo === 'function') {
            playerRef.current.stopVideo();
          }
          if (typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch (e) {
          console.error(`Error destroying ${playerName}:`, e);
        } finally {
          // Always null the ref
          playerRef.current = null;
        }
      }
    };

    destroyPlayer(player1Ref, 'player1');
    destroyPlayer(player2Ref, 'player2');

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
        host: 'https://www.youtube-nocookie.com',
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
          // ✅ Paramètres pour compatibilité production
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          widget_referrer: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (event: any) => {
            console.log('✅ Player 1 prêt');

            // Appliquer le volume sauvegardé
            if (globalVolume > 0) {
              event.target.setVolume(globalVolume);
              event.target.unMute();
            } else {
              event.target.setVolume(0);
            }

            // Configurer les écouteurs de synchronisation
            setupSyncListeners(event.target, 1);

            // Pour les non-maîtres, mettre en pause au démarrage
            if (!gameState?.isGameMaster) {
              event.target.pauseVideo();
            }
          },
          onError: (event: any) => {
            console.error('❌ Erreur Player 1:', {
              errorCode: event.data,
              videoId: videoId1,
              origin: window.location.origin,
              errorMessage: event.data === 2 ? 'Invalid parameter'
                : event.data === 5 ? 'HTML5 player error'
                : event.data === 100 ? 'Video not found or private'
                : event.data === 101 || event.data === 150 ? 'Video not allowed to be played in embedded players'
                : 'Unknown error'
            });
          }
        }
      });
    }

    if (videoId2 && window.YT && window.YT.Player) {
      player2Ref.current = new window.YT.Player('player2', {
        height: '100%',
        width: '100%',
        videoId: videoId2,
        host: 'https://www.youtube-nocookie.com',
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
          // ✅ Paramètres pour compatibilité production
          origin: typeof window !== 'undefined' ? window.location.origin : undefined,
          widget_referrer: typeof window !== 'undefined' ? window.location.origin : undefined,
        },
        events: {
          onReady: (event: any) => {
            console.log('✅ Player 2 prêt');

            // Appliquer le volume sauvegardé
            if (globalVolume > 0) {
              event.target.setVolume(globalVolume);
              event.target.unMute();
            } else {
              event.target.setVolume(0);
            }

            // Configurer les écouteurs de synchronisation
            setupSyncListeners(event.target, 2);

            // Pour les non-maîtres, mettre en pause au démarrage
            if (!gameState?.isGameMaster) {
              event.target.pauseVideo();
            }
          },
          onError: (event: any) => {
            console.error('❌ Erreur Player 2:', {
              errorCode: event.data,
              videoId: videoId2,
              origin: window.location.origin,
              errorMessage: event.data === 2 ? 'Invalid parameter'
                : event.data === 5 ? 'HTML5 player error'
                : event.data === 100 ? 'Video not found or private'
                : event.data === 101 || event.data === 150 ? 'Video not allowed to be played in embedded players'
                : 'Unknown error'
            });
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
        await response.json();

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

    // Sauvegarder le volume dans localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('gameVolume', volume.toString());
    }

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
        <GameHeader
          roomName={roomName}
          currentDuelIndex={gameState.currentDuelIndex}
          totalDuels={gameState.totalDuels}
          gameMaster={gameState.gameMaster}
          globalVolume={globalVolume}
          onGlobalVolumeChange={handleGlobalVolumeChange}
          isGameMaster={gameState.isGameMaster}
          roomId={roomId}
          gameSessionId={gameState.gameSessionId}
          onExcludePlayer={handleExcludePlayer}
          currentUserName={session?.user?.name || ''}
          votes={gameState.votes}
          totalPlayers={gameState.totalPlayers}
          allVoted={gameState.allVoted}
          voteDetails={gameState.voteDetails}
        />

        {/* Duels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Item 1 */}
          <DuelItem
            playerId="player1"
            playerRef={player1Ref}
            itemName={gameState.currentDuel.item1.name}
            proposedBy={gameState.currentDuel.item1.proposedBy}
            hasVoted={gameState.hasVoted}
            voting={voting}
            userVote={gameState.userVote}
            onVoteClick={handleVoteClick}
            isGameMaster={gameState.isGameMaster}
            roomId={roomId}
            videoIndex={1}
            socket={socket}
          />

          {/* Item 2 */}
          <DuelItem
            playerId="player2"
            playerRef={player2Ref}
            itemName={gameState.currentDuel.item2.name}
            proposedBy={gameState.currentDuel.item2.proposedBy}
            hasVoted={gameState.hasVoted}
            voting={voting}
            userVote={gameState.userVote}
            onVoteClick={handleVoteClick}
            isGameMaster={gameState.isGameMaster}
            roomId={roomId}
            videoIndex={2}
            socket={socket}
          />
        </div>

        {/* Dialog de confirmation de vote */}
        <VoteConfirmDialog
          show={showConfirmDialog}
          pendingVote={pendingVote}
          voting={voting}
          onConfirm={confirmVote}
          onCancel={cancelVote}
        />

        {/* Animation de Pile ou Face */}
        <TieBreakerModal
          show={showCoinFlip}
          tieBreaker={gameState?.tieBreaker || null}
          voteDetails={gameState?.voteDetails || []}
          currentDuelIndex={gameState?.currentDuelIndex || 0}
          coinFlipping={coinFlipping}
          showContinueButton={showContinueButton}
          continueButtonEnabled={continueButtonEnabled}
          clickingContinue={clickingContinue}
          userHasContinued={gameState?.userHasContinued}
          continueClicks={gameState?.continueClicks}
          totalPlayers={gameState?.totalPlayers || 0}
          onContinueClick={handleContinueClick}
        />

        {/* Panneau récapitulatif normal (sans tiebreaker) */}
        <ResultsPanel
          show={showResultsPanel && !!gameState && !gameState.tieBreaker}
          currentDuelIndex={gameState?.currentDuelIndex || 0}
          item1={gameState?.currentDuel?.item1 || { name: '', youtubeLink: '', proposedBy: [] }}
          item2={gameState?.currentDuel?.item2 || { name: '', youtubeLink: '', proposedBy: [] }}
          voteDetails={gameState?.voteDetails || []}
          totalPlayers={gameState?.totalPlayers || 0}
          continueButtonEnabled={continueButtonEnabled}
          clickingContinue={clickingContinue}
          normalContinueClicks={normalContinueClicks}
          onContinueClick={handleNormalContinue}
        />
      </div>
    </div>
  );
}
