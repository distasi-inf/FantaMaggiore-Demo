import { Component, inject, OnInit, signal, DestroyRef, computed } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import autoAnimate from '@formkit/auto-animate';

import { HomeService } from '../home/service/home-service';
import { GlobalRankingResponse } from '../home/model/GlobalRankingResponse';
import { AppStateService } from '../../core/services/app-state.service';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { AuthService } from '../../core/services/auth.service';
import { JwtHelperService } from '../../core/services/jwt-helper.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

export interface ExtendedRanking extends GlobalRankingResponse {
  trend?: 'up' | 'down' | 'stable';
  positionsMoved?: number;
  isJustUpdated?: boolean;
  liveDirection?: 'up' | 'down' | 'neutral';
}

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, HeaderComponent],
  templateUrl: './ranking.component.html',
})
export class RankingComponent implements OnInit {
  private homeService = inject(HomeService);
  private destroyRef = inject(DestroyRef);
  public location = inject(Location);
  public appState = inject(AppStateService);
  private wsService = inject(WebSocketService);
  public authService = inject(AuthService);
  private jwtHelper = inject(JwtHelperService);

  ranking = signal<ExtendedRanking[]>([]);
  isLoading = signal<boolean>(true);

  ngOnInit() {
    this.loadRanking();
    this.setupWebSocket();
  }

  loadRanking(isLiveRefresh: boolean = false) {
    if (!this.appState.globalRankingCache() && !isLiveRefresh) {
      this.isLoading.set(true);
    }

    this.homeService
      .getGlobalRanking(isLiveRefresh)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newData) => {
          this.applyFinalRanking(newData);

          setTimeout(() => {
            const listContainer = document.getElementById('ranking-list-container');
            if (listContainer && !listContainer.hasAttribute('data-auto-animate')) {
              autoAnimate(listContainer, { duration: 500 });
              listContainer.setAttribute('data-auto-animate', 'true');
            }
          }, 100);
        },
        error: (err) => {
          console.error('Errore classifica:', err);
          this.isLoading.set(false);
        },
      });
  }

  private applyFinalRanking(newData: GlobalRankingResponse[]) {
    const oldRanking = this.ranking();

    const enrichedData = newData.map((newUser, newIndex) => {
      const oldUserIndex = oldRanking.findIndex((u) => u.userId === newUser.userId);
      const currentPosition = newIndex + 1;
      const startPosition = newUser.previousPosition || currentPosition;

      let trend: 'up' | 'down' | 'stable' = 'stable';
      let positionsMoved = 0;

      if (startPosition > 0 && currentPosition < startPosition) {
        trend = 'up';
        positionsMoved = startPosition - currentPosition;
      } else if (startPosition > 0 && currentPosition > startPosition) {
        trend = 'down';
        positionsMoved = currentPosition - startPosition;
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

    this.ranking.set(enrichedData);
    this.isLoading.set(false);

    setTimeout(() => {
      this.ranking.update((list) => list.map((u) => ({ ...u, isJustUpdated: false })));
    }, 5000);
  }

  private setupWebSocket() {
    this.wsService.connect();

    // Aggiorna quando la classifica cambia (fine giornata, scommesse)
    this.wsService
      .watch('/topic/rankings')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action === 'RELOAD') {
          this.appState.clearGlobalRankingCache();
          this.loadRanking(true);
        }
      });

    // 🔥 FIX BUG CLASSIFICA: ascolta anche /topic/users per aggiornare
    // nome/cognome/fantasyTeamName in tempo reale quando un utente modifica
    // il proprio profilo da un'altra sessione o device.
    this.wsService
      .watch('/topic/users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (msg && msg.action === 'UPDATE') {
          this.appState.clearGlobalRankingCache();
          this.loadRanking(true);
        }
      });
  }

  isCurrentUser(userId: number): boolean {
    return this.jwtHelper.getCurrentUserId() === userId;
  }
}
