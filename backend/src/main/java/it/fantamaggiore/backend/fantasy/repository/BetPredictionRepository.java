package it.fantamaggiore.backend.fantasy.repository;

import it.fantamaggiore.backend.fantasy.model.BetPrediction;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BetPredictionRepository extends JpaRepository<BetPrediction, Long> {
    Optional<BetPrediction> findByBetIdAndUserId(Long betId, Long userId);
}