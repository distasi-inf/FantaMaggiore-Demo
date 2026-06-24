package it.fantamaggiore.backend.tournament.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class TournamentRankingDTO {
    private Long teamId;
    private String teamName;
    private int points;
    private int goalDifference;
    private int goalsScored;
    private int goalsConceded;
}
