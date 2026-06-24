import { Component, inject, OnInit, signal, computed, DestroyRef, OnDestroy } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';
import { LucideAngularModule } from 'lucide-angular';

import { FormationService, VoteResponse } from './service/formation-service';
import { PlayerResponse } from '../../core/models/player.model';
import { FormationRequest } from '../../core/models/formation.model';
import { FantaModalComponent } from '../../shared/components/fanta-modal/fanta-modal.component';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { AppStateService } from '../../core/services/app-state.service';
import { AuthService } from '../../core/services/auth.service';
import { JwtHelperService } from '../../core/services/jwt-helper.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-formation',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, FantaModalComponent, HeaderComponent],
  templateUrl: './formation.component.html',
  styleUrls: ['./formation.component.scss'],
})
export class FormationComponent implements OnInit, OnDestroy {
  private formationService = inject(FormationService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);
  public location = inject(Location);
  private wsService = inject(WebSocketService);
  private appState = inject(AppStateService);
  public authService = inject(AuthService);
  private jwtHelper = inject(JwtHelperService);

  // --- STATO LOCALE (Signals) ---
  currentMatchDayId = signal<number | null>(null);
  availablePlayers = signal<PlayerResponse[]>([]);

  selectedStarters = signal<(PlayerResponse | null)[]>([null, null, null, null]);
  selectedSub = signal<PlayerResponse | null>(null);

  isLoading = signal<boolean>(true);
  isSaving = signal<boolean>(false);
  isDirty = signal<boolean>(false);
  isRecovered = signal<boolean>(false);

  isReadOnly = signal<boolean>(false);
  isLive = signal<boolean>(false);
  origin = signal<string>('');
  viewedUserId = signal<number | null>(null);
  matchDayStatus = signal<string>('OPEN');

  matchDayName = signal<string>('');
  timeLeft = signal<string>('');
  expirationDate = signal<Date | null>(null);

  liveVotesMap = signal<Map<number, VoteResponse>>(new Map());

  // --- MAPPATURA POSIZIONI CAMPO A ROMBO ---
  fieldPositions = [
    { index: 3, cssClass: 'top-6 left-1/2 -translate-x-1/2' }, // ALTO (PUNTA)
    { index: 1, cssClass: 'top-1/2 left-4 sm:left-12 -translate-y-1/2' }, // SINISTRA
    { index: 2, cssClass: 'top-1/2 right-4 sm:right-12 -translate-y-1/2' }, // DESTRA
    { index: 0, cssClass: 'bottom-6 left-1/2 -translate-x-1/2' }, // BASSO (DIFENSORE)
  ];

  // --- STATO MODALI ---
  isConfirmModalOpen = signal<boolean>(false);
  isSelectionModalOpen = signal<boolean>(false);
  activeSlotForSelection = signal<number | 'SUB' | null>(null);
  activeRoleFilter = signal<string>('TUTTI');

  isDetailModalOpen = signal<boolean>(false);
  selectedPlayerDetail = signal<PlayerResponse | null>(null);

  private countdownInterval: any;

  currentUserId = computed(() => this.jwtHelper.getCurrentUserId());

  // 🔥 NUOVI COMPUTED PER LA GESTIONE LIVE/ARCHIVED
  isCalculated = computed(() => this.matchDayStatus() === 'CALCULATED');
  showVotes = computed(() => this.isLive() || this.isCalculated());

  filteredPlayers = computed(() => {
    const players = this.availablePlayers();
    const role = this.activeRoleFilter();
    const startersIds = this.selectedStarters().map((p) => p?.id);
    const subId = this.selectedSub()?.id;

    let filtered = role === 'TUTTI' ? players : players.filter((p) => p.role === role);

    return filtered
      .map((p) => {
        const isStarter = startersIds.includes(p.id);
        const isSub = subId === p.id;
        return {
          ...p,
          isAlreadySelected: isStarter || isSub,
          selectionStatus: isStarter ? 'Titolare' : isSub ? 'Panchina' : null,
        };
      })
      .sort((a, b) => {
        if (a.isAlreadySelected && !b.isAlreadySelected) return 1;
        if (!a.isAlreadySelected && b.isAlreadySelected) return -1;
        return a.surname.localeCompare(b.surname);
      });
  });

  canSave = computed(() => {
    const hasAllStarters = this.selectedStarters().every((p) => p !== null);
    const hasSub = this.selectedSub() !== null;
    return hasAllStarters && hasSub;
  });

  // 🔥 Punteggio totale aggiornato per funzionare con showVotes()
  liveScore = computed(() => {
    if (!this.showVotes()) return null;
    const map = this.liveVotesMap();
    let total = 0;
    let needsSubstitution = false;

    this.selectedStarters().forEach((player) => {
      if (!player || this.getVoto(player) === 'SV') {
        needsSubstitution = true;
      } else {
        const vote = map.get(player.id);
        if (vote) total += vote.fantaVote;
      }
    });

    if (needsSubstitution) {
      const sub = this.selectedSub();
      if (sub && this.getVoto(sub) !== 'SV') {
        const subVote = map.get(sub.id);
        if (subVote) total += subVote.fantaVote;
      }
    }
    return total;
  });

  substitutedStarterIndex = computed(() => {
    if (!this.showVotes()) return -1;
    const sub = this.selectedSub();
    if (!sub || this.getVoto(sub) === 'SV') return -1;

    const starters = this.selectedStarters();
    return starters.findIndex((p) => p === null || this.getVoto(p) === 'SV');
  });

  isNotCalledUp(player: PlayerResponse | null): boolean {
    if (!player) return true;
    return !this.availablePlayers().some((p) => p.id === player.id);
  }

  ngOnInit() {
    const state = window.history.state;

    if (state && state.matchDayId) {
      this.currentMatchDayId.set(state.matchDayId);
      this.viewedUserId.set(state.userId || this.currentUserId());
      this.matchDayStatus.set(state.status || 'OPEN');
      this.matchDayName.set(state.matchDayName || state.description || '');

      if (state.origin) {
        this.origin.set(state.origin);
      }

      const matchDayFromCache = this.appState
        .matchDaysList()
        ?.find((md) => md.id === state.matchDayId);
      const deadlineStr = state.deadline || matchDayFromCache?.deadline;

      let isExpiredLocal = false;
      if (deadlineStr) {
        this.expirationDate.set(new Date(deadlineStr));
        isExpiredLocal = new Date(deadlineStr).getTime() <= Date.now();
      } else if (this.matchDayStatus() !== 'OPEN') {
        isExpiredLocal = true;
      }

      const isMyFormation = this.viewedUserId() === this.currentUserId();
      const canEdit = this.matchDayStatus() === 'OPEN' && !isExpiredLocal && isMyFormation;

      this.isReadOnly.set(!canEdit);
      this.isLive.set(this.matchDayStatus() === 'LIVE');

      if (deadlineStr && this.matchDayStatus() === 'OPEN' && !isExpiredLocal) {
        this.startCountdown(deadlineStr);
        this.setupMatchDayUpdates(state.matchDayId);
      } else if (isExpiredLocal) {
        this.timeLeft.set('Scaduto');
      }

      this.loadData(state.matchDayId, this.viewedUserId()!);
    } else {
      this.router.navigate(['/home']);
    }
  }

  loadData(matchDayId: number, userId?: number) {
    this.isLoading.set(true);
    this.formationService
      .getAvailablePlayers(matchDayId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (players) => {
          this.availablePlayers.set(players);

          const formationRequest = userId
            ? this.formationService.getFormationByUserId(matchDayId, userId, this.matchDayStatus())
            : this.formationService.getMyFormation(matchDayId);

          formationRequest.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: (formation) => {
              if (formation) {
                this.isRecovered.set(formation.carriedOver || false);

                if (formation.starterIds && formation.starterIds.length > 0) {
                  const startersArray: (PlayerResponse | null)[] = [null, null, null, null];
                  let currentIndex = 0;
                  formation.starterIds.forEach((id) => {
                    const player = players.find((p) => p.id === id);
                    if (player && currentIndex < 4) {
                      startersArray[currentIndex] = player;
                      currentIndex++;
                    }
                  });
                  this.selectedStarters.set(startersArray);
                }
                if (formation.subId) {
                  const sub = players.find((p) => p.id === formation.subId) || null;
                  this.selectedSub.set(sub);
                }
              }

              // 🔥 LOGICA OTTIMIZZATA PER IL RECUPERO VOTI
              if (this.isLive()) {
                this.setupLiveUpdates(matchDayId);
              } else if (this.isCalculated()) {
                // Se è archiviata facciamo solo il recupero (senza aprire WebSocket!)
                this.loadLiveVotes(matchDayId);
              }

              this.isLoading.set(false);
            },
            error: () => {
              if (userId && userId !== this.currentUserId()) {
                toast.info("Formazione non inserita dall'utente.");
              }
              this.isRecovered.set(false);
              this.selectedStarters.set([null, null, null, null]);
              this.selectedSub.set(null);
              this.isLoading.set(false);
            },
          });
        },
        error: () => {
          toast.error('Errore nel caricamento dei giocatori.');
          this.isLoading.set(false);
        },
      });
  }

  // --- LOGICA DI SELEZIONE GIOCATORI ---
  openSelection(slot: number | 'SUB') {
    this.activeSlotForSelection.set(slot);
    this.isSelectionModalOpen.set(true);
  }

  closeSelection() {
    this.isSelectionModalOpen.set(false);
    this.activeSlotForSelection.set(null);
  }

  setRoleFilter(role: string) {
    this.activeRoleFilter.set(role);
  }

  selectPlayerForSlot(player: PlayerResponse) {
    const slot = this.activeSlotForSelection();
    if (slot === null) return;

    const starters = this.selectedStarters();
    const sub = this.selectedSub();
    const isStarterIndex = starters.findIndex((p) => p?.id === player.id);
    const isSub = sub?.id === player.id;

    if (slot === 'SUB') {
      if (isStarterIndex !== -1) {
        toast.error('Giocatore già tra i titolari!');
        return;
      }
      this.selectedSub.set(player);
    } else {
      if (isSub) {
        toast.error('Giocatore già in panchina!');
        return;
      }
      if (isStarterIndex !== -1 && isStarterIndex !== slot) {
        toast.error('Giocatore già schierato in un altro ruolo!');
        return;
      }
      const newStarters = [...starters];
      newStarters[slot] = player;
      this.selectedStarters.set(newStarters);
    }

    this.isDirty.set(true);
    this.closeSelection();
  }

  removePlayer(slot: number | 'SUB', event: Event) {
    event.stopPropagation();

    if (slot === 'SUB') {
      this.selectedSub.set(null);
    } else {
      const newStarters = [...this.selectedStarters()];
      newStarters[slot] = null;
      this.selectedStarters.set(newStarters);
    }
    this.isDirty.set(true);
  }

  clearFormation() {
    this.selectedStarters.set([null, null, null, null]);
    this.selectedSub.set(null);
    this.isDirty.set(true);
  }

  // --- SALVATAGGIO E NAVIGAZIONE ---
  saveFormation() {
    const matchDayId = this.currentMatchDayId();
    if (!matchDayId) return;

    if (!this.canSave()) {
      toast.error('Devi schierare 4 titolari e 1 panchinaro!');
      return;
    }

    this.isSaving.set(true);
    const starterIds = this.selectedStarters().map((p) => p!.id);

    const request: FormationRequest = {
      matchDayId: matchDayId,
      starterIds: starterIds,
      subId: this.selectedSub()!.id,
    };

    this.formationService
      .saveFormation(request)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          toast.success('Formazione salvata con successo!');
          this.isSaving.set(false);
          this.isDirty.set(false);
          this.router.navigate(['/home']);
        },
        error: (err) => {
          console.error('Errore salvataggio:', err);
          toast.error(err.error?.message || 'Errore durante il salvataggio.');
          this.isSaving.set(false);
        },
      });
  }

  goBack() {
    if (this.isDirty()) {
      this.isConfirmModalOpen.set(true);
      return;
    }
    this.executeNavigation();
  }

  closeModal() {
    this.isConfirmModalOpen.set(false);
  }

  confirmGoBack() {
    this.isConfirmModalOpen.set(false);
    this.executeNavigation();
  }

  private executeNavigation() {
    if (this.origin() === 'calendar') {
      this.router.navigate(['/calendar/matchday', this.currentMatchDayId()], {
        state: {
          activeTab: 'formations',
          status: this.matchDayStatus(),
          description: this.matchDayName(),
        },
      });
    } else {
      this.location.back();
    }
  }

  // --- STATO LIVE E WEBSOCKET ---
  loadLiveVotes(matchDayId: number) {
    this.formationService
      .getLiveVotes(matchDayId, this.matchDayStatus())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((votes) => {
        const map = new Map<number, VoteResponse>();
        votes.forEach((v) => map.set(v.idPlayer, v));
        this.liveVotesMap.set(map);
      });
  }

  setupLiveUpdates(matchDayId: number) {
    this.loadLiveVotes(matchDayId);

    this.wsService
      .watch('/topic/live-votes')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.loadLiveVotes(matchDayId);
      });

    this.wsService
      .watch('/topic/matches')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (msg && (msg.action === 'UPDATE' || msg.action === 'SAVE' || msg.action === 'RELOAD')) {
          this.loadLiveVotes(matchDayId);
        }
      });
  }

  getVoto(player: PlayerResponse | null): string {
    if (!player) return 'SV';
    const vote = this.liveVotesMap().get(player.id);
    if (!vote || vote.fantaVote === 0) return 'SV';
    return vote.fantaVote.toString();
  }

  getVotoColorClass(player: PlayerResponse | null): string {
    const voto = this.getVoto(player);
    if (voto === 'SV') return 'bg-gray-200 text-gray-500';
    const num = parseFloat(voto);
    return num >= 6 ? 'bg-green-600 text-white' : 'bg-red-600 text-white';
  }

  getLiveStats(player: PlayerResponse | null) {
    if (!player) return { goals: 0, assists: 0, ownGoals: 0 };
    const vote = this.liveVotesMap().get(player.id);
    if (!vote) return { goals: 0, assists: 0, ownGoals: 0 };
    return {
      goals: vote.goals || 0,
      assists: vote.assists || 0,
      ownGoals: vote.ownGoals || 0,
    };
  }

  getArray(n: number): number[] {
    return Array(n || 0).fill(0);
  }

  // --- GESTIONE MODALE DETTAGLIO GIOCATORE ---
  openPlayerDetail(player: PlayerResponse, event: Event) {
    event.stopPropagation();
    this.selectedPlayerDetail.set(player);
    this.isDetailModalOpen.set(true);
  }

  closePlayerDetail() {
    this.isDetailModalOpen.set(false);
    this.selectedPlayerDetail.set(null);
  }

  // --- GESTIONE WEBSOCKET CONVOCATI IN TEMPO REALE ---
  setupMatchDayUpdates(matchDayId: number) {
    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        // Se il messaggio riguarda esattamente questa giornata...
        if (msg && msg.matchDay && msg.matchDay.id === matchDayId) {
          // 1. Scarichiamo la nuova lista bypassando la cache (forceRefresh = true)
          this.formationService
            .getAvailablePlayers(matchDayId, true)
            .subscribe((updatedPlayers) => {
              this.availablePlayers.set(updatedPlayers);
              let selectionChanged = false;

              // 2. Controlliamo se qualche TITOLARE schierato non è più convocato
              const currentStarters = [...this.selectedStarters()];
              for (let i = 0; i < currentStarters.length; i++) {
                const p = currentStarters[i];
                if (p && !updatedPlayers.some((av) => av.id === p.id)) {
                  currentStarters[i] = null; // Lo rimuoviamo dal campo
                  selectionChanged = true;
                }
              }
              this.selectedStarters.set(currentStarters);

              // 3. Controlliamo la PANCHINA
              const currentSub = this.selectedSub();
              if (currentSub && !updatedPlayers.some((av) => av.id === currentSub.id)) {
                this.selectedSub.set(null); // Lo rimuoviamo dalla panchina
                selectionChanged = true;
              }

              // 4. Avvisiamo l'utente
              if (selectionChanged) {
                toast.error(
                  '⚠️ Attenzione: Un giocatore che avevi schierato è stato rimosso dai convocati.',
                );
                this.isDirty.set(true);
              } else {
                toast.info('🔄 La lista dei convocati è stata aggiornata.');
              }
            });
        }
      });
  }

  ngOnDestroy() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    this.wsService.disconnect();
  }

  private startCountdown(deadlineStr: string) {
    if (this.countdownInterval) clearInterval(this.countdownInterval);

    const tick = () => {
      const deadline = new Date(deadlineStr).getTime();
      const diff = deadline - Date.now();

      if (diff <= 0) {
        this.timeLeft.set('Scaduto');
        this.isReadOnly.set(true);
        clearInterval(this.countdownInterval);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      this.timeLeft.set(`${h}h ${m}m ${s}s`);
    };

    tick();
    this.countdownInterval = setInterval(tick, 1000);
  }
}
