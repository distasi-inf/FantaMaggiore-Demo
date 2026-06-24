import { Component, inject, OnInit, signal, computed, DestroyRef } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TournamentService } from '../admin/services/tournament.service';
import { AdminService } from '../admin/services/admin.service';
import { WebSocketService } from '../../shared/services/web-socket-service';
import { MatchResponse } from '../admin/model/MatchResponse';
import { PlayerResponse } from '../../core/models/player.model';
import { TournamentRanking } from '../../core/models/tournament-ranking.model';

import { toast } from 'ngx-sonner'; // Aggiungi questo import
import { AuthService } from '../../core/services/auth.service';
import { HeaderComponent } from '../../shared/components/header/header.component';

export interface MatchEventResponse {
  id: number;
  type: 'GOAL' | 'ASSIST' | 'OWNGOAL';
  matchId: number;
  playerId: number;
  playerName?: string;
  value: number;
  assistPlayerId?: number | null;
  assistPlayerName?: string | null;
}

interface TeamPlayer extends PlayerResponse {
  side: 'home' | 'away';
}

@Component({
  selector: 'app-match-viewer',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, HeaderComponent],
  templateUrl: './match-viewer.html',
})
export class MatchViewerComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tournamentService = inject(TournamentService);
  private adminService = inject(AdminService);
  private wsService = inject(WebSocketService);
  private destroyRef = inject(DestroyRef);
  public location = inject(Location);
  private router = inject(Router);
  public authService = inject(AuthService);

  matchId = signal<number | null>(null);
  match = signal<MatchResponse | null>(null);
  matchEvents = signal<MatchEventResponse[]>([]);
  allPlayers = signal<PlayerResponse[]>([]);
  teams = signal<any[]>([]);
  ranking = signal<TournamentRanking[]>([]);

  isLoading = signal(true);

  matchStatus = signal<string>('FINISHED');

  matchPlayers = computed<TeamPlayer[]>(() => {
    const m = this.match();
    const tms = this.teams();
    const pls = this.allPlayers();
    if (!m || !tms.length || !pls.length) return [];

    const homeTeam = tms.find((t) => t.id === m.homeTeamId);
    const awayTeam = tms.find((t) => t.id === m.awayTeamId);

    const homePlayers: TeamPlayer[] = (homeTeam?.playerIds || [])
      .map((id: number) => pls.find((p) => p.id === id))
      .filter(Boolean)
      .map((p: any) => ({ ...p, side: 'home' as const }));

    const awayPlayers: TeamPlayer[] = (awayTeam?.playerIds || [])
      .map((id: number) => pls.find((p) => p.id === id))
      .filter(Boolean)
      .map((p: any) => ({ ...p, side: 'away' as const }));

    if (m.homeGuestGoalkeeperId) {
      const p = pls.find((p) => p.id === m.homeGuestGoalkeeperId);
      if (p) homePlayers.push({ ...p, side: 'home' as const, role: 'PORTIERE' });
    }
    if (m.awayGuestGoalkeeperId) {
      const p = pls.find((p) => p.id === m.awayGuestGoalkeeperId);
      if (p) awayPlayers.push({ ...p, side: 'away' as const, role: 'PORTIERE' });
    }

    return [...homePlayers, ...awayPlayers];
  });

  groupedMatchEvents = computed<MatchEventResponse[]>(() => {
    return [...(this.matchEvents() || [])].sort((a, b) => b.id - a.id);
  });

  homeMatchEvents = computed(() => {
    return this.groupedMatchEvents().filter((ev) => {
      const player = this.matchPlayers().find((p) => p.id === ev.playerId);
      if (!player) return false;
      return ev.type === 'OWNGOAL' ? player.side === 'away' : player.side === 'home';
    });
  });

  awayMatchEvents = computed(() => {
    return this.groupedMatchEvents().filter((ev) => {
      const player = this.matchPlayers().find((p) => p.id === ev.playerId);
      if (!player) return false;
      return ev.type === 'OWNGOAL' ? player.side === 'home' : player.side === 'away';
    });
  });

  ngOnInit() {
    this.wsService.connect();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      const matchDayId = window.history.state?.matchDayId;
      const status = window.history.state?.status; // 🔥 Leggiamo lo status

      if (id && matchDayId) {
        this.matchId.set(id);
        if (status) this.matchStatus.set(status);
        this.loadInitialData(id, matchDayId);
        this.setupLiveUpdates(id, matchDayId);
      } else {
        // 🔥 FIX PUNTO 6: Manca il matchDayId (es. refresh forzato della pagina)
        toast.info('Sessione scaduta, ritorno alla home.');
        this.router.navigate(['/home']);
      }
    });
  }

  loadInitialData(matchId: number, matchDayId: number) {
    this.adminService.getAllPlayersIncludingDeleted().subscribe((players) => {
      this.allPlayers.set(players);
      // 🔥 Passiamo lo status
      this.tournamentService.getTeamsByMatchDay(matchDayId, this.matchStatus()).subscribe((tms) => {
        this.teams.set(tms);
        // 🔥 Passiamo lo status
        this.tournamentService
          .getMatchByMatchdayId(matchDayId, this.matchStatus())
          .subscribe((matches) => {
            const currentMatch = matches.find((m) => m.id === matchId);
            if (currentMatch) {
              this.match.set(currentMatch);
              this.loadEvents(matchId);
              this.loadRanking(matchDayId);
              this.isLoading.set(false);
            }
          });
      });
    });
  }

  getMatchStats(playerId: number) {
    let goals = 0;
    let assists = 0;
    let ownGoals = 0;

    this.matchEvents().forEach((ev) => {
      if (ev.type === 'GOAL' && ev.playerId === playerId) goals++;
      if (ev.type === 'GOAL' && ev.assistPlayerId === playerId) assists++;
      if (ev.type === 'OWNGOAL' && ev.playerId === playerId) ownGoals++;
    });

    return { goals, assists, ownGoals };
  }

  getArray(n: number): number[] {
    return Array(n || 0).fill(0);
  }

  loadEvents(matchId: number) {
    // 🔥 Passiamo lo status per attivare la cache se serve!
    this.tournamentService.getMatchEvents(matchId, this.matchStatus()).subscribe((events) => {
      this.matchEvents.set(events as MatchEventResponse[]);
    });
  }

  loadRanking(matchDayId: number) {
    // 🔥 Passiamo lo status
    this.tournamentService
      .getTournamentRankingByMatchDay(matchDayId, this.matchStatus())
      .subscribe((rank) => {
        this.ranking.set(rank);
      });
  }

  setupLiveUpdates(matchId: number, matchDayId: number) {
    // 1. Ascoltatore SPECIFICO per QUESTO match (es. gol, assist, cartellini)
    this.wsService
      .watch(`/topic/match/${matchId}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: any) => {
        if (payload) {
          // Il backend potrebbe mandare l'oggetto match diretto o wrappato
          const updatedMatch = payload.match ? payload.match : payload;

          if (updatedMatch && updatedMatch.id === matchId) {
            this.match.set(updatedMatch);
            // 🔥 FONDAMENTALE: aggiorniamo lo status in tempo reale
            this.matchStatus.set(updatedMatch.status || updatedMatch.matchStatus);
            this.loadEvents(matchId);
            this.loadRanking(matchDayId);
          }
        }
      });

    // 2. Ascoltatore GLOBALE per TUTTI i match (es. fischio d'inizio, reload forzati)
    this.wsService
      .watch('/topic/matches')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((msg: any) => {
        if (msg) {
          // Se l'admin avvia/termina la NOSTRA partita o fa un reload globale:
          if (msg.action === 'RELOAD' || (msg.action === 'UPDATE' && msg.match?.id === matchId)) {
            console.log('🏁 Stato della partita cambiato (Iniziata/Finita)! Ricarico i dati...');

            // Forza lo stato a LIVE per bypassare la cache in caso di ritardi
            const newStatus = msg.match?.status || msg.match?.matchStatus || 'LIVE';
            this.matchStatus.set(newStatus);

            // Rifacciamo la chiamata (la cache non scatterà perché non è 'CALCULATED')
            this.tournamentService
              .getMatchByMatchdayId(matchDayId, newStatus)
              .subscribe((matches) => {
                const currentMatch = matches.find((m) => m.id === matchId);
                if (currentMatch) {
                  this.match.set(currentMatch);
                  this.matchStatus.set(currentMatch.matchStatus);
                }
              });
          }
          // Se l'admin aggiorna un'ALTRA partita, ricalcoliamo solo la classifica
          else if (msg.action === 'UPDATE' && msg.match?.id !== matchId) {
            this.loadRanking(matchDayId);
          }
        }
      });
  }

  getPlayerName(playerId: number | null): string {
    if (!playerId) return '—';
    const p = this.allPlayers().find((pl) => pl.id === playerId);
    return p ? `${p.name} ${p.surname}` : '—';
  }
}
