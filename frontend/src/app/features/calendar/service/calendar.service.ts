import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AppStateService } from '../../../core/services/app-state.service';

@Injectable({ providedIn: 'root' })
export class CalendarService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;
  private appState = inject(AppStateService);

  // 🔥 FIX WEBSOCKET: Aggiunto il parametro "forceRefresh"
  getAllMatchdays(forceRefresh: boolean = false): Observable<any[]> {
    if (!forceRefresh && this.appState.matchDaysList()) {
      return of(this.appState.matchDaysList()!);
    }
    return this.http
      .get<any[]>(`${this.apiUrl}/matchdays`)
      .pipe(tap((matchDays) => this.appState.matchDaysList.set(matchDays)));
  }

  // 2. UTENTI
  getAllUsers(): Observable<any[]> {
    if (this.appState.usersList()) {
      return of(this.appState.usersList()!);
    }
    return this.http
      .get<any[]>(`${this.apiUrl}/users`)
      .pipe(tap((users) => this.appState.usersList.set(users)));
  }

  // 3. FORMAZIONI
  getFormationByUser(matchDayId: number, userId: number, status: string): Observable<any> {
    const cacheKey = `${matchDayId}-${userId}`;
    const cacheMap = this.appState.archivedFormations();

    if (status === 'CALCULATED' && cacheMap.has(cacheKey)) {
      return of(cacheMap.get(cacheKey));
    }

    return this.http
      .get<any>(`${this.apiUrl}/formations/matchDay/${matchDayId}/user/${userId}`)
      .pipe(
        tap((formation) => {
          if (status === 'CALCULATED') {
            const updatedMap = new Map(cacheMap);
            updatedMap.set(cacheKey, formation);
            this.appState.archivedFormations.set(updatedMap);
          }
        }),
      );
  }

  // 4. MATCH REALI
  getMatchesByMatchDay(matchDayId: number, status: string = ''): Observable<any[]> {
    const cacheMap = this.appState.archivedMatchesCache();

    if (status === 'CALCULATED' && cacheMap.has(matchDayId)) {
      return of(cacheMap.get(matchDayId)!);
    }

    return this.http.get<any[]>(`${this.apiUrl}/tournaments/matches/matchday/${matchDayId}`).pipe(
      tap((matches) => {
        if (status === 'CALCULATED') {
          const updatedMap = new Map(cacheMap);
          updatedMap.set(matchDayId, matches);
          this.appState.archivedMatchesCache.set(updatedMap);
        }
      }),
    );
  }

  getUsersForMatchDay(matchDayId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/users/for-matchday/${matchDayId}`);
  }
}
