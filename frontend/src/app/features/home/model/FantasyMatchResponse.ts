export interface FantasyMatchResponse {
  id: number;
  matchDayId: number;
  matchDayDescription: string;
  user1Id: number;
  user1FantasyTeamName: string;
  user1OwnerName: string;
  user1Username: string; // Quello che abbiamo aggiunto nel mapper
  scoreUser1: number;
  goalsUser1: number;
  user2Id: number;
  user2FantasyTeamName: string;
  user2OwnerName: string;
  user2Username: string;
  scoreUser2: number;
  goalsUser2: number;
  calculated: boolean;
}