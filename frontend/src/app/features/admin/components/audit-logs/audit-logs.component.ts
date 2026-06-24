import { Component, inject, OnInit, signal, DestroyRef, OnDestroy } from '@angular/core'; // <-- Aggiunto OnDestroy
import { CommonModule } from '@angular/common';
import { AdminService } from '../../services/admin.service';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs'; // <-- Aggiunto Subscription
import { AuditLog } from '../../../../core/models/aduitLog.model';
import { WebSocketService } from '../../../../shared/services/web-socket-service'; // <-- ADATTA QUESTO PERCORSO SE SERVE
import { toast } from 'ngx-sonner'; // <-- Aggiunto per il banner

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './audit-logs.component.html',
})
export class AuditLogsComponent implements OnInit, OnDestroy {
  // <-- Implements OnDestroy
  private adminService = inject(AdminService);
  private destroyRef = inject(DestroyRef);
  private wsService = inject(WebSocketService); // <-- Iniettato

  private logSub?: Subscription; // Variabile per non far impazzire la memoria

  logs = signal<AuditLog[]>([]);
  isLoading = signal(true);

  currentPage = signal(0);
  totalPages = signal(0);
  totalElements = signal(0);

  searchTerm = signal('');
  searchSubject = new Subject<string>();

  ngOnInit() {
    this.loadLogs();

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe((val) => {
        this.searchTerm.set(val);
        this.currentPage.set(0);
        this.loadLogs();
      });

    // === INIZIO DELLA MAGIA: Ascolto in tempo reale ===
    this.logSub = this.wsService.watch('/topic/audit-logs').subscribe((msg: any) => {
      if (msg && msg.action === 'NEW_LOG') {
        // Avviso piccolo ed elegante
        toast.info('Nuova operazione registrata nel sistema.', {
          duration: 3000,
          style: { backgroundColor: '#3b82f6', color: '#fff', border: 'none' },
        });

        // Se c'è un nuovo log, ricarichiamo silenziosamente la pagina corrente!
        this.loadLogs();
      }
    });
  }

  loadLogs() {
    this.isLoading.set(true);
    this.adminService
      .getAuditLogs(this.currentPage(), 15, this.searchTerm())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          this.logs.set(page.content);
          this.totalPages.set(page.totalPages);
          this.totalElements.set(page.totalElements);
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false),
      });
  }

  getActionClass(action: string): string {
    if (action.includes('DELETE') || action.includes('BAN') || action.includes('ROLLBACK'))
      return 'bg-red-100 text-red-700';
    if (action.includes('CREATE')) return 'bg-emerald-100 text-emerald-700';
    if (action.includes('UPDATE') || action.includes('RESET')) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  }

  onSearch(event: any) {
    this.searchSubject.next(event.target.value);
  }
  nextPage() {
    if (this.currentPage() < this.totalPages() - 1) {
      this.currentPage.update((p) => p + 1);
      this.loadLogs();
    }
  }
  prevPage() {
    if (this.currentPage() > 0) {
      this.currentPage.update((p) => p - 1);
      this.loadLogs();
    }
  }

  // === PROTEZIONE DELLA MEMORIA ===
  ngOnDestroy() {
    if (this.logSub) {
      this.logSub.unsubscribe();
    }
  }
}
