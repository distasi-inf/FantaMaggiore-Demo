package it.fantamaggiore.backend.fantasy.repository;

import it.fantamaggiore.backend.fantasy.model.Formation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;


public interface FormationRepository extends JpaRepository<Formation, Long> {
    List<Formation> findByMatchDayId(Long matchId);
    Optional<Formation> findByUserIdAndMatchDayId(Long userId, Long matchDayId);
    List<Formation> getFormationByUserId(Long userId);
    boolean existsByUserIdAndMatchDayId(Long userId, Long matchDayId);
}
