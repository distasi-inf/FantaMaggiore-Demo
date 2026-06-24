package it.fantamaggiore.backend.core.dto;

import it.fantamaggiore.backend.core.model.enums.Role;
import lombok.Data;

@Data
public class UserResponseDTO {

    private Long id;
    private String name;
    private String surname;
    private String username;
    private String fantasyTeamName;
    private String nationality;
    private String email;
    private Role role;
    private boolean locked;
    private int betPoints;

    private Long playerId;
}
