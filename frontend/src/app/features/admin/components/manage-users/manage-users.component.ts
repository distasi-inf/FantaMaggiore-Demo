import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminService } from '../../services/admin.service';
import { AuthService } from '../../../../core/services/auth.service';
import { AppStateService } from '../../../../core/services/app-state.service';
import { toast } from 'ngx-sonner';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { User } from '../../../../core/models/user.model';
import { WebSocketService } from '../../../../shared/services/web-socket-service';
import { FantaModalComponent } from '../../../../shared/components/fanta-modal/fanta-modal.component';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

@Component({
  selector: 'app-manage-users',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, FantaModalComponent],
  templateUrl: './manage-users.component.html',
})
export class ManageUsersComponent implements OnInit {
  private fb = inject(FormBuilder);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private appState = inject(AppStateService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService);

  loggedUserIdentifier = signal<string | null>(null);
  loggedUserRole = signal<string | null>(null);

  allUsersData = signal<User[]>([]);

  selectedUser = signal<User | null>(null);
  searchTerm = signal<string>('');
  filterRole = signal<string>('TUTTI');

  searchSubject = new Subject<string>();

  currentPage = signal<number>(0);
  pageSize = signal<number>(10);
  isLoading = signal<boolean>(true);

  filteredAndSortedUsers = computed(() => {
    const currentData = this.allUsersData();
    let list = Array.isArray(currentData) ? [...currentData] : [];

    const role = this.filterRole();
    if (role !== 'TUTTI') {
      list = list.filter((u) => u.role === role);
    }

    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      const searchWords = search.split(/\s+/);
      list = list.filter((u) => {
        const fullText =
          `${u.name} ${u.surname} ${u.username} ${u.email} ${u.fantasyTeamName}`.toLowerCase();
        return searchWords.every((word) => fullText.includes(word));
      });
    }

    const roleWeight: Record<string, number> = { SUPER_ADMIN: 1, ADMIN: 2, USER: 3 };
    list.sort((a, b) => {
      const wA = roleWeight[a.role] || 4;
      const wB = roleWeight[b.role] || 4;
      if (wA !== wB) return wA - wB;
      return a.name.localeCompare(b.name);
    });

    return list;
  });

  totalElements = computed(() => this.filteredAndSortedUsers().length);
  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize()) || 1);

  users = computed(() => {
    const start = this.currentPage() * this.pageSize();
    return this.filteredAndSortedUsers().slice(start, start + this.pageSize());
  });

  isEditModalOpen = signal(false);
  isPasswordModalOpen = signal(false);
  isConfirmModalOpen = signal(false);

  editForm: FormGroup = this.fb.group({
    name: ['', Validators.required],
    surname: ['', Validators.required],
    username: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['', Validators.required],
    fantasyTeamName: ['', Validators.required],
    nationality: [''],
  });

  passwordForm: FormGroup = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
  });

  confirmTitle = signal('');
  confirmMessage = signal('');
  pendingAction: (() => void) | null = null;

  ngOnInit() {
    this.extractUserFromToken();
    this.loadAllUsers();
    this.setupWebSocket();

    this.searchSubject
      .pipe(debounceTime(150), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.searchTerm.set(val);
        this.currentPage.set(0);
      });
  }

  private setupWebSocket() {
    this.wsService.connect();
    this.wsService
      .watch('/topic/users')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: any) => {
        if (payload && payload.action) {
          this.appState.clearUsersCache();
          this.loadAllUsers(true);

          if (this.selectedUser() && payload.user && payload.user.id === this.selectedUser()?.id) {
            this.selectedUser.set(payload.user);
          }
        }
      });
  }

  private extractUserFromToken() {
    const token = this.authService.getToken();
    if (!token) return;
    try {
      const parts = token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        this.loggedUserIdentifier.set(payload.sub || payload.username || payload.email);
        this.loggedUserRole.set(
          payload.role || payload.authorities?.[0]?.authority || payload.authorities?.[0] || 'USER',
        );
      }
    } catch (e) {
      console.error('Errore nella decodifica del token');
    }
  }

  isMe(user: User | null | undefined): boolean {
    if (!user || !this.loggedUserIdentifier()) return false;
    const identifier = this.loggedUserIdentifier();
    return user.username === identifier || user.email === identifier;
  }

  amISuperAdmin = computed(() => {
    const myUser = this.allUsersData().find((u) => this.isMe(u));
    if (myUser && myUser.role === 'SUPER_ADMIN') return true;
    return this.loggedUserRole() === 'SUPER_ADMIN' || this.loggedUserRole() === 'ROLE_SUPER_ADMIN';
  });

  loadAllUsers(forceRefresh = false) {
    // 🔥 FIX BUG "iscritti non mostrati":
    // Prima, quando la cache era disponibile il metodo usciva subito senza
    // mai impostare isLoading = false. Il signal riparte da true a ogni
    // creazione del componente, quindi il template mostrava gli skeleton
    // in eterno anche se i dati erano già pronti in allUsersData.
    if (!forceRefresh && this.appState.usersList()) {
      this.allUsersData.set(this.appState.usersList()!);
      this.isLoading.set(false); // ← questo era il bug: mancava questa riga
      return;
    }

    this.isLoading.set(true);
    this.adminService
      .getAllUsersPagedAndSearched(0, 1000, '', 'TUTTI')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response: any) => {
          let usersArray = [];
          if (Array.isArray(response)) {
            usersArray = response;
          } else if (response && response.content) {
            usersArray = response.content;
          } else if (response && response.data) {
            usersArray = response.data;
          }

          this.appState.usersList.set(usersArray);
          this.allUsersData.set(usersArray);
          this.isLoading.set(false);
        },
        error: (err) => {
          toast.error(err.error?.message || 'Errore nel caricamento degli utenti');
          this.isLoading.set(false);
        },
      });
  }

  onSearchChange(event: any) {
    this.searchSubject.next(event.target.value);
  }

  clearSearch() {
    this.searchTerm.set('');
    this.currentPage.set(0);
  }

  setFilterRole(role: string) {
    this.filterRole.set(role);
    this.currentPage.set(0);
  }

  openEditModal(user: User) {
    this.selectedUser.set(user);
    this.editForm.patchValue({
      name: user.name,
      surname: user.surname,
      username: user.username,
      email: user.email,
      role: user.role,
      fantasyTeamName: user.fantasyTeamName,
      nationality: user.nationality || '',
    });

    const personalFields = [
      'name',
      'surname',
      'username',
      'email',
      'fantasyTeamName',
      'nationality',
    ];
    const isMe = this.isMe(user);
    const superAdmin = this.amISuperAdmin();

    if (isMe) {
      personalFields.forEach((field) => this.editForm.get(field)?.enable());
      this.editForm.get('role')?.disable();
    } else if (user.role === 'SUPER_ADMIN') {
      personalFields.forEach((field) => this.editForm.get(field)?.disable());
      this.editForm.get('role')?.disable();
    } else if (user.role === 'ADMIN') {
      if (superAdmin) {
        personalFields.forEach((field) => this.editForm.get(field)?.enable());
        this.editForm.get('role')?.enable();
      } else {
        personalFields.forEach((field) => this.editForm.get(field)?.disable());
        this.editForm.get('role')?.disable();
      }
    } else {
      personalFields.forEach((field) => this.editForm.get(field)?.enable());
      this.editForm.get('role')?.enable();
    }

    this.isEditModalOpen.set(true);
  }

  closeEditModal() {
    this.isEditModalOpen.set(false);
  }

  submitEdit() {
    if (this.editForm.invalid || !this.selectedUser()) return;
    const payload = this.editForm.getRawValue();
    this.adminService
      .updateUserAsAdmin(this.selectedUser()!.id, payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          toast.success('Utente aggiornato!');
          this.appState.clearUsersCache();
          this.loadAllUsers(true);
          this.closeEditModal();
        },
        error: (err) => toast.error(err.error?.message || 'Errore aggiornamento'),
      });
  }

  openPasswordModal(user: User) {
    this.selectedUser.set(user);
    this.passwordForm.reset();
    this.isPasswordModalOpen.set(true);
  }

  closePasswordModal() {
    this.isPasswordModalOpen.set(false);
  }

  submitPasswordReset() {
    if (this.passwordForm.invalid || !this.selectedUser()) return;
    this.adminService
      .resetUserPasswordAsAdmin(this.selectedUser()!.id, this.passwordForm.value.newPassword)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          toast.success('Password resettata!');
          this.closePasswordModal();
        },
        error: (err) => toast.error(err.error?.message || 'Errore reset password'),
      });
  }

  confirmToggleBan(user: User) {
    this.selectedUser.set(user);
    if (user.locked) {
      this.confirmTitle.set('Ripristina Utente');
      this.confirmMessage.set(`Vuoi riattivare l'account di ${user.name}?`);
      this.pendingAction = () => {
        this.adminService.restoreUserAsAdmin(user.id).subscribe({
          next: () => {
            toast.success('Utente ripristinato con successo!');
            this.appState.clearUsersCache();
            this.loadAllUsers(true);
          },
          error: (err) => toast.error(err.error?.message || 'Errore ripristino'),
        });
      };
    } else {
      this.confirmTitle.set('Banna Utente');
      this.confirmMessage.set(`Vuoi davvero bannare ${user.name}? Non potrà più accedere.`);
      this.pendingAction = () => {
        this.adminService.deleteUserAsAdmin(user.id).subscribe({
          next: () => {
            toast.error('Utente bannato!');
            this.appState.clearUsersCache();
            this.loadAllUsers(true);
          },
          error: (err) => toast.error(err.error?.message || 'Errore ban'),
        });
      };
    }
    this.isConfirmModalOpen.set(true);
  }

  executeConfirm() {
    if (this.pendingAction) this.pendingAction();
    this.closeConfirm();
  }

  closeConfirm() {
    this.isConfirmModalOpen.set(false);
    this.pendingAction = null;
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
