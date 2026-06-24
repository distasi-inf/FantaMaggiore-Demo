package it.fantamaggiore.backend.fantasy.dto;

import lombok.Data;

@Data
public class VoteResponseDTO {

    private Long id;

    private Long idMatchDay;
    private Long idPlayer;

    private Double baseVote;
    private Double bonus;
    private Double malus;
    private Double fantaVote;

    private Integer goals = 0;
    private Integer assists = 0;
    private Integer ownGoals = 0;
}
