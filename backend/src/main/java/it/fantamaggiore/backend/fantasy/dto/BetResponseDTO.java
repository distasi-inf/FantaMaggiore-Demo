package it.fantamaggiore.backend.fantasy.dto;

import it.fantamaggiore.backend.fantasy.model.enums.BetStatus;
import lombok.Data;

@Data
public class BetResponseDTO {
    private Long id;
    private String description;
    private BetStatus status;
    private Long creatorId;
    private String creatorName;
    private Long matchDayId;

    private int participantCount;
    private int yesCount;
    private int noCount;

    private String userPrediction;

    // 🔥 FIX CRITICO: Aggiunto il campo mancante!
    private Boolean isCreator;
}