package it.fantamaggiore.backend.tournament.dto;

import it.fantamaggiore.backend.tournament.model.enums.EventType;
import lombok.Data;

@Data
public class MatchEventRequestDTO {

    private EventType type;
    private Long matchId;
    private Long playerId;
    private Double value;
    private Long assistPlayerId;

}
