package it.fantamaggiore.backend.core.mapper;

import it.fantamaggiore.backend.core.dto.PlayerRequestDTO;
import it.fantamaggiore.backend.core.dto.PlayerResponseDTO;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.repository.UserRepository;
import it.fantamaggiore.backend.core.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class PlayerMapper {

    @Autowired
    private UserRepository userRepository;

    public Player toEntity(PlayerRequestDTO playerDTO) {
        if (playerDTO == null) return null;

        Player player = new Player();
        player.setName(playerDTO.getName());
        player.setSurname(playerDTO.getSurname());
        player.setNickname(playerDTO.getNickname()); // AGGIUNTO
        player.setProfileImg(playerDTO.getProfileImg());
        player.setRole(playerDTO.getRole());
        player.setNationality(playerDTO.getNationality());
        if (playerDTO.getUserId() != null) {
            User user = userRepository.findById(playerDTO.getUserId()).orElseThrow(() -> new ResourceNotFoundException("User not found"));
            player.setUser(user);
        }
        // FIX: active deve essere esplicitamente true alla creazione
        player.setActive(true);

        return player;
    }

    public PlayerResponseDTO toDTO(Player player) {
        if (player == null) return null;

        PlayerResponseDTO playerDTO = new PlayerResponseDTO();
        playerDTO.setName(player.getName());
        playerDTO.setRole(player.getRole());
        playerDTO.setId(player.getId());
        playerDTO.setNationality(player.getNationality());
        playerDTO.setSurname(player.getSurname());
        playerDTO.setNickname(player.getNickname()); // AGGIUNTO
        playerDTO.setProfileImg(player.getProfileImg());
        playerDTO.setTotalAssist(player.getTotalAssist());
        playerDTO.setTotalOwnGoal(player.getTotalOwnGoal());
        playerDTO.setTotalGoal(player.getTotalGoal());
        playerDTO.setAverageFantaVote(player.getAverageFantaVote());
        playerDTO.setGamesPlayed(player.getGamesPlayed());
        playerDTO.setActive(player.isActive());

        if (player.getUser() != null) {
            playerDTO.setUserId(player.getUser().getId());
        }

        return playerDTO;
    }
}