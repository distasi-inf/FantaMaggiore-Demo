package it.fantamaggiore.backend.core.controller;

import it.fantamaggiore.backend.core.dto.PlayerRequestDTO;
import it.fantamaggiore.backend.core.dto.PlayerResponseDTO;
import it.fantamaggiore.backend.core.mapper.PlayerMapper;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import it.fantamaggiore.backend.core.service.PlayerService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api/players")
public class PlayerController {

    @Autowired
    private PlayerService playerService;

    @Autowired
    private PlayerMapper playerMapper;

    @GetMapping
    public ResponseEntity<List<PlayerResponseDTO>> getAll(){
        List<Player> players = playerService.getAllPlayers();
        List<PlayerResponseDTO> playersDTO= players.stream()
                .map(playerMapper ::toDTO)
                .toList();
        return ResponseEntity.ok(playersDTO);
    }

    @GetMapping("/{id}")
    public ResponseEntity<PlayerResponseDTO> getPlayerById(@PathVariable Long id){
        return ResponseEntity.ok(playerMapper.toDTO(playerService.getPlayerById(id)));
    }

    @GetMapping("/role/{role}")
    public ResponseEntity<List<PlayerResponseDTO>> getPlayersByRole (@PathVariable PlayerRole role){
        List<Player> players = playerService.getPlayersByRole(role);
        List<PlayerResponseDTO> playersDTO= players.stream()
                .map(playerMapper :: toDTO)
                .toList();
        return ResponseEntity.ok(playersDTO);
    }

    @PostMapping
    public ResponseEntity<PlayerResponseDTO> createPlayer (@RequestBody PlayerRequestDTO playerDTO){
        Player player = playerMapper.toEntity(playerDTO);
        playerService.savePlayer(player);
        return ResponseEntity.ok(playerMapper.toDTO(player));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deletePlayer(@PathVariable Long id){
        playerService.deletePlayer(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}")
    public ResponseEntity<PlayerResponseDTO> updatePlayer(@PathVariable Long id, @RequestBody PlayerRequestDTO dto){
        Player player = playerService.updatePlayer(id, dto);
        return ResponseEntity.ok(playerMapper.toDTO(player));
    }

    @GetMapping("/paged")
    public ResponseEntity<Page<PlayerResponseDTO>> getPlayersPaged(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "TUTTI") String role,
            @RequestParam(defaultValue = "true") boolean active,
            @RequestParam(defaultValue = "surname") String sortBy,
            @RequestParam(defaultValue = "ASC") String sortDir) {

        // Passiamo tutti i filtri al service!
        Page<Player> playerPage = playerService.getPlayersPagedAndSearched(page, size, search, role, active, sortBy, sortDir);

        // Mappiamo in DTO
        Page<PlayerResponseDTO> responsePage = playerPage.map(playerMapper::toDTO);

        return ResponseEntity.ok(responsePage);
    }

    @GetMapping("/deleted")
    public ResponseEntity <List<PlayerResponseDTO>> getDeletedPlayers(){
        List<Player> players = playerService.getDeletedPlayers();
        List<PlayerResponseDTO> playersDTO= players.stream()
                .map(playerMapper :: toDTO)
                .toList();
        return ResponseEntity.ok(playersDTO);
    }

    @PutMapping("/{id}/restore")
    public ResponseEntity<Void> restorePlayer(@PathVariable Long id){
        playerService.restorePlayer(id);
        return ResponseEntity.ok().build();
    }

    // Restituisce tutti i giocatori (attivi + eliminati) per uso storico admin
    @GetMapping("/all-including-deleted")
    public ResponseEntity<List<PlayerResponseDTO>> getAllPlayersIncludingDeleted() {
        return ResponseEntity.ok(
                playerService.getAllPlayersIncludingDeleted().stream()
                        .map(playerMapper::toDTO)
                        .toList()
        );
    }
}
