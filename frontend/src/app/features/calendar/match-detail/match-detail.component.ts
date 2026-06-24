import { Component, inject, OnInit, signal, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarService } from './../service/calendar.service';
import { AppStateService } from '../../../core/services/app-state.service';
import { AuthService } from '../../../core/services/auth.service';
import { HeaderComponent } from '../../../shared/components/header/header.component';
import { BetResponse, BetService } from '../../bets/service/bet.service';
import { WebSocketService } from '../../../shared/services/web-socket-service';

@Component({
  selector: 'app-matchday-detail',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, HeaderComponent],
  templateUrl: './match-detail.component.html',
})
export class MatchdayDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  public location = inject(Location);
  private calendarService = inject(CalendarService);
  private destroyRef = inject(DestroyRef);
  private appState = inject(AppStateService);
  public authService = inject(AuthService);

  private betService = inject(BetService);
  private wsService = inject(WebSocketService);

  matchDayId = signal<number | null>(null);
  matchDayTitle = signal<string>('Dettaglio');
  matchDayStatus = signal<string>('CLOSED');
  activeTab = signal<'matches' | 'formations' | 'bets'>('matches');

  realMatches = signal<any[]>([]);
  users = signal<any[]>([]);
  isLoading = signal(true);

  // NUOVI SIGNALS PER LE BETS
  bets = signal<BetResponse[]>([]);
  isLoadingBets = signal(false);

  ngOnInit() {
    const state = window.history.state;
    if (state) {
      this.matchDayStatus.set(state.status || 'CLOSED');
      this.matchDayTitle.set(state.description || 'Dettaglio');

      // 🔥 RIPRISTINO TAB: Se torniamo indietro dalla formazione, riapre "Formazioni"
      if (state.activeTab) {
        this.activeTab.set(state.activeTab);
      }
    }

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.matchDayId.set(id);
        setTimeout(() => this.loadData(id), 100);
      }
    });
    this.wsService.connect();
    this.wsService
      .watch('/topic/users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        // Se un utente viene modificato/bannato, ricarichiamo i dati di questa specifica giornata
        if (msg && msg.action === 'UPDATE' && this.matchDayId()) {
          this.loadData(this.matchDayId()!);
        }
      });
  }

  loadData(id: number) {
    this.isLoading.set(true);

    // Caricamento Match
    this.calendarService.getMatchesByMatchDay(id, this.matchDayStatus()).subscribe({
      next: (matches) => {
        this.realMatches.set(Array.isArray(matches) ? matches : []);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });

    // Caricamento Utenti
    this.calendarService.getUsersForMatchDay(id).subscribe({
      next: (response: any) => {
        let usersArray = [];
        if (Array.isArray(response)) {
          usersArray = response;
        } else if (response && response.content) {
          usersArray = response.content;
        } else if (response && response.data) {
          usersArray = response.data;
        }
        this.users.set(usersArray);
      },
      error: (err) => {
        console.error('Errore nel recupero degli utenti:', err);
        this.users.set([]);
      },
    });

    // NUOVO: Caricamento Sfide
    this.isLoadingBets.set(true);
    this.betService.getBetsByMatchDay(id).subscribe({
      next: (data) => {
        this.bets.set(data);
        this.isLoadingBets.set(false);
      },
      error: () => this.isLoadingBets.set(false),
    });
  }

  viewUserFormation(userId: number) {
    this.router.navigate(['/formations'], {
      state: {
        matchDayId: this.matchDayId(),
        userId: userId,
        status: this.matchDayStatus(),
        matchDayName: this.matchDayTitle(),
        // Peschiamo la deadline dal global state e la passiamo
        deadline: this.appState.matchDaysList()?.find((m) => m.id === this.matchDayId())?.deadline,
        // 🔥 SEGNALE DI ORIGINE: Diciamo alla formazione che veniamo da qui!
        origin: 'calendar',
      },
    });
  }

  goBack() {
    this.router.navigate(['/calendar']);
  }
}
