package it.fantamaggiore.backend.tournament.dto;

import lombok.Data;

@Data
public class MatchRequestDTO {

    private Long matchDayId;
    private Long homeTeamId;
    private Long awayTeamId;

}
