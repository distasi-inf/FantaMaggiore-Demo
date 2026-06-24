import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
  AbstractControl,
} from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toast } from 'ngx-sonner';

import imageCompression from 'browser-image-compression';

import { ProfileService, UpdateProfileDTO } from './service/profile.service';
import { AuthService } from '../../core/services/auth.service';
import { JwtHelperService } from '../../core/services/jwt-helper.service';
import { AppStateService } from '../../core/services/app-state.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FantaModalComponent } from '../../shared/components/fanta-modal/fanta-modal.component';
import { User } from '../../core/models/user.model';
import { PlayerResponse } from '../../core/models/player.model';

type Tab = 'account' | 'player' | 'stats';
type ProfileField = 'name' | 'surname' | 'username' | 'fantasyTeamName';

const ROLES: Record<string, string> = {
  PORTIERE: 'POR',
  DIFENSORE: 'DIF',
  CENTROCAMPISTA: 'CEN',
  ATTACCANTE: 'ATT',
};

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    LucideAngularModule,
    HeaderComponent,
    FantaModalComponent,
  ],
  templateUrl: './profile.component.html',
})
export class ProfileComponent implements OnInit {
  private profileService = inject(ProfileService);
  private authService = inject(AuthService);
  private jwtHelper = inject(JwtHelperService);
  private appState = inject(AppStateService);
  private supabaseService = inject(SupabaseService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  activeTab = signal<Tab>('account');
  isLoadingProfile = signal(true);
  isSavingPassword = signal(false);

  user = signal<User | null>(null);
  myPlayer = signal<PlayerResponse | null>(null);

  // --- STATO INLINE EDITING (ACCOUNT) ---
  editingField = signal<ProfileField | null>(null);
  editControl = this.fb.control('', [Validators.required, Validators.minLength(2)]);
  isSavingField = signal(false);
  passwordForm!: FormGroup;

  // --- STATO ALTER-EGO ---
  playerForm!: FormGroup;
  isCreatePlayerModalOpen = signal(false);
  isEditPlayerModalOpen = signal(false);
  isDeletePlayerModalOpen = signal(false);
  isSavingPlayer = signal(false);

  imagePreview = signal<string | null>(null);
  isUploadingImage = signal(false);

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

  currentUserId = computed(() => this.jwtHelper.getCurrentUserId());
  roleLabel = (role: string) => ROLES[role] ?? role;

  ngOnInit(): void {
    this.buildForms();
    this.loadProfile();
  }

  private buildForms(): void {
    this.passwordForm = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(6)]],
        confirmPassword: ['', Validators.required],
      },
      { validators: this.passwordMatchValidator },
    );

    this.playerForm = this.fb.group({
      name: ['', Validators.required],
      surname: ['', Validators.required],
      nickname: [''],
      nationality: ['it', Validators.required],
      role: ['ATTACCANTE', Validators.required],
      profileImg: [''],
    });
  }

  private passwordMatchValidator(group: AbstractControl) {
    const pw = group.get('newPassword')?.value;
    const conf = group.get('confirmPassword')?.value;
    return pw === conf ? null : { mismatch: true };
  }

  private loadProfile(): void {
    const uid = this.currentUserId();
    if (!uid) {
      this.router.navigate(['/login']);
      return;
    }

    this.profileService
      .getMyProfile(uid)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (user) => {
          this.user.set(user);
          this.isLoadingProfile.set(false);
          if (user.playerId) {
            this.profileService.getMyPlayer(user.playerId).subscribe((p) => this.myPlayer.set(p));
          }
        },
        error: () => {
          toast.error('Errore caricamento profilo');
          this.isLoadingProfile.set(false);
        },
      });
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  // ===================== INLINE EDITING ACCOUNT =====================
  startEdit(field: ProfileField): void {
    this.editingField.set(field);
    this.editControl.setValue(this.user()![field]);
  }

  cancelEdit(): void {
    this.editingField.set(null);
  }

  saveField(): void {
    if (this.editControl.invalid) return;
    const field = this.editingField();
    if (!field) return;

    this.isSavingField.set(true);
    const dto: UpdateProfileDTO = { [field]: this.editControl.value };

    this.profileService
      .updateMyProfile(dto)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.user.set(updated);
          toast.success('Campo aggiornato con successo!');
          this.editingField.set(null);
          this.isSavingField.set(false);

          // 🔥 FIX BUG CLASSIFICA: Svuota la cache della classifica globale
          // così la prossima volta che si apre Home o Ranking vengono ricaricati
          // i dati aggiornati con il nuovo nome/fantasyTeamName dell'utente.
          this.appState.clearGlobalRankingCache();
        },
        error: (err) => {
          toast.error(err.error?.message || "Errore durante l'aggiornamento");
          this.isSavingField.set(false);
        },
      });
  }

  // ===================== PASSWORD =====================
  savePassword(): void {
    if (this.passwordForm.invalid) return;
    this.isSavingPassword.set(true);
    this.profileService.changePassword(this.passwordForm.value.newPassword).subscribe({
      next: () => {
        toast.success('Password aggiornata!');
        this.passwordForm.reset();
        this.isSavingPassword.set(false);
      },
      error: () => {
        toast.error('Errore aggiornamento password');
        this.isSavingPassword.set(false);
      },
    });
  }

  // ===================== UTILS ALTER-EGO (Mappe e Form) =====================
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
      // 🔥 1. PULIZIA AUTOMATICA: Se c'è già un URL nel form, eliminiamo il vecchio file da Supabase
      const oldUrl = this.playerForm.get('profileImg')?.value;
      if (oldUrl && oldUrl.includes('supabase.co')) {
        await this.supabaseService.deleteImageByUrl(oldUrl);
      }

      // 2. CONFIGURAZIONE COMPRESSIONE
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 800,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      const reader = new FileReader();
      reader.onload = () => this.imagePreview.set(reader.result as string);
      reader.readAsDataURL(compressedFile);

      const userId = this.currentUserId()!;

      // 3. UPLOAD DEL NUOVO FILE
      const publicUrl = await this.supabaseService.uploadPlayerImage(
        compressedFile as File,
        userId,
      );

      this.playerForm.patchValue({ profileImg: publicUrl });
      toast.success('Immagine ottimizzata e caricata!');
    } catch (e) {
      toast.error("Errore durante l'upload");
    } finally {
      this.isUploadingImage.set(false);
    }
  }

  // ===================== AZIONI ALTER-EGO =====================
  openCreatePlayerModal() {
    this.playerForm.reset({ role: 'ATTACCANTE', nationality: 'it', profileImg: '' });
    this.imagePreview.set(null);
    this.isCreatePlayerModalOpen.set(true);
  }
  closeCreatePlayerModal() {
    this.isCreatePlayerModalOpen.set(false);
  }

  createPlayer(): void {
    if (this.playerForm.invalid) return;
    this.isSavingPlayer.set(true);

    const payload = { ...this.playerForm.value };
    if (payload.nationality) payload.nationality = payload.nationality.toUpperCase();

    this.profileService
      .createMyPlayer(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (newPlayer) => {
          this.myPlayer.set(newPlayer);
          this.loadProfile();
          toast.success('Alter-ego sceso in campo!');
          this.closeCreatePlayerModal();
          this.isSavingPlayer.set(false);
        },
        error: (err) => {
          toast.error(err.error?.message || 'Errore creazione');
          this.isSavingPlayer.set(false);
        },
      });
  }

  openEditPlayerModal() {
    const p = this.myPlayer();
    if (p) {
      this.imagePreview.set(p.profileImg || null);
      this.playerForm.patchValue({
        name: p.name,
        surname: p.surname,
        nickname: p.nickname || '',
        nationality: p.nationality ? p.nationality.toLowerCase() : 'it',
        role: p.role,
        profileImg: p.profileImg || '',
      });
      this.isEditPlayerModalOpen.set(true);
    }
  }
  closeEditPlayerModal() {
    this.isEditPlayerModalOpen.set(false);
  }

  updatePlayer(): void {
    if (this.playerForm.invalid) return;
    this.isSavingPlayer.set(true);

    const payload = { ...this.playerForm.value };
    if (payload.nationality) payload.nationality = payload.nationality.toUpperCase();

    this.profileService
      .updateMyPlayer(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updatedPlayer) => {
          this.myPlayer.set(updatedPlayer);
          toast.success('Alter-ego aggiornato!');
          this.closeEditPlayerModal();
          this.isSavingPlayer.set(false);
        },
        error: () => {
          toast.error('Errore aggiornamento');
          this.isSavingPlayer.set(false);
        },
      });
  }

  openDeletePlayerModal() {
    this.isDeletePlayerModalOpen.set(true);
  }
  closeDeletePlayerModal() {
    this.isDeletePlayerModalOpen.set(false);
  }

  deletePlayer(): void {
    // NIENTE PULIZIA SUPABASE QUI: Il giocatore va nel cestino dell'admin,
    // quindi la foto deve sopravvivere!
    this.profileService
      .deleteMyPlayer()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.myPlayer.set(null);
          this.loadProfile();
          toast.success('Alter-ego eliminato (spostato nel cestino)!');
          this.closeDeletePlayerModal();
        },
        error: () => toast.error("Errore durante l'eliminazione"),
      });
  }
  async removeImage() {
    const currentUrl = this.playerForm.get('profileImg')?.value;
    if (currentUrl && currentUrl.includes('supabase.co')) {
      await this.supabaseService.deleteImageByUrl(currentUrl);
    }
    this.imagePreview.set(null);
    this.playerForm.patchValue({ profileImg: '' });
  }

  // ===================== LOGOUT =====================
  logout(): void {
    this.authService.logout();
    this.appState.clearAllCache();
    this.router.navigate(['/login']);
  }

  get pf() {
    return this.passwordForm.controls;
  }
  get plf() {
    return this.playerForm.controls;
  }

  roleColor(role: string): string {
    const map: Record<string, string> = {
      PORTIERE: 'bg-yellow-100 text-yellow-800',
      DIFENSORE: 'bg-blue-100 text-blue-800',
      CENTROCAMPISTA: 'bg-green-100 text-green-800',
      ATTACCANTE: 'bg-red-100 text-red-800',
    };
    return map[role] ?? 'bg-gray-100 text-gray-700';
  }
}
