import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { BetService, BetResponse, BetStatus, PredictionType } from './service/bet.service';
import { AuthService } from '../../core/services/auth.service';
import { AppStateService } from '../../core/services/app-state.service';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { HomeService } from '../home/service/home-service';
import { toast } from 'ngx-sonner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FantaModalComponent } from '../../shared/components/fanta-modal/fanta-modal.component';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { JwtHelperService } from '../../core/services/jwt-helper.service';

@Component({
  selector: 'app-bets',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, FantaModalComponent, HeaderComponent],
  templateUrl: './bets.component.html',
})
export class BetsComponent implements OnInit {
  private betService = inject(BetService);
  public authService = inject(AuthService);
  private appState = inject(AppStateService);
  private homeService = inject(HomeService);
  private wsService = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);
  private jwtHelper = inject(JwtHelperService);

  activeFilter = signal<'ALL' | 'CREATED' | 'PREDICTED'>('ALL');
  allBets = signal<BetResponse[]>([]);
  globalRanking = signal<any[]>([]);
  isLoading = signal(true);
  currentMatchDayId = signal<number>(0);

  // --- COMPUTED LOGIC ---
  currentUserId = computed(() => this.jwtHelper.getCurrentUserId());

  // Priorità assoluta al LIVE, poi OPEN
  activeMatchDay = computed(() => {
    const days = this.appState.matchDaysList();
    if (!days) return null;
    return (
      days.find((d) => d.status === 'LIVE') ||
      days.find((d) => d.status === 'OPEN') ||
      days
        .filter((d) => d.status === 'CALCULATED')
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] ||
      null
    );
  });

  myGlobalEntry = computed(() =>
    this.globalRanking().find((r) => r.userId === this.currentUserId()),
  );

  betStats = computed(() => {
    const bets = this.allBets();
    const won = bets.filter((b) => this.didIWin(b) === true).length;
    const total = bets.filter((b) => b.userPrediction).length;
    return { won, total };
  });

  displayBets = computed(() => {
    const bets = this.allBets();
    const filter = this.activeFilter();
    const uid = this.currentUserId();
    if (filter === 'CREATED') return bets.filter((b) => b.creatorId === uid);
    if (filter === 'PREDICTED') return bets.filter((b) => !!b.userPrediction);
    return bets;
  });

  // --- MODAL SIGNALS ---
  isCreateModalOpen = signal(false);
  newBetDescription = signal('');
  isEditModalOpen = signal(false);
  betToEdit = signal<BetResponse | null>(null);
  editDescription = signal('');
  isConfirmModalOpen = signal(false);
  pendingBetId = signal<number | null>(null);
  pendingStatus = signal<BetStatus | null>(null);
  isDeleteModalOpen = signal(false);
  betToDeleteId = signal<number | null>(null);
  isWithdrawModalOpen = signal(false);
  betToWithdrawId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadRanking();
    const currentList = this.appState.matchDaysList();
    if (!currentList || currentList.length === 0) {
      this.homeService
        .getAllMatchDays()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.initData());
    } else {
      this.initData();
    }
  }

  private initData(): void {
    this.syncMatchDay();
    this.loadBets();
    this.setupWebSockets();
  }

  private syncMatchDay() {
    const active = this.activeMatchDay();
    this.currentMatchDayId.set(active ? active.id : 0);
  }

  loadRanking() {
    this.homeService.getGlobalRanking(true).subscribe((data) => this.globalRanking.set(data));
  }

  private setupWebSockets() {
    this.wsService.connect();

    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.homeService.getAllMatchDays(true).subscribe((res) => {
          this.appState.matchDaysList.set(res);
          this.syncMatchDay();
          this.loadBets();
        });
      });

    this.wsService
      .watch('/topic/rankings')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadBets();
        this.loadRanking();
      });
  }

  loadBets() {
    if (this.currentMatchDayId() === 0) {
      this.isLoading.set(false);
      this.allBets.set([]);
      return;
    }
    this.isLoading.set(true);
    this.betService.getBetsByMatchDay(this.currentMatchDayId()).subscribe({
      next: (bets) => {
        this.allBets.set(bets);
        this.isLoading.set(false);
      },
      error: () => this.isLoading.set(false),
    });
  }

  didIWin(bet: BetResponse): boolean | null {
    if (bet.status === 'PENDING' || !bet.userPrediction) return null;
    return (
      (bet.userPrediction === 'YES' && bet.status === 'WON') ||
      (bet.userPrediction === 'NO' && bet.status === 'LOST')
    );
  }

  yesPercent(bet: BetResponse): number {
    if (!bet.participantCount || bet.participantCount === 0) return 0;
    return Math.round((bet.yesCount / bet.participantCount) * 100);
  }

  // --- UTILS PER LA UI ---
  canVote(): boolean {
    return this.activeMatchDay()?.status === 'OPEN';
  }

  isLiveMatchDay(): boolean {
    return this.activeMatchDay()?.status === 'LIVE';
  }

  // --- ACTIONS ---
  onPredict(betId: number, type: PredictionType) {
    this.betService.placePrediction(betId, type).subscribe({
      next: () => {
        toast.success(`Puntata registrata!`);
        this.loadBets();
      },
      error: (err) => toast.error(err.error?.message || 'Errore'),
    });
  }

  openWithdrawModal(betId: number) {
    this.betToWithdrawId.set(betId);
    this.isWithdrawModalOpen.set(true);
  }
  closeWithdrawModal() {
    this.isWithdrawModalOpen.set(false);
  }
  confirmWithdraw() {
    if (this.betToWithdrawId()) {
      this.betService.removePrediction(this.betToWithdrawId()!).subscribe(() => {
        toast.success('Puntata ritirata');
        this.closeWithdrawModal();
        this.loadBets();
      });
    }
  }

  openCreateModal() {
    this.isCreateModalOpen.set(true);
  }
  closeCreateModal() {
    this.isCreateModalOpen.set(false);
    this.newBetDescription.set('');
  }
  createBet() {
    if (!this.newBetDescription().trim()) return;
    this.betService
      .createBet({ description: this.newBetDescription(), matchDayId: this.currentMatchDayId() })
      .subscribe(() => {
        toast.success('Sfida creata!');
        this.closeCreateModal();
        this.loadBets();
      });
  }

  openEditModal(bet: BetResponse) {
    this.betToEdit.set(bet);
    this.editDescription.set(bet.description);
    this.isEditModalOpen.set(true);
  }
  closeEditModal() {
    this.isEditModalOpen.set(false);
  }
  confirmEdit() {
    if (this.betToEdit() && this.editDescription().trim()) {
      this.betService.updateBet(this.betToEdit()!.id, this.editDescription()).subscribe(() => {
        toast.success('Sfida aggiornata');
        this.closeEditModal();
        this.loadBets();
      });
    }
  }

  resolveBet(betId: number, status: BetStatus) {
    this.pendingBetId.set(betId);
    this.pendingStatus.set(status);
    this.isConfirmModalOpen.set(true);
  }
  closeConfirmModal() {
    this.isConfirmModalOpen.set(false);
  }
  confirmResolve() {
    if (this.pendingBetId() && this.pendingStatus()) {
      this.betService.resolveBet(this.pendingBetId()!, this.pendingStatus()!).subscribe({
        next: () => {
          toast.success('Sfida risolta!');
          this.closeConfirmModal();
          this.loadBets();
        },
        error: (err) => toast.error(err.error?.message || 'Errore'),
      });
    }
  }

  openDeleteModal(betId: number) {
    this.betToDeleteId.set(betId);
    this.isDeleteModalOpen.set(true);
  }
  closeDeleteModal() {
    this.isDeleteModalOpen.set(false);
  }
  confirmDelete() {
    if (this.betToDeleteId()) {
      this.betService.deleteBet(this.betToDeleteId()!).subscribe(() => {
        toast.success('Sfida eliminata');
        this.closeDeleteModal();
        this.loadBets();
      });
    }
  }
}
