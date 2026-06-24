package it.fantamaggiore.backend.core.dto;


import it.fantamaggiore.backend.core.model.Player;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
public class MatchDayRequestDTO {
    private String description;
    private LocalDateTime date;
    private LocalDateTime deadline;
    private List<Long> playerIds = new ArrayList<>();
}
