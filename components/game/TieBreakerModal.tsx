import Avatar from '@/components/Avatar';
import { Trophy } from 'lucide-react';

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

interface TieBreakerModalProps {
  show: boolean;
  tieBreaker: TieBreaker | null;
  voteDetails: VoteDetail[];
  currentDuelIndex: number;
  coinFlipping: boolean;
  showContinueButton: boolean;
  continueButtonEnabled: boolean;
  clickingContinue: boolean;
  userHasContinued?: boolean;
  continueClicks?: number;
  totalPlayers: number;
  onContinueClick: () => void;
}

export default function TieBreakerModal({
  show,
  tieBreaker,
  voteDetails,
  currentDuelIndex,
  coinFlipping,
  showContinueButton,
  continueButtonEnabled,
  clickingContinue,
  userHasContinued,
  continueClicks,
  totalPlayers,
  onContinueClick,
}: TieBreakerModalProps) {
  if (!show || !tieBreaker) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-200 mb-1">
            Égalité
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Duel {currentDuelIndex + 1} - Égalité {tieBreaker.votes}-{tieBreaker.votes}
          </p>
        </div>

        {/* Les deux items en compétition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
            !coinFlipping && tieBreaker.winner === tieBreaker.item1
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-zinc-700/50'
          }`}>
            <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
              {tieBreaker.item1}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                {tieBreaker.votes} {tieBreaker.votes > 1 ? 'votes' : 'vote'}
              </p>
              <div className="flex flex-wrap gap-2">
                {voteDetails
                  .filter(v => v.itemVoted === tieBreaker.item1)
                  .map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                      <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                      <span className="text-xs text-zinc-300">{voter.name}</span>
                    </div>
                  ))}
              </div>
            </div>
            {!coinFlipping && tieBreaker.winner === tieBreaker.item1 && (
              <div className="mt-3">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Gagnant</span>
              </div>
            )}
          </div>
          <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
            !coinFlipping && tieBreaker.winner === tieBreaker.item2
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-zinc-700/50'
          }`}>
            <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
              {tieBreaker.item2}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                {tieBreaker.votes} {tieBreaker.votes > 1 ? 'votes' : 'vote'}
              </p>
              <div className="flex flex-wrap gap-2">
                {voteDetails
                  .filter(v => v.itemVoted === tieBreaker.item2)
                  .map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                      <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                      <span className="text-xs text-zinc-300">{voter.name}</span>
                    </div>
                  ))}
              </div>
            </div>
            {!coinFlipping && tieBreaker.winner === tieBreaker.item2 && (
              <div className="mt-3">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Gagnant</span>
              </div>
            )}
          </div>
        </div>

        {/* Animation de la pièce */}
        <div className="mb-4 sm:mb-6 flex justify-center items-center gap-4">
          <div
            className={`text-6xl sm:text-8xl ${coinFlipping ? 'animate-spin' : ''}`}
            style={{
              animationDuration: coinFlipping ? '0.3s' : '1s',
            }}
          >
            🪙
          </div>
          {!coinFlipping && (
            <div className="text-center">
              <p className="text-2xl sm:text-4xl font-bold text-zinc-200">
                {tieBreaker.coinFlip === 'heads' ? 'Pile' : 'Face'}
              </p>
            </div>
          )}
        </div>

        {!coinFlipping && (
          <div className="space-y-3 sm:space-y-4">
            {showContinueButton && (
              <div className="mt-4 sm:mt-6">
                <button
                  onClick={onContinueClick}
                  disabled={!continueButtonEnabled || clickingContinue || userHasContinued}
                  className={`w-full px-4 sm:px-6 py-2.5 sm:py-3 font-medium rounded-lg transition-all text-sm sm:text-base cursor-pointer ${
                    userHasContinued
                      ? 'bg-emerald-600 text-white cursor-default'
                      : continueButtonEnabled
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {userHasContinued
                    ? `✓ En attente (${continueClicks || 0}/${totalPlayers})`
                    : clickingContinue
                    ? 'Chargement...'
                    : continueButtonEnabled
                    ? `Continuer (${continueClicks || 0}/${totalPlayers})`
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
  );
}
