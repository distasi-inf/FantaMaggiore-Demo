import { Component, DestroyRef, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { Router, RouterModule } from '@angular/router';
import { AdminService } from '../services/admin.service';
import { AuthService } from '../../../core/services/auth.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HeaderComponent } from '../../../shared/components/header/header.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, RouterModule, HeaderComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin-dashboard.component.scss',
})
export class AdminDashboardComponent implements OnInit {
  public router = inject(Router);
  private adminService = inject(AdminService);
  private authService = inject(AuthService);
  private destroyRef = inject(DestroyRef);

  selectedMatchDayId = signal<number | null>(null);
  loggedUserRole = signal<string | null>(null);

  menuItems = [
    { id: 'users', label: 'Iscritti', icon: 'book-user' },
    { id: 'days', label: 'Giornate', icon: 'calendar' },
    { id: 'players', label: 'Listone', icon: 'users' },
    { id: 'real-matches', label: 'Real Match', icon: 'swords' },
    { id: 'live-matches', label: 'Live Panel', icon: 'tv' },
  ];

  // --- LOGICA DI SICUREZZA PER I LOG ---
  amISuperAdmin = computed(() => {
    const role = this.loggedUserRole();
    return role === 'SUPER_ADMIN' || role === 'ROLE_SUPER_ADMIN';
  });

  ngOnInit() {
    this.extractUserRole();
    this.loadActiveMatchDay();
  }

  private extractUserRole() {
    const token = this.authService.getToken();
    if (!token) return;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      this.loggedUserRole.set(payload.role || payload.authorities?.[0]?.authority || 'USER');
    } catch (e) {
      console.error('Errore decodifica ruolo admin');
    }
  }

  private loadActiveMatchDay() {
    this.adminService
      .getAllMatchDays()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((days) => {
        const activeDay =
          days.find((d) => d.status === 'LIVE') || days.find((d) => d.status === 'OPEN');
        if (activeDay) {
          this.selectedMatchDayId.set(activeDay.id);
        }
      });
  }

  getPageTitle(): string {
    const url = this.router.url;
    if (url.includes('users')) return 'Iscritti';
    if (url.includes('days')) return 'Giornate';
    if (url.includes('players')) return 'Listone';
    if (url.includes('real-matches')) return 'Real Match';
    if (url.includes('live-matches')) return 'Live Panel';
    if (url.includes('audit-logs')) return 'Audit Logs';
    return 'Dashboard';
  }

  getPageIcon(): string {
    const url = this.router.url;
    if (url.includes('users')) return 'book-user';
    if (url.includes('days')) return 'calendar';
    if (url.includes('players')) return 'users';
    if (url.includes('real-matches')) return 'swords';
    if (url.includes('live-matches')) return 'tv';
    if (url.includes('audit-logs')) return 'clipboard-list';
    return 'layout-dashboard'; // Icona di default
  }

  openLogs() {
    this.router.navigate(['/admin/audit-logs']);
  }

  goToUserApp() {
    this.router.navigate(['/home']);
  }
}
