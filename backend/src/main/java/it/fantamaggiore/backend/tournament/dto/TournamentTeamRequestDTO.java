package it.fantamaggiore.backend.tournament.dto;

import lombok.Data;

import java.util.List;

@Data
public class TournamentTeamRequestDTO {

    private Long idMatchDay;
    private Long idCaptain;
    private String teamName;

    private List<Long> playerIds;
}
