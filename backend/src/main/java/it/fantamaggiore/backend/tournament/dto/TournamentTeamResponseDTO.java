package it.fantamaggiore.backend.tournament.dto;

import lombok.Data;

import java.util.List;

@Data
public class TournamentTeamResponseDTO {

    private Long id;

    private String teamName;

    private int points;
    private int goalsScored;
    private int goalsConceded;
    private int goalDifference;

    private Long idCaptain;
    private Long idMatchDay;

    private List<Long> playerIds;
}
