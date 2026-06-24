package it.fantamaggiore.backend.core.mapper;

import it.fantamaggiore.backend.core.dto.UserRegistrationDTO;
import it.fantamaggiore.backend.core.dto.UserResponseDTO;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.Role;
import org.springframework.stereotype.Component;

@Component // Questa annotazione dice a Spring di creare questo traduttore e tenerlo pronto
public class UserMapper {

    // 1. Da DTO a Entity (Quando l'utente si registra)
    public User toEntity(UserRegistrationDTO dto) {
        if (dto == null) return null;

        User user = new User();
        user.setName(dto.getName());
        user.setSurname(dto.getSurname());
        user.setUsername(dto.getUsername());
        user.setNationality(dto.getNationality());
        user.setEmail(dto.getEmail());
        user.setFantasyTeamName(dto.getFantasyTeamName());
        user.setPassword(dto.getPassword());
        user.setRole(Role.USER);

        return user;
    }

    public UserResponseDTO toDTO (User user){
        if (user == null) return null;

        UserResponseDTO userDTO = new UserResponseDTO();
        userDTO.setId(user.getId());
        userDTO.setName(user.getName());
        userDTO.setSurname(user.getSurname());
        userDTO.setUsername(user.getUsername());
        userDTO.setNationality(user.getNationality());
        userDTO.setEmail(user.getEmail());
        userDTO.setRole(user.getRole());
        userDTO.setLocked(user.isLocked());
        userDTO.setFantasyTeamName(user.getFantasyTeamName());
        userDTO.setBetPoints(user.getBetPoints());
        if (user.getPlayer() != null) {
            userDTO.setPlayerId(user.getPlayer().getId());
        }

        return userDTO;

    }


}
