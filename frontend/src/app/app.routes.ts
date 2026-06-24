import { Routes } from '@angular/router';
import { Login } from './features/auth/login/login.component';
import { Register } from './features/auth/register/register.component';
import { Home } from './features/home/home.component';
import { AdminDashboardComponent } from './features/admin/admin-dashboard/admin-dashboard.component';
import { adminGuard } from './core/guards/admin-guard';
import { authGuard } from './core/guards/auth.guard';

import { ManageDaysComponent } from './features/admin/components/manage-match-day/manage-match-days.component';
import { ManagePlayersComponent } from './features/admin/components/manage-players/manage-players.component';
import { ManageUsersComponent } from './features/admin/components/manage-users/manage-users.component';
import { ManageRealMatchComponent } from './features/admin/components/manage-real-match/manage-real-match.component';
import { LiveMatchesComponent } from './features/admin/components/live-matches/live-matches.component';
import { guestGuard } from './core/guards/guest-guard';
import { FormationComponent } from './features/formations/formation.component';
import { AuditLogsComponent } from './features/admin/components/audit-logs/audit-logs.component';
import { MatchViewerComponent } from './features/match-viewer/match-viewer';
import { CalendarComponent } from './features/calendar/calendar.component';
import { MatchdayDetailComponent } from './features/calendar/match-detail/match-detail.component';
import { BetsComponent } from './features/bets/bets.component';
import { ProfileComponent } from './features/profile/profile.component';
import { PlayersComponent } from './features/players/player.component';

export const routes: Routes = [
  { path: 'login', component: Login, canActivate: [guestGuard] },
  { path: 'registration', component: Register, canActivate: [guestGuard] },
  { path: 'home', component: Home, canActivate: [authGuard] },
  {
    path: 'admin',
    component: AdminDashboardComponent,
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'days', pathMatch: 'full' }, // Redirect di default
      { path: 'days', component: ManageDaysComponent },
      { path: 'players', component: ManagePlayersComponent },
      { path: 'users', component: ManageUsersComponent },
      { path: 'real-matches', component: ManageRealMatchComponent },
      { path: 'live-matches', component: LiveMatchesComponent },
      { path: 'audit-logs', component: AuditLogsComponent },
    ],
  },
  {
    path: 'formations',
    component: FormationComponent,
    canActivate: [authGuard],
  },
  { path: 'profile', component: ProfileComponent, canActivate: [authGuard] },
  { path: 'players', component: PlayersComponent, canActivate: [authGuard] },
  { path: 'match/:id', component: MatchViewerComponent, canActivate: [authGuard] },
  { path: 'calendar', component: CalendarComponent, canActivate: [authGuard] },
  { path: 'calendar/matchday/:id', component: MatchdayDetailComponent, canActivate: [authGuard] },
  {
    // FIX: aggiunto canActivate authGuard — utenti non loggati non possono accedere alla classifica
    path: 'ranking',
    loadComponent: () =>
      import('./features/ranking/ranking.component').then((m) => m.RankingComponent),
    canActivate: [authGuard],
  },
  {
    path: 'bets',
    component: BetsComponent,
    canActivate: [authGuard],
  },
  { path: '', redirectTo: 'home', pathMatch: 'full' },
  { path: '**', redirectTo: 'home' },
];
