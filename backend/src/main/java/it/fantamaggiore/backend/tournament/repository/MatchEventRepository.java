package it.fantamaggiore.backend.tournament.repository;

import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.tournament.model.MatchEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchEventRepository extends JpaRepository<MatchEvent, Long> {
    List<MatchEvent> findByPlayerId(Long playerId);
    List<MatchEvent> findByMatchId(Long matchId);
    List<MatchEvent> findByAssistPlayerId(Long assistPlayerId);
}
