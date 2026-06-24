package it.fantamaggiore.backend.fantasy.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class RankingDTO {
    private Long userId;
    private String fantasyTeamName;
    private String userName;
    private String userSurname;
    private Double totalPoints;
    private Double maxSingleMatchScore;
    private double betPoints;
    private Integer previousPosition;
}