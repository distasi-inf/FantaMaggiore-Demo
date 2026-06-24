import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthService } from '../../../core/services/auth.service'; // Verifica il percorso

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideAngularModule],
  templateUrl: './header.component.html',
})
export class HeaderComponent {
  public authService = inject(AuthService);

  @Input() title: string = '';
  @Input() subtitle: string = '';
  @Input() iconName: string = 'circle'; // Icona di default
  @Input() showAdminButton: boolean = true; // Possiamo nasconderlo se serve
}