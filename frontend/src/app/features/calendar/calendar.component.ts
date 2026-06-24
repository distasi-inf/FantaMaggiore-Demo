import { Component, inject, OnInit, signal, DestroyRef, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CalendarService } from './service/calendar.service';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { AppStateService } from '../../core/services/app-state.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterLink, HeaderComponent],
  templateUrl: './calendar.component.html',
})
export class CalendarComponent implements OnInit {
  private calendarService = inject(CalendarService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService);
  private appState = inject(AppStateService);

  matchDays = signal<any[]>([]);
  isLoading = signal(true);

  // 🔥 NUOVO: Signal per la ricerca
  searchTerm = signal<string>('');

  // Statistiche
  liveMatchdays = computed(() => this.matchDays().filter((m) => m.status === 'LIVE').length);
  calculatedMatchdays = computed(
    () => this.matchDays().filter((m) => m.status === 'CALCULATED').length,
  );

  // 🔥 COMPUTED: Filtra per ricerca e ordina in modo intelligente
  filteredMatchDays = computed(() => {
    const search = this.searchTerm().toLowerCase().trim();
    let list = [...this.matchDays()];

    // 1. Filtro testuale
    if (search) {
      list = list.filter((md) => md.description.toLowerCase().includes(search));
    }

    // 2. Smart Sorting
    return list.sort((a, b) => {
      // LIVE sempre per primo
      if (a.status === 'LIVE' && b.status !== 'LIVE') return -1;
      if (b.status === 'LIVE' && a.status !== 'LIVE') return 1;

      // OPEN: ordine cronologico (quella che arriva prima sta sopra)
      if (a.status === 'OPEN' && b.status === 'OPEN') {
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      }

      // CALCULATED: ordine inverso (l'ultima finita sta sopra)
      if (a.status === 'CALCULATED' && b.status === 'CALCULATED') {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      }

      // Tra OPEN e CALCULATED, vince OPEN
      if (a.status === 'OPEN' && b.status === 'CALCULATED') return -1;
      if (a.status === 'CALCULATED' && b.status === 'OPEN') return 1;

      return 0;
    });
  });

  // Isola il Live (se presente nella ricerca) per la grafica speciale
  activeLiveMatchDay = computed(() => this.filteredMatchDays().find((m) => m.status === 'LIVE'));

  // Tutte le altre giornate filtrate
  otherMatchDays = computed(() => {
    const live = this.activeLiveMatchDay();
    return this.filteredMatchDays().filter((m) => m !== live);
  });

  ngOnInit() {
    this.loadAllMatchDays();
    this.setupWebSockets();
    this.wsService.connect();
  }

  private setupWebSockets() {
    this.wsService
      .watch('/topic/matchdays')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (msg && (msg.action === 'SAVE' || msg.action === 'DELETE' || msg.action === 'UPDATE')) {
          this.appState.clearMatchDaysCache();
          this.loadAllMatchDays();
        }
      });
  }

  loadAllMatchDays() {
    this.isLoading.set(true);
    this.calendarService
      .getAllMatchdays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.matchDays.set(data);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('it-IT', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  }
}
