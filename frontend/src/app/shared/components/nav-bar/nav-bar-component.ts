import { Component, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service';
import { filter } from 'rxjs';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './nav-bar.component.html',
})
export class NavbarComponent {
  public authService = inject(AuthService);
  private router = inject(Router);

  isMenuOpen = false;
  isSecondaryActive = false;

  private secondaryRoutes = ['/players', '/profile'];

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.isSecondaryActive = this.secondaryRoutes.some((r) => e.urlAfterRedirects.startsWith(r));
      this.isMenuOpen = false;
    });
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  // Chiude cliccando fuori dalla navbar
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const navbar = document.querySelector('nav');
    if (this.isMenuOpen && navbar && !navbar.contains(event.target as Node)) {
      this.isMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.isMenuOpen = false;
  }
}
