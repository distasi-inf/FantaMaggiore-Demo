export interface MatchResponse {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeamName: string;   // AGGIUNTO
  awayTeamName: string;   // AGGIUNTO
  matchDayId: number;
  matchStatus: 'PRE' | 'LIVE' | 'FINISHED';
  startTime?: string;
  endTime?: string;
  expectedDuration?: number;
  actualDuration?: number;
  homeScore: number;
  awayScore: number;

  homeGuestGoalkeeperId?: number | null;
  awayGuestGoalkeeperId?: number | null;
}