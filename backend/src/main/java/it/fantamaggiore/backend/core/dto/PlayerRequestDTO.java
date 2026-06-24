package it.fantamaggiore.backend.core.dto;

import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import lombok.Data;

@Data // DTO per creare il giocatore
public class PlayerRequestDTO {

    private String name;
    private String surname;
    private String nickname;
    private String nationality;
    private String profileImg;
    private PlayerRole role;
    private Long userId;

}
