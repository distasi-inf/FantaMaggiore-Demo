import { Component, inject, OnInit, signal, output, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { MatchDayResponse } from '../../../home/model/MatchDayResponse';
import { PlayerResponse } from '../../../../core/models/player.model';
import { toast } from 'ngx-sonner';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../../shared/services/web-socket-service';
import { FantaModalComponent } from '../../../../shared/components/fanta-modal/fanta-modal.component';
import { Router } from '@angular/router';
import { AppStateService } from '../../../../core/services/app-state.service';

@Component({
  selector: 'app-manage-days',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FantaModalComponent],
  templateUrl: './manage-match-days.component.html',
})
export class ManageDaysComponent implements OnInit {
  private fb = inject(FormBuilder);
  public adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService);

  matchDays = signal<MatchDayResponse[]>([]);
  players = signal<PlayerResponse[]>([]);
  private router = inject(Router);
  private appState = inject(AppStateService);

  // Stato Modifica
  editingMatchDayId = signal<number | null>(null);

  // Ricerca giocatori
  searchTerm = signal<string>('');

  // 🔥 NUOVO: Ricerca Giornate
  matchDaySearchTerm = signal<string>('');

  //Skeleton
  isLoading = signal<boolean>(true);

  isPlayersModalOpen = signal(false);
  tempSelectedPlayers = signal<number[]>([]);

  isConfirmModalOpen = signal(false);
  modalTitle = signal<string>('');
  modalMessage = signal<string>('');
  pendingAction: (() => void) | null = null;

  matchDayForm: FormGroup = this.fb.group({
    description: ['', Validators.required],
    date: ['', Validators.required],
    deadline: ['', Validators.required],
    playerIds: [[], Validators.required],
  });

  // 🔥 NUOVO: Computed che ordina dalla più recente e filtra per nome
  filteredAndSortedMatchDays = computed(() => {
    const search = this.matchDaySearchTerm().toLowerCase().trim();

    // Creiamo una copia e ordiniamo per data decrescente (la più nuova in alto)
    let list = [...this.matchDays()].sort((a, b) => {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    // Se c'è testo nella ricerca, filtriamo
    if (search) {
      list = list.filter((md) => md.description.toLowerCase().includes(search));
    }

    return list;
  });

  ngOnInit() {
    this.loadMatchDays();
    this.loadPlayers();
    this.setupWebSocket();
  }

  private setupWebSocket() {
    this.wsService.connect();

    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action) {
          this.appState.clearMatchDaysCache();
          this.loadMatchDays();
        }
      });
  }

  filteredModalPlayers = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    let basePlayers = this.players();

    if (!search) return basePlayers;

    const searchWords = search.split(/\s+/);

    return basePlayers.filter((p) => {
      const fullText = `${p.name} ${p.surname} ${p.nickname || ''}`.toLowerCase();
      return searchWords.every((word) => fullText.includes(word));
    });
  });

  loadMatchDays() {
    this.isLoading.set(true);
    this.adminService
      .getAllMatchDays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.matchDays.set(data);
          this.isLoading.set(false);
        },
        error: (err) => {
          console.error('Errore caricamento giornate', err);
          this.isLoading.set(false);
        },
      });
  }

  loadPlayers() {
    this.adminService
      .getPlayersPaged(0, 1000)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.players.set(page.content),
        error: (err) => console.error('Errore caricamento giocatori', err),
      });
  }

  openPlayersModal() {
    this.searchTerm.set('');
    this.tempSelectedPlayers.set([...(this.matchDayForm.value.playerIds || [])]);
    this.isPlayersModalOpen.set(true);
  }

  closePlayersModal() {
    this.isPlayersModalOpen.set(false);
  }

  togglePlayerSelection(playerId: number) {
    const current = this.tempSelectedPlayers();
    if (current.includes(playerId)) {
      this.tempSelectedPlayers.set(current.filter((id) => id !== playerId));
    } else {
      this.tempSelectedPlayers.set([...current, playerId]);
    }
  }

  savePlayersSelection() {
    this.matchDayForm.patchValue({ playerIds: this.tempSelectedPlayers() });
    this.closePlayersModal();
  }

  editMatchDay(matchDay: MatchDayResponse) {
    if (matchDay.status !== 'OPEN') {
      toast.error('Puoi modificare solo le giornate in stato OPEN.');
      return;
    }

    this.editingMatchDayId.set(matchDay.id);

    this.matchDayForm.patchValue({
      description: matchDay.description,
      date: this.formatForInput(matchDay.date),
      deadline: this.formatForInput(matchDay.deadline),
      playerIds: matchDay.availablePlayerIds || [],
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  cancelEdit() {
    this.editingMatchDayId.set(null);
    this.matchDayForm.reset({ playerIds: [] });
  }

  onSubmit() {
    if (this.matchDayForm.valid) {
      const { description, date, deadline, playerIds } = this.matchDayForm.value;
      const editId = this.editingMatchDayId();

      const isDuplicate = this.matchDays().some(
        (md) =>
          md.description.trim().toLowerCase() === description.trim().toLowerCase() &&
          md.id !== editId,
      );

      if (isDuplicate) {
        toast.error('Esiste già una giornata con questo nome!');
        return;
      }

      const matchDayPayload = {
        description,
        date,
        deadline,
        playerIds: playerIds.map(Number),
      };

      if (editId) {
        this.adminService
          .updateMatchDay(editId, matchDayPayload)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              toast.success('Giornata e Convocati aggiornati con successo!');
              this.cancelEdit();
              this.loadMatchDays();
            },
            error: (err) => toast.error(err.error?.message || 'Errore modifica giornata'),
          });
      } else {
        this.adminService
          .createMatchDay(matchDayPayload)
          .pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe({
            next: () => {
              toast.success('Giornata e Convocati salvati con successo!');
              this.matchDayForm.reset({ playerIds: [] });
              this.loadMatchDays();
            },
            error: (err) =>
              toast.error(err.error?.message || 'Errore nella creazione della giornata'),
          });
      }
    }
  }

  deleteMatchDay(id: number) {
    this.modalTitle.set('Elimina Giornata');
    this.modalMessage.set("Vuoi davvero eliminare questa giornata? L'azione è irreversibile.");
    this.pendingAction = () => {
      this.adminService
        .deleteMatchDay(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => toast.success('Giornata eliminata con successo'),
          error: (err) =>
            toast.error(err.error?.message || 'Impossibile eliminare questa giornata.'),
        });
    };
    this.openModal();
  }

  openMatchDay(id: number) {
    this.modalTitle.set('Apri Giornata');
    this.modalMessage.set(
      'Vuoi aprire la giornata? Verranno generati i voti base (6.0) per tutti e lo stato passerà a "In Corso".',
    );
    this.pendingAction = () => {
      this.adminService
        .openMatchDay(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Giornata aperta!');
            this.loadMatchDays();
          },
          error: (err) =>
            toast.error(err.error?.message || "Errore durante l'apertura della giornata."),
        });
    };
    this.openModal();
  }

  calculateResults(id: number) {
    this.modalTitle.set('Attenzione: Calcolo Risultati');
    this.modalMessage.set(
      'Vuoi calcolare i risultati? Assicurati che TUTTE le partite associate a questa giornata siano terminate. Se un match non ancora iniziato o è ancora in corso, il calcolo fallirà.',
    );
    this.pendingAction = () => {
      this.adminService
        .calculateMatchDayResults(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Risultati calcolati e classifica aggiornata!');
            this.loadMatchDays();
          },
          error: (err) =>
            toast.error(
              err.error?.message ||
                'Errore durante il calcolo. Controlla che i match siano finiti.',
            ),
        });
    };
    this.openModal();
  }

  rollbackMatchDay(id: number) {
    this.modalTitle.set('⚠️ EMERGENZA: Annulla Calcolo');
    this.modalMessage.set(
      'Attenzione! Questa operazione annullerà il calcolo della giornata, sottraendo i punti assegnati e riportando lo stato a "LIVE". Usa questa funzione solo in caso di errori. Sei sicuro di voler procedere?',
    );
    this.pendingAction = () => {
      this.adminService
        .rollbackMatchDay(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Rollback completato! La giornata è di nuovo LIVE.');
            this.loadMatchDays();
          },
          error: (err) =>
            toast.error(err.error?.message || 'Errore durante il rollback della giornata.'),
        });
    };
    this.openModal();
  }

  goToLiveMatches(id: number) {
    this.router.navigate(['/admin/live-matches'], { queryParams: { matchDayId: id } });
  }

  getMinDateTime(): string {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
  }

  openModal() {
    this.isConfirmModalOpen.set(true);
  }

  closeModal() {
    this.isConfirmModalOpen.set(false);
  }

  confirmAction() {
    if (this.pendingAction) {
      this.pendingAction();
      this.pendingAction = null;
    }
    this.closeModal();
  }

  isAllSelected(): boolean {
    const filteredIds = this.filteredModalPlayers().map((p) => p.id);
    if (filteredIds.length === 0) return false;
    return filteredIds.every((id) => this.tempSelectedPlayers().includes(id));
  }

  toggleSelectAll() {
    const filteredIds = this.filteredModalPlayers().map((p) => p.id);
    const currentSelected = this.tempSelectedPlayers();

    if (this.isAllSelected()) {
      this.tempSelectedPlayers.set(currentSelected.filter((id) => !filteredIds.includes(id)));
    } else {
      const newSelected = new Set([...currentSelected, ...filteredIds]);
      this.tempSelectedPlayers.set(Array.from(newSelected));
    }
  }

  private formatForInput(dateStr: string | Date): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = new Date(d.getTime() - offset).toISOString().slice(0, 16);
    return localISOTime;
  }
}
