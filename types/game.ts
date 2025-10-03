// Types pour le système de jeu

export interface GameItem {
  name: string;
  youtubeLink: string;
  proposedBy: string[];
}

export interface Duel {
  item1: GameItem;
  item2: GameItem;
  round: number;
  matchIndex: number;
}

export interface TieBreaker {
  duelIndex: number;
  winner: string;
  item1: string;
  item2: string;
  coinFlip: 'heads' | 'tails';
  votes: number;
}

export interface TournamentData {
  roomId: number;
  roomName: string;
  configId: number;
  duels: Duel[];
  currentRound: number;
  totalRounds: number;
  winners: string[];
  allItems: GameItem[];
  tieBreakers?: TieBreaker[];
}

export interface GameSession {
  id: number;
  status: 'in_progress' | 'finished';
  current_duel_index: number;
  duels_data: string; // JSON serialized TournamentData
  video_start_time: string | null;
  created_at: string;
}

export interface Vote {
  id: number;
  game_session_id: number;
  user_id: number;
  duel_index: number;
  item_voted: string;
  created_at: string;
}

export interface VoteDetail {
  userId: number;
  name: string;
  profilePictureUrl: string | null;
  itemVoted: string;
}

export interface GameStateResponse {
  gameSessionId: number;
  status: string;
  currentDuelIndex: number;
  totalDuels: number;
  currentDuel: {
    item1: GameItem;
    item2: GameItem;
  };
  currentRound: number;
  totalRounds: number;
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
}
