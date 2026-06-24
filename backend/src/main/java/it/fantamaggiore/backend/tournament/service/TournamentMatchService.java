package it.fantamaggiore.backend.tournament.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.PlayerService;
import it.fantamaggiore.backend.core.service.PlayerStatsService;
import it.fantamaggiore.backend.fantasy.service.VoteService;
import it.fantamaggiore.backend.tournament.dto.MatchResponseDTO;
import it.fantamaggiore.backend.tournament.mapper.MatchMapper;
import it.fantamaggiore.backend.tournament.model.Match;
import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import it.fantamaggiore.backend.tournament.model.enums.MatchStatus;
import it.fantamaggiore.backend.tournament.repository.MatchRepository;
import it.fantamaggiore.backend.tournament.repository.TournamentTeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import it.fantamaggiore.backend.fantasy.service.FormationService;
import it.fantamaggiore.backend.fantasy.model.Formation;
import org.springframework.cache.annotation.CacheEvict;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TournamentMatchService {

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private TournamentTeamRepository teamRepository;

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private FormationService formationService;

    @Autowired
    private VoteService voteService;

    @Autowired
    private MatchMapper matchMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    // --- METODO UNIFICATO PER TUTTI I WEBSOCKET DEL MATCH ---
    private void notifyAllMatchUpdates(Match match, String action) {

        // 1. Mappiamo il DTO QUI FUORI, mentre il Database è ancora "aperto"
        it.fantamaggiore.backend.tournament.dto.MatchResponseDTO matchDTO = matchMapper.toDTO(match);

        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("match", matchDTO);

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    // 2. Usiamo il DTO già convertito.
                    messagingTemplate.convertAndSend("/topic/matches", (Object) payload);
                    messagingTemplate.convertAndSend("/topic/live-score", matchDTO);
                    messagingTemplate.convertAndSend("/topic/match/" + match.getId(), matchDTO);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/matches", (Object) payload);
            messagingTemplate.convertAndSend("/topic/live-score", matchDTO);
            messagingTemplate.convertAndSend("/topic/match/" + match.getId(), matchDTO);
        }
    }

    @Transactional
    public Match createMatch(Long matchDayId, Long homeTeamId, Long awayTeamId) {
        MatchDay matchDay = matchDayService.getMatchDayById(matchDayId);
        TournamentTeam homeTeam = teamRepository.findById(homeTeamId)
                .orElseThrow(() -> new ResourceNotFoundException("Home team not found"));
        TournamentTeam awayTeam = teamRepository.findById(awayTeamId)
                .orElseThrow(() -> new ResourceNotFoundException("Away team not found"));

        Match match = new Match();
        match.setMatchDay(matchDay);
        match.setHomeTeam(homeTeam);
        match.setAwayTeam(awayTeam);
        match.setStatus(MatchStatus.PRE);

        Match savedMatch = matchRepository.save(match);
        notifyAllMatchUpdates(savedMatch, "SAVE");
        return savedMatch;
    }

    @Transactional
    public void deleteMatch(Long id) {
        Match match = findMatchById(id);
        if (match.getStatus() != MatchStatus.PRE) {
            throw new InvalidActionException("You cannot delete a match that has already started or finished.");
        }

        matchRepository.delete(match);
        notifyAllMatchUpdates(match, "DELETE");
    }

    @CacheEvict(value = "globalRanking", allEntries = true) // 🔥 Svuota cache
    @Transactional
    public Match startMatch(Long matchId, Integer duration) {
        try {
            Match match = findMatchById(matchId);
            if (match.getStatus() != MatchStatus.PRE) {
                throw new InvalidActionException("Match already started or finished.");
            }

            MatchDay matchDay = match.getMatchDay();
            if (matchDay.getStatus() == MatchDayStatus.OPEN) {
                matchDayService.openMatchDay(matchDay.getId());
            }

            // Assegna il voto 6.0 iniziale ai titolari in campo
            voteService.generateBaseVotesForMatchPlayers(match);

            // 🔥 RICALCOLA LE FORMAZIONI SUBITO (Così i +6.0 si sommano subito ai punti totali)
            List<Formation> formations = formationService.getFormationsByIdMatchDay(matchDay.getId());
            if (formations != null) {
                formations.forEach(f -> formationService.updateFormationScore(f.getId()));
            }

            match.setStatus(MatchStatus.LIVE);
            match.setStartTime(java.time.LocalDateTime.now());
            match.setExpectedDuration(duration);

            Match savedMatch = matchRepository.saveAndFlush(match);
            notifyAllMatchUpdates(savedMatch, "UPDATE");

            // 🔥 AVVISA I TELEFONI DI FARE L'ANIMAZIONE DI SORPASSO
            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
                    }
                });
            } else {
                messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
            }

            return savedMatch;

        } catch (Exception e) {
            System.err.println("🚨 ERRORE DURANTE START MATCH 🚨");
            e.printStackTrace();
            throw e;
        }
    }

    @Transactional
    public void endMatch(long idMatch) {
        Match match = findMatchById(idMatch);
        match.setStatus(MatchStatus.FINISHED);
        match.setEndTime(LocalDateTime.now());
        match.setActualDuration((int) Duration.between(match.getStartTime(), match.getEndTime()).toMinutes());
        matchRepository.save(match);

        match.getHomeTeam().getPlayers().forEach(player -> playerStatsService.updateAllPlayerStats(player.getId()));
        match.getAwayTeam().getPlayers().forEach(player -> playerStatsService.updateAllPlayerStats(player.getId()));

        if (match.getHomeGuestGoalkeeper() != null) {
            playerStatsService.updateAllPlayerStats(match.getHomeGuestGoalkeeper().getId());
        }
        if (match.getAwayGuestGoalkeeper() != null) {
            playerStatsService.updateAllPlayerStats(match.getAwayGuestGoalkeeper().getId());
        }

        updateStandings(idMatch);

        Match updatedMatch = findMatchById(idMatch);
        notifyAllMatchUpdates(updatedMatch, "UPDATE");
    }

    @Transactional
    public void updateStandings(long idMatch) {
        Match match = findMatchById(idMatch);
        if (match.getStatus().equals(MatchStatus.FINISHED) && !match.isStandingsUpdated()) {
            TournamentTeam homeTeam = match.getHomeTeam();
            TournamentTeam awayTeam = match.getAwayTeam();
            homeTeam.setGoalsScored(match.getHomeScore() + homeTeam.getGoalsScored());
            awayTeam.setGoalsScored(match.getAwayScore() + awayTeam.getGoalsScored());
            homeTeam.setGoalsConceded(match.getAwayScore() + homeTeam.getGoalsConceded());
            awayTeam.setGoalsConceded(match.getHomeScore() + awayTeam.getGoalsConceded());
            homeTeam.setGoalDifference(homeTeam.getGoalsScored() - homeTeam.getGoalsConceded());
            awayTeam.setGoalDifference(awayTeam.getGoalsScored() - awayTeam.getGoalsConceded());
            if (match.getHomeScore() > match.getAwayScore()) {
                homeTeam.setPoints(homeTeam.getPoints() + 3);
            } else if (match.getHomeScore() == match.getAwayScore()) {
                homeTeam.setPoints(homeTeam.getPoints() + 1);
                awayTeam.setPoints(awayTeam.getPoints() + 1);
            } else {
                awayTeam.setPoints(awayTeam.getPoints() + 3);
            }

            match.setStandingsUpdated(true);
            matchRepository.save(match);
            teamRepository.save(homeTeam);
            teamRepository.save(awayTeam);
        }
    }

    @Transactional
    public Match setGuestGoalkeepers(Long matchId, Long homeGuestId, Long awayGuestId) {
        Match match = findMatchById(matchId);
        if (match.getStatus() != MatchStatus.PRE) {
            throw new InvalidActionException("You cannot change goalkeepers once the match has started.");
        }

        match.setHomeGuestGoalkeeper(homeGuestId != null ? playerService.getPlayerById(homeGuestId) : null);
        match.setAwayGuestGoalkeeper(awayGuestId != null ? playerService.getPlayerById(awayGuestId) : null);

        Match savedMatch = matchRepository.save(match);
        notifyAllMatchUpdates(savedMatch, "UPDATE");
        return savedMatch;
    }

    @Transactional(readOnly = true)
    public Match findMatchById(long idMatch) {
        return matchRepository.findById(idMatch)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found with id: " + idMatch));
    }

    @Transactional(readOnly = true)
    public List<MatchResponseDTO> getMatchesByMatchDay(Long matchDayId) {
        return matchRepository.findAll().stream()
                .filter(m -> m.getMatchDay().getId().equals(matchDayId))
                .map(matchMapper::toDTO)
                .toList();
    }
}