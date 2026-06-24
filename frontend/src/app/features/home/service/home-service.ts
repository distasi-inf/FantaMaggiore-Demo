import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { MatchDayResponse } from '../model/MatchDayResponse';
import { GlobalRankingResponse } from '../model/GlobalRankingResponse';
import { AppStateService } from '../../../core/services/app-state.service';

@Injectable({
  providedIn: 'root',
})
export class HomeService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;
  private appState = inject(AppStateService);

  getCurrentMatchday(): Observable<MatchDayResponse> {
    return this.http.get<MatchDayResponse>(`${this.apiUrl}/matchdays/current`);
  }

  getAllMatchDays(forceRefresh: boolean = false): Observable<any[]> {
    const cached = this.appState.matchDaysList();
    // Se c'è la cache e non forziamo l'aggiornamento, usiamo la cache
    if (cached && cached.length > 0 && !forceRefresh) return of(cached);

    return this.http
      .get<any[]>(`${this.apiUrl}/matchdays`)
      .pipe(tap((data) => this.appState.matchDaysList.set(data)));
  }

  getGlobalRanking(forceRefresh: boolean = false): Observable<any[]> {
    const cached = this.appState.globalRankingCache();
    if (cached && cached.length > 0 && !forceRefresh) return of(cached);

    return this.http.get<any[]>(`${this.apiUrl}/rankings/global`).pipe(
      tap((data) => {
        this.appState.globalRankingCache.set(data); // ← era commentato, ora attivo
      }),
    );
  }

  getMatchesByMatchDay(matchDayId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/tournaments/matches/matchday/${matchDayId}`);
  }

  getBetsByMatchDay(matchDayId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/bets/matchday/${matchDayId}`);
  }

  // 🔥 FIX CRITICO: sostituito il vecchio /join (inesistente) con /predict (endpoint reale)
  predictBet(betId: number, type: 'YES' | 'NO'): Observable<string> {
    return this.http.post(
      `${this.apiUrl}/bets/${betId}/predict`,
      { type },
      { responseType: 'text' },
    );
  }

  checkFormationSubmitted(matchDayId: number): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/formations/matchday/${matchDayId}/mine/exists`);
  }
}
