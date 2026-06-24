package it.fantamaggiore.backend.fantasy.model;

import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Entity
@Table(name = "formations", uniqueConstraints = {
        // Unisce due colonne: L'utente X nella Giornata Y può avere un solo record!
        @UniqueConstraint(columnNames = {"user_id", "matchday_id"})
})
@Data
@NoArgsConstructor
public class Formation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double totalScore;

    @ManyToOne
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne
    @JoinColumn(name = "matchday_id", nullable = false)
    private MatchDay matchDay;

    @ManyToMany
    @JoinTable(name = "formation_players")
    private List<Player> starters;

    // Panchinaro
    @ManyToOne
    @JoinColumn(name = "sub_id")
    private Player substitutePlayer;

    @Column(name = "carried_over")
    private boolean carriedOver = false;

    public Formation(User user, MatchDay matchDay, List<Player> players, Player substitutePlayer) {
        this.user = user;
        this.matchDay = matchDay;
        this.starters = players;
        this.substitutePlayer = substitutePlayer;
        this.totalScore = 0.0;
    }

    public Formation(User user, MatchDay matchDay, List<Player> players, Player substitutePlayer, boolean carriedOver) {
        this.user = user;
        this.matchDay = matchDay;
        this.starters = players;
        this.substitutePlayer = substitutePlayer;
        this.totalScore = 0.0;
        this.carriedOver = carriedOver;
    }


}
