package it.fantamaggiore.backend.fantasy.repository;

import it.fantamaggiore.backend.fantasy.model.FantasyMatch;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface FantasyMatchRepository extends JpaRepository<FantasyMatch, Long> {
    List<FantasyMatch> findByMatchDayId(Long matchDayId);
    List<FantasyMatch> findByIsCalculated(Boolean isCalculated);
    @Query("SELECT f FROM FantasyMatch f WHERE (f.user1.id = :userId OR f.user2.id = :userId) " +
            "AND f.isCalculated = true ORDER BY f.matchDay.date DESC")
    List<FantasyMatch> findLastMatchesByUserId(@Param("userId") Long userId, Pageable pageable);
    // AGGIUNGI QUESTA QUERY
    @Query("SELECT f FROM FantasyMatch f WHERE f.user1.id = :userId OR f.user2.id = :userId ORDER BY f.matchDay.date DESC")
    List<FantasyMatch> findMyMatchesHistory(@Param("userId") Long userId, Pageable pageable);
}
