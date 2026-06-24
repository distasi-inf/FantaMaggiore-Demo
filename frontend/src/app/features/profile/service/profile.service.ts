import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { User } from '../../../core/models/user.model';
import { PlayerRequest, PlayerResponse } from '../../../core/models/player.model';

export interface UpdateProfileDTO {
  name?: string;
  surname?: string;
  username?: string;
  nationality?: string;
  fantasyTeamName?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  /** Dati dell'utente loggato */
  getMyProfile(userId: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${userId}`);
  }

  /** Aggiorna i dati del profilo */
  updateMyProfile(dto: UpdateProfileDTO): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me`, dto);
  }

  /** Cambia la password */
  changePassword(newPassword: string): Observable<string> {
    return this.http.put(
      `${this.apiUrl}/users/me/password`,
      { newPassword },
      { responseType: 'text' },
    );
  }

  // ===================== ALTER-EGO (PLAYER) ===================== //

  getMyPlayer(playerId: number): Observable<PlayerResponse> {
    return this.http.get<PlayerResponse>(`${this.apiUrl}/players/${playerId}`);
  }

  createMyPlayer(dto: PlayerRequest): Observable<PlayerResponse> {
    return this.http.post<PlayerResponse>(`${this.apiUrl}/users/me/player/create`, dto);
  }

  updateMyPlayer(dto: PlayerRequest): Observable<PlayerResponse> {
    return this.http.put<PlayerResponse>(`${this.apiUrl}/users/me/player/edit`, dto);
  }

  deleteMyPlayer(): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/me/player/delete`);
  }

  linkPlayer(playerId: number): Observable<User> {
    return this.http.put<User>(`${this.apiUrl}/users/me/player/${playerId}`, {});
  }

  unlinkPlayer(): Observable<User> {
    return this.http.delete<User>(`${this.apiUrl}/users/me/player`);
  }
}
