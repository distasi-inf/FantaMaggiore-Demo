import {
  HttpInterceptorFn,
  HttpErrorResponse,
  HttpRequest,
  HttpHandlerFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { Router } from '@angular/router';
import { toast } from 'ngx-sonner';
import {
  catchError,
  switchMap,
  throwError,
  BehaviorSubject,
  filter,
  take,
  retry,
  timer,
} from 'rxjs';

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  const isAuthRequest =
    req.url.includes('/login') ||
    req.url.includes('/register') ||
    req.url.includes('/refresh') ||
    req.url.includes('/check-');

  let authReq = req;
  if (token && !isAuthRequest) {
    authReq = req.clone({
      setHeaders: { Authorization: `Bearer ${token}` },
    });
  }

  return next(authReq).pipe(
    catchError((error: HttpErrorResponse) => {
      // === 1. CONTROLLO KICK ISTANTANEO (BAN) ===
      if (error.status === 401 && !isAuthRequest) {
        const backendMessage =
          error.error?.message || (typeof error.error === 'string' ? error.error : '');

        // Se il backend ci dice che siamo bloccati, niente refresh: ti butto fuori subito!
        if (
          backendMessage.toLowerCase().includes('bloccato') ||
          backendMessage.toLowerCase().includes('sospeso')
        ) {
          authService.logout();
          router.navigate(['/login']);
          toast.error(backendMessage, { duration: 5000 });
          return throwError(() => error);
        }
        // ==========================================

        if (!isRefreshing) {
          const refreshTokenStr = localStorage.getItem('refresh_token');

          // 🔥 FIX: Controllo di sicurezza rigoroso per evitare finti token "null"
          if (refreshTokenStr && refreshTokenStr !== 'null' && refreshTokenStr !== 'undefined') {
            isRefreshing = true;
            refreshTokenSubject.next(null);

            return authService.refreshToken().pipe(
              retry({
                count: 3,
                delay: (err, retryCount) => {
                  if (err.status === 0 || err.status >= 500) {
                    console.warn(
                      `[Cold Start] Backend dorme. Tentativo ${retryCount}/3 tra 4 secondi...`,
                    );
                    return timer(4000);
                  }
                  return throwError(() => err);
                },
              }),
              catchError((refreshError) => {
                isRefreshing = false;
                authService.logout();

                if (!router.url.includes('/login') && !router.url.includes('/register')) {
                  router.navigate(['/login']);
                }

                // === 2. CONTROLLO BAN DURANTE IL REFRESH ===
                const refreshMsg = refreshError.error?.message || '';
                if (refreshMsg.toLowerCase().includes('bloccato')) {
                  toast.error(refreshMsg, { duration: 5000 });
                }

                // 🔥 TOAST "SESSIONE SCADUTA" RIMOSSO DEFINITIVAMENTE!
                // Il redirect silenzioso al login è l'esperienza utente migliore.

                return throwError(() => refreshError);
              }),
              switchMap((response) => {
                isRefreshing = false;
                refreshTokenSubject.next(response.accessToken);

                const retriedReq = req.clone({
                  setHeaders: { Authorization: `Bearer ${response.accessToken}` },
                });
                return next(retriedReq);
              }),
            );
          } else {
            // 🔥 SILENT LOGOUT PURO: Utente nuovo o sloggato. Niente errori.
            authService.logout();
            if (!router.url.includes('/login') && !router.url.includes('/register')) {
              router.navigate(['/login']);
            }
            return throwError(() => error);
          }
        } else {
          // Accoda le richieste in attesa del nuovo token
          return refreshTokenSubject.pipe(
            filter((newToken) => newToken !== null),
            take(1),
            switchMap((newToken) => {
              const retriedReq = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
              });
              return next(retriedReq);
            }),
          );
        }
      }

      return throwError(() => error);
    }),
  );
};
