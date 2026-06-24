package it.fantamaggiore.backend.fantasy.repository;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.fantasy.model.Bet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface BetRepository extends JpaRepository<Bet, Long> {
    List<Bet> findByMatchDayId(Long matchDayId);

    // 🔥 FIX: Query personalizzata che cerca tra le "predictions" invece che nei "participants"
    @Query("SELECT DISTINCT b FROM Bet b LEFT JOIN b.predictions p WHERE b.creator = :user OR p.user = :user")
    List<Bet> findByCreatorOrUserHasPredicted(@Param("user") User user);
}