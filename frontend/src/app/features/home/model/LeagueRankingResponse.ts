export interface LeagueRankingResponse {
  fantasyTeamName: string;
  ownerName: string;
  points: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  totalScoreSum: number;
  goalDifference: number;
}