export interface TeamResponse {
  id: number;
  teamName: string;
  points: number;
  goalsScored: number;
  goalsConceded: number;
  goalDifference: number;
  idCaptain: number;
  idMatchDay: number;
  playerIds: number[];
}