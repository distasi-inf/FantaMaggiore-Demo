package it.fantamaggiore.backend.core.dto;

import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import lombok.Data;

@Data
public class PlayerResponseDTO {
    private Long id;
    private String name;
    private String surname;
    private String nickname;
    private String nationality;
    private String profileImg;

    private int totalGoal;
    private int totalAssist;
    private int totalOwnGoal;
    private int gamesPlayed;
    private double averageFantaVote;
    private boolean isActive;

    private PlayerRole role;

    private Long userId;
}
