import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface PlayerResponse {
  id: number;
  name: string;
  surname: string;
  nickname: string;
  nationality: string;
  profileImg: string;
  role: 'PORTIERE' | 'DIFENSORE' | 'CENTROCAMPISTA' | 'ATTACCANTE';
  totalGoal: number;
  totalAssist: number;
  totalOwnGoal: number;
  gamesPlayed: number;
  averageFantaVote: number;
  isActive: boolean;
  userId: number | null;
}

export interface PagedResponse<T> {
  content: T[];
  totalPages: number;
  totalElements: number;
  number: number; // pagina corrente
}

@Injectable({
  providedIn: 'root',
})
export class PlayerService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/players`;

  getPlayersPaged(
    page: number = 0,
    size: number = 20,
    search: string = '',
    role: string = 'TUTTI',
    sortBy: string = 'surname',
    sortDir: string = 'ASC',
  ): Observable<PagedResponse<PlayerResponse>> {
    const params: any = { page, size, active: true, sortBy, sortDir };
    if (search) params['search'] = search;
    if (role !== 'TUTTI') params['role'] = role;

    return this.http.get<PagedResponse<PlayerResponse>>(`${this.apiUrl}/paged`, { params });
  }

  getPlayerById(id: number): Observable<PlayerResponse> {
    return this.http.get<PlayerResponse>(`${this.apiUrl}/${id}`);
  }

  getAllPlayers(): Observable<PlayerResponse[]> {
    return this.http.get<PlayerResponse[]>(this.apiUrl);
  }
}
