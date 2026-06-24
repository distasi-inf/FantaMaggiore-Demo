import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type BetStatus = 'PENDING' | 'WON' | 'LOST';
export type PredictionType = 'YES' | 'NO';

export interface BetResponse {
  id: number;
  description: string;
  status: BetStatus;
  creatorId: number;
  creatorName?: string;
  matchDayId: number;
  participantCount: number;
  yesCount: number;
  noCount: number;
  userPrediction?: PredictionType;
  isCreator: boolean; // 🔥 ESSENZIALE PER LA MODIFICA
}

@Injectable({
  providedIn: 'root',
})
export class BetService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/bets`;

  createBet(request: { description: string; matchDayId: number }): Observable<BetResponse> {
    return this.http.post<BetResponse>(this.apiUrl, request);
  }

  placePrediction(betId: number, type: PredictionType): Observable<string> {
    return this.http.post(`${this.apiUrl}/${betId}/predict`, { type }, { responseType: 'text' });
  }

  // 🔥 MANCAVA: Permette di ritirare il voto
  removePrediction(betId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${betId}/predict`, { responseType: 'text' });
  }

  resolveBet(betId: number, status: BetStatus): Observable<string> {
    return this.http.put(`${this.apiUrl}/${betId}/resolve/${status}`, null, {
      responseType: 'text',
    });
  }

  // 🔥 MANCAVA: Permette al creatore di modificare il testo
  updateBet(betId: number, description: string): Observable<BetResponse> {
    return this.http.put<BetResponse>(`${this.apiUrl}/${betId}`, { description, matchDayId: 0 });
  }

  getBetsByMatchDay(matchDayId: number): Observable<BetResponse[]> {
    return this.http.get<BetResponse[]>(`${this.apiUrl}/matchday/${matchDayId}`);
  }

  deleteBet(betId: number): Observable<string> {
    return this.http.delete(`${this.apiUrl}/${betId}`, { responseType: 'text' });
  }

  getMyBets(): Observable<BetResponse[]> {
    return this.http.get<BetResponse[]>(`${this.apiUrl}/me`);
  }
}
