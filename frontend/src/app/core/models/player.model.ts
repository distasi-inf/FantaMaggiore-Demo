export interface Player {
  id: number;
  name: string;
  surname: string;
  nickname?: string;
  nationality: string;
  profileImg?: string;
  role: 'PORTIERE' | 'DIFENSORE' | 'CENTROCAMPISTA' | 'ATTACCANTE';

  // Statistiche
  totalGoal: number;
  totalAssist: number;
  totalOwnGoal: number;
  gamesPlayed: number;
  averageFantaVote: number;
  active: boolean;

  userId?: number; // Opzionale, se il giocatore è collegato a un utente
}

// Alias per retrocompatibilità
export type PlayerResponse = Player;

export interface PlayerRequest {
  name: string;
  surname: string;
  nickname?: string;
  nationality: string;
  profileImg?: string;
  role: 'PORTIERE' | 'DIFENSORE' | 'CENTROCAMPISTA' | 'ATTACCANTE';
  userId?: number | null;
}
