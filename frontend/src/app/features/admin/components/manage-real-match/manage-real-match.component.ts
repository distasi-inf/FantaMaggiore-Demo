import { Component, inject, OnInit, signal, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TournamentService } from '../../services/tournament.service';
import { AdminService } from '../../services/admin.service';
import { MatchDayResponse } from '../../../home/model/MatchDayResponse';
import { PlayerResponse } from '../../../../core/models/player.model';
import { toast } from 'ngx-sonner';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../../shared/services/web-socket-service';
import { FantaModalComponent } from '../../../../shared/components/fanta-modal/fanta-modal.component';

@Component({
  selector: 'app-manage-real-match',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FantaModalComponent],
  templateUrl: './manage-real-match.component.html',
})
export class ManageRealMatchComponent implements OnInit {
  private fb = inject(FormBuilder);
  private tournamentService = inject(TournamentService);
  private adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService);

  matchDays = signal<MatchDayResponse[]>([]);
  allPlayers = signal<PlayerResponse[]>([]);
  players = signal<PlayerResponse[]>([]);
  currentMatchDayId = signal<number | null>(null);
  selectedTeamPlayerIds = signal<number[]>([]);

  availableTeamsForMatch = signal<any[]>([]);
  currentMatchDayMatches = signal<any[]>([]);
  teamsForSelectedMatchDay = signal<any[]>([]);

  selectedHomeTeamId = signal<number | null>(null);
  selectedAwayTeamId = signal<number | null>(null);

  //Skeleton
  isLoadingTeams = signal<boolean>(false);
  isLoadingMatches = signal<boolean>(false);

  editingTeamId = signal<number | null>(null);

  filterRole = signal<string>('TUTTI');
  sortOrder = signal<'ASC' | 'DESC'>('ASC');

  isConfirmModalOpen = signal(false);
  modalTitle = signal<string>('');
  modalMessage = signal<string>('');
  pendingAction: (() => void) | null = null;

  deleteMatch(matchId: number) {
    this.modalTitle.set('Elimina Partita');
    this.modalMessage.set("Vuoi davvero annullare questa partita? L'operazione è irreversibile.");

    this.pendingAction = () => {
      this.tournamentService
        .deleteMatch(matchId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Partita eliminata con successo!');
            // Il WebSocket aggiornerà automaticamente la lista, ma se vuoi puoi forzare un ricaricamento:
            // const currentMdId = this.currentMatchDayId();
            // if (currentMdId) { this.setMatchMatchDay(currentMdId); }
          },
          error: (err) => toast.error(err.error?.message || 'Impossibile eliminare la partita.'),
        });
    };

    this.isConfirmModalOpen.set(true);
  }

  setFilterRole(role: string) {
    this.filterRole.set(role);
  }

  toggleSortOrder() {
    this.sortOrder.update((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
  }

  availableHomeTeams = computed(() => {
    const awayId = this.selectedAwayTeamId();
    return this.availableTeamsForMatch().filter((t) => t.id !== awayId);
  });

  availableAwayTeams = computed(() => {
    const homeId = this.selectedHomeTeamId();
    return this.availableTeamsForMatch().filter((t) => t.id !== homeId);
  });

  alreadyAssignedPlayerIds = computed(() => {
    const teams = this.teamsForSelectedMatchDay();
    const editingId = this.editingTeamId(); // Recupera l'ID della squadra in modifica

    let assignedIds: number[] = [];
    teams.forEach((team) => {
      // Ignora i giocatori della squadra che stiamo attualmente modificando!
      if (team.id !== editingId && team.playerIds && Array.isArray(team.playerIds)) {
        assignedIds = [...assignedIds, ...team.playerIds];
      }
    });
    return assignedIds;
  });

  matchDayPlayers = computed(() => {
    const matchDayId = this.currentMatchDayId();
    if (!matchDayId) return [];

    const matchDay = this.matchDays().find((md) => md.id === matchDayId);
    if (!matchDay || !matchDay.availablePlayerIds) return [];

    const assignedIds = this.alreadyAssignedPlayerIds();

    let filteredPlayers = this.allPlayers().filter((p) => {
      const isAvailableForMatchDay = matchDay.availablePlayerIds.includes(p.id);
      const isAlreadyAssigned = assignedIds.includes(p.id);

      // MODIFICATO: Mostriamo solo i giocatori che NON sono ancora stati assegnati
      return isAvailableForMatchDay && !isAlreadyAssigned;
    });

    if (this.filterRole() !== 'TUTTI') {
      filteredPlayers = filteredPlayers.filter((p) => p.role === this.filterRole());
    }

    return filteredPlayers.sort((a, b) => {
      // ... (mantieni il sort intatto)
      const nameA = a.surname.toUpperCase();
      const nameB = b.surname.toUpperCase();
      return this.sortOrder() === 'ASC' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  });

  filteredModalPlayers = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    // ATTENZIONE: Qui usiamo i giocatori disponibili per LA GIORNATA, non il listone intero!
    let basePlayers = this.matchDayPlayers();

    if (!search) return basePlayers;

    const searchWords = search.split(/\s+/);

    return basePlayers.filter((p) => {
      const fullText = `${p.name} ${p.surname} ${p.nickname || ''}`.toLowerCase();
      return searchWords.every((word) => fullText.includes(word));
    });
  });

  availablePlayersInTeam = computed(() => {
    const selectedPlayerIds = this.selectedTeamPlayerIds();
    return this.matchDayPlayers().filter((p) => !selectedPlayerIds.includes(p.id));
  });

  isPlayersModalOpen = signal(false);
  tempSelectedPlayers = signal<number[]>([]);

  searchTerm = signal<string>('');

  isTeamDetailModalOpen = signal(false);
  selectedTeamDetail = signal<any | null>(null);

  teamForm: FormGroup = this.fb.group({
    teamName: ['', Validators.required],
    idMatchDay: [null, Validators.required],
    playerIds: [[], Validators.required],
    idCaptain: [null],
  });

  matchForm: FormGroup = this.fb.group({
    matchDayId: [null, Validators.required],
    homeTeamId: [null, Validators.required],
    awayTeamId: [null, Validators.required],
  });

  ngOnInit() {
    this.loadMatchDays();
    this.loadAllPlayers();
    this.setupWebSocket();
  }

  // --- AGGIUNTO: SETUP WEBSOCKET PER SQUADRE E PARTITE ---
  private setupWebSocket() {
    this.wsService.connect();

    // 1. Ascolto modifiche alle SQUADRE
    this.wsService
      .watch('/topic/teams')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action && message.team) {
          const action = message.action;
          const updatedTeam = message.team;

          // Aggiorniamo le liste SOLO se la squadra appartiene alla giornata che stiamo guardando!
          if (this.currentMatchDayId() === updatedTeam.idMatchDay) {
            // Aggiorna la lista di tutte le squadre della giornata
            this.teamsForSelectedMatchDay.update((teams) => {
              let newTeams = teams.filter((t) => t.id !== updatedTeam.id);
              if (action !== 'DELETE') newTeams.push(updatedTeam);
              return newTeams;
            });

            // Aggiorna la tendina delle squadre disponibili per i Match
            this.availableTeamsForMatch.update((teams) => {
              let newTeams = teams.filter((t) => t.id !== updatedTeam.id);
              if (action !== 'DELETE') newTeams.push(updatedTeam);
              return newTeams;
            });
          }
        }
      });

    // 2. Ascolto modifiche ai MATCH PROGRAMMATI
    this.wsService
      .watch('/topic/matches')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action && message.match) {
          const action = message.action;
          const updatedMatch = message.match;

          // Aggiorniamo la lista SOLO se la partita è della giornata selezionata
          // Nota: usa il nome esatto della proprietà che ti restituisce il DTO (es. matchDayId)
          if (this.matchForm.get('matchDayId')?.value === updatedMatch.matchDayId) {
            this.currentMatchDayMatches.update((matches) => {
              let newMatches = matches.filter((m) => m.id !== updatedMatch.id);
              if (action !== 'DELETE') newMatches.push(updatedMatch);
              return newMatches;
            });
          }
        }
      });
  }

  loadMatchDays() {
    this.adminService
      .getAllMatchDays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => this.matchDays.set(data),
        error: (err) => console.error('Errore caricamento giornate', err),
      });
  }

  loadAllPlayers() {
    // Una sola chiamata che restituisce attivi + eliminati
    this.adminService
      .getAllPlayersIncludingDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (allPlayers) => {
          this.allPlayers.set(allPlayers); // usato per getTeamPlayers() (storico)
          // players = solo attivi, usato nella modale di CREAZIONE squadra
          this.players.set(allPlayers.filter((p) => p.active));
        },
        error: (err) => console.error('Errore caricamento giocatori', err),
      });
  }

  loadTeamsForMatchDay(matchDayId: number) {
    this.isLoadingTeams.set(true); // INIZIO CARICAMENTO SQUADRE
    this.tournamentService
      .getTeamsByMatchDay(matchDayId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (teams) => {
          this.teamsForSelectedMatchDay.set(teams);
          this.isLoadingTeams.set(false); // FINE CARICAMENTO SQUADRE
        },
        error: (err) => {
          console.error('Errore caricamento squadre per giornata', err);
          this.isLoadingTeams.set(false); // ERRORE
        },
      });
  }

  getMatchDayDesc(id: number | null): string {
    if (!id) return '';
    const md = this.matchDays().find((m) => m.id === id);
    return md ? md.description : '';
  }

  getTeamName(id: number | null): string {
    if (!id) return '';
    const team = this.availableTeamsForMatch().find((t) => t.id === id);
    return team ? team.teamName : '';
  }

  getCaptainName(id: number | null): string {
    if (!id) return '';
    const p = this.allPlayers().find((p) => p.id === id);
    return p ? `${p.name} ${p.surname}` : '';
  }

  // 1. Modifica la firma per accettare null
  setTeamMatchDay(mdId: number | null) {
    this.currentMatchDayId.set(mdId);

    this.teamForm.get('idMatchDay')?.setValue(mdId);
    this.teamForm.get('playerIds')?.setValue([]);
    this.teamForm.get('idCaptain')?.setValue(null);
    this.selectedTeamPlayerIds.set([]);
    this.tempSelectedPlayers.set([]);

    if (mdId) {
      this.loadTeamsForMatchDay(mdId);
    } else {
      this.teamsForSelectedMatchDay.set([]);
    }
  }

  setCaptain(playerId: number | null) {
    this.teamForm.get('idCaptain')?.setValue(playerId);
  }

  // 2. Modifica la firma per accettare null
  setMatchMatchDay(mdId: number | null) {
    this.matchForm.get('matchDayId')?.setValue(mdId);

    this.matchForm.patchValue({ homeTeamId: null, awayTeamId: null });
    this.selectedHomeTeamId.set(null);
    this.selectedAwayTeamId.set(null);

    if (mdId) {
      this.isLoadingMatches.set(true); // INIZIO CARICAMENTO MATCH

      this.tournamentService
        .getMatchByMatchdayId(mdId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (matches) => {
            this.currentMatchDayMatches.set(matches);
            this.isLoadingMatches.set(false); // FINE CARICAMENTO MATCH
          },
          error: (err) => {
            console.error(err);
            this.isLoadingMatches.set(false); // ERRORE
          },
        });

      this.tournamentService
        .getTeamsByMatchDay(mdId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((teams) => {
          this.availableTeamsForMatch.set(teams);
        });
    } else {
      this.availableTeamsForMatch.set([]);
      this.currentMatchDayMatches.set([]);
    }
  }
  
  // 3. Modifica la firma per accettare null
  setHomeTeam(teamId: number | null) {
    this.matchForm.get('homeTeamId')?.setValue(teamId);
    this.selectedHomeTeamId.set(teamId);
  }

  // 4. Modifica la firma per accettare null
  setAwayTeam(teamId: number | null) {
    this.matchForm.get('awayTeamId')?.setValue(teamId);
    this.selectedAwayTeamId.set(teamId);
  }

  openPlayersModal() {
    const matchDayId = this.teamForm.get('idMatchDay')?.value;
    if (!matchDayId) {
      toast.error('Seleziona una giornata prima di gestire la rosa!');
      return;
    }

    this.searchTerm.set('');
    this.currentMatchDayId.set(matchDayId);
    this.selectedTeamPlayerIds.set([...(this.teamForm.value.playerIds || [])]);
    this.tempSelectedPlayers.set([...(this.teamForm.value.playerIds || [])]);

    this.filterRole.set('TUTTI');
    this.sortOrder.set('ASC');

    this.isPlayersModalOpen.set(true);
  }

  closePlayersModal() {
    this.isPlayersModalOpen.set(false);
  }

  togglePlayerSelection(playerId: number) {
    const current = this.tempSelectedPlayers();
    const isCurrentlySelected = current.includes(playerId);

    if (!isCurrentlySelected) {
      // Controllo per le squadre: MASSIMO 5
      if (current.length >= 5) {
        toast.warning('Puoi selezionare massimo 5 giocatori!');
        return;
      }
      this.tempSelectedPlayers.set([...current, playerId]);
    } else {
      this.tempSelectedPlayers.set(current.filter((id) => id !== playerId));
    }
  }

  savePlayersSelection() {
    const count = this.tempSelectedPlayers().length;
    if (count < 4 || count > 5) {
      toast.error('Devi selezionare 4 o 5 giocatori per la squadra!');
      return;
    }
    this.teamForm.patchValue({ playerIds: this.tempSelectedPlayers() });
    this.selectedTeamPlayerIds.set([...this.tempSelectedPlayers()]);

    const currentCaptain = this.teamForm.value.idCaptain;
    if (currentCaptain && !this.tempSelectedPlayers().includes(Number(currentCaptain))) {
      this.teamForm.patchValue({ idCaptain: null });
    }
    this.closePlayersModal();
  }

  openTeamDetail(team: any) {
    this.selectedTeamDetail.set(team);
    this.isTeamDetailModalOpen.set(true);
  }

  closeTeamDetail() {
    this.isTeamDetailModalOpen.set(false);
    this.selectedTeamDetail.set(null);
  }

  getTeamPlayers(playerIds: number[]): PlayerResponse[] {
    if (!playerIds || playerIds.length === 0) return [];

    const roleWeights: Record<string, number> = {
      PORTIERE: 1,
      DIFENSORE: 2,
      CENTROCAMPISTA: 3,
      ATTACCANTE: 4,
    };

    return this.allPlayers()
      .filter((p) => playerIds.includes(p.id))
      .sort((a, b) => {
        const weightA = roleWeights[a.role] || 99;
        const weightB = roleWeights[b.role] || 99;
        return weightA - weightB;
      });
  }

  onSubmitTeam() {
    if (this.teamForm.valid) {
      const count = this.teamForm.value.playerIds.length;
      if (count < 4 || count > 5) {
        toast.error('La squadra deve avere 4 o 5 giocatori!');
        return;
      }

      // NOMI CORRETTI PER IL TUO BACKEND!
      const payload = {
        teamName: this.teamForm.value.teamName,
        idMatchDay: Number(this.teamForm.value.idMatchDay),
        idCaptain: this.teamForm.value.idCaptain ? Number(this.teamForm.value.idCaptain) : null,
        playerIds: this.teamForm.value.playerIds.map(Number),
      };

      const editId = this.editingTeamId();

      if (editId) {
        // MODALITÀ AGGIORNAMENTO
        this.tournamentService
          .updateTournamentTeam(editId, payload)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              toast.success('Squadra aggiornata con successo!');
              this.cancelEditTeam();
            },
            error: (err) => toast.error(err.error?.message || 'Errore aggiornamento squadra'),
          });
      } else {
        // MODALITÀ CREAZIONE
        this.tournamentService
          .createTournamentTeam(payload)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              toast.success('Squadra Reale creata con successo!');
              const currentMdId = Number(this.teamForm.value.idMatchDay);
              this.teamForm.reset({ playerIds: [], idMatchDay: currentMdId });
              this.selectedTeamPlayerIds.set([]);
            },
            error: (err) => toast.error(err.error?.message || 'Errore nella creazione squadra'),
          });
      }
    }
  }

  editTeam(team: any, event: Event) {
    event.stopPropagation(); // Evita di aprire il dettaglio

    // Scroll to the top where the form is
    window.scrollTo({ top: 0, behavior: 'smooth' });

    this.editingTeamId.set(team.id);

    // Popoliamo il form con i dati della squadra
    this.teamForm.patchValue({
      teamName: team.teamName,
      idMatchDay: team.idMatchDay,
      idCaptain: team.idCaptain || null,
      playerIds: team.playerIds || [],
    });

    // Aggiorniamo le variabili di supporto per far funzionare correttamente la modale giocatori
    this.currentMatchDayId.set(team.idMatchDay);
    this.selectedTeamPlayerIds.set([...(team.playerIds || [])]);
  }

  cancelEditTeam() {
    this.editingTeamId.set(null);
    const currentMdId = Number(this.teamForm.value.idMatchDay);
    this.teamForm.reset({ playerIds: [], idMatchDay: currentMdId });
    this.selectedTeamPlayerIds.set([]);
  }

  deleteTeam(teamId: number, event: Event) {
    event.stopPropagation(); // Evita che si apra il modale del dettaglio squadra quando clicchi sul cestino

    this.modalTitle.set('Elimina Squadra');
    this.modalMessage.set(
      'Vuoi davvero eliminare questa squadra? Assicurati che non sia già assegnata a un match.',
    );

    this.pendingAction = () => {
      this.tournamentService
        .deleteTournamentTeam(teamId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Squadra eliminata con successo!');
          },
          error: (err) => toast.error(err.error?.message || 'Impossibile eliminare la squadra.'),
        });
    };

    this.isConfirmModalOpen.set(true);
  }

  onSubmitMatch() {
    if (this.matchForm.valid) {
      const { matchDayId, homeTeamId, awayTeamId } = this.matchForm.value;

      const matchPayload = {
        matchDayId: Number(matchDayId),
        homeTeamId: Number(homeTeamId),
        awayTeamId: Number(awayTeamId),
      };

      this.tournamentService
        .createMatch(matchPayload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Partita programmata!');
            this.matchForm.patchValue({ homeTeamId: null, awayTeamId: null });
            this.selectedHomeTeamId.set(null);
            this.selectedAwayTeamId.set(null);
          },
          error: (err) => toast.error(err.error?.message || 'Errore nella creazione match'),
        });
    }
  }

  getMatchDayStatus(id: number | null): string {
    if (!id) return '';
    const md = this.matchDays().find((m) => m.id === id);
    return md ? md.status : '';
  }

  isAllSelected(): boolean {
    const filteredIds = this.filteredModalPlayers().map((p) => p.id);
    if (filteredIds.length === 0) return false;
    return filteredIds.every((id) => this.tempSelectedPlayers().includes(id));
  }

  toggleSelectAll() {
    const filteredIds = this.filteredModalPlayers().map((p) => p.id);
    let currentSelected = [...this.tempSelectedPlayers()];

    if (this.isAllSelected()) {
      // Deseleziona
      this.tempSelectedPlayers.set(currentSelected.filter((id) => !filteredIds.includes(id)));
    } else {
      // Seleziona con limite di 5
      for (const id of filteredIds) {
        if (!currentSelected.includes(id)) {
          if (currentSelected.length >= 5) {
            toast.warning('Limite raggiunto: puoi selezionare massimo 5 giocatori!');
            break; // Interrompe il ciclo appena arriva a 5
          }
          currentSelected.push(id);
        }
      }
      this.tempSelectedPlayers.set(currentSelected);
    }
  }

  // Metodi di utilità per il modale
  closeModal() {
    this.isConfirmModalOpen.set(false);
    this.pendingAction = null;
  }

  confirmAction() {
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
    this.closeModal();
  }
}
