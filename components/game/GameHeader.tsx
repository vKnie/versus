import Avatar from '@/components/Avatar';
import GameMasterMenu from '@/components/GameMasterMenu';
import { Volume2, Check } from 'lucide-react';

interface GameMaster {
  name: string;
  profilePictureUrl?: string | null;
}

interface VoteDetail {
  userId: number;
  name: string;
  profilePictureUrl?: string | null;
  itemVoted: string;
}

interface GameHeaderProps {
  roomName: string;
  currentDuelIndex: number;
  totalDuels: number;
  gameMaster?: GameMaster;
  globalVolume: number;
  onGlobalVolumeChange: (volume: number) => void;
  isGameMaster: boolean;
  roomId: number | null;
  gameSessionId: number;
  onExcludePlayer: (userId: number) => void;
  currentUserName: string;
  votes: number;
  totalPlayers: number;
  allVoted: boolean;
  voteDetails: VoteDetail[];
}

export default function GameHeader({
  roomName,
  currentDuelIndex,
  totalDuels,
  gameMaster,
  globalVolume,
  onGlobalVolumeChange,
  isGameMaster,
  roomId,
  gameSessionId,
  onExcludePlayer,
  currentUserName,
  votes,
  totalPlayers,
  allVoted,
  voteDetails,
}: GameHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-bold text-zinc-200 mb-4">{decodeURIComponent(roomName)}</h1>

      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {/* Badge Duel */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2">
            <span className="text-sm text-zinc-400">Duel</span>
            <span className="ml-2 text-sm font-semibold text-zinc-200">
              {currentDuelIndex + 1} / {totalDuels}
            </span>
          </div>

          {/* Badge Maître du jeu */}
          {gameMaster && (
            <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 flex items-center gap-2">
              <span className="text-sm text-zinc-400">Maître :</span>
              <div className="flex items-center gap-1.5">
                <Avatar src={gameMaster.profilePictureUrl} name={gameMaster.name} size="xs" />
                <span className="text-sm font-medium text-zinc-200">{gameMaster.name}</span>
              </div>
            </div>
          )}

          {/* Badge Volume */}
          <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 flex items-center gap-3 min-w-[220px]">
            <Volume2 className="w-4 h-4 text-zinc-400" />
            <input
              type="range"
              min="0"
              max="100"
              value={globalVolume}
              onChange={(e) => onGlobalVolumeChange(parseInt(e.target.value))}
              className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              title="Volume global"
            />
            <span className="text-xs text-zinc-400 w-9 text-right">{globalVolume}%</span>
          </div>

          {/* Menu de gestion pour le maître du jeu */}
          {isGameMaster && roomId && gameSessionId && (
            <GameMasterMenu
              roomId={roomId}
              gameSessionId={gameSessionId}
              onExcludePlayer={onExcludePlayer}
              currentUserName={currentUserName}
            />
          )}
        </div>

        {/* Badge Votes - à droite */}
        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-2 relative group">
          <span className="text-sm text-zinc-400">Votes :</span>
          <span className="ml-2 text-sm font-semibold text-zinc-200">
            {votes} / {totalPlayers}
          </span>
          {allVoted && (
            <Check className="ml-2 w-3.5 h-3.5 text-emerald-400 inline" />
          )}

          {/* Tooltip qui affiche qui a voté - à gauche du badge */}
          <div className="absolute hidden group-hover:block top-0 right-full mr-2 w-64 bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl z-50">
            {voteDetails && voteDetails.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-zinc-300 mb-2">Ont voté :</p>
                <div className="space-y-1">
                  {voteDetails.map((voter) => (
                    <div key={voter.userId} className="flex items-center gap-1.5">
                      <Avatar src={voter.profilePictureUrl} name={voter.name} size="xs" />
                      <span className="text-xs text-zinc-300">{voter.name}</span>
                      <Check className="ml-auto w-3 h-3 text-emerald-400" />
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-xs text-zinc-400 italic">Aucun vote pour le moment</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
