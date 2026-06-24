import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { MatchResponse } from '../model/MatchResponse';
import { Observable, of, tap } from 'rxjs'; // Importato tap
import { MatchEventRequest } from '../model/MatchEventRequest';
import { TournamentRanking } from '../../../core/models/tournament-ranking.model';
import { AppStateService } from '../../../core/services/app-state.service'; // Importato AppStateService

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private appState = inject(AppStateService); // Iniettato AppStateService

  getMatchByMatchdayId(matchDayId: number, status: string = ''): Observable<MatchResponse[]> {
    const cacheMap = this.appState.archivedMatchesCache();
    if (status === 'CALCULATED' && cacheMap.has(matchDayId)) return of(cacheMap.get(matchDayId)!);

    return this.http
      .get<MatchResponse[]>(`${this.apiUrl}/tournaments/matches/matchday/${matchDayId}`)
      .pipe(
        tap((matches) => {
          if (status === 'CALCULATED') {
            const updatedMap = new Map(cacheMap);
            updatedMap.set(matchDayId, matches);
            this.appState.archivedMatchesCache.set(updatedMap);
          }
        }),
      );
  }

  startMatch(id: number, duration: number): Observable<MatchResponse> {
    return this.http.put<MatchResponse>(
      `${this.apiUrl}/tournaments/matches/${id}/start?duration=${duration}`,
      {},
    );
  }

  endMatch(id: number): Observable<string> {
    return this.http.put(
      `${this.apiUrl}/tournaments/matches/${id}/end`,
      {},
      { responseType: 'text' },
    );
  }

  // --- INVALIDAZIONE CACHE AGGIUNTA QUI ---
  addEvent(eventData: MatchEventRequest): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/tournaments/matches/events`, eventData).pipe(
      tap(() => this.appState.clearPlayersCache()), // Svuota la cache dei giocatori dopo un evento
    );
  }

  createTournamentTeam(teamData: { teamName: string }) {
    return this.http.post(`${this.apiUrl}/tournaments/teams`, teamData);
  }

  updateTournamentTeam(id: number, teamData: any) {
    return this.http.put(`${this.apiUrl}/tournaments/teams/${id}`, teamData);
  }

  deleteTournamentTeam(id: number) {
    return this.http.delete(`${this.apiUrl}/tournaments/teams/${id}`);
  }

  getTournamentRanking(): Observable<TournamentRanking[]> {
    return this.http.get<TournamentRanking[]>(`${this.apiUrl}/tournaments/ranking`);
  }

  getTournamentRankingByMatchDay(
    matchDayId: number,
    status: string = '',
  ): Observable<TournamentRanking[]> {
    const cacheMap = this.appState.archivedRankingsCache();
    if (status === 'CALCULATED' && cacheMap.has(matchDayId)) return of(cacheMap.get(matchDayId)!);

    return this.http
      .get<TournamentRanking[]>(`${this.apiUrl}/tournaments/ranking/matchday/${matchDayId}`)
      .pipe(
        tap((ranking) => {
          if (status === 'CALCULATED') {
            const updatedMap = new Map(cacheMap);
            updatedMap.set(matchDayId, ranking);
            this.appState.archivedRankingsCache.set(updatedMap);
          }
        }),
      );
  }

  createMatch(matchData: { matchDayId: number; homeTeamId: number; awayTeamId: number }) {
    return this.http.post(`${this.apiUrl}/tournaments/matches`, matchData);
  }

  deleteMatch(matchId: number) {
    return this.http.delete(`${this.apiUrl}/tournaments/matches/${matchId}`);
  }

  getTeamsByMatchDay(matchDayId: number, status: string = ''): Observable<any[]> {
    const cacheMap = this.appState.archivedTeamsCache();
    if (status === 'CALCULATED' && cacheMap.has(matchDayId)) return of(cacheMap.get(matchDayId)!);

    return this.http.get<any[]>(`${this.apiUrl}/tournaments/teams/matchday/${matchDayId}`).pipe(
      tap((teams) => {
        if (status === 'CALCULATED') {
          const updatedMap = new Map(cacheMap);
          updatedMap.set(matchDayId, teams);
          this.appState.archivedTeamsCache.set(updatedMap);
        }
      }),
    );
  }

  getMatchEvents(matchId: number, status: string = ''): Observable<any[]> {
    const cacheMap = this.appState.matchDetailsCache();
    if (status === 'CALCULATED' && cacheMap.has(matchId)) return of(cacheMap.get(matchId)!);

    return this.http.get<any[]>(`${this.apiUrl}/tournaments/matches/${matchId}/events`).pipe(
      tap((events) => {
        if (status === 'CALCULATED') {
          const updatedMap = new Map(cacheMap);
          updatedMap.set(matchId, events);
          this.appState.matchDetailsCache.set(updatedMap);
        }
      }),
    );
  }

  // --- INVALIDAZIONE CACHE AGGIUNTA QUI ---
  removeEvent(eventId: number): Observable<string> {
    return this.http
      .delete(`${this.apiUrl}/tournaments/matches/events/${eventId}`, {
        responseType: 'text',
      })
      .pipe(
        tap(() => this.appState.clearPlayersCache()), // Svuota la cache dei giocatori anche quando rimuovi un evento
      );
  }

  setGuestGoalkeepers(
    matchId: number,
    homeGuestId: number | null,
    awayGuestId: number | null,
  ): Observable<MatchResponse> {
    const payload = { homeGuestId, awayGuestId };
    return this.http.put<MatchResponse>(
      `${this.apiUrl}/tournaments/matches/${matchId}/guest-goalkeepers`,
      payload,
    );
  }
}
