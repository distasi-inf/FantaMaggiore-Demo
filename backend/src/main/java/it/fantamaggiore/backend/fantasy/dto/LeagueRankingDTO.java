package it.fantamaggiore.backend.fantasy.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class LeagueRankingDTO {

    private String fantasyTeamName;
    private String ownerName;

    private Integer points = 0;
    private Integer played = 0;
    private Integer won = 0;
    private Integer drawn = 0;
    private Integer lost = 0;

    private Integer goalsFor = 0;
    private Integer goalsAgainst = 0;
    private Double totalScoreSum = 0.0;

    public LeagueRankingDTO(String fantasyTeamName, String ownerName) {
        this.fantasyTeamName = fantasyTeamName;
        this.ownerName = ownerName;
    }

    public Integer getGoalDifference() {
        return this.goalsFor - this.goalsAgainst;
    }
}