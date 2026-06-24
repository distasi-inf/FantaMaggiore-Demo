export interface MatchEventRequest {
  type: 'GOAL' | 'ASSIST' | 'OWNGOAL';
  matchId: number;
  playerId: number;
  value: number;
  assistPlayerId?: number | null;
}
