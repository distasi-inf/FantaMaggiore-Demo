import {
  Component,
  inject,
  OnInit,
  signal,
  computed,
  DestroyRef,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import autoAnimate from '@formkit/auto-animate';

import { HomeService } from './service/home-service';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { AuthService } from '../../core/services/auth.service';
import { AppStateService } from '../../core/services/app-state.service';
import { toast } from 'ngx-sonner';

import { GlobalRankingResponse } from './model/GlobalRankingResponse';
import { HeaderComponent } from '../../shared/components/header/header.component';

export interface ExtendedRanking extends GlobalRankingResponse {
  trend?: 'up' | 'down' | 'stable';
  positionsMoved?: number;
  isJustUpdated?: boolean;
  liveDirection?: 'up' | 'down' | 'neutral';
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, HeaderComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class Home implements OnInit {
  @ViewChild('matchCarousel') matchCarousel!: ElementRef;
  @ViewChild('betCarousel') betCarousel!: ElementRef;

  private homeService = inject(HomeService);
  private wsService = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);
  public authService = inject(AuthService);
  public appState = inject(AppStateService);

  currentMatchDay = signal<any | null>(null);
  realMatches = signal<any[]>([]);
  activeBets = signal<any[]>([]);
  globalRanking = signal<ExtendedRanking[]>([]);

  isLoadingMatchDay = signal(true);
  isLoadingMatches = signal(false);
  isLoadingBets = signal(false);
  isLoadingRanking = signal(true);

  hasSubmittedFormation = signal<boolean>(false);

  activeMatchIndex = signal(0);
  activeBetIndex = signal(0);

  countdown = signal('');
  private countdownInterval: any;

  isLive = computed(() => this.currentMatchDay()?.status === 'LIVE');
  isOpen = computed(() => this.currentMatchDay()?.status === 'OPEN');

  currentUserId = computed(() => {
    const token = this.authService.getToken();
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.id;
    } catch {
      return null;
    }
  });

  myGlobalEntry = computed(() =>
    this.globalRanking().find((r) => r.userId === this.currentUserId()),
  );

  myPosition = computed(() => {
    const idx = this.globalRanking().findIndex((r) => r.userId === this.currentUserId());
    return idx >= 0 ? idx + 1 : 0;
  });

  top5Ranking = computed(() => this.globalRanking().slice(0, 5));

  myEntryOutsideTop5 = computed(() => {
    const pos = this.myPosition();
    return pos > 5 ? pos : null;
  });

  matchDayDate = computed(() => {
    const d = this.currentMatchDay()?.date;
    if (!d) return '';
    return new Date(d).toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  });

  deadlineTime = computed(() => {
    const d = this.currentMatchDay()?.deadline;
    if (!d) return '';
    return new Date(d).toLocaleTimeString('it-IT', {
      hour: '2-digit',
      minute: '2-digit',
    });
  });

  showBets = computed(() => this.activeBets().length > 0);
  showEmptyBets = computed(() => this.activeBets().length === 0 && !this.isLoadingBets());

  ngOnInit() {
    this.loadInitialData();
    this.refreshRanking();
    this.setupWebSockets();
    this.wsService.connect();
  }

  loadInitialData() {
    this.isLoadingMatchDay.set(true);
    this.homeService
      .getCurrentMatchday()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (md) => {
          this.currentMatchDay.set(md);
          if (md) {
            this.startCountdown(md.deadline);
            this.loadMatchesAndBets(md.id);

            this.homeService
              .checkFormationSubmitted(md.id)
              .pipe(takeUntilDestroyed(this.destroyRef))
              .subscribe({
                next: (isSubmitted) => {
                  this.hasSubmittedFormation.set(isSubmitted);
                  this.isLoadingMatchDay.set(false);
                },
                error: () => {
                  this.hasSubmittedFormation.set(false);
                  this.isLoadingMatchDay.set(false);
                },
              });
          } else {
            this.isLoadingMatchDay.set(false);
          }
        },
        error: () => {
          this.currentMatchDay.set(null);
          this.isLoadingMatchDay.set(false);
        },
      });
  }

  loadMatchesAndBets(id: number) {
    this.isLoadingMatches.set(true);
    this.isLoadingBets.set(true);

    this.homeService
      .getMatchesByMatchDay(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.realMatches.set(data);
          this.isLoadingMatches.set(false);
        },
        error: () => this.isLoadingMatches.set(false),
      });

    this.homeService
      .getBetsByMatchDay(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.activeBets.set(data);
          this.isLoadingBets.set(false);
        },
        error: () => this.isLoadingBets.set(false),
      });
  }

  refreshRanking(isLiveRefresh: boolean = false) {
    if (!this.appState.globalRankingCache() && !isLiveRefresh) {
      this.isLoadingRanking.set(true);
    }

    this.homeService.getGlobalRanking(isLiveRefresh).subscribe({
      next: (newData) => {
        this.processRankingData(newData);

        setTimeout(() => {
          const listContainer = document.getElementById('home-ranking-list-container');
          if (listContainer && !listContainer.hasAttribute('data-auto-animate')) {
            autoAnimate(listContainer, { duration: 500 });
            listContainer.setAttribute('data-auto-animate', 'true');
          }
        }, 100);
      },
      error: () => this.isLoadingRanking.set(false),
    });
  }

  private processRankingData(newData: GlobalRankingResponse[]) {
    const oldRanking = this.globalRanking();
    const enriched = newData.map((newUser, newIndex) => {
      const currentPos = newIndex + 1;
      const startPos = newUser.previousPosition || currentPos;
      const oldUserIndex = oldRanking.findIndex((u) => u.userId === newUser.userId);

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let positionsMoved = 0;
      if (startPos > 0 && currentPos < startPos) {
        trend = 'up';
        positionsMoved = startPos - currentPos;
      } else if (startPos > 0 && currentPos > startPos) {
        trend = 'down';
        positionsMoved = currentPos - startPos;
      }

      let isJustUpdated = false;
      let liveDirection: 'up' | 'down' | 'neutral' = 'neutral';

      if (oldUserIndex !== -1) {
        if (newIndex < oldUserIndex) liveDirection = 'up';
        else if (newIndex > oldUserIndex) liveDirection = 'down';
        else if (oldRanking[oldUserIndex].totalPoints < newUser.totalPoints) liveDirection = 'up';
        else if (oldRanking[oldUserIndex].totalPoints > newUser.totalPoints) liveDirection = 'down';

        if (
          oldRanking[oldUserIndex].totalPoints !== newUser.totalPoints ||
          oldUserIndex !== newIndex
        ) {
          isJustUpdated = true;
        }
      }
      return { ...newUser, trend, positionsMoved, isJustUpdated, liveDirection };
    });

    this.globalRanking.set(enriched);
    this.isLoadingRanking.set(false);

    setTimeout(() => {
      this.globalRanking.update((list) => list.map((u) => ({ ...u, isJustUpdated: false })));
    }, 5000);
  }

  scrollNext(type: 'matches' | 'bets') {
    const el =
      type === 'matches' ? this.matchCarousel.nativeElement : this.betCarousel.nativeElement;
    const card = el.querySelector('.snap-center');
    if (card) el.scrollBy({ left: card.clientWidth + 16, behavior: 'smooth' });
  }

  scrollPrev(type: 'matches' | 'bets') {
    const el =
      type === 'matches' ? this.matchCarousel.nativeElement : this.betCarousel.nativeElement;
    const card = el.querySelector('.snap-center');
    if (card) el.scrollBy({ left: -(card.clientWidth + 16), behavior: 'smooth' });
  }

  onScroll(event: any, type: 'matches' | 'bets') {
    const el = event.target;
    const card = el.querySelector('.snap-center');
    if (card) {
      const cardWidth = card.clientWidth + 16;
      const isEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 15;
      const totalItems = type === 'matches' ? this.realMatches().length : this.activeBets().length;
      let index = isEnd ? totalItems - 1 : Math.round(el.scrollLeft / cardWidth);
      index = Math.max(0, Math.min(index, totalItems - 1));
      if (type === 'matches') this.activeMatchIndex.set(index);
      else this.activeBetIndex.set(index);
    }
  }

  private setupWebSockets() {
    this.wsService
      .watch('/topic/matches')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (['SAVE', 'DELETE', 'UPDATE'].includes(msg.action)) {
          this.loadMatchesAndBets(this.currentMatchDay()!.id);
        }
      });

    this.wsService
      .watch('/topic/live-score')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((updatedMatch) => {
        this.realMatches.update((matches) =>
          matches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m)),
        );
      });

    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        this.loadInitialData();
        if (msg && msg.action === 'UPDATE' && msg.matchDay?.status === 'CALCULATED') {
          this.refreshRanking();
        }
      });

    this.wsService
      .watch('/topic/rankings')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action === 'RELOAD') {
          this.appState.clearGlobalRankingCache();
          this.refreshRanking(true);
          if (this.currentMatchDay()) {
            this.loadMatchesAndBets(this.currentMatchDay()!.id);
          }
        }
      });

    // 🔥 FIX BUG CLASSIFICA HOME: ascolta /topic/users per aggiornare
    // nome/cognome/fantasyTeamName in tempo reale quando un utente li modifica.
    this.wsService
      .watch('/topic/users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (msg && msg.action === 'UPDATE') {
          this.appState.clearGlobalRankingCache();
          this.refreshRanking(true);
        }
      });
  }

  private startCountdown(deadline: string) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const tick = () => {
      const diff = new Date(deadline).getTime() - Date.now();
      if (diff <= 0) {
        this.countdown.set('Scaduto');
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.countdown.set(`${h}h ${m}m ${s}s`);
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }

  medalFor(position: number): string {
    if (position === 1) return '🥇';
    if (position === 2) return '🥈';
    if (position === 3) return '🥉';
    return '';
  }

  hasVoted(bet: any): boolean {
    return !!bet.userPrediction;
  }

  yesPercent(bet: any): number {
    const total = bet.participantCount;
    if (!total) return 50;
    return Math.round((bet.yesCount / total) * 100);
  }
}
