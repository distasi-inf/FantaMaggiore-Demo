import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { MatchDayResponse } from '../../home/model/MatchDayResponse';
import { Observable, of, tap } from 'rxjs';
import { PlayerRequest, PlayerResponse } from '../../../core/models/player.model';
import { AppStateService } from '../../../core/services/app-state.service';
import { HttpParams } from '@angular/common/http';
import { AuditLog } from '../../../core/models/aduitLog.model';

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private appState = inject(AppStateService);

  // --- GIORNATE ---

  createMatchDay(matchDayData: {
    description: string;
    date: string;
    deadline: string;
    playerIds: number[];
  }) {
    return this.http
      .post<MatchDayResponse>(`${this.apiUrl}/matchdays`, matchDayData)
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  updateMatchDay(
    id: number,
    matchDayData: { description: string; date: string; deadline: string; playerIds: number[] },
  ) {
    return this.http
      .put<MatchDayResponse>(`${this.apiUrl}/matchdays/${id}`, matchDayData)
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  addAvailablePlayers(matchDayId: number, playerIds: number[]) {
    return this.http.put(`${this.apiUrl}/matchdays/${matchDayId}/available-players`, playerIds, {
      responseType: 'text',
    });
  }

  getAllMatchDays(): Observable<MatchDayResponse[]> {
    if (this.appState.matchDaysList()) {
      return of(this.appState.matchDaysList()!);
    }
    return this.http
      .get<MatchDayResponse[]>(`${this.apiUrl}/matchdays`)
      .pipe(tap((matchDays) => this.appState.matchDaysList.set(matchDays)));
  }

  openMatchDay(id: number) {
    return this.http
      .put(`${this.apiUrl}/matchdays/${id}/open`, {}, { responseType: 'text' })
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  calculateMatchDayResults(id: number) {
    return this.http
      .put(`${this.apiUrl}/matchdays/${id}/calculate`, {}, { responseType: 'text' })
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  calculateMatchDay(id: number) {
    return this.calculateMatchDayResults(id);
  }

  deleteMatchDay(id: number) {
    return this.http
      .delete(`${this.apiUrl}/matchdays/${id}`)
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  // --- ROLLBACK GIORNATA ---
  rollbackMatchDay(id: number) {
    return this.http
      .put(`${this.apiUrl}/matchdays/${id}/rollback`, {}, { responseType: 'text' })
      .pipe(tap(() => this.appState.clearMatchDaysCache()));
  }

  // --- GIOCATORI ---

  getPlayersPaged(page: number, size: number, search: string = ''): Observable<any> {
    if (!search && this.appState.playersList()) {
      return of(this.appState.playersList()!);
    }
    return this.http
      .get<any>(`${this.apiUrl}/players/paged`, {
        params: { page: page.toString(), size: size.toString(), search },
      })
      .pipe(
        tap((response) => {
          if (!search) {
            this.appState.playersList.set(response);
          }
        }),
      );
  }

  createPlayer(playerData: PlayerRequest): Observable<PlayerResponse> {
    return this.http
      .post<PlayerResponse>(`${this.apiUrl}/players`, playerData)
      .pipe(tap(() => this.appState.clearPlayersCache()));
  }

  updatePlayer(id: number, playerData: PlayerRequest): Observable<PlayerResponse> {
    return this.http
      .put<PlayerResponse>(`${this.apiUrl}/players/${id}`, playerData)
      .pipe(tap(() => this.appState.clearPlayersCache()));
  }

  deletePlayer(id: number): Observable<void> {
    return this.http
      .delete<void>(`${this.apiUrl}/players/${id}`)
      .pipe(tap(() => this.appState.clearPlayersCache()));
  }

  restorePlayer(id: number): Observable<void> {
    return this.http
      .put<void>(`${this.apiUrl}/players/${id}/restore`, {})
      .pipe(tap(() => this.appState.clearPlayersCache()));
  }

  getAllPlayersIncludingDeleted(): Observable<PlayerResponse[]> {
    if (this.appState.allPlayersList()) {
      return of(this.appState.allPlayersList()!);
    }
    return this.http
      .get<PlayerResponse[]>(`${this.apiUrl}/players/all-including-deleted`)
      .pipe(tap((players) => this.appState.allPlayersList.set(players)));
  }

  getDeletedPlayers(): Observable<PlayerResponse[]> {
    if (this.appState.deletedPlayersList()) {
      return of(this.appState.deletedPlayersList()!);
    }
    return this.http
      .get<PlayerResponse[]>(`${this.apiUrl}/players/deleted`)
      .pipe(tap((players) => this.appState.deletedPlayersList.set(players)));
  }

  // --- LA SUPER CHIAMATA PER I GIOCATORI ---
  getPlayersPagedAdvanced(
    page: number = 0,
    size: number = 10,
    search: string = '',
    role: string = 'TUTTI',
    active: boolean = true,
    sortBy: string = 'surname',
    sortDir: string = 'ASC',
  ): Observable<PageResponse<PlayerResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('role', role)
      .set('active', active.toString())
      .set('sortBy', sortBy)
      .set('sortDir', sortDir);

    // Aggiungiamo la ricerca solo se c'è testo
    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<PageResponse<PlayerResponse>>(`${this.apiUrl}/players/paged`, { params });
  }

  // --- TORNEO ---

  generateCalendar(): Observable<string> {
    return this.http.post(
      `${this.apiUrl}/rankings/generate-calendar`,
      {},
      { responseType: 'text' },
    );
  }

  // --- UTENTI ---

  getAllUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users`);
  }

  // --- LA SUPER CHIAMATA PER GLI UTENTI ---
  getAllUsersPagedAndSearched(
    page: number = 0,
    size: number = 10,
    search: string = '',
    role: string = 'TUTTI',
  ): Observable<PageResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString())
      .set('role', role);

    if (search && search.trim() !== '') {
      params = params.set('search', search.trim());
    }

    return this.http.get<PageResponse<any>>(`${this.apiUrl}/users`, { params });
  }

  updateUserAsAdmin(id: number, userData: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/users/${id}`, userData);
  }

  deleteUserAsAdmin(id: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/users/${id}`, { responseType: 'text' });
  }

  resetUserPasswordAsAdmin(id: number, newPassword: string): Observable<string> {
    return this.http.put(
      `${this.apiUrl}/users/${id}/password`,
      { newPassword },
      { responseType: 'text' },
    );
  }

  restoreUserAsAdmin(id: number): Observable<string> {
    return this.http.put(`${this.apiUrl}/users/${id}/restore`, {}, { responseType: 'text' });
  }

  // --- AUDIT LOGS ---
  getAuditLogs(page: number = 0, size: number = 15, search: string = ''): Observable<PageResponse<AuditLog>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (search) params = params.set('search', search);

    return this.http.get<PageResponse<AuditLog>>(`${this.apiUrl}/audit-logs`, { params });
  }
}

