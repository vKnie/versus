import Avatar from '@/components/Avatar';
import VideoPlayer from './VideoPlayer';
import { Check } from 'lucide-react';

interface ProposedByUser {
  name: string;
  profilePictureUrl?: string | null;
}

interface DuelItemProps {
  playerId: string;
  playerRef: React.MutableRefObject<any>;
  itemName: string;
  proposedBy: ProposedByUser[];
  hasVoted: boolean;
  voting: boolean;
  userVote: string | null;
  onVoteClick: (itemName: string) => void;
  isGameMaster: boolean;
  roomId: number | null;
  videoIndex: number;
  socket: any;
}

export default function DuelItem({
  playerId,
  playerRef,
  itemName,
  proposedBy,
  hasVoted,
  voting,
  userVote,
  onVoteClick,
  isGameMaster,
  roomId,
  videoIndex,
  socket,
}: DuelItemProps) {
  return (
    <div>
      <VideoPlayer
        playerId={playerId}
        playerRef={playerRef}
        isGameMaster={isGameMaster}
        roomId={roomId}
        videoIndex={videoIndex}
        socket={socket}
      />

      <div className="p-6">
        <h2 className="text-xl font-semibold text-zinc-200 mb-2">
          {itemName}
        </h2>
        <div className="mb-4">
          <p className="text-xs text-zinc-400 mb-2">Proposé par :</p>
          <div className="flex flex-wrap gap-2">
            {proposedBy.map((person, i) => {
              const personName = typeof person === 'string' ? person : person.name;
              const personPic = typeof person === 'string' ? null : person.profilePictureUrl;
              return (
                <div key={i} className="flex items-center gap-1 bg-zinc-800 rounded-full pr-2 py-0.5">
                  <Avatar src={personPic} name={personName} size="xs" />
                  <span className="text-xs text-zinc-300">{personName}</span>
                </div>
              );
            })}
          </div>
        </div>

        <button
          onClick={() => onVoteClick(itemName)}
          disabled={hasVoted || voting}
          className={`w-full px-6 py-3 font-medium rounded-lg transition-colors cursor-pointer ${
            userVote === itemName
              ? 'bg-emerald-600 text-white'
              : hasVoted
              ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 text-white'
          }`}
        >
          {userVote === itemName
            ? (<span className="flex items-center gap-1"><Check className="w-3 h-3" /> Voté</span>)
            : hasVoted
            ? 'Déjà voté'
            : 'Voter pour cet item'}
        </button>
      </div>
    </div>
  );
}
