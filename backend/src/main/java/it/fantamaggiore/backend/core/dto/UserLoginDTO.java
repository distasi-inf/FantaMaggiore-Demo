package it.fantamaggiore.backend.core.dto;

import lombok.Data;

@Data
public class UserLoginDTO {

    private String email;
    private String password;

}
