import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { NgxSonnerToaster, toast } from 'ngx-sonner';
import { CommonModule } from '@angular/common';
import { AuthService } from './core/services/auth.service';
import { NavbarComponent } from '../app/shared/components/nav-bar/nav-bar-component';
import { WebSocketService } from './shared/services/web-socket-service';
import { Subscription } from 'rxjs';
import { AppStateService } from './core/services/app-state.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NgxSonnerToaster, CommonModule, NavbarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public router = inject(Router);
  private wsService = inject(WebSocketService);
  private appState = inject(AppStateService);
  private http = inject(HttpClient);

  // 🔥 FIX SPLASH SCREEN: segnale letto dall'app.html per mostrare/nascondere
  // il loader. Rimane false finché il server non risponde alla prima chiamata.
  isAppReady = signal(false);

  private usersSub?: Subscription;
  private rankingsSub?: Subscription;
  private matchdaysSub?: Subscription;

  // Timeout di sicurezza: se il server non risponde entro 15s mostriamo
  // comunque l'app (evita che resti bloccata per sempre su errori 4xx/offline)
  private readyTimeout: any;

  get hideGlobalNavbar(): boolean {
    const url = this.router.url;
    return (
      url.includes('/login') ||
      url.includes('/registration') ||
      url.includes('/admin') ||
      url.includes('/formations')
    );
  }

  ngOnInit() {
    // ── SPLASH SCREEN LOGIC ──────────────────────────────────────────────────
    // Facciamo una chiamata leggera al backend (health-check implicito).
    // Non appena risponde (anche con errore 4xx/5xx) siamo sicuri che il server
    // è sveglio e nascondiamo la splash. Il timeout è una rete di sicurezza.
    this.readyTimeout = setTimeout(() => this.isAppReady.set(true), 15_000);

    this.http.get(`${environment.apiUrl}/matchdays/current`, { responseType: 'text' }).subscribe({
      next: () => this.markReady(),
      error: () => this.markReady(), // anche un 401/404 significa che il server risponde
    });
    // ────────────────────────────────────────────────────────────────────────

    this.authService.currentUser$.subscribe((token) => {
      if (token) {
        console.log('🚀 [APP] Utente loggato, avvio WebSocket...');
        this.wsService.connect();

        // 1. Iscrizione utenti
        if (!this.usersSub || this.usersSub.closed) {
          this.usersSub = this.wsService.watch('/topic/users').subscribe((msg: any) => {
            this.handleUserUpdate(msg, token);
          });
        }

        // 2. Iscrizione classifiche
        if (!this.rankingsSub || this.rankingsSub.closed) {
          this.rankingsSub = this.wsService.watch('/topic/rankings').subscribe((msg: any) => {
            if (msg && msg.action === 'RELOAD') {
              this.appState.clearGlobalRankingCache();
            }
          });
        }

        // 3. Sincronizzazione Globale Giornate
        if (!this.matchdaysSub || this.matchdaysSub.closed) {
          this.matchdaysSub = this.wsService.watch('/topic/matchdays').subscribe((msg: any) => {
            if (msg) {
              console.log('🌍 [GLOBAL] Stato giornata cambiato! Sincronizzo la cache...');
              this.http.get<any[]>(`${environment.apiUrl}/matchdays`).subscribe((res) => {
                this.appState.matchDaysList.set(res);
              });
            }
          });
        }
      } else {
        this.wsService.disconnect();
        if (this.usersSub) this.usersSub.unsubscribe();
        if (this.rankingsSub) this.rankingsSub.unsubscribe();
        if (this.matchdaysSub) this.matchdaysSub.unsubscribe();
      }
    });
  }

  private markReady() {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
    this.isAppReady.set(true);
  }

  private handleUserUpdate(msg: any, currentToken: string) {
    if (!msg || msg.action !== 'UPDATE' || !msg.user) return;
    try {
      const payload = JSON.parse(atob(currentToken.split('.')[1]));
      const myEmail = String(payload.sub || payload.email || '')
        .toLowerCase()
        .trim();
      const msgEmail = String(msg.user.email || '')
        .toLowerCase()
        .trim();

      if (myEmail === msgEmail) {
        const myRole = String(payload.role || payload.authorities?.[0] || 'USER')
          .replace('ROLE_', '')
          .trim();
        const msgRole = String(msg.user.role || 'USER')
          .replace('ROLE_', '')
          .trim();

        if (myRole !== msgRole) {
          this.authService.refreshToken().subscribe({
            next: () => {
              toast.info('Permessi aggiornati in tempo reale!', {
                style: { backgroundColor: '#3b82f6', color: '#fff', border: 'none' },
              });
              setTimeout(() => window.location.reload(), 1500);
            },
          });
        }
      }
    } catch (error) {
      console.error('❌ Errore token:', error);
    }
  }

  ngOnDestroy() {
    if (this.usersSub) this.usersSub.unsubscribe();
    if (this.rankingsSub) this.rankingsSub.unsubscribe();
    if (this.matchdaysSub) this.matchdaysSub.unsubscribe();
    if (this.readyTimeout) clearTimeout(this.readyTimeout);
  }
}
