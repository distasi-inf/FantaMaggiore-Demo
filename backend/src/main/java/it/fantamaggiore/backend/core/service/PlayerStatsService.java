package it.fantamaggiore.backend.core.service;

import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.mapper.PlayerMapper;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.repository.PlayerRepository;
import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.fantasy.repository.VoteRepository;
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

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class PlayerStatsService {

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private MatchEventRepository matchEventRepository;

    @Autowired
    private VoteRepository voteRepository;

    @Autowired
    private MatchRepository matchRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private PlayerMapper playerMapper;

    // --- NUOVO METODO PER IL WEBSOCKET ---
    private void notifyFrontend(Player player, String action) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("player", playerMapper.toDTO(player));

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/players", (Object) payload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/players", (Object) payload);
        }
    }

    @Transactional
    public void updateTotalGoalsAndAssists(Long playerId) {
        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found"));

        // 1. Troviamo tutte le volte in cui è l'ATTORE PRINCIPALE (Gol o Autogol)
        List<MatchEvent> eventsAsMain = matchEventRepository.findByPlayerId(playerId);
        long goals = eventsAsMain.stream().filter(e -> e.getType() == EventType.GOAL).count();
        long ownGoals = eventsAsMain.stream().filter(e -> e.getType() == EventType.OWNGOAL).count();

        // 2. Troviamo tutte le volte in cui è l'ASSISTMAN
        List<MatchEvent> eventsAsAssist = matchEventRepository.findByAssistPlayerId(playerId);
        long assists = eventsAsAssist.size(); // Se sei l'assistPlayer in un evento, hai fatto un assist!

        player.setTotalGoal((int) goals);
        player.setTotalAssist((int) assists);
        player.setTotalOwnGoal((int) ownGoals);

        playerRepository.save(player);
    }

    @Transactional
    public void updateAverageFantaVote(Long playerId) {
        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found"));
        List<Vote> votes = voteRepository.findByPlayerId(playerId);

        // Filtriamo: consideriamo solo i voti in cui il giocatore ha effettivamente giocato (es. voto base > 0)
        List<Vote> validVotes = votes.stream()
                .filter(v -> v.getBaseVote() != null && v.getBaseVote() > 0)
                .toList();

        if (!validVotes.isEmpty()) {
            double sum = validVotes.stream().mapToDouble(Vote::getFantaVote).sum();
            player.setAverageFantaVote(sum / validVotes.size());
        } else {
            player.setAverageFantaVote(0.0);
        }
        playerRepository.save(player);
    }

    @Transactional
    public void updateGamesPlayed(Long playerId) {
        Player player = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found with id: " + playerId));

        long count = matchRepository.findAll().stream()
                .filter(m -> m.getStatus() == MatchStatus.FINISHED)
                .filter(m -> m.getHomeTeam().getPlayers().contains(player)
                        || m.getAwayTeam().getPlayers().contains(player))
                .count();

        player.setGamesPlayed((int) count);
        playerRepository.save(player);
    }

    /**
     * Aggiorna tutte e tre le statistiche in sequenza per un giocatore.
     * Chiamato da MatchEventService dopo ogni evento di partita.
     */
    @Transactional
    public void updateAllPlayerStats(Long playerId) {
        updateTotalGoalsAndAssists(playerId);
        updateAverageFantaVote(playerId);
        updateGamesPlayed(playerId);

        // RECUPERIAMO IL GIOCATORE CON TUTTE LE STATISTICHE SALVATE E AVVISIAMO IL FRONTEND!
        Player updatedPlayer = playerRepository.findById(playerId)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found with id: " + playerId));
        notifyFrontend(updatedPlayer, "UPDATE");
    }
}