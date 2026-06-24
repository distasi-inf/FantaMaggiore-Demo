import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { AdminService } from '../../services/admin.service';
import { PlayerRequest, PlayerResponse } from '../../../../core/models/player.model';
import { toast } from 'ngx-sonner';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { WebSocketService } from '../../../../shared/services/web-socket-service';
import { FantaModalComponent } from '../../../../shared/components/fanta-modal/fanta-modal.component';
import { User } from '../../../../core/models/user.model';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { AppStateService } from '../../../../core/services/app-state.service';
import { SupabaseService } from '../../../../core/services/supabase.service';

import imageCompression from 'browser-image-compression';

@Component({
  selector: 'app-manage-players',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FantaModalComponent],
  templateUrl: './manage-players.component.html',
})
export class ManagePlayersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService);
  private appState = inject(AppStateService);
  private supabaseService = inject(SupabaseService);

  isUploadingImage = signal<boolean>(false);
  isUploadingEditImage = signal<boolean>(false);

  // 🔥 IL VERO CERVELLO DELLA CACHE: Tutti i giocatori caricati una volta sola
  allPlayersData = signal<PlayerResponse[]>([]);

  users = signal<User[]>([]);
  imagePreview = signal<string | null>(null);

  // Filtri e Ordinamento
  filterRole = signal<string>('TUTTI');
  sortOrder = signal<'ASC' | 'DESC'>('ASC');
  searchTerm = signal<string>('');
  isTrashMode = signal<boolean>(false);

  isLoading = signal<boolean>(true);

  // Paginazione
  currentPage = signal<number>(0);
  pageSize = signal<number>(10);

  // 🔥 COMPUTED: Filtra e ordina in tempo reale nella RAM (Zero chiamate HTTP!)
  filteredAndSortedPlayers = computed(() => {
    let list = this.allPlayersData();

    // 1. Filtro Cestino / Attivi
    const trash = this.isTrashMode();
    list = list.filter((p) => p.active === !trash);

    // 2. Filtro Ruolo
    const role = this.filterRole();
    if (role !== 'TUTTI') {
      list = list.filter((p) => p.role === role);
    }

    // 3. Ricerca Istantanea Testuale
    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      const searchWords = search.split(/\s+/);
      list = list.filter((p) => {
        const fullText = `${p.name} ${p.surname} ${p.nickname || ''}`.toLowerCase();
        return searchWords.every((word) => fullText.includes(word));
      });
    }

    // 4. Ordinamento
    const sortAsc = this.sortOrder() === 'ASC';
    list = list.sort((a, b) => {
      const nameA = a.surname.toLowerCase();
      const nameB = b.surname.toLowerCase();
      if (nameA < nameB) return sortAsc ? -1 : 1;
      if (nameA > nameB) return sortAsc ? 1 : -1;
      return 0;
    });

    return list;
  });

  // 🔥 COMPUTED: Paginazione lato client automatica
  totalElements = computed(() => this.filteredAndSortedPlayers().length);
  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()) || 1);

  players = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredAndSortedPlayers().slice(start, start + this.pageSize());
  });

  searchSubject = new Subject<string>();

  onSearchChange(event: any) {
    this.searchSubject.next(event.target.value);
  }

  clearSearch() {
    this.searchTerm.set('');
    this.currentPage.set(0);
  }

  playerForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    surname: ['', Validators.required],
    nickname: [''],
    role: ['PORTIERE', Validators.required],
    nationality: ['it', Validators.required],
    profileImg: [''],
    userId: [null],
  });

  isConfirmModalOpen = signal<boolean>(false);
  modalTitle = signal<string>('');
  modalMessage = signal<string>('');
  pendingAction: (() => void) | null = null;

  isDetailModalOpen = signal<boolean>(false);
  selectedPlayerDetail = signal<PlayerResponse | null>(null);

  countries = [
    { code: 'it', name: 'Italia' },
    { code: 'ar', name: 'Argentina' },
    { code: 'br', name: 'Brasile' },
    { code: 'fr', name: 'Francia' },
    { code: 'es', name: 'Spagna' },
    { code: 'de', name: 'Germania' },
    { code: 'gb-eng', name: 'Inghilterra' },
    { code: 'pt', name: 'Portogallo' },
    { code: 'nl', name: 'Olanda' },
    { code: 'be', name: 'Belgio' },
    { code: 'hr', name: 'Croazia' },
    { code: 'rs', name: 'Serbia' },
    { code: 'uy', name: 'Uruguay' },
    { code: 'co', name: 'Colombia' },
    { code: 'us', name: 'USA' },
    { code: 'sn', name: 'Senegal' },
    { code: 'ma', name: 'Marocco' },
    { code: 'jp', name: 'Giappone' },
  ].sort((a, b) => a.name.localeCompare(b.name));

  ngOnInit() {
    this.loadAllPlayers();
    this.loadUsers();
    this.setupWebSocket();

    this.searchSubject
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.searchTerm.set(val);
        this.currentPage.set(0);
      });
  }

  // --- GESTIONE UTENTI ---
  availableUsersForCreation = computed(() => {
    const assignedIds = new Set(
      this.allPlayersData()
        .map((p) => Number(p.userId))
        .filter((id) => !isNaN(id) && id !== 0),
    );
    return this.users().filter((u) => !assignedIds.has(Number(u.id)));
  });

  availableUsersForEdit = computed(() => {
    const currentEditUserId = Number(this.selectedPlayerToEdit()?.userId);
    const assignedIds = new Set(
      this.allPlayersData()
        .map((p) => Number(p.userId))
        .filter((id) => !isNaN(id) && id !== 0 && id !== currentEditUserId),
    );
    return this.users().filter((u) => !assignedIds.has(Number(u.id)));
  });

  loadUsers() {
    this.adminService
      .getAllUsersPagedAndSearched(0, 1000, '', 'TUTTI')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => this.users.set(page.content),
        error: () => console.error('Errore nel caricamento degli utenti'),
      });
  }

  getUserName(userId?: number): string | null {
    if (!userId) return null;
    const u = this.users().find((user) => user.id === userId);
    return u ? `${u.name} ${u.surname}` : 'Sconosciuto';
  }

  setUserId(id: number | null) {
    this.playerForm.patchValue({ userId: id });
  }
  getSelectedUser() {
    const id = this.playerForm.get('userId')?.value;
    return id ? this.users().find((u) => u.id === id) : null;
  }
  setEditUserId(id: number | null) {
    this.editPlayerForm.patchValue({ userId: id });
  }
  getEditSelectedUser() {
    const id = this.editPlayerForm.get('userId')?.value;
    return id ? this.users().find((u) => u.id === id) : null;
  }

  private setupWebSocket() {
    this.wsService.connect();
    this.wsService
      .watch('/topic/players')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (message && message.action && message.player) {
          const updatedPlayer: PlayerResponse = message.player;
          // Aggiorna l'array globale in tempo reale
          this.allPlayersData.update((current) => {
            let newArray = current.filter((p) => p.id !== updatedPlayer.id);
            newArray.push(updatedPlayer);
            return newArray;
          });

          if (this.selectedPlayerDetail()?.id === updatedPlayer.id)
            this.selectedPlayerDetail.set(updatedPlayer);
          if (this.selectedPlayerToEdit()?.id === updatedPlayer.id)
            this.selectedPlayerToEdit.set(updatedPlayer);
        } else {
          this.appState.clearPlayersCache();
          this.loadAllPlayers(true);
        }
      });
  }

  // 🔥 CARICAMENTO UNICO DEI GIOCATORI TRAMITE CACHE GLOBALE
  loadAllPlayers(forceRefresh = false) {
    if (!forceRefresh && this.appState.allPlayersList()) {
      this.allPlayersData.set(this.appState.allPlayersList()!);
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.adminService
      .getAllPlayersIncludingDeleted()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.allPlayersData.set(data);
          this.isLoading.set(false);
        },
        error: () => {
          toast.error('Errore nel caricamento del listone');
          this.isLoading.set(false);
        },
      });
  }

  setFilterRole(role: string) {
    this.filterRole.set(role);
    this.currentPage.set(0);
  }

  toggleSortOrder() {
    this.sortOrder.update((current) => (current === 'ASC' ? 'DESC' : 'ASC'));
    this.currentPage.set(0);
  }

  setRole(role: string) {
    this.playerForm.patchValue({ role });
  }
  setNationality(code: string) {
    this.playerForm.patchValue({ nationality: code });
  }
  getSelectedCountry() {
    return this.countries.find((c) => c.code === this.playerForm.get('nationality')?.value);
  }

  async onFileSelected(event: any) {
    let file: File = event.target.files[0];
    if (!file) return;

    this.isUploadingImage.set(true);
    try {
      const oldUrl = this.playerForm.get('profileImg')?.value;
      if (oldUrl && oldUrl.includes('supabase.co')) {
        await this.supabaseService.deleteImageByUrl(oldUrl); // Rimuove solo se cambiamo idea durante la creazione
      }

      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      const reader = new FileReader();
      reader.onload = () => this.imagePreview.set(reader.result as string);
      reader.readAsDataURL(compressedFile);

      // Usiamo l'ID utente assegnato, oppure 0 se è "Nessuno"
      const assignedUserId = this.playerForm.get('userId')?.value || 0;
      const publicUrl = await this.supabaseService.uploadPlayerImage(
        compressedFile as File,
        assignedUserId,
      );

      this.playerForm.patchValue({ profileImg: publicUrl });
    } catch (e) {
      toast.error('Errore upload immagine');
    } finally {
      this.isUploadingImage.set(false);
    }
  }

  async removeImage() {
    const currentUrl = this.playerForm.get('profileImg')?.value;
    if (currentUrl && currentUrl.includes('supabase.co')) {
      await this.supabaseService.deleteImageByUrl(currentUrl);
    }
    this.imagePreview.set(null);
    this.playerForm.patchValue({ profileImg: '' });
  }

  onSubmitPlayer() {
    if (this.playerForm.valid) {
      const formValue = this.playerForm.value;
      const payload: PlayerRequest = {
        name: formValue.name,
        surname: formValue.surname,
        nickname: formValue.nickname,
        role: formValue.role,
        profileImg: formValue.profileImg,
        nationality: formValue.nationality.toUpperCase(),
        userId: formValue.userId ? Number(formValue.userId) : null,
      };

      this.adminService
        .createPlayer(payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Giocatore aggiunto!');
            this.playerForm.reset({
              role: 'PORTIERE',
              nationality: 'it',
              nickname: '',
              userId: null,
            });
            this.imagePreview.set(null);
            this.appState.clearPlayersCache();
            this.loadAllPlayers(true); // Forza refresh da backend per sicurezza
          },
          error: (err) => toast.error(err.error?.message || 'Errore salvataggio'),
        });
    }
  }

  deletePlayer(id: number) {
    this.modalTitle.set('Elimina Giocatore');
    this.modalMessage.set('Sei sicuro di voler rimuovere questo calciatore dal sistema?');
    this.pendingAction = () => {
      this.adminService
        .deletePlayer(id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => toast.success('Giocatore eliminato!'),
          error: () => toast.error('Impossibile eliminare questo giocatore.'),
        });
    };
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

  openPlayerDetail(player: PlayerResponse) {
    this.selectedPlayerDetail.set(player);
    this.isDetailModalOpen.set(true);
  }
  closePlayerDetail() {
    this.isDetailModalOpen.set(false);
    this.selectedPlayerDetail.set(null);
  }

  toggleTrashMode() {
    this.isTrashMode.update((val) => !val);
    this.currentPage.set(0);
  }

  restorePlayer(id: number, event: Event) {
    event.stopPropagation();
    this.adminService
      .restorePlayer(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => toast.success('Giocatore ripristinato con successo!'),
        error: () => toast.error('Errore durante il ripristino'),
      });
  }

  isEditModalOpen = signal<boolean>(false);
  selectedPlayerToEdit = signal<PlayerResponse | null>(null);
  editImagePreview = signal<string | null>(null);

  editPlayerForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    surname: ['', Validators.required],
    nickname: [''],
    role: ['PORTIERE', Validators.required],
    nationality: ['it', Validators.required],
    profileImg: [''],
    userId: [null],
  });

  openEditModal(player: PlayerResponse, event: Event) {
    event.stopPropagation();
    this.selectedPlayerToEdit.set(player);
    this.editImagePreview.set(player.profileImg || null);
    this.editPlayerForm.patchValue({
      name: player.name,
      surname: player.surname,
      nickname: player.nickname || '',
      role: player.role,
      nationality: player.nationality.toLowerCase(),
      profileImg: player.profileImg || '',
      userId: player.userId || null,
    });
    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
    this.selectedPlayerToEdit.set(null);
    this.editPlayerForm.reset();
  }

  setEditRole(role: string) {
    this.editPlayerForm.patchValue({ role });
  }
  setEditNationality(code: string) {
    this.editPlayerForm.patchValue({ nationality: code });
  }
  getEditSelectedCountry() {
    return this.countries.find((c) => c.code === this.editPlayerForm.get('nationality')?.value);
  }

  async onEditFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    this.isUploadingEditImage.set(true);
    try {
      // Elimina la vecchia foto da Supabase perché la stiamo rimpiazzando con una nuova
      const oldUrl = this.editPlayerForm.get('profileImg')?.value;
      if (oldUrl && oldUrl.includes('supabase.co')) {
        await this.supabaseService.deleteImageByUrl(oldUrl);
      }

      const options = { maxSizeMB: 0.2, maxWidthOrHeight: 800, useWebWorker: true };
      const compressedFile = await imageCompression(file, options);

      const reader = new FileReader();
      reader.onload = () => this.editImagePreview.set(reader.result as string);
      reader.readAsDataURL(compressedFile);

      const assignedUserId = this.editPlayerForm.get('userId')?.value || 0;
      const publicUrl = await this.supabaseService.uploadPlayerImage(
        compressedFile as File,
        assignedUserId,
      );

      this.editPlayerForm.patchValue({ profileImg: publicUrl });
    } catch (e) {
      toast.error('Errore upload immagine');
    } finally {
      this.isUploadingEditImage.set(false);
    }
  }

  async removeEditImage() {
    const currentUrl = this.editPlayerForm.get('profileImg')?.value;
    if (currentUrl && currentUrl.includes('supabase.co')) {
      await this.supabaseService.deleteImageByUrl(currentUrl);
    }
    this.editImagePreview.set(null);
    this.editPlayerForm.patchValue({ profileImg: '' });
  }

  onSubmitEditPlayer() {
    if (this.editPlayerForm.valid && this.selectedPlayerToEdit()) {
      const formValue = this.editPlayerForm.value;
      const payload: PlayerRequest = {
        name: formValue.name,
        surname: formValue.surname,
        nickname: formValue.nickname,
        role: formValue.role,
        profileImg: formValue.profileImg,
        nationality: formValue.nationality.toUpperCase(),
        userId: formValue.userId ? Number(formValue.userId) : null,
      };

      this.adminService
        .updatePlayer(this.selectedPlayerToEdit()!.id, payload)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            toast.success('Giocatore aggiornato!');
            this.closeEditModal();
          },
          error: (err) => toast.error(err.error?.message || 'Errore aggiornamento'),
        });
    }
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
    }
  }
  nextPage() {
    this.goToPage(this.currentPage() + 1);
  }
  prevPage() {
    this.goToPage(this.currentPage() - 1);
  }
}
