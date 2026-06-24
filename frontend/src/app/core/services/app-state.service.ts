import { Injectable, signal } from '@angular/core';
import { PlayerResponse } from '../models/player.model';
import { MatchDayResponse } from '../../features/home/model/MatchDayResponse';

@Injectable({ providedIn: 'root' })
export class AppStateService {
  // --- CACHE GIOCATORI ---
  playersList = signal<any | null>(null);
  deletedPlayersList = signal<PlayerResponse[] | null>(null); // Per il cestino
  allPlayersList = signal<PlayerResponse[] | null>(null); // NUOVO: Per la lista completa

  clearPlayersCache() {
    this.playersList.set(null);
    this.deletedPlayersList.set(null);
    this.allPlayersList.set(null);
    this.formationPlayersCache.set(new Map());
  }

  // --- CACHE GIORNATE ---
  matchDaysList = signal<MatchDayResponse[] | null>(null); // NUOVO

  clearMatchDaysCache() {
    this.matchDaysList.set(null);
  }

  // --- CACHE UTENTI E FORMAZIONI (CALENDARIO) ---
  usersList = signal<any[] | null>(null);
  archivedFormations = signal<Map<string, any>>(new Map());

  clearUsersCache() {
    this.usersList.set(null);
  }

  clearArchivedFormationsCache() {
    this.archivedFormations.set(new Map());
  }

  // --- CACHE SPECIFICA FORMAZIONE (Mappata per MatchDay ID) ---
  formationPlayersCache = signal<Map<number, PlayerResponse[]>>(new Map());

  // --- NUOVE CACHE PER STORICO ---
  // Mappa dei voti: "matchDayId" -> VoteResponse[]
  archivedVotesCache = signal<Map<number, any[]>>(new Map());

  // Mappa dei match reali: "matchDayId" -> MatchResponse[]
  archivedMatchesCache = signal<Map<number, any[]>>(new Map());

  // Mappa dei dettagli match: "matchId" -> MatchFullDetail
  matchDetailsCache = signal<Map<number, any>>(new Map());

  archivedRankingsCache = signal<Map<number, any[]>>(new Map());
  archivedTeamsCache = signal<Map<number, any[]>>(new Map());

  // --- CACHE CLASSIFICA GLOBALE ---
  globalRankingCache = signal<any[] | null>(null);

  clearGlobalRankingCache() {
    this.globalRankingCache.set(null);
  }

  clearAllCache() {
    this.matchDaysList.set(null);
    this.usersList.set(null);
    this.archivedFormations.set(new Map());
    this.archivedVotesCache.set(new Map());
    this.archivedMatchesCache.set(new Map());
    this.matchDetailsCache.set(new Map());
    this.formationPlayersCache.set(new Map());
    this.archivedRankingsCache.set(new Map());
    this.archivedTeamsCache.set(new Map());
  }
}
