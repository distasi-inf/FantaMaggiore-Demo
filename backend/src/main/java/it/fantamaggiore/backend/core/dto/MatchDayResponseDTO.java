package it.fantamaggiore.backend.core.dto;

import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.enums.MatchDayStatus;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class MatchDayResponseDTO {

    private Long id;

    private String description;
    private LocalDateTime date;
    private LocalDateTime deadline;
    private MatchDayStatus status;

    private List<Long> availablePlayerIds = new ArrayList<>();

}
