import Avatar from '@/components/Avatar';
import { Trophy } from 'lucide-react';

interface VoteDetail {
  userId: number;
  name: string;
  profilePictureUrl?: string | null;
  itemVoted: string;
}

interface DuelItem {
  name: string;
  youtubeLink: string;
  proposedBy: any[];
}

interface ResultsPanelProps {
  show: boolean;
  currentDuelIndex: number;
  item1: DuelItem;
  item2: DuelItem;
  voteDetails: VoteDetail[];
  totalPlayers: number;
  continueButtonEnabled: boolean;
  clickingContinue: boolean;
  normalContinueClicks: number;
  onContinueClick: () => void;
}

export default function ResultsPanel({
  show,
  currentDuelIndex,
  item1,
  item2,
  voteDetails,
  totalPlayers,
  continueButtonEnabled,
  clickingContinue,
  normalContinueClicks,
  onContinueClick,
}: ResultsPanelProps) {
  if (!show) return null;

  const item1Votes = voteDetails.filter(v => v.itemVoted === item1.name).length;
  const item2Votes = voteDetails.filter(v => v.itemVoted === item2.name).length;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800/60 rounded-xl p-4 sm:p-6 max-w-2xl w-full shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="mb-4 sm:mb-6">
          <h3 className="text-xl sm:text-2xl font-bold text-zinc-200 mb-1">
            Résultats du duel {currentDuelIndex + 1}
          </h3>
          <p className="text-zinc-400 text-xs sm:text-sm">
            Tous les joueurs ont voté
          </p>
        </div>

        {/* Les deux items en compétition */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Item 1 */}
          <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
            item1Votes > item2Votes
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-zinc-700/50'
          }`}>
            <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
              {item1.name}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                {item1Votes}{' '}
                {item1Votes > 1 ? 'votes' : 'vote'}
              </p>
              <div className="flex flex-wrap gap-2">
                {voteDetails
                  .filter(v => v.itemVoted === item1.name)
                  .map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                      <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                      <span className="text-xs text-zinc-300">{voter.name}</span>
                    </div>
                  ))}
                {item1Votes === 0 && (
                  <span className="text-xs text-zinc-500 italic">Aucun vote</span>
                )}
              </div>
            </div>
            {item1Votes > item2Votes && (
              <div className="mt-3">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Gagnant</span>
              </div>
            )}
          </div>

          {/* Item 2 */}
          <div className={`bg-zinc-800/50 border rounded-lg p-4 transition-all ${
            item2Votes > item1Votes
              ? 'border-emerald-500 bg-emerald-500/10'
              : 'border-zinc-700/50'
          }`}>
            <p className="text-sm font-semibold text-zinc-200 mb-3 line-clamp-2">
              {item2.name}
            </p>
            <div className="space-y-2">
              <p className="text-xs text-zinc-400">
                {item2Votes}{' '}
                {item2Votes > 1 ? 'votes' : 'vote'}
              </p>
              <div className="flex flex-wrap gap-2">
                {voteDetails
                  .filter(v => v.itemVoted === item2.name)
                  .map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1 bg-zinc-700/50 rounded-full pr-2 py-0.5">
                      <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                      <span className="text-xs text-zinc-300">{voter.name}</span>
                    </div>
                  ))}
                {item2Votes === 0 && (
                  <span className="text-xs text-zinc-500 italic">Aucun vote</span>
                )}
              </div>
            </div>
            {item2Votes > item1Votes && (
              <div className="mt-3">
                <span className="text-xs font-medium text-emerald-400 flex items-center gap-1"><Trophy className="w-3.5 h-3.5" /> Gagnant</span>
              </div>
            )}
          </div>
        </div>

        {/* Bouton Continuer */}
        <div className="text-center">
          <button
            onClick={onContinueClick}
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
              ? `Continuer (${normalContinueClicks}/${totalPlayers})`
              : 'Continuer...'}
          </button>
          <p className="text-xs text-zinc-500 mt-2">
            Tous les joueurs doivent cliquer pour passer au duel suivant
          </p>
        </div>
      </div>
    </div>
  );
}
