import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const guestGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Se l'utente è GIÀ loggato, non ha senso che stia sulla pagina di Login o Registrazione
  if (authService.isLoggedIn()) {
    router.navigate(['/home']);
    return false;
  }

  // Se NON è loggato, lo lasciamo passare per fare il login
  return true;
};
