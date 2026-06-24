package it.fantamaggiore.backend.core.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthResponseDTO {
    private String accessToken;   // Quello che scade in 24h
    private String refreshToken; //Quello che scade dopo un anno
    private UserResponseDTO user;
}