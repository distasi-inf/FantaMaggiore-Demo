import { Component, inject, OnInit, signal, computed, DestroyRef, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';

import { TournamentService } from '../../services/tournament.service';
import { AdminService } from '../../services/admin.service';
import { MatchResponse } from '../../model/MatchResponse';
import { PlayerResponse } from '../../../../core/models/player.model';
import { MatchEventRequest } from '../../model/MatchEventRequest';
import { WebSocketService } from '../../../../shared/services/web-socket-service';
import { FantaModalComponent } from '../../../../shared/components/fanta-modal/fanta-modal.component';
import { AppStateService } from '../../../../core/services/app-state.service';
import { TournamentRanking } from '../../../../core/models/tournament-ranking.model';
import { ActivatedRoute } from '@angular/router';

interface TeamPlayer extends PlayerResponse {
  side: 'home' | 'away';
}

export interface MatchEventResponse {
  id: number;
  type: 'GOAL' | 'ASSIST' | 'OWNGOAL';
  matchId: number;
  playerId: number;
  playerName?: string;
  value: number;
  assistPlayerId?: number | null;
  assistPlayerName?: string | null;
}

@Component({
  selector: 'app-live-matches',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, FantaModalComponent],
  templateUrl: './live-matches.component.html',
})
export class LiveMatchesComponent implements OnInit {
  // Diventa una variabile normale e non più un Input
  matchDayId: number | null = null;

  isEventModalOpen = signal(false);
  isConfirmModalOpen = signal(false);

  private tournamentService = inject(TournamentService);
  private adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private appState = inject(AppStateService);
  private wsService = inject(WebSocketService);
  private route = inject(ActivatedRoute);

  matches = signal<MatchResponse[]>([]);
  selectedMatch = signal<MatchResponse | null>(null);
  allPlayers = signal<PlayerResponse[]>([]);
  players = signal<PlayerResponse[]>([]);
  teams = signal<any[]>([]);
  ranking = signal<TournamentRanking[]>([]);

  onResultsCalculated = output<void>();

  matchDayStatus = signal<string>('OPEN');

  isLoadingMatches = signal<boolean>(true);
  isLoadingRanking = signal<boolean>(true);

  matchEvents = signal<MatchEventResponse[]>([]);

  selectedHomeGoalkeeperId = signal<number | null>(null);
  selectedAwayGoalkeeperId = signal<number | null>(null);

  availableGuestGoalkeepers = computed<PlayerResponse[]>(() => {
    const match = this.selectedMatch();
    const teams = this.teams();
    const players = this.allPlayers();

    if (!match || !teams.length || !players.length) return [];

    const homeTeam = teams.find((t) => t.id === match.homeTeamId);
    const awayTeam = teams.find((t) => t.id === match.awayTeamId);

    const activePlayerIds = new Set([
      ...(homeTeam?.playerIds || []),
      ...(awayTeam?.playerIds || []),
    ]);

    const allAssignedIds = new Set<number>();
    teams.forEach((t) => t.playerIds?.forEach((id: number) => allAssignedIds.add(id)));

    return players.filter((p) => allAssignedIds.has(p.id) && !activePlayerIds.has(p.id));
  });

  availableHomeGuestGoalkeepers = computed<PlayerResponse[]>(() => {
    const allGuests = this.availableGuestGoalkeepers();
    const awaySelectedId = this.selectedAwayGoalkeeperId();
    return allGuests.filter((p) => p.id !== awaySelectedId);
  });

  availableAwayGuestGoalkeepers = computed<PlayerResponse[]>(() => {
    const allGuests = this.availableGuestGoalkeepers();
    const homeSelectedId = this.selectedHomeGoalkeeperId();
    return allGuests.filter((p) => p.id !== homeSelectedId);
  });

  groupedMatchEvents = computed<MatchEventResponse[]>(() => {
    const rawEvents = this.matchEvents() || [];
    return [...rawEvents].sort((a, b) => b.id - a.id);
  });

  homeMatchEvents = computed(() => {
    return this.groupedMatchEvents().filter((ev) => {
      const player = this.matchPlayers().find((p) => p.id === ev.playerId);
      if (!player) return false;
      if (ev.type === 'OWNGOAL') {
        return player.side === 'away';
      }
      return player.side === 'home';
    });
  });

  awayMatchEvents = computed(() => {
    return this.groupedMatchEvents().filter((ev) => {
      const player = this.matchPlayers().find((p) => p.id === ev.playerId);
      if (!player) return false;
      if (ev.type === 'OWNGOAL') {
        return player.side === 'home';
      }
      return player.side === 'away';
    });
  });

  matchPlayers = computed<TeamPlayer[]>(() => {
    const match = this.selectedMatch();
    const teams = this.teams();
    const players = this.allPlayers();
    if (!match || !teams.length || !players.length) return [];

    const homeTeam = teams.find((t) => t.id === match.homeTeamId);
    const awayTeam = teams.find((t) => t.id === match.awayTeamId);

    const homePlayers: TeamPlayer[] = (homeTeam?.playerIds || [])
      .map((id: number) => players.find((p) => p.id === id))
      .filter(Boolean)
      .map((p: PlayerResponse) => ({ ...p, side: 'home' as const }));

    const awayPlayers: TeamPlayer[] = (awayTeam?.playerIds || [])
      .map((id: number) => players.find((p) => p.id === id))
      .filter(Boolean)
      .map((p: PlayerResponse) => ({ ...p, side: 'away' as const }));

    const homeGuestId =
      match.matchStatus === 'PRE' ? this.selectedHomeGoalkeeperId() : match.homeGuestGoalkeeperId;
    const awayGuestId =
      match.matchStatus === 'PRE' ? this.selectedAwayGoalkeeperId() : match.awayGuestGoalkeeperId;

    if (homeGuestId) {
      const p = players.find((p) => p.id === homeGuestId);
      if (p) homePlayers.push({ ...p, side: 'home' as const, role: 'PORTIERE' });
    }
    if (awayGuestId) {
      const p = players.find((p) => p.id === awayGuestId);
      if (p) awayPlayers.push({ ...p, side: 'away' as const, role: 'PORTIERE' });
    }

    return [...homePlayers, ...awayPlayers];
  });

  homeTeamPlayerCount = computed(() => {
    const match = this.selectedMatch();
    const teams = this.teams();
    if (!match || !teams.length) return 0;
    const homeTeam = teams.find((t) => t.id === match.homeTeamId);
    return homeTeam?.playerIds?.length || 0;
  });

  awayTeamPlayerCount = computed(() => {
    const match = this.selectedMatch();
    const teams = this.teams();
    if (!match || !teams.length) return 0;
    const awayTeam = teams.find((t) => t.id === match.awayTeamId);
    return awayTeam?.playerIds?.length || 0;
  });

  canStartMatch = computed(() => {
    const homeCount = this.homeTeamPlayerCount();
    const awayCount = this.awayTeamPlayerCount();
    const homeGuest = this.selectedHomeGoalkeeperId();
    const awayGuest = this.selectedAwayGoalkeeperId();

    if (homeCount === 4 && !homeGuest) return false;
    if (awayCount === 4 && !awayGuest) return false;

    return true;
  });

  eventMode = signal<'GOAL' | 'OWNGOAL'>('GOAL');
  eventForm = {
    scorerId: null as number | null,
    assistId: null as number | null,
    ownGoalId: null as number | null,
  };

  selectedScorerSide = signal<'home' | 'away' | null>(null);

  availableAssistPlayers = computed<TeamPlayer[]>(() => {
    const side = this.selectedScorerSide();
    const scorerId = this.eventForm.scorerId;
    if (!side) return [];

    return this.matchPlayers().filter((p) => p.side === side && p.id !== scorerId);
  });

  duration = 90;
  pendingAction: (() => void) | null = null;
  confirmTitle = '';
  confirmMessage = '';
  isCalculating = signal(false);

  ngOnInit() {
    this.wsService.connect();

    // Ascoltiamo l'URL per vedere se ci passano un ID specifico
    this.route.queryParams.subscribe((params) => {
      const urlId = params['matchDayId'];

      if (urlId) {
        // Se c'è l'ID nell'URL (es. hai cliccato da Giornate), usa quello!
        this.matchDayId = Number(urlId);
        this.loadAll();
      } else {
        // Se hai cliccato dal menu laterale, auto-cerca la giornata attiva
        this.adminService
          .getAllMatchDays()
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe((days) => {
            const activeDay =
              days.find((d) => d.status === 'LIVE') || days.find((d) => d.status === 'OPEN');
            if (activeDay) {
              this.matchDayId = activeDay.id;
              this.loadAll();
            } else {
              this.isLoadingMatches.set(false);
              this.isLoadingRanking.set(false);
            }
          });
      }
    });
  }

  private setupWebSocket() {
    // 1. Ascolto le partite (era già così)
    this.wsService
      .watch('/topic/matches')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: any) => {
        // ... (lascia intatta tutta la logica del /topic/matches che hai già qui)
        if (payload && payload.action && payload.match) {
          const updatedMatch = payload.match;
          if (payload.action === 'UPDATE' || payload.action === 'SAVE') {
            this.matches.update((currentMatches) => {
              const exists = currentMatches.some((m) => m.id === updatedMatch.id);
              if (exists) {
                return currentMatches.map((m) => (m.id === updatedMatch.id ? updatedMatch : m));
              } else {
                return [...currentMatches, updatedMatch];
              }
            });
            const currentSelected = this.selectedMatch();
            if (currentSelected && currentSelected.id === updatedMatch.id) {
              this.selectedMatch.set(updatedMatch);
              if (updatedMatch.matchStatus === 'LIVE') {
                this.loadEventsForMatch(updatedMatch.id);
              }
            }
          }
          if (payload.action === 'DELETE') {
            this.matches.update((m) => m.filter((x) => x.id !== updatedMatch.id));
            if (this.selectedMatch()?.id === updatedMatch.id) {
              this.selectedMatch.set(null);
            }
          }
          this.loadRanking();
        }
      });

    // 2. FIX PUNTO 4: Ascoltiamo anche le GIORNATE in tempo reale!
    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action) {
          this.loadMatchDayStatus(); // Ricarica lo stato (es. passa a LIVE) automaticamente
        }
      });
  }

  loadAll() {
    if (!this.matchDayId) return;
    this.loadMatchDayStatus();
    this.loadMatches();
    this.loadAllPlayers();
    this.loadTeams();
    this.loadRanking();
  }

  loadRanking() {
    if (!this.matchDayId) return;
    this.isLoadingRanking.set(true);
    this.tournamentService
      .getTournamentRankingByMatchDay(this.matchDayId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.ranking.set(data);
          this.isLoadingRanking.set(false);
        },
        error: () => {
          console.error('Errore nel caricamento della classifica filtrata');
          this.isLoadingRanking.set(false);
        },
      });
  }

  loadMatchDayStatus() {
    if (!this.matchDayId) return;
    this.adminService
      .getAllMatchDays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (days) => {
          const currentDay = days.find((d) => d.id === this.matchDayId);
          if (currentDay) {
            this.matchDayStatus.set(currentDay.status);
          }
        },
      });
  }

  loadMatches() {
    if (!this.matchDayId) return;
    this.isLoadingMatches.set(true);
    this.tournamentService
      .getMatchByMatchdayId(this.matchDayId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.matches.set(data);
          const sel = this.selectedMatch();
          if (sel) {
            const updated = data.find((m) => m.id === sel.id);
            if (updated) this.selectedMatch.set(updated);
          }
          this.isLoadingMatches.set(false);
        },
        error: () => {
          toast.error('Errore nel caricamento dei match');
          this.isLoadingMatches.set(false);
        },
      });
  }

  loadAllPlayers() {
    this.adminService
      .getAllPlayersIncludingDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (allPlayers) => {
          this.allPlayers.set(allPlayers);
          this.players.set(allPlayers.filter((p) => p.active));
        },
        error: (err) => console.error('Errore caricamento giocatori', err),
      });
  }

  loadTeams() {
    if (!this.matchDayId) return;
    this.tournamentService
      .getTeamsByMatchDay(this.matchDayId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.teams.set(data),
        error: () => toast.error('Errore squadre'),
      });
  }

  selectMatch(match: MatchResponse) {
    this.selectedMatch.set(match);
    this.resetEventForm();
    this.loadEventsForMatch(match.id);

    this.selectedHomeGoalkeeperId.set(match.homeGuestGoalkeeperId || null);
    this.selectedAwayGoalkeeperId.set(match.awayGuestGoalkeeperId || null);
  }

  loadEventsForMatch(matchId: number) {
    this.tournamentService.getMatchEvents(matchId).subscribe({
      next: (events) => this.matchEvents.set(events),
      error: () => toast.error('Impossibile recuperare lo storico degli eventi'),
    });
  }

  confirmStartMatch() {
    const match = this.selectedMatch();
    if (!match) return;
    this.confirmTitle = 'Avvia Match';
    this.confirmMessage = `Avviare ${match.homeTeamName} vs ${match.awayTeamName} (${this.duration} min)?`;

    this.pendingAction = () => this.saveGoalkeepersAndStart();
    this.isConfirmModalOpen.set(true);
  }

  doStartMatch(matchId: number) {
    this.tournamentService.startMatch(matchId, this.duration).subscribe({
      next: () => {
        toast.success('Match avviato!');
        this.appState.clearMatchDaysCache();
        this.loadMatches();
      },
      error: (err) => toast.error(err?.error?.message || 'Errore avvio match'),
    });
  }

  confirmEndMatch() {
    const match = this.selectedMatch();
    if (!match) return;
    this.confirmTitle = 'Termina Match';
    this.confirmMessage = `Terminare definitivamente la partita? Non potrai più aggiungere eventi.`;
    this.pendingAction = () => this.doEndMatch(match.id);
    this.isConfirmModalOpen.set(true);
  }

  doEndMatch(matchId: number) {
    this.tournamentService.endMatch(matchId).subscribe({
      next: () => {
        toast.success('Match terminato!');
        this.appState.clearMatchDaysCache();
        this.loadMatches();
        this.loadRanking();
      },
      error: (err) => toast.error(err?.error?.message || 'Errore chiusura match'),
    });
  }

  setEventMode(mode: 'GOAL' | 'OWNGOAL') {
    this.eventMode.set(mode);
  }

  setPlayerForRole(
    role: 'scorer' | 'assist' | 'owngoal',
    playerId: number | null,
    side?: 'home' | 'away',
  ) {
    if (role === 'scorer') {
      this.eventForm.scorerId = playerId;
      if (side) this.selectedScorerSide.set(side);
      this.eventForm.assistId = null;
    }
    if (role === 'assist') this.eventForm.assistId = playerId;
    if (role === 'owngoal') this.eventForm.ownGoalId = playerId;
  }

  submitEvent() {
    const match = this.selectedMatch();
    if (!match) return;

    const mode = this.eventMode();
    const scorerId = mode === 'GOAL' ? this.eventForm.scorerId : this.eventForm.ownGoalId;
    if (!scorerId) return;

    const payload: MatchEventRequest = {
      matchId: match.id,
      playerId: scorerId,
      type: mode,
      value: mode === 'GOAL' ? 3 : -3,
      assistPlayerId: mode === 'GOAL' ? this.eventForm.assistId : null,
    };

    this.tournamentService.addEvent(payload).subscribe({
      next: () => {
        this.loadEventsForMatch(match.id);
        this.loadMatches();
        this.isEventModalOpen.set(false);
        toast.success('Evento registrato!');
      },
      error: (err) => {
        console.error('Errore salvataggio evento:', err);
        toast.error("Errore durante il salvataggio dell'evento");
      },
    });
  }

  removeEvent(eventId: number) {
    this.tournamentService.removeEvent(eventId).subscribe({
      next: () => {
        toast.success('Evento rimosso con successo');
        const mId = this.selectedMatch()?.id;
        if (mId) {
          this.loadMatches();
          this.loadEventsForMatch(mId);
        }
      },
      error: () => toast.error('Errore rimozione evento'),
    });
  }

  finalizeEvent(matchId: number) {
    toast.success('Evento registrato!');
    this.isEventModalOpen.set(false);
    this.loadMatches();
    this.loadEventsForMatch(matchId);
    this.resetEventForm();
  }

  resetEventForm() {
    this.eventMode.set('GOAL');
    this.eventForm = { scorerId: null, assistId: null, ownGoalId: null };
    this.selectedScorerSide.set(null);
  }

  getPlayerName(playerId: number | null): string {
    if (!playerId) return 'Seleziona...';
    const p = this.allPlayers().find((pl) => pl.id === playerId);
    return p ? `${p.name} ${p.surname}` : '—';
  }

  confirmCalculate() {
    // Il controllo allMatchesFinished() lo fa già l'HTML, quindi se clicchi qui i match sono sicuramente finiti.
    this.confirmTitle = 'Calcola Risultati';
    this.confirmMessage =
      "Vuoi calcolare i risultati fanta per questa giornata? L'operazione genererà i punteggi finali e la giornata passerà allo stato Calcolata.";

    this.pendingAction = () => this.doCalculate();
    this.isConfirmModalOpen.set(true); // Usa il tuo modale nativo!
  }

  doCalculate() {
    if (!this.matchDayId) return;
    this.isCalculating.set(true);
    this.adminService.calculateMatchDayResults(this.matchDayId).subscribe({
      next: () => {
        toast.success('Risultati calcolati con successo!');
        this.isCalculating.set(false);
        // FIX: Aggiorniamo ISTANTANEAMENTE lo stato così il bottone scompare senza fare F5
        this.matchDayStatus.set('CALCULATED');
        this.loadMatches();
        this.onResultsCalculated.emit();
      },
      error: (err) => {
        toast.error(err?.error?.message || 'Errore nel calcolo');
        this.isCalculating.set(false);
      },
    });
  }

  executeConfirm() {
    this.isConfirmModalOpen.set(false);
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
  }

  closeConfirm() {
    this.isConfirmModalOpen.set(false);
    this.pendingAction = null;
  }

  allMatchesFinished(): boolean {
    const m = this.matches();
    return m.length > 0 && m.every((match) => match.matchStatus === 'FINISHED');
  }

  saveGoalkeepersAndStart() {
    const match = this.selectedMatch();
    if (!match) return;

    this.tournamentService
      .setGuestGoalkeepers(
        match.id,
        this.selectedHomeGoalkeeperId(),
        this.selectedAwayGoalkeeperId(),
      )
      .subscribe({
        next: () => {
          this.doStartMatch(match.id);
        },
        error: (err) => toast.error('Errore salvataggio portieri in prestito'),
      });
  }

  parseId(value: any): number | null {
    if (!value || value === 'null') return null;
    const parsed = Number(value);
    return isNaN(parsed) ? null : parsed;
  }

  quickAddEvent(player: TeamPlayer, action: 'GOAL' | 'OWNGOAL') {
    this.resetEventForm();
    this.eventMode.set(action);

    if (action === 'GOAL') {
      this.setPlayerForRole('scorer', player.id, player.side);
    } else {
      this.setPlayerForRole('owngoal', player.id);
    }

    this.isEventModalOpen.set(true);
  }
}
