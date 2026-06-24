package it.fantamaggiore.backend.fantasy.model;

import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.User;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "fantasy_matches")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class FantasyMatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // La giornata in cui avviene questo scontro (es. Giornata 1)
    @ManyToOne
    @JoinColumn(name = "matchday_id", nullable = false)
    private MatchDay matchDay;

    // Il primo sfidante
    @ManyToOne
    @JoinColumn(name = "user1_id", nullable = false)
    private User user1;

    // Il secondo sfidante
    @ManyToOne
    @JoinColumn(name = "user2_id", nullable = false)
    private User user2;

    // Punteggi decimali esatti calcolati a fine giornata (es. 72.5)
    private Double scoreUser1 = 0.0;
    private Double scoreUser2 = 0.0;

    // Gol calcolati in base alle fasce (es. 2 gol a 1)
    private Integer goalsUser1 = 0;
    private Integer goalsUser2 = 0;

    // Flag per capire se questa partita è già stata calcolata o se è ancora da giocare
    private boolean isCalculated = false;

    // Un costruttore comodo che ci servirà per generare il calendario velocemente
    public FantasyMatch(MatchDay matchDay, User user1, User user2) {
        this.matchDay = matchDay;
        this.user1 = user1;
        this.user2 = user2;
    }

    public void setCalculatedTrue(){
        this.isCalculated = true;
    }
}
