import { VoteResponse } from './vote.model';

export interface FormationRequest {
  matchDayId: number;
  starterIds: number[];
  subId: number | null;
}

export interface FormationResponse {
  id: number;
  userId: number;
  matchDayId: number;
  
  starterIds: number[];        
  subId: number | null;         
  
  starterVotes: VoteResponse[];
  subVote: VoteResponse | null;
  totalScore: number;
  carriedOver: boolean;
}
