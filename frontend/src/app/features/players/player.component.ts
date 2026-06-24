import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { HeaderComponent } from '../../shared/components/header/header.component';
import { FantaModalComponent } from '../../shared/components/fanta-modal/fanta-modal.component';
import { PlayerService, PlayerResponse } from '../../features/players/service/player.service';
import { WebSocketService } from '../../shared/services/web-socket-service';

@Component({
  selector: 'app-players',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, HeaderComponent, FantaModalComponent],
  templateUrl: './player.component.html',
})
export class PlayersComponent implements OnInit {
  private playerService = inject(PlayerService);
  private wsService = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);

  private allPlayers = signal<PlayerResponse[]>([]);

  isLoading = signal(true);
  searchTerm = signal('');
  selectedRole = signal('TUTTI');
  currentPage = signal(0);
  readonly pageSize = 20;

  selectedPlayer = signal<PlayerResponse | null>(null);
  isModalOpen = signal(false);

  roles = [
    { key: 'TUTTI', label: 'Tutti', icon: 'users' },
    { key: 'PORTIERE', label: 'P', icon: 'hand' },
    { key: 'DIFENSORE', label: 'D', icon: 'shield' },
    { key: 'CENTROCAMPISTA', label: 'C', icon: 'activity' },
    { key: 'ATTACCANTE', label: 'A', icon: 'flame' },
  ];

  // Stessa logica dell'admin: filtra in RAM splittando le parole
  filteredPlayers = computed(() => {
    let list = this.allPlayers();

    const role = this.selectedRole();
    if (role !== 'TUTTI') {
      list = list.filter((p) => p.role === role);
    }

    const search = this.searchTerm().toLowerCase().trim();
    if (search) {
      const words = search.split(/\s+/);
      list = list.filter((p) => {
        const fullText = `${p.name} ${p.surname} ${p.nickname ?? ''}`.toLowerCase();
        return words.every((w) => fullText.includes(w));
      });
    }

    return list;
  });

  totalElements = computed(() => this.filteredPlayers().length);
  totalPages = computed(() => Math.ceil(this.totalElements() / this.pageSize) || 1);

  players = computed(() => {
    const start = this.currentPage() * this.pageSize;
    return this.filteredPlayers().slice(start, start + this.pageSize);
  });

  ngOnInit() {
    this.loadPlayers();
    this.setupWebSocket();
  }

  private loadPlayers() {
    this.isLoading.set(true);
    this.playerService
      .getAllPlayers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.allPlayers.set([...data].sort((a, b) => a.surname.localeCompare(b.surname)));
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  private setupWebSocket() {
    this.wsService.connect();
    this.wsService
      .watch('/topic/players')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((message: any) => {
        if (!message) return;

        if (message.action && message.player) {
          const updated: PlayerResponse = message.player;

          if (message.action === 'DELETE') {
            // Rimuovi dalla lista se non più attivo
            this.allPlayers.update((current) => current.filter((p) => p.id !== updated.id));
          } else {
            // SAVE o UPDATE: aggiorna/inserisci e riordina
            this.allPlayers.update((current) => {
              const filtered = current.filter((p) => p.id !== updated.id);
              // Solo i giocatori attivi nel listone utente
              if (updated.isActive !== false) filtered.push(updated);
              return filtered.sort((a, b) => a.surname.localeCompare(b.surname));
            });
          }

          // Aggiorna anche il modal se aperto su quel giocatore
          if (this.selectedPlayer()?.id === updated.id) {
            if (message.action === 'DELETE') {
              this.closeModal();
            } else {
              this.selectedPlayer.set(updated);
            }
          }
        } else {
          // Messaggio generico: ricarica tutto
          this.loadPlayers();
        }
      });
  }

  onSearchInput(value: string) {
    this.searchTerm.set(value);
    this.currentPage.set(0);
  }

  onRoleChange(role: string) {
    this.selectedRole.set(role);
    this.currentPage.set(0);
  }

  openModal(player: PlayerResponse) {
    this.selectedPlayer.set(player);
    this.isModalOpen.set(true);
  }

  closeModal() {
    this.isModalOpen.set(false);
    setTimeout(() => this.selectedPlayer.set(null), 300);
  }

  goToPage(page: number) {
    if (page >= 0 && page < this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  pages(): number[] {
    return Array.from({ length: this.totalPages() }, (_, i) => i);
  }

  getRoleConfig(role: string): { label: string; classes: string } {
    const map: Record<string, { label: string; classes: string }> = {
      PORTIERE: { label: 'P', classes: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      DIFENSORE: { label: 'D', classes: 'bg-blue-100 text-blue-800 border-blue-200' },
      CENTROCAMPISTA: { label: 'C', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
      ATTACCANTE: { label: 'A', classes: 'bg-red-100 text-red-800 border-red-200' },
    };
    return map[role] ?? { label: '?', classes: 'bg-gray-100 text-gray-600 border-gray-200' };
  }

  getRoleFullLabel(role: string): string {
    const map: Record<string, string> = {
      PORTIERE: 'Portiere',
      DIFENSORE: 'Difensore',
      CENTROCAMPISTA: 'Centrocampista',
      ATTACCANTE: 'Attaccante',
    };
    return map[role] ?? role;
  }

  getVoteColor(avg: number): string {
    if (avg === 0) return 'text-gray-400';
    if (avg >= 7) return 'text-emerald-600';
    if (avg >= 6) return 'text-gray-800';
    return 'text-red-500';
  }
}
