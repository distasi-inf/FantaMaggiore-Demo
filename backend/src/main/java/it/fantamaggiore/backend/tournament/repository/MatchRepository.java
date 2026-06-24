package it.fantamaggiore.backend.tournament.repository;

import it.fantamaggiore.backend.tournament.model.Match;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MatchRepository extends JpaRepository<Match, Long> {
    boolean existsByHomeTeamIdOrAwayTeamId(Long homeTeamId, Long awayTeamId);
}
