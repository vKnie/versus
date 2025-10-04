'use client';

import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import Avatar from '@/components/Avatar';
import { Home, Play } from 'lucide-react';
import Image from 'next/image';

interface DuelResult {
  duelIndex: number;
  round: number;
  item1: {
    name: string;
    youtubeLink: string;
    proposedBy: (string | { name: string; profilePictureUrl?: string | null })[];
  };
  item2: {
    name: string;
    youtubeLink: string;
    proposedBy: (string | { name: string; profilePictureUrl?: string | null })[];
  };
  item1Votes: { voter: string; votedAt: string; profilePictureUrl?: string | null }[];
  item2Votes: { voter: string; votedAt: string; profilePictureUrl?: string | null }[];
  item1Count: number;
  item2Count: number;
  winner: string;
}

interface Results {
  gameSessionId: number;
  totalRounds: number;
  duelResults: DuelResult[];
  winner: string;
  allParticipants: any[];
}

export default function ResultsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const gameSessionId = params.gameSessionId as string;

  const [results, setResults] = useState<Results | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedRounds, setExpandedRounds] = useState<{ [key: number]: boolean }>({});

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/game/results?gameSessionId=${gameSessionId}`);
      if (response.ok) {
        const data = await response.json();
        setResults(data);

        // Initialiser tous les rounds comme fermés
        const rounds: { [key: number]: boolean } = {};
        data.duelResults.forEach((duel: DuelResult) => {
          if (rounds[duel.round] === undefined) {
            rounds[duel.round] = false;
          }
        });
        setExpandedRounds(rounds);
      } else {
        router.push('/');
      }
    } catch (error) {
      console.error('Erreur lors de la récupération des résultats:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  }, [gameSessionId, router]);

  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }

    fetchResults();
  }, [session, status, router, fetchResults]);

  const toggleRound = (round: number) => {
    setExpandedRounds(prev => ({
      ...prev,
      [round]: !prev[round]
    }));
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-500">Chargement des résultats...</div>
      </div>
    );
  }

  if (!session || !results) {
    return null;
  }

  // Organiser les duels par round
  const duelsByRound: { [key: number]: DuelResult[] } = {};
  results.duelResults.forEach((duel) => {
    if (!duelsByRound[duel.round]) {
      duelsByRound[duel.round] = [];
    }
    duelsByRound[duel.round].push(duel);
  });

  const getRoundName = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Finale';
    if (round === totalRounds - 1) return 'Demi-finale';
    if (round === totalRounds - 2) return 'Quart de finale';
    return `Round ${round}`;
  };

  const extractYouTubeId = (url: string) => {
    const match = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
    return match ? match[1] : null;
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-200 mb-4">Résultats du Tournoi</h1>
          <div className="bg-zinc-900/60 backdrop-blur border border-emerald-800/60 rounded-xl p-6">
            <p className="text-sm text-zinc-400 mb-1">Vainqueur</p>
            <h2 className="text-2xl font-semibold text-emerald-400">{results.winner}</h2>
          </div>
        </div>

        {/* Bracket par rounds */}
        {Object.keys(duelsByRound)
          .map(Number)
          .sort((a, b) => a - b)
          .map((round) => (
            <div key={round} className="mb-3">
              <button
                onClick={() => toggleRound(round)}
                className="w-full flex items-center justify-between bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4 hover:bg-zinc-900/80 transition-colors cursor-pointer"
              >
                <h3 className="text-lg font-semibold text-zinc-200">
                  {getRoundName(round, results.totalRounds)}
                </h3>
                <svg
                  className={`w-3 h-3 text-zinc-400 transition-transform ${expandedRounds[round] ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 12 8"
                >
                  <path d="M1 1L6 6L11 1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>

              {expandedRounds[round] && (
                <div className="space-y-3 mt-3">
                {duelsByRound[round].map((duel) => (
                  <div
                    key={duel.duelIndex}
                    className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4"
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Item 1 */}
                      <div
                        className={`border rounded-lg p-3 ${
                          duel.winner === duel.item1.name
                            ? 'border-emerald-600 bg-emerald-900/20'
                            : 'border-zinc-800'
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Contenu principal */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className={`text-base font-medium ${
                                duel.winner === duel.item1.name ? 'text-emerald-400' : 'text-zinc-200'
                              }`}>
                                {duel.item1.name}
                              </h4>
                              {duel.winner === duel.item1.name && (
                                <span className="text-emerald-400 text-sm">✓</span>
                              )}
                            </div>

                            <div className="mb-2">
                              <p className="text-xs text-zinc-500 mb-1">
                                Proposé par
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {duel.item1.proposedBy.map((person, i) => {
                                  // Support pour l'ancien format (string) et le nouveau (objet)
                                  const personName = typeof person === 'string' ? person : person.name;
                                  const personPic = typeof person === 'string' ? null : person.profilePictureUrl;
                                  return (
                                    <div key={i} className="flex items-center gap-1 bg-zinc-800/60 rounded-full pr-2 py-0.5">
                                      <Avatar src={personPic} name={personName} size="xs" />
                                      <span className="text-xs text-zinc-400">{personName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="border-t border-zinc-800 pt-2">
                              <p className="text-xs text-zinc-500 mb-1">
                                {duel.item1Count} vote{duel.item1Count > 1 ? 's' : ''}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {duel.item1Votes.map((vote, i) => (
                                  <div key={i} className="flex items-center gap-1 bg-zinc-800/60 rounded-full pr-2 py-0.5">
                                    <Avatar src={vote.profilePictureUrl} name={vote.voter} size="xs" />
                                    <span className="text-xs text-zinc-400">{vote.voter}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Miniature YouTube à droite */}
                          {duel.item1.youtubeLink && extractYouTubeId(duel.item1.youtubeLink) && (
                            <div className="flex flex-col gap-1">
                              <Image
                                src={`https://img.youtube.com/vi/${extractYouTubeId(duel.item1.youtubeLink)}/mqdefault.jpg`}
                                alt={duel.item1.name}
                                width={128}
                                height={80}
                                className="w-32 h-20 object-cover rounded border border-zinc-700"
                              />
                              <a
                                href={duel.item1.youtubeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-center transition-colors cursor-pointer flex items-center gap-1.5 justify-center"
                              >
                                <Play className="w-3 h-3" />
                                Voir la vidéo
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item 2 */}
                      <div
                        className={`border rounded-lg p-3 ${
                          duel.winner === duel.item2.name
                            ? 'border-emerald-600 bg-emerald-900/20'
                            : 'border-zinc-800'
                        }`}
                      >
                        <div className="flex gap-3">
                          {/* Contenu principal */}
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className={`text-base font-medium ${
                                duel.winner === duel.item2.name ? 'text-emerald-400' : 'text-zinc-200'
                              }`}>
                                {duel.item2.name}
                              </h4>
                              {duel.winner === duel.item2.name && (
                                <span className="text-emerald-400 text-sm">✓</span>
                              )}
                            </div>

                            <div className="mb-2">
                              <p className="text-xs text-zinc-500 mb-1">
                                Proposé par
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {duel.item2.proposedBy.map((person, i) => {
                                  // Support pour l'ancien format (string) et le nouveau (objet)
                                  const personName = typeof person === 'string' ? person : person.name;
                                  const personPic = typeof person === 'string' ? null : person.profilePictureUrl;
                                  return (
                                    <div key={i} className="flex items-center gap-1 bg-zinc-800/60 rounded-full pr-2 py-0.5">
                                      <Avatar src={personPic} name={personName} size="xs" />
                                      <span className="text-xs text-zinc-400">{personName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="border-t border-zinc-800 pt-2">
                              <p className="text-xs text-zinc-500 mb-1">
                                {duel.item2Count} vote{duel.item2Count > 1 ? 's' : ''}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {duel.item2Votes.map((vote, i) => (
                                  <div key={i} className="flex items-center gap-1 bg-zinc-800/60 rounded-full pr-2 py-0.5">
                                    <Avatar src={vote.profilePictureUrl} name={vote.voter} size="xs" />
                                    <span className="text-xs text-zinc-400">{vote.voter}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>

                          {/* Miniature YouTube à droite */}
                          {duel.item2.youtubeLink && extractYouTubeId(duel.item2.youtubeLink) && (
                            <div className="flex flex-col gap-1">
                              <Image
                                src={`https://img.youtube.com/vi/${extractYouTubeId(duel.item2.youtubeLink)}/mqdefault.jpg`}
                                alt={duel.item2.name}
                                width={128}
                                height={80}
                                className="w-32 h-20 object-cover rounded border border-zinc-700"
                              />
                              <a
                                href={duel.item2.youtubeLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-center transition-colors cursor-pointer flex items-center gap-1.5 justify-center"
                              >
                                <Play className="w-3 h-3" />
                                Voir la vidéo
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                </div>
              )}
            </div>
          ))}

        {/* Bouton retour */}
        <div className="mt-6">
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm rounded-lg transition-colors cursor-pointer flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Retour à l'accueil
          </button>
        </div>
      </div>
    </div>
  );
}
