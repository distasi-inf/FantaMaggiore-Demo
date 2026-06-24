import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, throwError } from 'rxjs';
// FIX: importa 'environment' (non 'environment.development')
import { environment } from '../../../environments/environment';
import { LoginRequest, RegisterRequest, AuthResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/users`;

  private currentUserSubject = new BehaviorSubject<string | null>(this.getToken());
  public currentUser$ = this.currentUserSubject.asObservable();

  public getToken(): string | null {
    return localStorage.getItem('jwt_token');
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap((response) => {
        this.saveToken(response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem('refresh_token', response.refreshToken);
        }
        this.currentUserSubject.next(response.accessToken);
      }),
    );
  }

  logout(): void {
    localStorage.removeItem('jwt_token');
    localStorage.removeItem('refresh_token');
    this.currentUserSubject.next(null);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  register(userData: RegisterRequest): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, userData);
  }

  saveToken(token: string) {
    localStorage.setItem('jwt_token', token);
  }

  checkEmail(email: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/check-email`, { params: { email } });
  }

  checkUsername(username: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/check-username`, { params: { username } });
  }

  checkTeamName(name: string): Observable<boolean> {
    return this.http.get<boolean>(`${this.apiUrl}/check-fantasy-name`, { params: { name } });
  }

  /**
   * FIX: logica spostata in JwtHelperService per evitare duplicazione.
   * Qui manteniamo il metodo per retrocompatibilità con i componenti che lo usano già,
   * ma il parsing vero avviene in un solo posto.
   */
  isAdmin(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      const payload = JSON.parse(atob(parts[1]));
      const role = payload.role ?? payload.authorities?.[0] ?? '';
      return ['ADMIN', 'ROLE_ADMIN', 'SUPER_ADMIN', 'ROLE_SUPER_ADMIN'].includes(role);
    } catch {
      return false;
    }
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('Refresh token mancante'));
    }
    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh`, { refreshToken }).pipe(
      tap((response) => {
        this.saveToken(response.accessToken);
        if (response.refreshToken) {
          localStorage.setItem('refresh_token', response.refreshToken);
        }
        this.currentUserSubject.next(response.accessToken);
      }),
    );
  }
}
