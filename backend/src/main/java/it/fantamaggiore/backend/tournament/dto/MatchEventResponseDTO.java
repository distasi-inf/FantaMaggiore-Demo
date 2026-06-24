package it.fantamaggiore.backend.tournament.dto;

import it.fantamaggiore.backend.tournament.model.enums.EventType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class MatchEventResponseDTO {

    private Long id;

    private EventType type;

    private Long matchId;
    private Long playerId;
    private String playerName;

    private Long assistPlayerId;
    private String assistPlayerName;

    private Double value;

    private Integer matchMinute;
    private LocalDateTime timestamp;
}
