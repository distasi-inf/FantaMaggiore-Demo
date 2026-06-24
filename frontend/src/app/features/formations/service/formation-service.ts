import { inject, Injectable } from '@angular/core';
import { environment } from '../../../../environments/environment';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { FormationRequest, FormationResponse } from '../../../core/models/formation.model';
import { PlayerResponse } from '../../../core/models/player.model';
import { AppStateService } from '../../../core/services/app-state.service';

export interface VoteResponse {
  id: number;
  idMatchDay: number;
  idPlayer: number;
  baseVote: number;
  bonus: number;
  malus: number;
  fantaVote: number;
  goals: number;
  assists: number;
  ownGoals: number;
}

@Injectable({
  providedIn: 'root',
})
export class FormationService {
  http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;
  private appState = inject(AppStateService);

  getAvailablePlayers(
    matchDayId: number,
    forceRefresh: boolean = false,
  ): Observable<PlayerResponse[]> {
    const cacheMap = this.appState.formationPlayersCache();

    // 1. Se NON forziamo l'aggiornamento e abbiamo la cache, usiamo la cache
    if (!forceRefresh && cacheMap.has(matchDayId)) {
      return of(cacheMap.get(matchDayId)!);
    }

    // 2. Altrimenti facciamo la chiamata al backend
    return this.http
      .get<PlayerResponse[]>(`${this.apiUrl}/matchdays/${matchDayId}/available-players`)
      .pipe(
        tap((players) => {
          // 3. Aggiorniamo la cache con i nuovi dati freschi
          const updatedMap = new Map(cacheMap);
          updatedMap.set(matchDayId, players);
          this.appState.formationPlayersCache.set(updatedMap);
        }),
      );
  }

  getMyFormation(matchDayId: number): Observable<FormationResponse> {
    return this.http.get<FormationResponse>(`${this.apiUrl}/formations/me/matchDay/${matchDayId}`);
  }

  saveFormation(formationRequest: FormationRequest) {
    return this.http.post(`${this.apiUrl}/formations`, formationRequest, { responseType: 'text' });
  }

  getLiveVotes(matchDayId: number, status: string = ''): Observable<VoteResponse[]> {
    const cacheMap = this.appState.archivedVotesCache();

    if (status === 'CALCULATED' && cacheMap.has(matchDayId)) {
      return of(cacheMap.get(matchDayId)!);
    }

    return this.http.get<VoteResponse[]>(`${this.apiUrl}/votes/matchday/${matchDayId}`).pipe(
      tap((votes) => {
        if (status === 'CALCULATED') {
          const updatedMap = new Map(cacheMap);
          updatedMap.set(matchDayId, votes);
          this.appState.archivedVotesCache.set(updatedMap);
        }
      }),
    );
  }

  getFormationByUserId(
    matchDayId: number,
    userId: number,
    status: string = '',
  ): Observable<FormationResponse> {
    const cacheKey = `${matchDayId}-${userId}`;
    const cacheMap = this.appState.archivedFormations();

    // Se è archiviata e ce l'abbiamo in memoria, la restituiamo subito
    if (status === 'CALCULATED' && cacheMap.has(cacheKey)) {
      return of(cacheMap.get(cacheKey));
    }

    return this.http
      .get<FormationResponse>(`${this.apiUrl}/formations/matchDay/${matchDayId}/user/${userId}`)
      .pipe(
        tap((formation) => {
          // Salviamo in cache SOLO se lo stato è CALCULATED (definitivo)
          if (status === 'CALCULATED') {
            const updatedMap = new Map(cacheMap);
            updatedMap.set(cacheKey, formation);
            this.appState.archivedFormations.set(updatedMap);
          }
        }),
      );
  }
}
