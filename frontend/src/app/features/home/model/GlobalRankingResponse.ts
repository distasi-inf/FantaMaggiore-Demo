export interface GlobalRankingResponse {
  userId: number;
  fantasyTeamName: string; // 🔥 AGGIUNTO — da mappare anche nel backend
  userName: string;
  userSurname: string;
  totalPoints: number;
  maxSingleMatchScore: number;
  betPoints: number;
  previousPosition: number;
}