package it.fantamaggiore.backend.core.audit.model;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "audit_logs")
@Data
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String adminUsername; // Chi ha fatto l'azione

    @Column(nullable = false)
    private String action; // CREATE, UPDATE, DELETE, CALCULATE, ROLLBACK

    @Column(nullable = false)
    private String entityName; // Es: "Player", "MatchDay", "User"

    private Long entityId; // L'ID del giocatore/giornata modificata

    @Column(columnDefinition = "TEXT")
    private String details; // Un messaggio leggibile: "L'admin Marco ha calcolato la Giornata 1"

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @PrePersist
    protected void onCreate() {
        this.timestamp = LocalDateTime.now();
    }
}