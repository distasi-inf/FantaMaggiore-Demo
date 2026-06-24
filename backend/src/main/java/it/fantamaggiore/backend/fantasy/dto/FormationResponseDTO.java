package it.fantamaggiore.backend.fantasy.dto;

import lombok.Data;

import java.util.List;

@Data
public class FormationResponseDTO {

    private Long id;

    private Long userId;
    private Long matchDayId;
    private List<VoteResponseDTO> starterVotes;
    private VoteResponseDTO subVote;

    private Double totalScore;

    private List<Long> starterIds;
    private Long subId;

    private boolean carriedOver;

}
