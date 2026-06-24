package it.fantamaggiore.backend.core.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class UserRegistrationDTO {

    @NotBlank(message = "The name is mandatory")
    private String name;

    @NotBlank(message = "The surname is mandatory")
    private String surname;

    @NotBlank(message = "The username is mandatory")
    private String username;

    private String nationality;

    @NotBlank(message = "The fantasy team name is mandatory")
    private String fantasyTeamName;

    @NotBlank(message = "The email is mandatory")
    @Email(message = "Invalid email format")
    private String email;

    @NotBlank(message = "The password is mandatory")
    @Size(min = 6, message = "Password must be at least 6 characters long")
    private String password;
}