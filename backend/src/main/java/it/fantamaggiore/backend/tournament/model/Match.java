package it.fantamaggiore.backend.tournament.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import it.fantamaggiore.backend.core.model.MatchDay;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.tournament.model.enums.MatchStatus;
import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "matches")
@Data
@NoArgsConstructor
public class Match {

    private boolean standingsUpdated = false;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private int homeScore = 0;
    private int awayScore = 0;

    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer actualDuration; // Durata effettiva in minuti
    private Integer expectedDuration;

    @Enumerated(EnumType.STRING)
    private MatchStatus status = MatchStatus.PRE;

    //Molti match appartengono a una sola giornata
    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "match_day_id", nullable = false)
    private MatchDay matchDay;

    @ManyToOne
    @JoinColumn(name = "home_team_id", nullable = false)
    private TournamentTeam homeTeam;

    @ManyToOne
    @JoinColumn(name = "away_team_id", nullable = false)
    private TournamentTeam awayTeam;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "home_guest_goalkeeper_id")
    private Player homeGuestGoalkeeper;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "away_guest_goalkeeper_id")
    private Player awayGuestGoalkeeper;

    public void incrementScore(boolean isHomeTeam) {
        if (isHomeTeam) {
            this.homeScore++;
        } else {
            this.awayScore++;
        }
    }
}