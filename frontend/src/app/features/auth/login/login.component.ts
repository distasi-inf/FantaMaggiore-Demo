import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';
import { toast } from 'ngx-sonner';
import { FantaToastComponent } from '../../../shared/components/fanta-toast/fanta-toast.component';
import { LucideAngularModule } from 'lucide-angular'; // AGGIUNTO: Importa il modulo icone
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true, // AGGIUNTO: Assicurati che sia standalone
  imports: [CommonModule, ReactiveFormsModule, LucideAngularModule, RouterLink], // AGGIUNTO: LucideAngularModule e RouterLink
  templateUrl: './login.component.html',
  styleUrl: './login.scss',
})
export class Login implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  // AGGIUNTO: Variabile per gestire la visibilità della password
  hidePassword = true;

  loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  // AGGIUNTO: Controllo all'avvio del componente
  ngOnInit() {
    if (this.authService.isLoggedIn()) {
      // Se l'utente è già loggato e finisce qui, lo riportiamo alla home
      this.router.navigate(['/home']);
    }
  }

  // AGGIUNTO: Metodo per alternare la visibilità
  togglePassword() {
    this.hidePassword = !this.hidePassword;
  }

  onSubmit() {
    if (this.loginForm.valid) {
      this.authService.login(this.loginForm.value).subscribe({
        next: (response) => {
          toast.custom(FantaToastComponent, {
            componentProps: {
              title: 'Bentornato Presidente!',
              message: 'Pronto per la prossima giornata?',
              iconName: 'trophy',
            },
          });

          setTimeout(() => {
            this.router.navigate(['/home']);
          }, 1000);
        },
        error: (err) => {
          console.error('Errore dal backend:', err);

          // === LA MAGIA È QUI ===
          // Estraiamo il messaggio mandato dal backend, se c'è. Altrimenti errore standard.
          const errorMessage =
            err.error?.message ||
            (err.status === 401 ? 'Email o Password errate!' : 'Errore di connessione al server');

          toast.error(errorMessage, {
            style: {
              backgroundColor: '#dc2626',
              color: '#fff',
              border: 'none',
            },
          });
        },
      });
    } else {
      this.loginForm.markAllAsTouched();
    }
  }
}
