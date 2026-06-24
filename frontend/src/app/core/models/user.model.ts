import { Role } from './role.enum';

export interface User {
  id: number;
  name: string;
  surname: string;
  username: string;
  fantasyTeamName: string;
  nationality?: string;
  email: string;
  role: Role;      // Usiamo l'Enum invece di una stringa generica
  locked: boolean; // Per gestire il ban/ripristino
  betPoints: number;
  playerId?: number;
}