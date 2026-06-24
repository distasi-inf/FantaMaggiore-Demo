package it.fantamaggiore.backend.core.service;

import it.fantamaggiore.backend.core.audit.service.AuditLogService;
import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.mapper.MatchDayMapper;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import it.fantamaggiore.backend.core.repository.MatchDayRepository;
import it.fantamaggiore.backend.fantasy.model.Formation;
import it.fantamaggiore.backend.fantasy.repository.BetRepository;
import it.fantamaggiore.backend.fantasy.repository.FantasyMatchRepository;
import it.fantamaggiore.backend.fantasy.repository.FormationRepository;
import it.fantamaggiore.backend.fantasy.service.FantasyMatchService;
import it.fantamaggiore.backend.fantasy.service.FormationService;
import it.fantamaggiore.backend.fantasy.service.VoteService;
import it.fantamaggiore.backend.tournament.model.enums.MatchStatus;
import it.fantamaggiore.backend.tournament.repository.MatchRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import it.fantamaggiore.backend.tournament.model.Match;
import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import it.fantamaggiore.backend.tournament.repository.TournamentTeamRepository;
import it.fantamaggiore.backend.fantasy.service.RankingService;
import it.fantamaggiore.backend.fantasy.dto.RankingDTO;
import it.fantamaggiore.backend.core.repository.UserRepository;
import org.springframework.cache.annotation.CacheEvict;

import java.util.*;

@Service
public class MatchDayService {

    @Autowired private MatchDayRepository matchDayRepository;
    @Autowired private VoteService voteService;
    @Autowired private FormationService formationService;
    @Autowired private PlayerService playerService;
    @Autowired private BetRepository betRepository;
    @Autowired private FantasyMatchRepository fantasyMatchRepository;
    @Autowired @Lazy private FantasyMatchService fantasyMatchService;
    @Autowired private FormationRepository formationRepository;
    @Autowired private RankingService rankingService;
    @Autowired private UserRepository userRepository;
    @Autowired private MatchRepository matchRepository;
    @Autowired private TournamentTeamRepository teamRepository;
    @Autowired private SimpMessagingTemplate messagingTemplate;
    @Autowired private AuditLogService auditLogService;
    @Autowired private MatchDayMapper matchDayMapper;

    private void notifyMatchDayUpdate(MatchDay matchDay, String action) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("matchDay", matchDayMapper.toDTO(matchDay));

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/matchdays", (Object) payload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/matchdays", (Object) payload);
        }
    }

    @CacheEvict(value = "globalRanking", allEntries = true)
    @Transactional
    public void openMatchDay(Long idMatchDay) {
        MatchDay matchDay = getMatchDayById(idMatchDay);
        copyPreviousFormations(matchDay);
        matchDay.setStatus(MatchDayStatus.LIVE);
        MatchDay saved = matchDayRepository.save(matchDay);
        notifyMatchDayUpdate(saved, "UPDATE");

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

        auditLogService.logAction("OPEN_MATCHDAY", "MatchDay", idMatchDay, "Giornata aperta");
    }

    private void copyPreviousFormations(MatchDay currentMatchDay) {
        java.util.Optional<MatchDay> prevMatchDayOpt = matchDayRepository
                .findFirstByDateLessThanAndActiveTrueOrderByDateDesc(currentMatchDay.getDate());

        if (prevMatchDayOpt.isEmpty()) return;

        MatchDay prevMatchDay = prevMatchDayOpt.get();
        List<Formation> prevFormations = formationService.getFormationsByIdMatchDay(prevMatchDay.getId());
        List<Formation> currentFormations = formationService.getFormationsByIdMatchDay(currentMatchDay.getId());

        List<Long> usersWithCurrentFormation = currentFormations.stream()
                .map(f -> f.getUser().getId())
                .toList();

        List<Player> availableNow = currentMatchDay.getAvailablePlayers();

        for (Formation prevF : prevFormations) {
            // 🔥 FIX: Se l'utente è bannato/bloccato, saltiamo la copia! Niente formazioni zombie.
            if (prevF.getUser().isLocked()) {
                continue;
            }

            if (!usersWithCurrentFormation.contains(prevF.getUser().getId())) {
                try {
                    List<Player> validStarters = prevF.getStarters().stream()
                            .filter(availableNow::contains)
                            .toList();

                    Player validSub = prevF.getSubstitutePlayer();
                    if (validSub != null && !availableNow.contains(validSub)) {
                        validSub = null;
                    }

                    if (validStarters.isEmpty() && validSub == null) continue;

                    Formation fallbackFormation = new Formation(
                            prevF.getUser(),
                            currentMatchDay,
                            new java.util.ArrayList<>(validStarters),
                            validSub,
                            true
                    );

                    formationRepository.saveAndFlush(fallbackFormation);
                } catch (Exception e) {
                    System.out.println("Impossibile copiare formazione per utente: " + e.getMessage());
                }
            }
        }
    }

    @Transactional
    public void calculateMatchDayResults(Long idFormation) {
        formationService.updateFormationScore(idFormation);
    }

    @CacheEvict(value = "globalRanking", allEntries = true)
    @Transactional
    public void calculateAllLineups(Long idMatchDay) {
        MatchDay matchDay = matchDayRepository.findByIdAndActiveTrue(idMatchDay)
                .orElseThrow(() -> new ResourceNotFoundException("Match day not found"));

        boolean allMatchesFinished = matchRepository.findAll().stream()
                .filter(m -> m.getMatchDay().getId().equals(idMatchDay))
                .allMatch(m -> m.getStatus() == MatchStatus.FINISHED);

        if (!allMatchesFinished) {
            throw new InvalidActionException("Non puoi calcolare i risultati: ci sono partite in corso!");
        }

        List<Formation> allFormations = formationService.getFormationsByIdMatchDay(idMatchDay);
        allFormations.forEach(f -> formationService.updateFormationScore(f.getId()));
        fantasyMatchService.updateResultsForMatchDay(idMatchDay);

        List<RankingDTO> finalRanking = rankingService.getGlobalRanking();
        List<User> allUsers = userRepository.findAll();

        for (int i = 0; i < finalRanking.size(); i++) {
            Long userId = finalRanking.get(i).getUserId();
            int currentPos = i + 1;
            allUsers.stream().filter(u -> u.getId().equals(userId)).findFirst().ifPresent(u -> {
                u.setPreviousPosition(currentPos);
            });
        }
        userRepository.saveAll(allUsers);

        matchDay.setStatus(MatchDayStatus.CALCULATED);
        MatchDay saved = matchDayRepository.save(matchDay);
        notifyMatchDayUpdate(saved, "UPDATE");

        // 🔥 FIX CRITICO WEBSOCKET: Quando chiudi la giornata, diciamo a tutte le app di ricaricare i dati di scommesse e classifiche!
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

        auditLogService.logAction("CALC_RESULTS", "MatchDay", idMatchDay, "Calcolo risultati effettuato.");
    }

    @Transactional
    public MatchDay createMatchDay(MatchDay matchDay, List<Long> playerIds) {
        if (matchDay.getDate().isBefore(java.time.LocalDateTime.now())) {
            throw new InvalidActionException("The start date of the day cannot be in the past.");
        }
        if (matchDay.getDeadline().isBefore(java.time.LocalDateTime.now())) {
            throw new InvalidActionException("The deadline for training cannot be in the past.");
        }
        if (matchDay.getDeadline().isAfter(matchDay.getDate()) || matchDay.getDeadline().isEqual(matchDay.getDate())) {
            throw new InvalidActionException("The deadline must be before the start of the first game.");
        }

        if (playerIds != null && !playerIds.isEmpty()) {
            List<Player> players = playerService.getPlayersByIds(playerIds);
            matchDay.setAvailablePlayers(players);
        }

        matchDay.setStatus(MatchDayStatus.OPEN);
        matchDay.setActive(true);
        MatchDay saved = matchDayRepository.save(matchDay);

        notifyMatchDayUpdate(saved, "SAVE");
        auditLogService.logAction("CREATE_MATCHDAY", "MatchDay", saved.getId(), "Creata giornata");
        return saved;
    }

    @Transactional
    public void setAvailablePlayers(Long idMatchDay, List<Long> availablePlayersId) {
        MatchDay matchDay = matchDayRepository.findByIdAndActiveTrue(idMatchDay)
                .orElseThrow(() -> new ResourceNotFoundException("Match day not found"));

        if (matchDay.getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Impossibile modificare i convocati.");
        }

        List<Player> players = playerService.getPlayersByIds(availablePlayersId);
        matchDay.setAvailablePlayers(players);
        MatchDay saved = matchDayRepository.save(matchDay);
        notifyMatchDayUpdate(saved, "UPDATE");
    }

    @Transactional(readOnly = true)
    public MatchDay getMatchDayById(Long matchId) {
        return matchDayRepository.findByIdAndActiveTrue(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found"));
    }

    @Transactional(readOnly = true)
    public List<MatchDay> getAll() {
        return matchDayRepository.findAllByActiveTrue();
    }

    @Transactional
    public MatchDay updateMatchDay(Long id, MatchDay updatedData, List<Long> playerIds) {
        MatchDay existing = getMatchDayById(id);
        if (existing.getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("You can only edit days in OPEN status.");
        }

        existing.setDescription(updatedData.getDescription());
        existing.setDate(updatedData.getDate());
        existing.setDeadline(updatedData.getDeadline());

        if (playerIds != null) {
            List<Player> players = playerService.getPlayersByIds(playerIds);
            existing.setAvailablePlayers(players);
        }

        MatchDay saved = matchDayRepository.save(existing);
        notifyMatchDayUpdate(saved, "UPDATE");
        return saved;
    }

    @Transactional
    public void deleteMatchDay(Long id) {
        MatchDay existing = getMatchDayById(id);
        if (existing.getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("Cannot delete in progress.");
        }

        formationService.deleteAllFormations(formationService.getFormationsByIdMatchDay(id));
        betRepository.deleteAll(betRepository.findByMatchDayId(id));
        fantasyMatchRepository.deleteAll(fantasyMatchRepository.findByMatchDayId(id));
        voteService.deleteAllVotes(voteService.getVotesByMatchDay(id));

        existing.setActive(false);
        MatchDay saved = matchDayRepository.save(existing);

        notifyMatchDayUpdate(saved, "DELETE");
    }

    @Transactional(readOnly = true)
    public MatchDay getCurrentOpenMatchDay() {
        Optional<MatchDay> activeMatchDay = matchDayRepository.findFirstByStatusInAndActiveTrueOrderByDateAsc(
                List.of(MatchDayStatus.OPEN, MatchDayStatus.LIVE)
        );

        if (activeMatchDay.isPresent()) {
            return activeMatchDay.get();
        }

        return matchDayRepository.findFirstByStatusAndActiveTrueOrderByDateDesc(MatchDayStatus.CALCULATED)
                .orElseThrow(() -> new ResourceNotFoundException("No active days present"));
    }

    @Transactional
    public void rollbackMatchDay(Long idMatchDay) {
        MatchDay matchDay = matchDayRepository.findByIdAndActiveTrue(idMatchDay)
                .orElseThrow(() -> new ResourceNotFoundException("Match day not found"));

        if (matchDay.getStatus() == MatchDayStatus.OPEN) {
            throw new InvalidActionException("La giornata non è ancora iniziata.");
        }

        List<Match> matches = matchRepository.findAll().stream()
                .filter(m -> m.getMatchDay().getId().equals(idMatchDay))
                .toList();

        for (Match match : matches) {
            if (match.isStandingsUpdated()) {
                TournamentTeam homeTeam = match.getHomeTeam();
                TournamentTeam awayTeam = match.getAwayTeam();

                homeTeam.setGoalsScored(homeTeam.getGoalsScored() - match.getHomeScore());
                awayTeam.setGoalsScored(awayTeam.getGoalsScored() - match.getAwayScore());
                homeTeam.setGoalsConceded(homeTeam.getGoalsConceded() - match.getAwayScore());
                awayTeam.setGoalsConceded(awayTeam.getGoalsConceded() - match.getHomeScore());

                homeTeam.setGoalDifference(homeTeam.getGoalsScored() - homeTeam.getGoalsConceded());
                awayTeam.setGoalDifference(awayTeam.getGoalsScored() - awayTeam.getGoalsConceded());

                if (match.getHomeScore() > match.getAwayScore()) {
                    homeTeam.setPoints(homeTeam.getPoints() - 3);
                } else if (match.getHomeScore() == match.getAwayScore()) {
                    homeTeam.setPoints(homeTeam.getPoints() - 1);
                    awayTeam.setPoints(awayTeam.getPoints() - 1);
                } else {
                    awayTeam.setPoints(awayTeam.getPoints() - 3);
                }

                teamRepository.save(homeTeam);
                teamRepository.save(awayTeam);
                match.setStandingsUpdated(false);
            }

            if (match.getStatus() == MatchStatus.FINISHED) {
                match.setStatus(MatchStatus.LIVE);
                match.setEndTime(null);
                match.setActualDuration(null);
            }
            matchRepository.save(match);
        }

        matchDay.setStatus(MatchDayStatus.LIVE);
        MatchDay saved = matchDayRepository.save(matchDay);

        notifyMatchDayUpdate(saved, "UPDATE");

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/matches", (Object) Collections.singletonMap("action", "RELOAD"));
                    messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
                }
            });
        }
        auditLogService.logAction("ROLLBACK", "MatchDay", idMatchDay, "ESEGUITO ROLLBACK");
    }
}