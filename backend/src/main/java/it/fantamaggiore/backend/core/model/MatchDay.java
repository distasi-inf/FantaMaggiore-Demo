package it.fantamaggiore.backend.core.model;

import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "matchdays", uniqueConstraints = {
        @UniqueConstraint(columnNames = "number") // Impedisce di creare due giornate con lo stesso numero
})
@Data
@NoArgsConstructor
@AllArgsConstructor
public class MatchDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String description;
    private LocalDateTime date;
    private LocalDateTime deadline;

    @Enumerated(EnumType.STRING)
    private MatchDayStatus status = MatchDayStatus.OPEN;

    // 🔥 NUOVO CAMPO PER IL SOFT DELETE 🔥
    @Column(nullable = false, columnDefinition = "boolean default true")
    private boolean active = true;

    // TABELLA DI GIUNZIONE PER I CONVOCATI
    @ManyToMany
    @JoinTable(
            name = "matchday_convocati",
            joinColumns = @JoinColumn(name = "matchday_id"),
            inverseJoinColumns = @JoinColumn(name = "player_id")
    )
    private List<Player> availablePlayers = new ArrayList<>();

    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.deadline);
    }
}