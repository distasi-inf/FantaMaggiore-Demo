package it.fantamaggiore.backend.fantasy.dto;

import lombok.Data;

import java.util.List;

@Data
public class FormationRequestDTO {

    private Long matchDayId;

    private List<Long> starterIds;

    private Long subId;
}
