package it.fantamaggiore.backend.tournament.model;

import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.tournament.model.enums.EventType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Duration;
import java.time.LocalDateTime;

@Entity
@Table(name = "match_events")
@Data
@NoArgsConstructor
public class MatchEvent {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private EventType type;

    private Double value; // +3 / +1 / -3
    private LocalDateTime timestamp;

    // Campo per salvare il risultato del calcolo (es. 12°)
    private Integer matchMinute;

    @ManyToOne
    @JoinColumn(name = "match_id", nullable = false)
    private Match match;

    @ManyToOne
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne
    @JoinColumn(name = "assist_player_id")
    private Player assistPlayer;

    public MatchEvent(EventType type, double value, LocalDateTime now, int matchMinute, Match match, Player player) {
        this.type = type;
        this.value = value;
        this.timestamp = now;
        this.matchMinute = matchMinute;
        this.match = match;
        this.player = player;
    }
}
