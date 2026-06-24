export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  surname: string;
  username: string;
  email: string;
  password: string;
  nationality: string;
  fantasyTeamName: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    name: string;
    surname: string;
    username: string;
    fantasyTeamName: string;
    nationality: string;
    email: string;
    role: string;
    betPoints: number;
    playerId?: number;
  };
}