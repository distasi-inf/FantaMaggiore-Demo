package it.fantamaggiore.backend.core.repository;

import it.fantamaggiore.backend.core.model.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);

    // 🔥 FIX: Aggiunto filtro per escludere gli utenti bannati/eliminati (locked = true)
    @EntityGraph(attributePaths = {"formations"})
    @Query("SELECT u FROM User u WHERE u.locked = false OR u.locked IS NULL")
    List<User> findAllWithFormations();

    boolean existsByEmail(String email);
    boolean existsByFantasyTeamName(String fantasyTeamName);
    boolean existsByUsername(String username);

    // --- LA SUPER QUERY DEGLI UTENTI ---
    @Query(value = "SELECT * FROM users u WHERE " +
            "(:role IS NULL OR u.role = :role) AND " +
            "(:search IS NULL OR :search = '' OR " +
            "LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.surname) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(u.fantasy_team_name) LIKE LOWER(CONCAT('%', :search, '%'))) " +
            "ORDER BY CASE u.role WHEN 'SUPER_ADMIN' THEN 1 WHEN 'ADMIN' THEN 2 ELSE 3 END ASC, u.id DESC",
            countQuery = "SELECT count(*) FROM users u WHERE " +
                    "(:role IS NULL OR u.role = :role) AND " +
                    "(:search IS NULL OR :search = '' OR LOWER(u.name) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.surname) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.username) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.email) LIKE LOWER(CONCAT('%', :search, '%')) OR LOWER(u.fantasy_team_name) LIKE LOWER(CONCAT('%', :search, '%')))",
            nativeQuery = true)
    org.springframework.data.domain.Page<User> findUsersFilteredAndAdminFirst(
            @org.springframework.data.repository.query.Param("role") String role,
            @org.springframework.data.repository.query.Param("search") String search,
            org.springframework.data.domain.Pageable pageable);
}