package it.fantamaggiore.backend.tournament.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.ArrayList;

@Entity
@Table(name = "tournament_teams", uniqueConstraints = {
        @UniqueConstraint(columnNames = "name")
})
@Data
@NoArgsConstructor
public class TournamentTeam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String teamName;

    private int points = 0;
    private int goalsScored = 0;
    private int goalsConceded = 0;
    private int goalDifference = 0;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "match_day_id", nullable = false)
    private MatchDay matchDay;

    // FIX: era @OneToOne, che impediva lo stesso giocatore di essere
    // capitano in squadre diverse (giornate diverse). Ora è @ManyToOne.
    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "captain_id")
    private Player captain;

    @JsonIgnore
    @ManyToMany
    @JoinTable(
            name = "tournament_team_players",
            joinColumns = @JoinColumn(name = "tournament_team_id"),
            inverseJoinColumns = @JoinColumn(name = "player_id")
    )
    private List<Player> players = new ArrayList<>();
}