package it.fantamaggiore.backend.tournament.dto;

import lombok.Data;

@Data
public class GuestGoalkeepersRequestDTO {
    private Long homeGuestId;
    private Long awayGuestId;
}