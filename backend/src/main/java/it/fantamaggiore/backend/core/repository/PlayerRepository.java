package it.fantamaggiore.backend.core.repository;

import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PlayerRepository extends JpaRepository<Player, Long> {

    // Trova tutti gli attivi
    List<Player> findAllByActiveTrue();

    // Trova attivo per ID
    Optional<Player> findByIdAndActiveTrue(Long id);

    // Trova attivi per ruolo
    List<Player> findByRoleAndActiveTrue(PlayerRole role);

    // Paginazione senza ricerca, ma solo attivi
    Page<Player> findByActiveTrue(Pageable pageable);

    // Trova lista di attivi tramite una lista di ID
    List<Player> findAllByIdInAndActiveTrue(List<Long> ids);

    // FIX: query DB per check duplicati — evita il findAll().stream() che carica tutta la tabella in memoria
    @Query("SELECT COUNT(p) > 0 FROM Player p WHERE " +
           "LOWER(TRIM(p.name)) = LOWER(TRIM(:name)) AND " +
           "LOWER(TRIM(p.surname)) = LOWER(TRIM(:surname)) AND " +
           "(:excludeId IS NULL OR p.id <> :excludeId)")
    boolean existsByNameAndSurnameIgnoreCase(
            @Param("name") String name,
            @Param("surname") String surname,
            @Param("excludeId") Long excludeId
    );

    // Ricerca per nome/cognome solo tra i giocatori attivi
    @Query("SELECT p FROM Player p WHERE p.active = true AND (LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.surname) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Player> searchActivePlayers(@Param("search") String search, Pageable pageable);

    List<Player> findAllByActiveFalse();

    // NUOVO: paginazione su TUTTI i giocatori inclusi eliminati (per storico)
    @Query("SELECT p FROM Player p WHERE (LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(p.surname) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Player> searchAllPlayers(@Param("search") String search, Pageable pageable);

    // --- LA SUPER QUERY DEFINITIVA ---
    @Query("SELECT p FROM Player p WHERE p.active = :active " +
            "AND (:role IS NULL OR p.role = :role) " +
            "AND (:search IS NULL OR :search = '' OR " +
            "LOWER(p.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(p.surname) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<Player> findPlayersFiltered(
            @Param("active") boolean active,
            @Param("role") PlayerRole role,
            @Param("search") String search,
            Pageable pageable
    );
}