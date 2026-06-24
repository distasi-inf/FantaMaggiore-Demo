package it.fantamaggiore.backend.core.service;

import it.fantamaggiore.backend.core.audit.service.AuditLogService;
import it.fantamaggiore.backend.core.dto.PlayerRequestDTO;
import it.fantamaggiore.backend.core.exceptions.InvalidActionException;
import it.fantamaggiore.backend.core.exceptions.ResourceNotFoundException;
import it.fantamaggiore.backend.core.mapper.PlayerMapper;
import it.fantamaggiore.backend.core.model.Player;
import it.fantamaggiore.backend.core.model.User;
import it.fantamaggiore.backend.core.model.enums.PlayerRole;
import it.fantamaggiore.backend.core.repository.PlayerRepository;
import it.fantamaggiore.backend.core.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * FIX GOD COMPONENT: PlayerService ora gestisce SOLO il CRUD dei giocatori
 * e le notifiche WebSocket.
 * La logica di calcolo statistiche è stata spostata in PlayerStatsService.
 */
@Service
public class PlayerService {

    @Autowired
    private PlayerRepository playerRepository;

    @Autowired
    private PlayerMapper playerMapper;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private AuditLogService auditLogService;

    // ---------------------------------------------------------------------------
    // WebSocket notification
    // ---------------------------------------------------------------------------

    private void notifyFrontend(Player player, String action) {
        Map<String, Object> payload = new HashMap<>();
        payload.put("action", action);
        payload.put("player", playerMapper.toDTO(player));

        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    messagingTemplate.convertAndSend("/topic/players", (Object) payload);
                }
            });
        } else {
            messagingTemplate.convertAndSend("/topic/players", (Object) payload);
        }
    }

    // ---------------------------------------------------------------------------
    // Validazione duplicati
    // ---------------------------------------------------------------------------

    private void checkDuplicatePlayer(String name, String surname, Long excludeId) {
        // FIX: era findAll().stream() che caricava tutta la tabella in memoria ad ogni controllo.
        // Ora la verifica avviene direttamente con una COUNT query sul DB.
        boolean exists = playerRepository.existsByNameAndSurnameIgnoreCase(name.trim(), surname.trim(), excludeId);
        if (exists) {
            throw new InvalidActionException(
                    "Errore: Un giocatore chiamato " + name.trim() + " " + surname.trim()
                            + " è già presente nel listone!");
        }
    }

    // ---------------------------------------------------------------------------
    // CRUD
    // ---------------------------------------------------------------------------

    @Transactional
    public void savePlayer(Player player) {
        checkDuplicatePlayer(player.getName(), player.getSurname(), null);
        playerRepository.save(player);
        notifyFrontend(player, "SAVE");
        auditLogService.logAction("CREATE_PLAYER", "Player", player.getId(), "Nuovo giocatore creato: " + player.getName() + " " + player.getSurname());
    }

    @Transactional
    public Player updatePlayer(Long id, PlayerRequestDTO dto) {
        Player player = getPlayerById(id);
        checkDuplicatePlayer(dto.getName(), dto.getSurname(), id);

        player.setName(dto.getName());
        player.setSurname(dto.getSurname());
        player.setNickname(dto.getNickname());
        player.setRole(dto.getRole());
        player.setNationality(dto.getNationality());
        player.setProfileImg(dto.getProfileImg());

        String assegnazioneMsg = "";
        if (dto.getUserId() != null) {
            User user = userRepository.findById(dto.getUserId())
                    .orElseThrow(() -> new ResourceNotFoundException("User not found"));
            player.setUser(user);
            assegnazioneMsg = " -> Assegnato a: " + user.getFantasyTeamName();
        } else {
            // Se prima aveva un utente e ora glielo tolgo
            if (player.getUser() != null) {
                assegnazioneMsg = " -> Rimosso dalla squadra: " + player.getUser().getFantasyTeamName();
            }
            player.setUser(null);
        }

        playerRepository.save(player);
        notifyFrontend(player, "UPDATE");

        // Log critico: Modifica giocatore e assegnazione manuale
        auditLogService.logAction(
                "UPDATE_PLAYER",
                "Player",
                id,
                "Modifica Listone: " + dto.getName() + " " + dto.getSurname() + assegnazioneMsg
        );

        return player;
    }

    @Transactional
    public void deletePlayer(long id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found with id: " + id));
        player.setActive(false);
        playerRepository.save(player);
        notifyFrontend(player, "DELETE");
        auditLogService.logAction("DELETE_PLAYER", "Player", id, "Giocatore spostato nel cestino.");
    }

    @Transactional
    public void restorePlayer(Long id) {
        Player player = playerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Giocatore non trovato."));
        player.setActive(true);
        playerRepository.save(player);
        notifyFrontend(player, "RESTORE");
        auditLogService.logAction("RESTORE_PLAYER", "Player", id, "Giocatore ripristinato dal cestino.");
    }

    // ---------------------------------------------------------------------------
    // Query
    // ---------------------------------------------------------------------------

    @Transactional(readOnly = true)
    public List<Player> getAllPlayers() {
        return playerRepository.findAllByActiveTrue();
    }

    @Transactional(readOnly = true)
    public Player getPlayerById(long id) {
        return playerRepository.findByIdAndActiveTrue(id)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Player not found or eliminated with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<Player> getPlayersByRole(PlayerRole role) {
        return playerRepository.findByRoleAndActiveTrue(role);
    }

    @Transactional(readOnly = true)
    public Page<Player> getPlayersPagedAndSearched(int page, int size, String search, String role, boolean active, String sortBy, String sortDir) {
        org.springframework.data.domain.Sort sort = sortDir.equalsIgnoreCase("DESC") ?
                org.springframework.data.domain.Sort.by(sortBy).descending() :
                org.springframework.data.domain.Sort.by(sortBy).ascending();
        Pageable pageable = PageRequest.of(page, size, sort);

        PlayerRole playerRole = null;
        if (role != null && !role.equalsIgnoreCase("TUTTI") && !role.isBlank()) {
            playerRole = PlayerRole.valueOf(role.toUpperCase());
        }

        return playerRepository.findPlayersFiltered(active, playerRole, search, pageable);
    }

    @Transactional
    public List<Player> getPlayersByIds(List<Long> ids) {
        List<Player> players = playerRepository.findAllByIdInAndActiveTrue(ids);
        return players.isEmpty() ? null : players;
    }

    @Transactional(readOnly = true)
    public List<Player> getDeletedPlayers() {
        return playerRepository.findAllByActiveFalse();
    }

    @Transactional(readOnly = true)
    public Player getPlayerByIdIncludingDeleted(long id) {
        return playerRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Player not found with id: " + id));
    }

    @Transactional(readOnly = true)
    public List<Player> getPlayersByIdsIncludingDeleted(List<Long> ids) {
        return playerRepository.findAllById(ids);
    }

    @Transactional(readOnly = true)
    public List<Player> getAllPlayersIncludingDeleted() {
        return playerRepository.findAll();
    }
}
