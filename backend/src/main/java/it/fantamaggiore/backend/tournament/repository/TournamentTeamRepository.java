package it.fantamaggiore.backend.tournament.repository;

import it.fantamaggiore.backend.tournament.model.TournamentTeam;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TournamentTeamRepository extends JpaRepository<TournamentTeam, Long> {
    // Prende la squadra, i suoi giocatori e la sua giornata in 1 singola query
    @Override
    @EntityGraph(attributePaths = {"matchDay", "players"})
    List<TournamentTeam> findAll();

    // Fa la stessa cosa per la nostra nuova API di filtraggio
    @EntityGraph(attributePaths = {"matchDay", "players"})
    List<TournamentTeam> findByMatchDayId(Long matchDayId);
}
