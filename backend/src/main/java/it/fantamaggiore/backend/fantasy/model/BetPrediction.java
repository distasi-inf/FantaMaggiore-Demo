package it.fantamaggiore.backend.fantasy.model;

import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.fantasy.model.Bet;
import it.fantamaggiore.backend.fantasy.model.enums.PredictionType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "bet_predictions", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"user_id", "bet_id"}) // Un utente scommette una sola volta per sfida
})
@Data
@NoArgsConstructor
public class BetPrediction {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "bet_id", nullable = false)
    private Bet bet;

    @Enumerated(EnumType.STRING)
    private PredictionType prediction; // YES o NO
}