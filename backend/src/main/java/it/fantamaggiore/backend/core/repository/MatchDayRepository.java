package it.fantamaggiore.backend.core.repository;

import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MatchDayRepository extends JpaRepository<MatchDay, Long> {

    // Trova la prima giornata ATTIVA con un determinato stato
    Optional<MatchDay> findFirstByStatusAndActiveTrueOrderByDateAsc(MatchDayStatus status);

    // Trova la prima giornata ATTIVA che corrisponde a una lista di stati (es. OPEN o LIVE)
    Optional<MatchDay> findFirstByStatusInAndActiveTrueOrderByDateAsc(List<MatchDayStatus> statuses);

    // Trova l'ultima giornata calcolata ATTIVA (ordinata per data decrescente)
    Optional<MatchDay> findFirstByStatusAndActiveTrueOrderByDateDesc(MatchDayStatus status);

    // Trova una singola giornata attiva
    Optional<MatchDay> findByIdAndActiveTrue(Long id);

    // Sostituisce la vecchia findAll per caricare i giocatori solo delle giornate attive
    @EntityGraph(attributePaths = {"availablePlayers"})
    List<MatchDay> findAllByActiveTrue();

    Optional<MatchDay> findFirstByDateLessThanAndActiveTrueOrderByDateDesc(java.time.LocalDateTime date);
}