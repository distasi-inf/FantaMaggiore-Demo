package it.fantamaggiore.backend.tournament.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import it.fantamaggiore.backend.core.service.MatchDayService;
import it.fantamaggiore.backend.core.service.PlayerService;
import it.fantamaggiore.backend.tournament.dto.TournamentRankingDTO;
import it.fantamaggiore.backend.tournament.dto.TournamentTeamRequestDTO;
import it.fantamaggiore.backend.tournament.dto.TournamentTeamResponseDTO;
import it.fantamaggiore.backend.tournament.mapper.TournamentTeamMapper;
import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import it.fantamaggiore.backend.tournament.repository.MatchRepository;
import it.fantamaggiore.backend.tournament.repository.TournamentTeamRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class TournamentTeamService {

    @Autowired
    private TournamentTeamRepository teamRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private MatchDayService matchDayService;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private TournamentTeamMapper tournamentTeamMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private void notifyTeamUpdate(TournamentTeam team, String action) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("team", tournamentTeamMapper.toDTO(team));

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/teams", (Object) payload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/teams", (Object) payload);
        }
    }

    @Transactional
    public TournamentTeam createTeam(TournamentTeam team, Long matchDayId, List<Long> playerIds, Long captainId) {
        MatchDay matchDay = matchDayService.getMatchDayById(matchDayId);
        List<Player> players = playerService.getPlayersByIds(playerIds);

        if (captainId != null) {
            Player captain = playerService.getPlayerById(captainId);
            team.setCaptain(captain);
        }

        team.setMatchDay(matchDay);
        team.setPlayers(players);

        TournamentTeam savedTeam = teamRepository.save(team);
        notifyTeamUpdate(savedTeam, "SAVE");
        return savedTeam;
    }

    @Transactional
    public TournamentTeam updateTeam(Long id, TournamentTeamRequestDTO requestDTO) {
        TournamentTeam team = teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        if (team.getMatchDay().getStatus() != MatchDayStatus.OPEN) {
            throw new InvalidActionException("You can only change the team when the matchday is in OPEN status.");
        }

        team.setTeamName(requestDTO.getTeamName());
        team.setPlayers(playerService.getPlayersByIds(requestDTO.getPlayerIds()));

        if (requestDTO.getIdCaptain() != null) {
            team.setCaptain(playerService.getPlayerById(requestDTO.getIdCaptain()));
        } else {
            team.setCaptain(null);
        }

        TournamentTeam savedTeam = teamRepository.save(team);
        notifyTeamUpdate(savedTeam, "UPDATE");
        return savedTeam;
    }

    @Transactional
    public void deleteTeam(Long id) {
        TournamentTeam team = teamRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Team not found"));

        boolean isTeamInMatch = matchRepository.existsByHomeTeamIdOrAwayTeamId(id, id);
        if (isTeamInMatch) {
            throw new InvalidActionException("Cannot delete team: it is already scheduled for one or more matches.");
        }

        // Eliminiamo la squadra
        teamRepository.delete(team);

        // Passiamo l'entità 'team' VERA al WebSocket!
        notifyTeamUpdate(team, "DELETE");
    }

    @Transactional(readOnly = true)
    public List<TournamentTeamResponseDTO> getTeamsByMatchDay(Long matchDayId) {
        return teamRepository.findByMatchDayId(matchDayId).stream()
                .map(tournamentTeamMapper::toDTO)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TournamentRankingDTO> getTournamentRankingByMatchDay(Long matchDayId) {
        // Filtriamo le squadre: prendiamo solo quelle associate alla giornata specifica
        List<TournamentTeam> teams = teamRepository.findByMatchDayId(matchDayId);
        List<TournamentRankingDTO> teamsDTO = new ArrayList<>();

        for (TournamentTeam team : teams) {
            teamsDTO.add(new TournamentRankingDTO(
                    team.getId(), team.getTeamName(), team.getPoints(),
                    team.getGoalDifference(), team.getGoalsScored(), team.getGoalsConceded()));
        }

        // Applichiamo lo stesso criterio di ordinamento della classifica generale
        teamsDTO.sort(Comparator.comparing(TournamentRankingDTO::getPoints).reversed()
                .thenComparing(Comparator.comparing(TournamentRankingDTO::getGoalDifference).reversed())
                .thenComparing(Comparator.comparing(TournamentRankingDTO::getGoalsScored).reversed())
                .thenComparing(TournamentRankingDTO::getTeamName));

        return teamsDTO;
    }

    @Transactional(readOnly = true)
    public List<TournamentRankingDTO> getTournamentRanking() {
        List<TournamentTeam> teams = teamRepository.findAll();
        List<TournamentRankingDTO> teamsDTO = new ArrayList<>();

        for (TournamentTeam team : teams) {
            teamsDTO.add(new TournamentRankingDTO(
                    team.getId(), team.getTeamName(), team.getPoints(),
                    team.getGoalDifference(), team.getGoalsScored(), team.getGoalsConceded()));
        }

        teamsDTO.sort(Comparator.comparing(TournamentRankingDTO::getPoints).reversed()
                .thenComparing(Comparator.comparing(TournamentRankingDTO::getGoalDifference).reversed())
                .thenComparing(Comparator.comparing(TournamentRankingDTO::getGoalsScored).reversed())
                .thenComparing(TournamentRankingDTO::getTeamName));

        return teamsDTO;
    }
}