import { Injectable } from '@angular/core';
import { AuthService } from './auth.service';

export interface JwtPayload {
  id: number;
  sub: string;
  role?: string;
  authorities?: string[];
  exp?: number;
}

/**
 * FIX: Centralizza il parsing del JWT eliminando la logica duplicata
 * che era ripetuta in AuthService, FormationComponent, RankingComponent e BetsComponent.
 */
@Injectable({ providedIn: 'root' })
export class JwtHelperService {
  constructor(private authService: AuthService) {}

  getPayload(): JwtPayload | null {
    const token = this.authService.getToken();
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      return JSON.parse(atob(parts[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  getCurrentUserId(): number | null {
    return this.getPayload()?.id ?? null;
  }

  isAdmin(): boolean {
    const payload = this.getPayload();
    if (!payload) return false;
    const role = payload.role ?? payload.authorities?.[0] ?? '';
    return ['ADMIN', 'ROLE_ADMIN', 'SUPER_ADMIN', 'ROLE_SUPER_ADMIN'].includes(role);
  }

  isSuperAdmin(): boolean {
    const payload = this.getPayload();
    if (!payload) return false;
    const role = payload.role ?? payload.authorities?.[0] ?? '';
    return ['SUPER_ADMIN', 'ROLE_SUPER_ADMIN'].includes(role);
  }
}
