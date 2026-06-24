package it.fantamaggiore.backend.core.dto;

import lombok.Data;

@Data
public class UserUpdateDTO {
    private String name;
    private String surname;
    private String username;
    private String nationality;
    private String fantasyTeamName;
    private String email;
    private String role;
}