package it.fantamaggiore.backend.tournament.service;

import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.service.PlayerService;
import it.fantamaggiore.backend.core.service.PlayerStatsService;
import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.fantasy.service.VoteService;
import it.fantamaggiore.backend.tournament.dto.MatchEventRequestDTO;
import it.fantamaggiore.backend.tournament.dto.MatchEventResponseDTO;
import it.fantamaggiore.backend.tournament.mapper.MatchEventMapper;
import it.fantamaggiore.backend.tournament.mapper.MatchMapper;
import it.fantamaggiore.backend.tournament.model.Match;
import it.fantamaggiore.backend.tournament.model.MatchEvent;
import it.fantamaggiore.backend.tournament.model.enums.EventType;
import it.fantamaggiore.backend.tournament.model.enums.MatchStatus;
import it.fantamaggiore.backend.tournament.repository.MatchEventRepository;
import it.fantamaggiore.backend.tournament.repository.MatchRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.cache.annotation.CacheEvict;
import it.fantamaggiore.backend.fantasy.service.FormationService;
import it.fantamaggiore.backend.fantasy.model.Formation;
import java.util.Collections;
import java.util.List;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class MatchEventService {

    @Autowired
    private MatchEventRepository eventRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private PlayerService playerService;

    @Autowired
    private FormationService formationService;

    @Autowired
    private PlayerStatsService playerStatsService;

    @Autowired
    private VoteService voteService;

    @Autowired
    private MatchEventMapper eventMapper;

    @Autowired
    private MatchMapper matchMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private void notifyAllMatchUpdates(Match match, String action) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("match", matchMapper.toDTO(match));

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new org.springframework.transaction.support.TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/live-score", matchMapper.toDTO(match));
                    messagingTemplate.convertAndSend("/topic/match/" + match.getId(), matchMapper.toDTO(match));
                    messagingTemplate.convertAndSend("/topic/live-votes",
                            (Object) Collections.singletonMap("message", "VOTES_UPDATED"));
                    messagingTemplate.convertAndSend("/topic/matches", (Object) payload);

                    // 🔥 PING WEBSOCKET: Avvisa i telefoni di ricaricare la classifica a salvataggio confermato!
                    messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/live-score", matchMapper.toDTO(match));
            messagingTemplate.convertAndSend("/topic/match/" + match.getId(), matchMapper.toDTO(match));
            messagingTemplate.convertAndSend("/topic/live-votes",
                    (Object) Collections.singletonMap("message", "VOTES_UPDATED"));
            messagingTemplate.convertAndSend("/topic/matches", (Object) payload);

            // Fallback in caso non ci sia una transazione attiva
            messagingTemplate.convertAndSend("/topic/rankings", (Object) Collections.singletonMap("action", "RELOAD"));
        }
    }

    @CacheEvict(value = "globalRanking", allEntries = true)
    @Transactional
    public MatchEventResponseDTO addEvent(Long matchId, MatchEventRequestDTO requestDTO) {
        Match match = matchRepository.findById(matchId)
                .orElseThrow(() -> new ResourceNotFoundException("Match not found with id: " + matchId));

        Player player = playerService.getPlayerById(requestDTO.getPlayerId());
        Player assistPlayer = null;
        if (requestDTO.getAssistPlayerId() != null) {
            assistPlayer = playerService.getPlayerById(requestDTO.getAssistPlayerId());
        }

        if (match.getStatus() != MatchStatus.LIVE) {
            throw new InvalidActionException("You can only add events to LIVE matches.");
        }

        // 🔥 CONTROLLO GIOCATORI E PORTIERI IN PRESTITO (GUEST GOALKEEPERS)
        boolean isHomePlayer = match.getHomeTeam().getPlayers().contains(player) ||
                (match.getHomeGuestGoalkeeper() != null && match.getHomeGuestGoalkeeper().getId().equals(player.getId()));

        boolean isAwayPlayer = match.getAwayTeam().getPlayers().contains(player) ||
                (match.getAwayGuestGoalkeeper() != null && match.getAwayGuestGoalkeeper().getId().equals(player.getId()));

        if (!isHomePlayer && !isAwayPlayer) {
            throw new InvalidActionException("The player is not part of this match.");
        }

        MatchEvent event = new MatchEvent();
        event.setMatch(match);
        event.setPlayer(player);
        event.setType(requestDTO.getType());
        event.setValue(requestDTO.getValue());
        event.setAssistPlayer(assistPlayer);

        Vote vote = voteService.getVoteByMatchDayIdAndPlayerId(
                player.getId(), match.getMatchDay().getId());

        if (event.getType() == EventType.GOAL) {
            if (isHomePlayer) match.setHomeScore(match.getHomeScore() + 1);
            else              match.setAwayScore(match.getAwayScore() + 1);

            vote.setGoals(vote.getGoals() + 1);
        } else if (event.getType() == EventType.OWNGOAL) {
            if (isHomePlayer) match.setAwayScore(match.getAwayScore() + 1);
            else              match.setHomeScore(match.getHomeScore() + 1);

            vote.setOwnGoals(vote.getOwnGoals() + 1);
        }

        vote.setBonus(vote.getBonus() + event.getValue());
        vote.updateFantaVote();
        voteService.saveVote(vote);

        if (assistPlayer != null) {
            Vote assistVote = voteService.getVoteByMatchDayIdAndPlayerId(
                    assistPlayer.getId(), match.getMatchDay().getId());
            assistVote.setBonus(assistVote.getBonus() + 1.0);
            assistVote.setAssists(assistVote.getAssists() + 1);
            assistVote.updateFantaVote();
            voteService.saveVote(assistVote);
        }

        MatchEvent savedEvent = eventRepository.save(event);

        playerStatsService.updateAllPlayerStats(player.getId());
        if (assistPlayer != null) {
            playerStatsService.updateAllPlayerStats(assistPlayer.getId());
        }

        // 🔥 RICALCOLO LIVE DELLE FORMAZIONI
        List<Formation> formations = formationService.getFormationsByIdMatchDay(match.getMatchDay().getId());
        if (formations != null) {
            formations.forEach(f -> formationService.updateFormationScore(f.getId()));
        }

        notifyAllMatchUpdates(match, "UPDATE");

        return eventMapper.toDTO(savedEvent);
    }

    @CacheEvict(value = "globalRanking", allEntries = true)
    @Transactional
    public void removeEvent(Long eventId) {
        MatchEvent event = eventRepository.findById(eventId)
                .orElseThrow(() -> new ResourceNotFoundException("Event not found with id: " + eventId));

        Match match = event.getMatch();
        Player player = event.getPlayer();

        if (match.getStatus() != MatchStatus.LIVE) {
            throw new InvalidActionException("You can only remove events from LIVE matches.");
        }

        // 🔥 CONTROLLO SQUADRA E PORTIERE IN PRESTITO PER RIMUOVERE CORRETTAMENTE IL GOL
        boolean isHomePlayer = match.getHomeTeam().getPlayers().contains(player) ||
                (match.getHomeGuestGoalkeeper() != null && match.getHomeGuestGoalkeeper().getId().equals(player.getId()));

        Vote vote = voteService.getVoteByMatchDayIdAndPlayerId(
                player.getId(), match.getMatchDay().getId());

        if (event.getType() == EventType.GOAL) {
            if (isHomePlayer) match.setHomeScore(match.getHomeScore() - 1);
            else              match.setAwayScore(match.getAwayScore() - 1);

            vote.setGoals(Math.max(0, vote.getGoals() - 1));
        } else if (event.getType() == EventType.OWNGOAL) {
            if (isHomePlayer) match.setAwayScore(match.getAwayScore() - 1);
            else              match.setHomeScore(match.getHomeScore() - 1);

            vote.setOwnGoals(Math.max(0, vote.getOwnGoals() - 1));
        }

        vote.setBonus(vote.getBonus() - event.getValue());
        vote.updateFantaVote();
        voteService.saveVote(vote);

        // Rimozione Assist (Se presente)
        if (event.getAssistPlayer() != null) {
            Vote assistVote = voteService.getVoteByMatchDayIdAndPlayerId(
                    event.getAssistPlayer().getId(), match.getMatchDay().getId());
            assistVote.setBonus(assistVote.getBonus() - 1.0);
            assistVote.setAssists(Math.max(0, assistVote.getAssists() - 1));
            assistVote.updateFantaVote();
            voteService.saveVote(assistVote);
        }

        matchRepository.save(match);
        eventRepository.delete(event);

        playerStatsService.updateAllPlayerStats(player.getId());
        if (event.getAssistPlayer() != null) {
            playerStatsService.updateAllPlayerStats(event.getAssistPlayer().getId());
        }

        // 🔥 RICALCOLO LIVE DELLE FORMAZIONI (Rimuove i punti tolti)
        List<Formation> formations = formationService.getFormationsByIdMatchDay(match.getMatchDay().getId());
        if (formations != null) {
            formations.forEach(f -> formationService.updateFormationScore(f.getId()));
        }

        notifyAllMatchUpdates(match, "UPDATE");
    }

    @Transactional(readOnly = true)
    public List<MatchEventResponseDTO> getMatchEvents(Long matchId) {
        return eventRepository.findByMatchId(matchId).stream()
                .map(eventMapper::toDTO)
                .toList();
    }
}