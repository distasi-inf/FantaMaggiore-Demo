import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isLoggedIn()) {
    return true;
  }

  // 🔥 FIX: Reindirizzamento silenzioso. Niente più toast d'errore fastidiosi per i nuovi utenti!
  router.navigate(['/login'], {
    queryParams: { returnUrl: state.url },
  });
  return false;
};
