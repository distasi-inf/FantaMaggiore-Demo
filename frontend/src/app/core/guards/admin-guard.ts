import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service'; // Controlla che il percorso sia giusto
import { toast } from 'ngx-sonner';

export const adminGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Se non loggato
  if (!authService.isLoggedIn()) {
    toast.error('Accesso negato - Devi effettuare il login');
    router.navigate(['/login']);
    return false;
  }

  // Se loggato ma non admin
  if (!authService.isAdmin()) {
    toast.error('Accesso negato - Non sei un amministratore');
    router.navigate(['/home']);
    return false;
  }

  return true;
};