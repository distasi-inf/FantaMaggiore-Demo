package it.fantamaggiore.backend.fantasy.repository;

import it.fantamaggiore.backend.fantasy.model.Vote;
import it.fantamaggiore.backend.tournament.model.MatchEvent;
import org.springframework.data.jpa.repository.JpaRepository;

import javax.swing.text.html.Option;
import java.util.List;
import java.util.Optional;

public interface VoteRepository extends JpaRepository<Vote, Long> {
    Optional<Vote> findByPlayerIdAndMatchDayId(Long playerId, Long matchDayId);
    List<Vote> findByPlayerId(Long playerId);
    List<Vote> findByMatchDayId(Long matchDayId);
}
