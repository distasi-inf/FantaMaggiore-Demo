package it.fantamaggiore.backend.core.audit.repository;

import it.fantamaggiore.backend.core.audit.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    // Ricerca testuale e paginazione dei log
    @Query("SELECT a FROM AuditLog a WHERE " +
            "LOWER(a.adminUsername) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(a.action) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(a.entityName) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
            "LOWER(a.details) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<AuditLog> searchLogs(@Param("search") String search, Pageable pageable);
}