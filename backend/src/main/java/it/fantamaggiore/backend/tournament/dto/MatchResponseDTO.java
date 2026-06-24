package it.fantamaggiore.backend.tournament.dto;

import it.fantamaggiore.backend.tournament.model.enums.MatchStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class MatchResponseDTO {

    private Long id;

    private Long homeTeamId;
    private Long awayTeamId;

    // AGGIUNTO: nomi delle squadre per il frontend
    private String homeTeamName;
    private String awayTeamName;

    private Long matchDayId;
    private MatchStatus matchStatus;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Integer expectedDuration;
    private Integer actualDuration;

    private int homeScore;
    private int awayScore;

    private Long homeGuestGoalkeeperId;
    private Long awayGuestGoalkeeperId;
    private String homeGuestGoalkeeperName;
    private String awayGuestGoalkeeperName;

}