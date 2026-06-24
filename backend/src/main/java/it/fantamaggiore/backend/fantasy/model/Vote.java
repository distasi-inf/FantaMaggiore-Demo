package it.fantamaggiore.backend.fantasy.model;

import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "votes", uniqueConstraints = {
        // Unisce due colonne: Il Giocatore X nella Giornata Y può avere un solo record!
        @UniqueConstraint(columnNames = {"player_id", "matchday_id"})
})
@Data
@NoArgsConstructor
public class Vote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Double baseVote;
    private Double bonus;
    private Double malus;
    private Double fantaVote;

    @ManyToOne
    @JoinColumn(name = "player_id", nullable = false)
    private Player player;

    @ManyToOne
    @JoinColumn(name = "match_day_id", nullable = false)
    private MatchDay matchDay;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private Integer goals = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private Integer assists = 0;

    @Column(nullable = false, columnDefinition = "integer default 0")
    private Integer ownGoals = 0;

    public Vote(Player player, MatchDay matchDay) {
        this.player = player;
        this.matchDay = matchDay;
        this.baseVote = 6.0;
        this.bonus = 0.0;
        this.malus = 0.0;
        this.fantaVote = 6.0;
    }

    public void updateFantaVote() {
        this.fantaVote = this.baseVote + this.bonus - this.malus;
    }

}
