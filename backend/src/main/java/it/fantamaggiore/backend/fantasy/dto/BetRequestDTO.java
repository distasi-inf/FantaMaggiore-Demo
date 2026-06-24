package it.fantamaggiore.backend.fantasy.dto;

import lombok.Data;

@Data
public class BetRequestDTO {

    private String description;
    private Long matchDayId;

}
